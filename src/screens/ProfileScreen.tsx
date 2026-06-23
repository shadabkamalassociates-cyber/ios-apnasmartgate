import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
  Image,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme, type ThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { loadResidentProfile, resolveResidenceInBackground } from '../lib/residentProfile';
import type { RootStackParamList } from '../navigation/types';
import type { ProfileStackParamList } from '../navigation/types';
import { useDispatch } from 'react-redux';
import { setAuthUser } from '../store/authSlice';
import * as residentApi from '../api/resident';
import * as bookingVendorsApi from '../api/bookingVendors';
import { useLocalProfileAvatar } from '../hooks/useLocalProfileAvatar';
import { clearLocalProfileAvatar, setLocalProfileAvatar } from '../lib/localProfileAvatar';
import { resolveProfileImageUrl } from '../lib/profileImageUrl';
import * as societyApi from '../api/society';
import * as blockApi from '../api/block';
import * as flatApi from '../api/flat';
import * as essentialContactsApi from '../api/essentialContacts';
import { sendSignupOtp, verifySignupOtp } from '../api/auth';

const appVersion = require('../../package.json').version as string;

function messageFromApiError(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: unknown } })?.response;
  const data = response?.data as Record<string, unknown> | string | undefined | null;
  if (data == null) {
    return 'Something went wrong';
  }
  if (typeof data === 'string') return data || 'Something went wrong';
  const direct =
    (data.message as string | undefined) ??
    (data.error as string | undefined) ??
    (data.title as string | undefined) ??
    (data.detail as string | undefined) ??
    (data.msg as string | undefined);
  if (typeof direct === 'string' && direct.trim()) return direct;
  try {
    return JSON.stringify(data);
  } catch {
    return 'Something went wrong';
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Accent tints for profile quick actions (complements cosmic orange theme). */
const PROFILE_ACTION = {
  maidsIconBg: 'rgba(232, 93, 4, 0.2)',
  essentials: '#0D9488',
  essentialsIconBg: 'rgba(13, 148, 136, 0.18)',
  bookings: '#6366F1',
  bookingsIconBg: 'rgba(99, 102, 241, 0.18)',
  chats: '#2563EB',
  chatsIconBg: 'rgba(37, 99, 235, 0.18)',
} as const;

function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const dispatch = useDispatch();
  const { width: windowWidth } = useWindowDimensions();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profileNavigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const route = useRoute<any>();
  const { localAvatarDataUrl, reloadLocalAvatar } = useLocalProfileAvatar(user?.id);
  /** `undefined` = leave as-is; `null` = remove on server; object = new local file to upload */
  const [avatarDraft, setAvatarDraft] = useState<
    undefined | null | { uri: string; type?: string; name?: string }
  >(undefined);

  const [avatarCacheBuster, setAvatarCacheBuster] = useState(() => Date.now());
  const serverAvatarUri = useMemo(
    () => resolveProfileImageUrl(user?.profile_image ?? undefined, avatarCacheBuster),
    [user?.profile_image, avatarCacheBuster]
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [hashOtp, setHashOtp] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [societyName, setSocietyName] = useState<string | null>(null);
  const [flatNumber, setFlatNumber] = useState<string | null>(null);
  const [residenceLoading, setResidenceLoading] = useState(false);
  const [essentialContactsVisible, setEssentialContactsVisible] = useState(false);
  const [essentialContactsLoading, setEssentialContactsLoading] = useState(false);
  const [essentialContacts, setEssentialContacts] = useState<
    essentialContactsApi.EssentialContact[]
  >([]);

  const [bookingsVisible, setBookingsVisible] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookings, setBookings] = useState<bookingVendorsApi.ResidentBooking[]>([]);
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const societyId = user?.society_id;
    const flatId = user?.flat_id;

    const loadResidenceDetails = async () => {
      if (societyId == null && flatId == null) {
        if (!cancelled) {
          setSocietyName(null);
          setFlatNumber(null);
        }
        return;
      }

      if (!cancelled) {
        setResidenceLoading(true);
        setSocietyName(null);
        setFlatNumber(null);
      }

      try {
        if (societyId != null) {
          const res = await societyApi.fetchAllSocieties();
          const list = (res?.data ?? []) as societyApi.Society[];
          const match = list.find((s) => String(s.id) === String(societyId));
          if (!cancelled) setSocietyName(match?.name ?? null);
        }

        if (societyId != null && flatId != null) {
          const blocksRes = await blockApi.fetchBlocksBySociety(societyId);
          const blocks = (blocksRes?.data ?? []) as blockApi.Block[];
          let found: flatApi.Flat | undefined;

          for (const block of blocks) {
            const flatsRes = await flatApi.fetchFlatsByBlock(block.id);
            const flats = (flatsRes?.data ?? []) as flatApi.Flat[];
            found = flats.find((f) => String(f.id) === String(flatId));
            if (found) break;
          }

          if (!cancelled) setFlatNumber(found?.flat_number ?? null);
        }
      } catch {
        // Ignore lookup errors; we'll fall back to displaying raw ids.
      } finally {
        if (!cancelled) setResidenceLoading(false);
      }
    };

    loadResidenceDetails();
    return () => {
      cancelled = true;
    };
  }, [user?.society_id, user?.flat_id]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      const phone = user?.phone_number ?? undefined;

      (async () => {
        const nextUser = await loadResidentProfile(phone);
        if (cancelled || nextUser?.id == null) return;

        dispatch(setAuthUser(nextUser));
        void resolveResidenceInBackground(nextUser.id, (extras) => {
          if (cancelled) return;
          dispatch(
            setAuthUser({
              ...nextUser,
              society_id: nextUser.society_id ?? extras.society_id ?? null,
              flat_id: nextUser.flat_id ?? extras.flat_id ?? null,
            })
          );
        });
      })();

      return () => {
        cancelled = true;
      };
    }, [dispatch, user?.phone_number])
  );

  const displayName = (user?.name || user?.email || 'Resident').trim();
  const memberRole = 'Community Member';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'R';
  const handleSave = async () => {
    if (!user?.id) return;

    const currentName = (user.name ?? '').trim();
    const currentEmail = (user.email ?? '').trim().toLowerCase();
    const currentPhone = sanitizePhoneInput(user.phone_number ?? '');

    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();
    const nextPhone = sanitizePhoneInput(phone);

    const updates: { name?: string; email?: string; phone_number?: string } = {};

    if (nextName && nextName !== currentName) {
      updates.name = nextName;
    }

    if (nextEmail && nextEmail !== currentEmail) {
      if (!isValidEmail(nextEmail)) {
        Alert.alert('Error', 'Enter a valid email address');
        return;
      }
      updates.email = nextEmail;
    }

    // If user typed a phone number, it must be exactly 10 digits.
    if (nextPhone && nextPhone.length !== 10) {
      Alert.alert('Error', 'Phone number must be exactly 10 digits');
      return;
    }

    const phoneChanged = nextPhone !== currentPhone;
    if (phoneChanged && nextPhone) {
      if (!phoneVerified) {
        Alert.alert('Verify phone', 'Please verify your new phone number with OTP before saving.');
        return;
      }
      updates.phone_number = nextPhone;
    }

    const textChanged = Object.keys(updates).length > 0;
    const avatarChanged = avatarDraft !== undefined;

    if (!textChanged && !avatarChanged) {
      setEditing(false);
      setEditProfileVisible(false);
      return;
    }

    const fullName = nextName || currentName;
    const fullEmail = nextEmail || currentEmail;
    const fullPhone = nextPhone || currentPhone;

    setLoading(true);
    try {
      const uid = String(user.id);
      let updateRes:
        | { success: boolean; data?: any; message?: string }
        | undefined;

      if (avatarChanged) {
        if (avatarDraft === null) {
          updateRes = await residentApi.residentUpdate(
            user.id,
            { name: fullName, email: fullEmail, phone_number: fullPhone },
            { removeProfileImage: true }
          );
        } else if (avatarDraft?.uri) {
          updateRes = await residentApi.residentUpdate(
            user.id,
            { name: fullName, email: fullEmail, phone_number: fullPhone },
            {
              profileImage: {
                uri: avatarDraft.uri,
                type: avatarDraft.type,
                name: avatarDraft.name,
              },
            }
          );
        }
        if (avatarDraft === null) {
          await clearLocalProfileAvatar(uid);
        } else if (avatarDraft?.uri) {
          await setLocalProfileAvatar(uid, avatarDraft.uri);
        }
      } else if (textChanged) {
        // Backend update query overwrites columns directly; send full values to avoid
        // accidentally nulling fields when only one field was edited.
        updateRes = await residentApi.residentUpdate(user.id, {
          name: fullName,
          email: fullEmail,
          phone_number: fullPhone,
        });
      }

      // Prefer backend response to update UI instantly (doesn't rely on /checkAuth).
      const raw = updateRes?.data;
      if (raw && typeof raw === 'object') {
        dispatch(
          setAuthUser({
            ...(user ?? {}),
            id: (raw as any).id ?? user?.id,
            name: (raw as any).name ?? user?.name,
            email: (raw as any).email ?? user?.email,
            phone_number: (raw as any).phone ?? (raw as any).phone_number ?? user?.phone_number,
            society_id: (raw as any).society_id ?? user?.society_id ?? null,
            flat_id: (raw as any).flat_id ?? user?.flat_id ?? null,
            profile_image: (raw as any).profile_image ?? user?.profile_image ?? null,
          })
        );
      } else {
        // Fallback: keep existing behavior.
        await refreshUser(user?.phone_number ?? undefined);
      }

      await reloadLocalAvatar();
      setAvatarCacheBuster(Date.now());
      setAvatarDraft(undefined);
      resetPhoneVerification();
      setEditing(false);
      setEditProfileVisible(false);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e as Error).message;
      Alert.alert('Error', msg || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const loadEssentialContacts = async () => {
    const societyId = user?.society_id;
    if (societyId == null || String(societyId).trim() === '') {
      Alert.alert('Not available', 'Your society is not set, so essential contacts cannot be loaded.');
      return;
    }

    setEssentialContactsLoading(true);
    try {
      const res = await essentialContactsApi.fetchEssentialContactsBySociety(societyId);
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to load essential contacts');
      }
      setEssentialContacts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setEssentialContacts([]);
      Alert.alert('Error', (e as Error).message || 'Failed to load essential contacts');
    } finally {
      setEssentialContactsLoading(false);
    }
  };

  const loadBookings = async () => {
    const residentId = user?.id;
    if (residentId == null) {
      Alert.alert('Not available', 'Resident id not found.');
      return;
    }

    setBookingsLoading(true);
    try {
      const res = await bookingVendorsApi.fetchResidentsBookings(residentId);
      setBookings(Array.isArray(res) ? res : []);
    } catch (e) {
      setBookings([]);
      Alert.alert('Error', (e as Error).message || 'Failed to load bookings');
    } finally {
      setBookingsLoading(false);
    }
  };

  const formatBookingLine = (b: bookingVendorsApi.ResidentBooking) => {
    const date = b.booking_date ? String(b.booking_date).slice(0, 10) : '';
    const time = b.booking_time ? String(b.booking_time).slice(0, 5) : '';
    const status = b.status ? String(b.status) : '';
    const address = b.address ? String(b.address) : '';

    const left = [date, time].filter(Boolean).join(' ');
    const right = status ? `Status: ${status}` : '';
    const sub = [address].filter(Boolean).join(' • ');

    return { left, right, sub };
  };

  const styles = makeStyles(colors);
  const societyDisplay =
    user?.society_id == null
      ? '-'
      : societyName ?? (residenceLoading ? 'Loading...' : `Society #${user.society_id}`);
  const flatDisplay =
    user?.flat_id == null
      ? '-'
      : flatNumber
        ? `Flat ${flatNumber}`
        : residenceLoading
          ? 'Loading...'
          : `Flat #${user.flat_id}`;
  const displayAvatarUri = (() => {
    if (avatarDraft === null) return null;
    if (avatarDraft?.uri) return avatarDraft.uri;
    return localAvatarDataUrl ?? serverAvatarUri;
  })();

  const resetPhoneVerification = () => {
    setHashOtp(null);
    setOtpCode('');
    setPhoneVerified(false);
  };

  const currentSavedPhone = sanitizePhoneInput(user?.phone_number ?? '');
  const phoneChangedForOtp = sanitizePhoneInput(phone) !== currentSavedPhone;
  const phoneBusy = otpSending || otpVerifying;

  const handlePhoneChange = (value: string) => {
    const cleaned = sanitizePhoneInput(value);
    setPhone(cleaned);
    resetPhoneVerification();
    if (cleaned === currentSavedPhone) {
      setPhoneVerified(true);
    }
  };

  const handleSendPhoneOtp = async () => {
    const cleanedPhone = sanitizePhoneInput(phone);
    if (cleanedPhone.length !== 10) {
      Alert.alert('Error', 'Enter a valid 10-digit phone number to receive OTP');
      return;
    }
    if (cleanedPhone === currentSavedPhone) {
      Alert.alert('No change', 'This is already your current phone number.');
      return;
    }
    setOtpSending(true);
    try {
      const res = await sendSignupOtp(cleanedPhone);
      setHashOtp(res.hashOTP);
      setOtpCode('');
      setPhoneVerified(false);
      Alert.alert('OTP sent', 'Check WhatsApp for your verification code.');
    } catch (err) {
      Alert.alert('Could not send OTP', messageFromApiError(err));
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const cleanedPhone = sanitizePhoneInput(phone);
    if (cleanedPhone.length !== 10) {
      Alert.alert('Error', 'Enter a valid 10-digit phone number');
      return;
    }
    if (!hashOtp) {
      Alert.alert('Error', 'Send OTP first');
      return;
    }
    const code = otpCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP from WhatsApp');
      return;
    }
    setOtpVerifying(true);
    try {
      await verifySignupOtp(hashOtp, code);
      setPhoneVerified(true);
      Alert.alert('Verified', 'Your new phone number is verified. You can save your changes.');
    } catch (err) {
      Alert.alert('Verification failed', messageFromApiError(err));
    } finally {
      setOtpVerifying(false);
    }
  };

  const startEditing = () => {
    setName(user?.name ?? '');
    setEmail((user?.email ?? '').trim());
    setPhone(sanitizePhoneInput(user?.phone_number ?? ''));
    setAvatarDraft(undefined);
    resetPhoneVerification();
    if (sanitizePhoneInput(user?.phone_number ?? '')) {
      setPhoneVerified(true);
    }
    setEditing(true);
    setEditProfileVisible(true);
  };

  const cancelEditing = () => {
    setName(user?.name ?? '');
    setEmail((user?.email ?? '').trim());
    setPhone(sanitizePhoneInput(user?.phone_number ?? ''));
    setAvatarDraft(undefined);
    resetPhoneVerification();
    setEditing(false);
    setEditProfileVisible(false);
  };

  const pickProfilePhoto = async () => {
    if (loading) return;
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        maxWidth: 1200,
        maxHeight: 1200,
        selectionLimit: 1,
      });
      if (result.didCancel || result.errorCode) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        setAvatarDraft({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'profile.jpg',
        });
      }
    } catch {
      // ignore
    }
  };

  const openEssentialContactsModal = () => {
    const societyId = user?.society_id;
    if (societyId == null || String(societyId).trim() === '') {
      Alert.alert('Not available', 'Your society is not set, so essential contacts cannot be loaded.');
      return;
    }
    setEssentialContactsVisible(true);
    void loadEssentialContacts();
  };

  const openBookingsModal = () => {
    if (user?.id == null) {
      Alert.alert('Not available', 'Resident id not found.');
      return;
    }
    setBookingsVisible(true);
    void loadBookings();
  };

  useEffect(() => {
    if (route?.params?.startEditing && !editing) {
      startEditing();
      profileNavigation.setParams({ startEditing: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.startEditing]);

  const gradientColors = isDark
    ? ([colors.primaryDark, '#7C2D12', colors.primary] as const)
    : ([colors.primaryDark, colors.primary, colors.primaryLight] as const);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            {
              // paddingTop: 18,
              width: windowWidth,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitles}>
              <Text style={styles.heroTitle}>Profile</Text>
              <Text style={styles.heroSubtitle}>Your home in the society</Text>
            </View>
            <TouchableOpacity
              style={styles.heroIconButton}
              onPress={() => rootNavigation.navigate('Settings')}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.profileHeroCard, styles.profileHeroCardOverlap]}>
            <View style={styles.avatarShell}>
              <View style={styles.avatarRing}>
                <View style={styles.avatarBox}>
                  {displayAvatarUri ? (
                    <Image
                      source={{ uri: displayAvatarUri }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>{initials}</Text>
                  )}
                </View>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.avatarName} numberOfLines={2}>
                  {displayName}
                </Text>
                <View style={styles.rolePill}>
                  <Ionicons name="people-outline" size={14} color={colors.primary} />
                  <Text style={styles.rolePillText}>{memberRole}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sectionAccentBar}
            />
            <Text style={styles.sectionTitle}>Residence</Text>
          </View>
          <View style={styles.residenceRow}>
            <View style={[styles.residenceCard, styles.residenceCardPrimary]}>
              <View style={[styles.residenceIconWrap, { backgroundColor: `${colors.primary}22` }]}>
                <Ionicons name="business-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.residenceLabel}>Society</Text>
              <Text style={styles.residenceValue} numberOfLines={3}>
                {societyDisplay}
              </Text>
            </View>
            <View style={[styles.residenceCard, styles.residenceCardAccent]}>
              <View style={[styles.residenceIconWrap, { backgroundColor: `${colors.accent}33` }]}>
                <Ionicons name="home-outline" size={22} color={colors.primaryDark} />
              </View>
              <Text style={styles.residenceLabel}>Flat</Text>
              <Text style={styles.residenceValue} numberOfLines={2}>
                {flatDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <LinearGradient
              colors={[PROFILE_ACTION.essentials, colors.primary]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sectionAccentBar}
            />
            <Text style={styles.sectionTitle}>Contact</Text>
          </View>
          <View style={styles.infoCardTinted}>
            <View style={styles.infoRowColored}>
              <View style={styles.infoIconBadge}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoTextCol}>
                <Text style={styles.infoCardLabel}>Email</Text>
                <Text style={styles.infoCardValue} numberOfLines={2}>
                  {user?.email || '—'}
                </Text>
              </View>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.infoRowColored}>
              <View style={[styles.infoIconBadge, styles.infoIconBadgeMint]}>
                <Ionicons name="call-outline" size={18} color={PROFILE_ACTION.essentials} />
              </View>
              <View style={styles.infoTextCol}>
                <Text style={styles.infoCardLabel}>Phone</Text>
                <Text style={styles.infoCardValue}>{user?.phone_number || '—'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <LinearGradient
              colors={[PROFILE_ACTION.bookings, colors.primary]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sectionAccentBar}
            />
            <Text style={styles.sectionTitle}>Shortcuts</Text>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              const societyId = user?.society_id;
              if (societyId == null || String(societyId).trim() === '') {
                Alert.alert('Not available', 'Your society is not set, so maids cannot be loaded.');
                return;
              }
              profileNavigation.navigate('Maids');
            }}
            disabled={loading}
            activeOpacity={0.88}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: PROFILE_ACTION.maidsIconBg }]}>
              <Ionicons name="shirt-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionRowLabel}>Maids</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={openEssentialContactsModal}
            disabled={loading}
            activeOpacity={0.88}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: PROFILE_ACTION.essentialsIconBg }]}>
              <Ionicons name="medkit-outline" size={22} color={PROFILE_ACTION.essentials} />
            </View>
            <Text style={styles.actionRowLabel}>Essential contacts</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={openBookingsModal}
            disabled={loading}
            activeOpacity={0.88}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: PROFILE_ACTION.bookingsIconBg }]}>
              <Ionicons name="calendar-outline" size={22} color={PROFILE_ACTION.bookings} />
            </View>
            <Text style={styles.actionRowLabel}>My bookings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              if (user?.id == null) {
                Alert.alert('Sign in required', 'Please log in to view your messages.');
                return;
              }
              profileNavigation.navigate('ChatInbox');
            }}
            disabled={loading}
            activeOpacity={0.88}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: PROFILE_ACTION.chatsIconBg }]}>
              <Ionicons name="chatbubbles-outline" size={22} color={PROFILE_ACTION.chats} />
            </View>
            <Text style={styles.actionRowLabel}>Messages</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>v{appVersion}</Text>
        </ScrollView>
      </KeyboardAvoidingView>

        <Modal
          visible={editProfileVisible}
          transparent
          animationType="fade"
          onRequestClose={cancelEditing}
        >
          <Pressable style={styles.modalOverlay} onPress={cancelEditing} />
          <View style={styles.modalCenter}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit profile</Text>
                <TouchableOpacity onPress={cancelEditing} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.editModalScroll}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.avatarEditHint}>Profile photo</Text>
                <View style={styles.avatarEditRow}>
                  <View style={styles.avatarEditPreview}>
                    {displayAvatarUri ? (
                      <Image
                        source={{ uri: displayAvatarUri }}
                        style={styles.avatarEditPreviewImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.avatarEditPlaceholder}>
                        <Text style={styles.avatarInitialSmall}>{initials}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.avatarEditActions}>
                    <TouchableOpacity
                      style={styles.softButton}
                      onPress={pickProfilePhoto}
                      disabled={loading}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="image-outline" size={18} color={colors.primary} />
                      <Text style={styles.softButtonText}>Choose photo</Text>
                    </TouchableOpacity>
                    {avatarDraft !== null && !!(avatarDraft?.uri ?? localAvatarDataUrl ?? serverAvatarUri) ? (
                      <TouchableOpacity
                        style={styles.textLinkBtn}
                        onPress={() => setAvatarDraft(null)}
                        disabled={loading}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.textLinkDanger}>Remove photo</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.inputLabel}>Full name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
                />

                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Text style={styles.inputLabel}>Phone (10 digits)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  placeholderTextColor={colors.textSecondary}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!loading && !phoneBusy}
                />

                {phoneChangedForOtp && sanitizePhoneInput(phone).length === 10 ? (
                  phoneVerified ? (
                    <Text style={[styles.phoneVerifiedText, { color: colors.primary }]}>
                      New phone number verified
                    </Text>
                  ) : !hashOtp ? (
                    <TouchableOpacity
                      style={[styles.otpSecondaryBtn, phoneBusy && styles.otpBtnDisabled]}
                      onPress={handleSendPhoneOtp}
                      disabled={phoneBusy || loading}
                      activeOpacity={0.9}
                    >
                      {otpSending ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <Text style={[styles.otpSecondaryBtnText, { color: colors.primary }]}>
                          Send OTP via WhatsApp
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.otpBlock}>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor={colors.textSecondary}
                        value={otpCode}
                        onChangeText={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!phoneBusy && !loading}
                      />
                      <View style={styles.otpActions}>
                        <TouchableOpacity
                          style={[styles.otpSecondaryBtn, styles.otpActionBtn, phoneBusy && styles.otpBtnDisabled]}
                          onPress={handleSendPhoneOtp}
                          disabled={phoneBusy || loading}
                          activeOpacity={0.9}
                        >
                          {otpSending ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                          ) : (
                            <Text style={[styles.otpSecondaryBtnText, { color: colors.primary }]}>
                              Resend OTP
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.otpPrimaryBtn, styles.otpActionBtn, phoneBusy && styles.otpBtnDisabled]}
                          onPress={handleVerifyPhoneOtp}
                          disabled={phoneBusy || loading}
                          activeOpacity={0.9}
                        >
                          {otpVerifying ? (
                            <ActivityIndicator color="#4A2100" size="small" />
                          ) : (
                            <Text style={styles.otpPrimaryBtnText}>Verify OTP</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                ) : null}

                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, loading && styles.modalPrimaryBtnDisabled]}
                  onPress={handleSave}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#4A2100" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={essentialContactsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEssentialContactsVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setEssentialContactsVisible(false)}
          />
          <View style={styles.modalCenter}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Essential contacts</Text>
                <TouchableOpacity
                  onPress={() => setEssentialContactsVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              {essentialContactsLoading ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.modalHint}>Loading contacts…</Text>
                </View>
              ) : essentialContacts.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalHint}>No essential contacts found.</Text>
                </View>
              ) : (
                <FlatList
                  data={essentialContacts}
                  keyExtractor={(item, index) => String(item.id ?? index)}
                  contentContainerStyle={styles.modalList}
                  renderItem={({ item, index }) => {
                    const line1 = [item.title, item.designation].filter(Boolean).join(' • ');
                    const phones = [item.mobile_number1, item.mobile_number2].filter(Boolean).join(' / ');
                    return (
                      <View>
                        <View style={styles.contactRow}>
                          <Text style={styles.contactName}>{item.name || '-'}</Text>
                          {!!line1 && <Text style={styles.contactMeta}>{line1}</Text>}
                          {!!phones && <Text style={styles.contactPhone}>{phones}</Text>}
                        </View>
                        {index < essentialContacts.length - 1 ? (
                          <View style={styles.contactDivider} />
                        ) : null}
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={bookingsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setBookingsVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setBookingsVisible(false)}
          />
          <View style={styles.modalCenter}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>My bookings</Text>
                <TouchableOpacity
                  onPress={() => setBookingsVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              {bookingsLoading ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.modalHint}>Loading bookings…</Text>
                </View>
              ) : bookings.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalHint}>No bookings found.</Text>
                </View>
              ) : (
                <FlatList
                  data={bookings}
                  keyExtractor={(item, index) => String(item.id ?? index)}
                  contentContainerStyle={styles.modalList}
                  renderItem={({ item, index }) => {
                    const line = formatBookingLine(item);
                    return (
                      <View>
                        <View style={styles.bookingRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bookingTitle} numberOfLines={1}>
                              {item.name || 'Service'}
                            </Text>
                            {!!line.left && <Text style={styles.bookingMeta}>{line.left}</Text>}
                            {!!line.right && <Text style={styles.bookingMeta}>{line.right}</Text>}
                            {!!line.sub && <Text style={styles.bookingSub}>{line.sub}</Text>}
                          </View>
                          {!!item.price && (
                            <Text style={styles.bookingPrice} numberOfLines={1}>
                              ₹ {String(item.price)}
                            </Text>
                          )}
                        </View>
                        {index < bookings.length - 1 ? <View style={styles.contactDivider} /> : null}
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  const hairline = StyleSheet.hairlineWidth;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },
    scrollView: { flex: 1 },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      paddingTop: 0,
    },

    hero: {
      // paddingBottom: 36,
      alignSelf: 'center',
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
      overflow: 'hidden',
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      padding: 15,
      minHeight: 52,
    },
    heroTitles: { 
      flex: 1, 
      paddingRight: 12
    },
    heroTitle: {
      fontSize: 23,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.4,
      textShadowColor: 'rgba(0,0,0,0.18)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    heroSubtitle: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
      lineHeight: 16,
      textShadowColor: 'rgba(0,0,0,0.16)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    heroIconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.35)',
    },

    profileHeroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      marginHorizontal: 0,
      marginBottom: 20,
      borderWidth: hairline,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.primaryDark,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.14,
          shadowRadius: 16,
        },
        android: { elevation: 5 },
      }),
    },
    /** Keep the profile card fully below the hero (no overlap). */
    profileHeroCardOverlap: { marginTop: 14 },

    editingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      paddingBottom: 12,
      borderBottomWidth: hairline,
      borderBottomColor: colors.border,
    },
    editingBannerText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    editingBannerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    linkMuted: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
    savePill: {
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
    },
    savePillDisabled: { opacity: 0.7 },
    savePillText: { fontSize: 15, fontWeight: '900', color: '#4A2100' },

    avatarShell: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarRing: {
      padding: 2,
      borderRadius: 20,
      backgroundColor: colors.surfaceVariant,
      borderWidth: 2,
      borderColor: `${colors.primary}44`,
      marginRight: 12,
    },
    avatarBox: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 72,
      height: 72,
    },
    avatarInitial: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
    },
    profileMeta: {
      flex: 1,
    },
    avatarName: {
      fontSize: 19,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    rolePill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: `${colors.primary}14`,
      borderWidth: hairline,
      borderColor: `${colors.primary}30`,
    },
    rolePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryDark,
    },

    avatarEditBlock: {
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: hairline,
      borderTopColor: colors.border,
    },
    avatarEditHint: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    avatarEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarEditPreview: {
      width: 64,
      height: 64,
      borderRadius: 14,
      marginRight: 14,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    avatarEditPreviewImage: { width: 64, height: 64 },
    avatarEditPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    },
    avatarInitialSmall: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
    },
    avatarEditActions: {
      flex: 1,
      gap: 10,
    },
    softButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceVariant,
    },
    softButtonText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    textLinkBtn: { paddingVertical: 4 },
    textLinkDanger: { fontSize: 14, fontWeight: '800', color: colors.error },

    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
      marginTop: 4,
    },
    sectionAccentBar: {
      width: 4,
      height: 20,
      borderRadius: 3,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
    },

    residenceRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 22,
    },
    residenceCard: {
      flex: 1,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: hairline,
      borderColor: colors.border,
    },
    residenceCardPrimary: {
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    residenceCardAccent: {
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
      backgroundColor: colors.surfaceVariant,
    },
    residenceIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    residenceLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: 6,
    },
    residenceValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 21,
    },

    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 8,
      marginBottom: 20,
      borderWidth: hairline,
      borderColor: colors.border,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 14,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    input: {
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.maincontainerbackground,
      borderWidth: hairline,
      borderColor: colors.border,
    },
    phoneVerifiedText: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: '700',
    },
    otpBlock: {
      marginTop: 10,
      gap: 10,
    },
    otpActions: {
      flexDirection: 'row',
      gap: 10,
    },
    otpActionBtn: {
      flex: 1,
      marginTop: 0,
    },
    otpSecondaryBtn: {
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceVariant,
      borderWidth: hairline,
      borderColor: colors.border,
    },
    otpSecondaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
    },
    otpPrimaryBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    otpPrimaryBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#4A2100',
    },
    otpBtnDisabled: {
      opacity: 0.6,
    },

    infoCardTinted: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 4,
      paddingHorizontal: 4,
      marginBottom: 22,
      borderWidth: hairline,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    infoRowColored: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
    },
    infoIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}18`,
    },
    infoIconBadgeMint: {
      backgroundColor: 'rgba(13,148,136,0.14)',
    },
    infoTextCol: { flex: 1 },
    infoCardLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    infoCardValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    rowDivider: {
      height: hairline,
      marginHorizontal: 12,
      backgroundColor: colors.border,
    },

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
      borderWidth: hairline,
      borderColor: colors.border,
    },
    actionIconCircle: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionRowLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },

    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 18,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: `${colors.error}12`,
      borderWidth: hairline,
      borderColor: `${colors.error}35`,
    },
    logoutText: { fontSize: 17, color: colors.error, fontWeight: '800' },
    versionText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.6,
      marginTop: 12,
      opacity: 0.85,
    },

    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalCenter: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      maxHeight: '80%',
      overflow: 'hidden',
      borderWidth: hairline,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 12 },
          shadowRadius: 20,
        },
        android: { elevation: 8 },
      }),
    },
    modalHeader: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: hairline,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceVariant,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    modalCloseBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    modalCloseText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 15,
    },
    modalLoading: { padding: 22, gap: 12, alignItems: 'center' },
    modalEmpty: { padding: 22 },
    modalHint: {
      color: colors.textSecondary,
      fontWeight: '600',
      textAlign: 'center',
      fontSize: 15,
    },
    modalList: { padding: 16 },
    editModalScroll: { padding: 16, paddingBottom: 22 },
    contactRow: { paddingVertical: 10 },
    contactName: { color: colors.text, fontSize: 16, fontWeight: '800' },
    contactMeta: {
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '600',
      fontSize: 14,
    },
    contactPhone: { color: colors.text, marginTop: 6, fontWeight: '700', fontSize: 15 },
    contactDivider: { height: hairline, backgroundColor: colors.border },

    bookingRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      paddingVertical: 10,
    },
    bookingTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginBottom: 2,
    },
    bookingMeta: {
      color: colors.textSecondary,
      fontWeight: '700',
      marginTop: 2,
      fontSize: 14,
    },
    bookingSub: {
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 6,
      fontSize: 13,
    },
    bookingPrice: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'right',
      paddingLeft: 8,
    },

    modalPrimaryBtn: {
      marginTop: 18,
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: hairline,
      borderColor: `${colors.primary}30`,
    },
    modalPrimaryBtnDisabled: { opacity: 0.75 },
    modalPrimaryBtnText: { color: '#4A2100', fontSize: 16, fontWeight: '900' },
  });
}
