import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../../theme';
import { useAuth, NOTIFICATION_PERMISSION_REQUIRED_CODE } from '../../context/AuthContext';
import { openAppSettings } from '../../services/fcm';
import { fetchAllSocieties, Society } from '../../api/society';
import { fetchBlocksBySociety, Block } from '../../api/block';
import { fetchFlatsByBlock, Flat } from '../../api/flat';
import { sendSignupOtp, verifySignupOtp } from '../../api/auth';
import { residentValidateSignupFields } from '../../api/resident';
import type { AuthStackProps } from '../../navigation/types';

function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

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

export default function SignUpScreen({ navigation }: AuthStackProps<'SignUp'>) {
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [hashOtp, setHashOtp] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState<string>('');
  const [societiesLoading, setSocietiesLoading] = useState(false);
  const [societyReloadKey, setSocietyReloadKey] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockReloadKey, setBlockReloadKey] = useState(0);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedFlatId, setSelectedFlatId] = useState<string>('');
  const [flatsLoading, setFlatsLoading] = useState(false);
  const [societyModalVisible, setSocietyModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [flatModalVisible, setFlatModalVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<{
    uri: string;
    type?: string;
    name?: string;
  } | null>(null);

  useEffect(() => {
    const loadSocieties = async () => {
      try {
        setSocietiesLoading(true);
        const res = await fetchAllSocieties();
        const list = (res?.data ?? []) as Society[];
        if (Array.isArray(list)) {
          setSocieties(list);
        }
      } catch {
        // ignore – just preloading
      } finally {
        setSocietiesLoading(false);
      }
    };

    loadSocieties();
  }, []);

  useEffect(() => {
    const loadBlocks = async () => {
      if (!selectedSocietyId) {
        setBlocks([]);
        setSelectedBlockId('');
        return;
      }
      try {
        setBlocksLoading(true);
        const res = await fetchBlocksBySociety(selectedSocietyId);
        const list = (res?.data ?? []) as Block[];
        if (Array.isArray(list)) {
          setBlocks(list);
        } else {
          setBlocks([]);
          setSelectedBlockId('');
        }
      } catch {
        setBlocks([]);
        setSelectedBlockId('');
      } finally {
        setBlocksLoading(false);
      }
    };

    loadBlocks();
  }, [selectedSocietyId, societyReloadKey]);

  useEffect(() => {
    const loadFlats = async () => {
      if (!selectedBlockId) {
        setFlats([]);
        setSelectedFlatId('');
        return;
      }
      try {
        setFlatsLoading(true);
        const res = await fetchFlatsByBlock(selectedBlockId);
        const list = (res?.data ?? []) as Flat[];
        if (Array.isArray(list)) {
          setFlats(list);
        } else {
          setFlats([]);
          setSelectedFlatId('');
        }
      } catch {
        setFlats([]);
        setSelectedFlatId('');
      } finally {
        setFlatsLoading(false);
      }
    };

    loadFlats();
  }, [selectedBlockId, blockReloadKey]);

  const resetPhoneVerification = () => {
    setHashOtp(null);
    setOtpCode('');
    setPhoneVerified(false);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(sanitizePhoneInput(value));
    resetPhoneVerification();
  };

  const handleSendOtp = async () => {
    const cleanedPhone = sanitizePhoneInput(phone);
    if (cleanedPhone.length !== 10) {
      Alert.alert('Error', 'Enter a valid 10-digit phone number to receive OTP');
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

  const handleVerifyOtp = async () => {
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
      Alert.alert('Verified', 'Your phone number is verified. You can complete sign up.');
    } catch (err) {
      Alert.alert('Verification failed', messageFromApiError(err));
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSignUp = async () => {
    const cleanedPhone = sanitizePhoneInput(phone);
    const normalizedEmail = email.trim().toLowerCase();

    if (!phoneVerified) {
      Alert.alert('Verify phone', 'Please verify your phone number with OTP before signing up.');
      return;
    }

    if (!name.trim() || !normalizedEmail || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (cleanedPhone.length !== 10) {
      Alert.alert('Error', 'Phone number must be exactly 10 digits');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (!selectedSocietyId || !selectedBlockId || !selectedFlatId) {
      Alert.alert(
        'Missing details',
        'Please select society, block, and flat before signing up.'
      );
      return;
    }

    setLoading(true);
    try {
      await residentValidateSignupFields({
        email: normalizedEmail,
        password,
        phone_number: cleanedPhone,
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Validation failed', messageFromApiError(err));
      return;
    }

    try {
      const result = await signUp({
        name: name.trim(),
        email: normalizedEmail,
        phone_number: cleanedPhone,
        password,
        society_id: selectedSocietyId,
        flat_id: selectedFlatId,
        profileImage: profileImage
          ? {
              uri: profileImage.uri,
              type: profileImage.type,
              name: profileImage.name,
            }
          : undefined,
      });

      if (result.success) {
        Alert.alert('Account created', 'Your account has been created. You can sign in now.', [
          {
            text: 'OK',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              }),
          },
        ]);
        return;
      }

      if (result.code === NOTIFICATION_PERMISSION_REQUIRED_CODE) {
        Alert.alert(
          'Notifications required',
          result.message ||
            'Notifications are required to sign up and receive society updates. Please enable them to continue.',
          [
            { text: 'Try again', onPress: () => handleSignUp() },
            { text: 'Open Settings', onPress: () => openAppSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      Alert.alert('Sign up failed', result.message || 'Could not create account');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    if (formLocked) return;
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        selectionLimit: 1,
      });
      if (result.didCancel || result.errorCode) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        setProfileImage({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'profile.jpg',
        });
      }
    } catch {
      // ignore
    }
  };

  const styles = makeStyles(colors);

  const selectedSociety = societies.find((s) => String(s.id) === selectedSocietyId);
  const selectedBlock = blocks.find((b) => String(b.id) === selectedBlockId);
  const selectedFlat = flats.find((f) => String(f.id) === selectedFlatId);

  const formLocked = loading || !phoneVerified;
  const phoneBusy = otpSending || otpVerifying;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.maincontainerbackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Register as a resident</Text>

          {/* Step 1: Phone Verification */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, phoneVerified && styles.stepBadgeComplete]}>
                <Text style={styles.stepBadgeText}>{phoneVerified ? '✓' : '1'}</Text>
              </View>
              <Text style={styles.sectionTitle}>Verify Phone Number</Text>
            </View>

            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Phone Number"
                placeholderTextColor={colors.textSecondary}
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!loading && !phoneBusy}
              />
            </View>

            {phoneVerified ? (
              <View style={styles.verifiedContainer}>
                <Text style={[styles.verifiedBadge, { color: colors.primary }]}>
                  Phone verified successfully
                </Text>
              </View>
            ) : (
              <>
                {!hashOtp ? (
                  <TouchableOpacity
                    style={[styles.secondaryButton, phoneBusy && styles.buttonDisabled]}
                    onPress={handleSendOtp}
                    disabled={phoneBusy || loading}
                  >
                    {otpSending ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                        Send OTP via WhatsApp
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={styles.otpInput}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor={colors.textSecondary}
                      value={otpCode}
                      onChangeText={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!loading && !phoneBusy}
                    />
                    <View style={styles.otpActions}>
                      <TouchableOpacity
                        style={[styles.secondaryButton, styles.otpActionButton, phoneBusy && styles.buttonDisabled]}
                        onPress={handleSendOtp}
                        disabled={phoneBusy || loading}
                      >
                        {otpSending ? (
                          <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                            Resend
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryButton, styles.otpActionButton, phoneBusy && styles.buttonDisabled]}
                        onPress={handleVerifyOtp}
                        disabled={phoneBusy || loading}
                      >
                        {otpVerifying ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Verify OTP</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {/* Step 2: Personal Information */}
          <View style={[styles.section, !phoneVerified && styles.sectionLocked]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, !phoneVerified && styles.stepBadgeDisabled]}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={[styles.sectionTitle, !phoneVerified && styles.textDisabled]}>
                Personal Information
              </Text>
            </View>

            {!phoneVerified && (
              <Text style={styles.lockedHint}>Complete phone verification to continue</Text>
            )}

            <TextInput
              style={[styles.input, formLocked && styles.inputDisabled]}
              placeholder="Full Name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              editable={!formLocked}
            />
            <TextInput
              style={[styles.input, formLocked && styles.inputDisabled]}
              placeholder="Email Address"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!formLocked}
            />
            <TextInput
              style={[styles.input, formLocked && styles.inputDisabled]}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!formLocked}
            />

            {/* Profile Photo */}
            <Text style={[styles.fieldLabel, formLocked && styles.textDisabled]}>
              Profile Photo (optional)
            </Text>
            {profileImage ? (
              <View style={styles.avatarContainer}>
                <Image source={{ uri: profileImage.uri }} style={styles.avatarPreview} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => !formLocked && setProfileImage(null)}
                  disabled={formLocked}
                  style={styles.avatarRemoveBtn}
                >
                  <Text style={[styles.avatarRemoveText, { color: colors.textSecondary }]}>
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.avatarPickBtn, formLocked && styles.inputDisabled]}
                disabled={formLocked}
                onPress={handlePickImage}
              >
                <Text style={[styles.avatarPickText, { color: colors.primary }]}>
                  + Add Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Step 3: Society Selection */}
          <View style={[styles.section, !phoneVerified && styles.sectionLocked]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, !phoneVerified && styles.stepBadgeDisabled]}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <Text style={[styles.sectionTitle, !phoneVerified && styles.textDisabled]}>
                Society Details
              </Text>
            </View>

            {/* Society Selector */}
            <TouchableOpacity
              style={[styles.selector, formLocked && styles.inputDisabled]}
              onPress={() => !formLocked && !societiesLoading && setSocietyModalVisible(true)}
              disabled={formLocked || societiesLoading}
            >
              <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>Society</Text>
              <Text style={[styles.selectorValue, { color: selectedSociety ? colors.text : colors.textSecondary }]}>
                {societiesLoading ? 'Loading...' : selectedSociety?.name || 'Select Society'}
              </Text>
              <Text style={styles.selectorArrow}>›</Text>
            </TouchableOpacity>

            {/* Block Selector */}
            <TouchableOpacity
              style={[styles.selector, (formLocked || !selectedSocietyId) && styles.inputDisabled]}
              onPress={() => !formLocked && selectedSocietyId && !blocksLoading && setBlockModalVisible(true)}
              disabled={formLocked || !selectedSocietyId || blocksLoading}
            >
              <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>Block</Text>
              <Text style={[styles.selectorValue, { color: selectedBlock ? colors.text : colors.textSecondary }]}>
                {blocksLoading ? 'Loading...' : selectedBlock?.name || 'Select Block'}
              </Text>
              <Text style={styles.selectorArrow}>›</Text>
            </TouchableOpacity>

            {/* Flat Selector */}
            <TouchableOpacity
              style={[styles.selector, (formLocked || !selectedBlockId) && styles.inputDisabled]}
              onPress={() => !formLocked && selectedBlockId && !flatsLoading && setFlatModalVisible(true)}
              disabled={formLocked || !selectedBlockId || flatsLoading}
            >
              <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>Flat</Text>
              <Text style={[styles.selectorValue, { color: selectedFlat ? colors.text : colors.textSecondary }]}>
                {flatsLoading ? 'Loading...' : selectedFlat?.flat_number || 'Select Flat'}
              </Text>
              <Text style={styles.selectorArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.button, (loading || !phoneVerified) && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading || !phoneVerified}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Society Modal */}
      <Modal visible={societyModalVisible} transparent animationType="fade" onRequestClose={() => setSocietyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Society</Text>
            {societiesLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Loading...</Text>
              </View>
            ) : societies.length === 0 ? (
              <View style={styles.modalLoading}>
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>No societies available</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList}>
                {societies.map((s) => {
                  const idStr = String(s.id);
                  const isSelected = idStr === selectedSocietyId;
                  return (
                    <TouchableOpacity
                      key={idStr}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        setSelectedSocietyId(idStr);
                        setSocietyReloadKey((key) => key + 1);
                        setBlocks([]);
                        setSelectedBlockId('');
                        setFlats([]);
                        setSelectedFlatId('');
                        setSocietyModalVisible(false);
                        setBlockModalVisible(true);
                      }}
                    >
                      <Text style={[styles.modalItemText, isSelected && { color: colors.primary }]}>{s.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSocietyModalVisible(false)}>
              <Text style={[styles.modalCloseText, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Block Modal */}
      <Modal visible={blockModalVisible} transparent animationType="fade" onRequestClose={() => setBlockModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Block</Text>
            {blocksLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Loading...</Text>
              </View>
            ) : blocks.length === 0 ? (
              <View style={styles.modalLoading}>
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>No blocks available</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList}>
                {blocks.map((b) => {
                  const idStr = String(b.id);
                  const isSelected = idStr === selectedBlockId;
                  return (
                    <TouchableOpacity
                      key={idStr}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        setSelectedBlockId(idStr);
                        setBlockReloadKey((key) => key + 1);
                        setFlats([]);
                        setSelectedFlatId('');
                        setBlockModalVisible(false);
                        setFlatModalVisible(true);
                      }}
                    >
                      <Text style={[styles.modalItemText, isSelected && { color: colors.primary }]}>{b.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalBackButton}
                onPress={() => {
                  setBlockModalVisible(false);
                  setSocietyModalVisible(true);
                }}
              >
                <Text style={[styles.modalBackText, { color: colors.textSecondary }]}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setBlockModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Flat Modal */}
      <Modal visible={flatModalVisible} transparent animationType="fade" onRequestClose={() => setFlatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Flat</Text>
            {flatsLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>Loading...</Text>
              </View>
            ) : flats.length === 0 ? (
              <View style={styles.modalLoading}>
                <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>No flats available</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList}>
                {flats.map((f) => {
                  const idStr = String(f.id);
                  const isSelected = idStr === selectedFlatId;
                  return (
                    <TouchableOpacity
                      key={idStr}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => {
                        setSelectedFlatId(idStr);
                        setFlatModalVisible(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, isSelected && { color: colors.primary }]}>{f.flat_number}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalBackButton}
                onPress={() => {
                  setFlatModalVisible(false);
                  setBlockModalVisible(true);
                }}
              >
                <Text style={[styles.modalBackText, { color: colors.textSecondary }]}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setFlatModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: { text: string; textSecondary: string; border: string; surface: string; primary: string; background: string }) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      padding: 24,
      paddingTop: 48,
      paddingBottom: 48,
    },
    form: {
      maxWidth: 400,
      width: '100%',
      alignSelf: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    section: {
      marginBottom: 24,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionLocked: {
      opacity: 0.5,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    stepBadgeComplete: {
      backgroundColor: '#10B981',
    },
    stepBadgeDisabled: {
      backgroundColor: colors.border,
    },
    stepBadgeText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    textDisabled: {
      color: colors.textSecondary,
    },
    lockedHint: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    phoneInputContainer: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    countryCode: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.background,
      marginRight: 8,
      justifyContent: 'center',
    },
    countryCodeText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    phoneInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    verifiedContainer: {
      backgroundColor: '#10B98115',
      padding: 12,
      borderRadius: 8,
    },
    verifiedBadge: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    otpInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 20,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 12,
      textAlign: 'center',
      letterSpacing: 8,
    },
    otpActions: {
      flexDirection: 'row',
      gap: 12,
    },
    otpActionButton: {
      flex: 1,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 8,
      marginTop: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 12,
    },
    inputDisabled: {
      opacity: 0.5,
    },
    avatarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    avatarPreview: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.border,
    },
    avatarRemoveBtn: {
      marginLeft: 16,
    },
    avatarRemoveText: {
      fontSize: 14,
      fontWeight: '500',
    },
    avatarPickBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      borderStyle: 'dashed',
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.background,
      marginBottom: 8,
    },
    avatarPickText: {
      fontSize: 16,
      fontWeight: '600',
    },
    selector: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.background,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectorLabel: {
      fontSize: 12,
      position: 'absolute',
      top: 6,
      left: 16,
    },
    selectorValue: {
      fontSize: 16,
      flex: 1,
      marginTop: 10,
    },
    selectorArrow: {
      fontSize: 20,
      color: colors.textSecondary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    link: {
      marginTop: 24,
      alignItems: 'center',
    },
    linkText: {
      fontSize: 16,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '70%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    modalList: {
      marginBottom: 16,
    },
    modalItem: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 4,
    },
    modalItemSelected: {
      backgroundColor: colors.primary + '15',
    },
    modalItemText: {
      fontSize: 16,
      color: colors.text,
    },
    modalLoading: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    modalMessage: {
      marginTop: 12,
      fontSize: 14,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalBackButton: {
      paddingVertical: 8,
    },
    modalBackText: {
      fontSize: 14,
      fontWeight: '500',
    },
    modalCloseButton: {
      paddingVertical: 8,
    },
    modalCloseText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
