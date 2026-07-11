import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  FlatList,
  Pressable,
  Image,
  ImageBackground,
} from 'react-native';
import { useTheme, type ThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as sosApi from '../api/sos';
import * as visitorApi from '../api/visitor';
import * as noticeApi from '../api/notice';
import * as postApi from '../api/post';
import * as blockApi from '../api/block';
import * as flatApi from '../api/flat';
import * as essentialContactsApi from '../api/essentialContacts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { formatDateTime12hTimeFirst } from '../lib/datetime';
import { VENDOR_CATEGORIES, type VendorCategoryKey } from '../constants/vendorCategories';
import { extractPostsArray, normalizePostImages } from '../lib/postImages';
import { useLocalProfileAvatar } from '../hooks/useLocalProfileAvatar';
import { resolveProfileImageUrl } from '../lib/profileImageUrl';
import { hasUnseenNoticesLocally } from '../lib/noticeSeenStorage';
import { navigateToTab } from '../navigation/navigateToTab';

const VENDOR_CATEGORY_ICONS: Record<VendorCategoryKey, { icon: string; color: string }> = {
  home_maintenance: { icon: 'construct-outline', color: '#0D9488' },
  cleaning_services: { icon: 'sparkles-outline', color: '#7C3AED' },
  security_services: { icon: 'shield-checkmark-outline', color: '#0369A1' },
  utility_services: { icon: 'flash-outline', color: '#CA8A04' },
  home_improvement: { icon: 'color-palette-outline', color: '#DB2777' },
  gardening_services: { icon: 'leaf-outline', color: '#15803D' },
  logistics_moving: { icon: 'cube-outline', color: '#C2410C' },
  events_catering: { icon: 'restaurant-outline', color: '#B45309' },
  health_wellness: { icon: 'medical-outline', color: '#0E7490' },
  daily_essentials: { icon: 'cart-outline', color: '#4F46E5' },
};

type SOSItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string;
  created_by?: {
    id: string | number;
    name?: string | null;
    email?: string | null;
  } | null;
  flat?: {
    id: string;
    flat_number: string;
    floor?: number | null;
  };
};

type HomeCommunityPost = {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
  images?: string[];
};

export default function HomeScreen({
  navigation,
}: {
  navigation: {
    navigate: (a: string, b?: any) => void;
    setOptions: (options: any) => void;
  };
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { localAvatarDataUrl } = useLocalProfileAvatar(user?.id, { refetchOnFocus: true });
  const serverAvatarUri = useMemo(
    () => resolveProfileImageUrl(user?.profile_image ?? undefined, user?.profile_image),
    [user?.profile_image]
  );
  const headerAvatarUri = localAvatarDataUrl ?? serverAvatarUri;
  const [sosVisible, setSosVisible] = useState(false);
  const [sosDescription, setSosDescription] = useState('');
  const [sosLoading, setSosLoading] = useState(false);
  const [sosList, setSosList] = useState<SOSItem[]>([]);
  const [sosListLoading, setSosListLoading] = useState(false);
   const [refreshing, setRefreshing] = useState(false);
  const [vendorServicesOpen, setVendorServicesOpen] = useState(false);
  const styles = makeStyles(colors);

  const [recentVisitors, setRecentVisitors] = useState<
    {
      id: string;
      name: string;
      status?: string | null;
      createdAt?: string | null;
      phone?: string | null;
      vehicleNumber?: string | null;
    }[]
  >([]);
  const [visitorModalVisible, setVisitorModalVisible] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<
    {
      id: string;
      name: string;
      phone?: string | null;
      vehicleNumber?: string | null;
      status?: string | null;
    } | null
  >(null);
  const [visitorActionLoading, setVisitorActionLoading] = useState(false);
  const [recentPosts, setRecentPosts] = useState<HomeCommunityPost[]>([]);
  const [hasNotices, setHasNotices] = useState(false);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<HomeCommunityPost | null>(null);
  const [userFlatNumber, setUserFlatNumber] = useState<string | null>(null);
  const [userBlockName, setUserBlockName] = useState<string | null>(null);
  const [userFloor, setUserFloor] = useState<number | null>(null);
  const [homeDropdownOpen, setHomeDropdownOpen] = useState(false);
  const [essentialContactsVisible, setEssentialContactsVisible] = useState(false);
  const [essentialContactsLoading, setEssentialContactsLoading] = useState(false);
  const [essentialContacts, setEssentialContacts] = useState<
    essentialContactsApi.EssentialContact[]
  >([]);

  const quickActions = useMemo(
    () => [
      {
        id: 'sos',
        label: 'SOS',
        iconBg: '#FFE4E6',
        iconColor: '#D32F2F',
        icon: 'warning-outline',
        target: 'SOS',
      },
      {
        id: 'preapprove',
        label: 'Pre-Approve',
        iconBg: '#FFE5D4',
        iconColor: '#E28B4A',
        icon: 'person-add-outline',
        target: 'VisitorsTab',
      },
      {
        id: 'vendorServices',
        label: 'Vendor Services',
        iconBg: '#E6F8FF',
        iconColor: '#0D9488',
        icon: 'storefront-outline',
        target: null,
      },
      {
        id: 'directory',
        label: 'Essential Contacts',
        iconBg: '#E4F7EC',
        iconColor: '#3D9B5E',
        icon: 'people-outline',
        target: null,
      },
      {
        id: 'events',
        label: 'Events',
        iconBg: '#FFF3E8',
        iconColor: '#E85D04',
        icon: 'calendar-outline',
        target: 'Events',
      },
      {
        id: 'bills',
        label: 'Bills',
        iconBg: '#FFF3D6',
        iconColor: '#B45309',
        icon: 'document-text-outline',
        target: 'Invoices',
      },
      // {
      //   id: 'sos',
      //   label: 'SOS',
      //   iconBg: '#FFE4E6',
      //   icon: 'warning-outline',
      //   target: 'SOS',
      // },
      // {
      //   id: 'services',
      //   label: 'Services',
      //   iconBg: '#E6F8FF',
      //   icon: 'construct-outline',
      //   target: null,
      // },
      // {
      //   id: 'more',
      //   label: 'More',
      //   iconBg: '#F2F2F7',
      //   icon: 'ellipsis-horizontal-outline',
      //   target: null,
      // },
    ],
    [],
  );

  const handleSendSOS = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }
    if (user.society_id == null || user.flat_id == null) {
      Alert.alert(
        'Missing details',
        'Your profile is missing society or flat information. Please update your profile or contact your society admin.'
      );
      return;
    }
    setSosLoading(true);
    try {
      await sosApi.createSOS({
        society_id: user.society_id,
        flat_id: user.flat_id,
        title: 'Emergency SOS',
        created_by: user.id,
        description: sosDescription.trim() || undefined,
      });
      setSosDescription('');
      setSosVisible(false);
      await loadSOSList();
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to send SOS');
    } finally {
      setSosLoading(false);
    }
  };

  const loadSOSList = async () => {
    if (!user?.society_id) {
      setSosList([]);
      return;
    }
    setSosListLoading(true);
    try {
      const res = await sosApi.getSOSBySociety(user.society_id);
      const data = (res as { data?: SOSItem[] })?.data ?? [];
      setSosList(Array.isArray(data) ? data : []);
    } catch {
      setSosList([]);
    } finally {
      setSosListLoading(false);
    }
  };

  const loadEssentialContacts = async () => {
    const societyId = user?.society_id;
    if (societyId == null || String(societyId).trim() === '') {
      Alert.alert(
        'Not available',
        'Your society is not set, so essential contacts cannot be loaded.',
      );
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

  const loadOverviewData = async () => {
    setRefreshing(true);
    if (user?.flat_id == null && user?.society_id == null) {
      setRecentVisitors([]);
      setRecentPosts([]);
      setHasNotices(false);
      setRefreshing(false);
      return;
    }

    try {
      if (user?.flat_id != null) {
        const visitorsRes = await visitorApi.getVisitorsByFlatId(user.flat_id);
        const vData = (visitorsRes as { data?: any[] })?.data ?? [];
        const todayKey = new Date().toDateString();
        setRecentVisitors(
          (Array.isArray(vData) ? vData : [])
            .map((v) => ({
              id: String(v.id),
              name: v.visitor?.name ?? 'Visitor',
              status: v.status,
              createdAt: v.check_in,
              phone: v.visitor?.phone ?? null,
              vehicleNumber: v.visitor?.vehicleinfo ?? null,
            }))
            .filter((v) => v.createdAt && new Date(v.createdAt).toDateString() === todayKey)
            .sort((a, b) => {
              const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bt - at;
            }),
        );

        const postsRes = await postApi.fetchAllPosts();
        const pData = extractPostsArray(postsRes);
        const sorted = [...pData].sort((a: any, b: any) => {
          const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
          return bt - at;
        });
        setRecentPosts(
          sorted.slice(0, 10).map((p: any) => ({
            id: String(p.id),
            title: p.title ?? 'Post',
            description: p.description,
            created_at: p.created_at,
            images: normalizePostImages(p),
          })),
        );
      }

      if (user?.society_id) {
        const notices = await noticeApi.getNoticesBySociety(user.society_id);
        const noticeList = Array.isArray(notices) ? notices : [];
        setHasNotices(user?.id != null ? await hasUnseenNoticesLocally(user.id, noticeList) : noticeList.length > 0);
      } else {
        setHasNotices(false);
      }

    } catch {
      setRecentVisitors([]);
      setRecentPosts([]);
      setHasNotices(false);
      setRefreshing(false);
      return;
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadSOSList();
    loadOverviewData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.society_id]);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.('focus', () => {
      loadOverviewData();
    });

    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, user?.id, user?.society_id]);

  useEffect(() => {
    let cancelled = false;
    const societyId = user?.society_id;
    const flatId = user?.flat_id;
    if (societyId == null || flatId == null) {
      setUserFlatNumber(null);
      setUserBlockName(null);
      setUserFloor(null);
      return;
    }
    (async () => {
      try {
        const blocksRes = await blockApi.fetchBlocksBySociety(societyId);
        const blocks = (blocksRes?.data ?? []) as blockApi.Block[];
        for (const block of blocks) {
          if (cancelled) break;
          const flatsRes = await flatApi.fetchFlatsByBlock(block.id);
          const flats = (flatsRes?.data ?? []) as flatApi.Flat[];
          const found = flats.find((f) => String(f.id) === String(flatId));
          if (found) {
            if (!cancelled) {
              setUserFlatNumber(found.flat_number);
              setUserBlockName(block.name);
              setUserFloor(found.floor ?? null);
            }
            return;
          }
        }
        if (!cancelled) {
          setUserFlatNumber(null);
          setUserBlockName(null);
          setUserFloor(null);
        }
      } catch {
        if (!cancelled) {
          setUserFlatNumber(null);
          setUserBlockName(null);
          setUserFloor(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.society_id, user?.flat_id]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.sosIconBtn}
          onPress={() => {
            if (!sosLoading) {
              setSosVisible(true);
            }
          }}
        >
          <Text style={styles.sosIconText}>SOS</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, sosLoading, styles.sosIconBtn, styles.sosIconText]);

  const handleResolveSOS = async (item: SOSItem) => {
    try {
      await sosApi.updateSOS(item.id, 'RESOLVED');
      await loadSOSList();
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to update SOS');
    }
  };

  const handleDeleteSOS = async (item: SOSItem) => {
    Alert.alert('Delete SOS', 'Are you sure you want to delete this SOS?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await sosApi.deleteSOS(item.id);
            await loadSOSList();
          } catch (e) {
            Alert.alert('Error', (e as Error).message || 'Failed to delete SOS');
          }
        },
      },
    ]);
  };

  const handleVisitorAction = async (status: 'approve' | 'unapprove') => {
    if (!selectedVisitor) return;
    setVisitorActionLoading(true);
    try {
      await visitorApi.updateVisitorStatus(selectedVisitor.id, status);
      setVisitorModalVisible(false);
      setSelectedVisitor(null);
      await loadOverviewData();
    } catch (e) {
      Alert.alert('Error', (e as Error).message || `Failed to ${status} visitor`);
    } finally {
      setVisitorActionLoading(false);
    }
  };

  const openVisitorModal = (visitor: (typeof recentVisitors)[0]) => {
    if (visitor.status && visitor.status !== 'waiting') {
      if (visitor.status === 'approve') {
        Alert.alert('Approved', 'This visitor is already approved.');
        return;
      }
      if (visitor.status === 'unapprove') {
        Alert.alert('Rejected', 'This visitor is already rejected.');
        return;
      }
      Alert.alert('Status', `This visitor is already ${visitor.status}.`);
      return;
    }
    setSelectedVisitor({
      id: visitor.id,
      name: visitor.name,
      phone: visitor.phone ?? null,
      vehicleNumber: visitor.vehicleNumber ?? null,
      status: visitor.status,
    });
    setVisitorModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadSOSList();
              loadOverviewData();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.homeSectionTouchable}
            activeOpacity={0.7}
            onPress={() => setHomeDropdownOpen((prev) => !prev)}
          >
            <View style={styles.homeSectionIconCircle}>
              <Ionicons name="location-sharp" size={20} color={colors.primary} />
            </View>
            <View style={styles.homeSectionTextBlock}>
              <Text style={styles.homeSectionLabel}>MY HOME</Text>
              <View style={styles.homeSectionTitleRow}>
                <Text style={styles.homeSectionTitle} numberOfLines={1}>
                  {userBlockName && userFlatNumber
                    ? `${userBlockName} - ${userFlatNumber}`.toUpperCase()
                    : userFlatNumber
                      ? `FLAT ${userFlatNumber}`.toUpperCase()
                      : 'HOME'}
                </Text>
                <Ionicons
                  name={homeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#666666"
                  style={styles.homeSectionChevron}
                />
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerNotificationBtn}
              onPress={() => {
                navigateToTab(navigation, 'NoticeTab');
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {hasNotices ? <View style={styles.headerNotificationDot} /> : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerAvatar}
              onPress={() => {
                navigateToTab(navigation, 'ProfileTab');
              }}
            >
              {headerAvatarUri ? (
                <Image source={{ uri: headerAvatarUri }} style={styles.headerAvatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.headerAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {homeDropdownOpen && (
          <View style={styles.homeDropdown}>
            <View style={styles.homeDropdownContent}>
              {userBlockName || userFlatNumber ? (
                <Text style={styles.homeDropdownLine} numberOfLines={2}>
                  {[
                    userBlockName,
                    userFlatNumber ? `Flat ${userFlatNumber}` : null,
                    userFloor != null ? `Floor ${userFloor}` : null,
                  ]
                    .filter(Boolean)
                    .join(' - ')}
                </Text>
              ) : (
                <Text style={styles.homeDropdownLine}>No address on file</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.entrySectionHeaderRow}>
          <Text style={styles.entrySectionTitle}>Entry Updates</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VisitorsTab')}>
            <Text style={styles.entrySectionActionText}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.entrySectionCard}>
          <Text style={styles.entryTodayLabel}>Today's Entry</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.entryRow}
          >
            {recentVisitors.length === 0 ? (
              <Text style={styles.emptyInlineText}>No visitors today</Text>
            ) : (
              recentVisitors.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.entryChip}
                  onPress={() => openVisitorModal(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.entryAvatar}>
                    {item.status ? (
                      <View
                        style={[
                          styles.entryStatusDot,
                          item.status === 'approve'
                            ? styles.entryStatusDotApproved
                            : item.status === 'unapprove'
                              ? styles.entryStatusDotRejected
                              : item.status === 'waiting'
                                ? styles.entryStatusDotWaiting
                                : null,
                        ]}
                      />
                    ) : null}
                    <Text style={styles.entryAvatarText}>{item.name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.entryName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        <View style={styles.quickActionsCard}>
          <View style={styles.quickActionsHeaderRow}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            {/* <TouchableOpacity style={styles.quickActionCustomise} onPress={() => {}}>
              <Ionicons name="options-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionActionText}>Customise</Text>
            </TouchableOpacity> */}
          </View>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionItem}
                activeOpacity={0.8}
                onPress={async () => {
                  if (action.id === 'preapprove') {
                    navigation.navigate('VisitorsTab', {
                      screen: 'VisitorForm',
                      params: { onSaved: loadOverviewData, source: 'home' },
                    });
                    return;
                  }
                  if (action.id === 'vendorServices') {
                    setVendorServicesOpen((prev) => !prev);
                    return;
                  }
                  if (action.id === 'directory') {
                    setEssentialContactsVisible(true);
                    await loadEssentialContacts();
                    return;
                  }
                  if (action.target) {
                    navigation.navigate(action.target);
                  }
                }}
              >
                <View style={[styles.quickActionIconCircle, { backgroundColor: action.iconBg }]}>
                  <Ionicons name={action.icon} size={24} color={action.iconColor || colors.text} />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={2}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {vendorServicesOpen ? (
          <View style={styles.vendorSection}>
            <View style={styles.vendorSectionHeaderRow}>
              <View style={styles.vendorSectionTitleBlock}>
                <View style={styles.vendorSectionIconWrap}>
                  <Ionicons name="storefront" size={22} color={colors.primary} />
                </View>
                <View style={styles.vendorSectionTitleTextCol}>
                  <Text style={styles.vendorSectionTitle}>Vendor Services</Text>
                  <Text style={styles.vendorSectionSubtitle}>Browse by category</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setVendorServicesOpen(false)}
                activeOpacity={0.75}
                style={styles.vendorSectionCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.vendorCategoriesWrap}>
              {VENDOR_CATEGORIES.map((c) => {
                const iconUi = VENDOR_CATEGORY_ICONS[c.key];
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={styles.vendorCategoryItem}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('VendorsByCategory', { category: c.key })}
                  >
                    {/* Gradient removed: using colorful icons directly */}
                    <View
                      style={[
                        styles.vendorCategoryIconBox,
                        { borderColor: iconUi.color, borderWidth: 1.5 },
                      ]}
                    >
                      <Ionicons name={iconUi.icon} size={24} color={iconUi.color} />
                    </View>
                    <Text style={styles.vendorCategoryLabel} numberOfLines={2}>
                      {c.label.replace(' ', '\n')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Community Posts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.communityPostsList}
          >
            {recentPosts.length === 0 ? (
              <Text style={styles.emptyInlineText}>No community updates yet.</Text>
            ) : null}
            {recentPosts.map((post) => {
              const hasImages = (post.images?.length ?? 0) > 0;
              const firstUri = post.images?.[0];
              return (
              <TouchableOpacity
                key={`post-${post.id}`}
                style={[styles.postCardHorizontal, !hasImages && styles.postCardNoImage]}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedPost(post);
                  setPostModalVisible(true);
                }}
              >
                {firstUri ? (
                  <ImageBackground
                    source={{ uri: firstUri }}
                    style={styles.postImage}
                    resizeMode="cover"
                  >
                    {(post.images?.length ?? 0) > 1 ? (
                      <View style={styles.postImageCountBadge}>
                        <Text style={styles.postImageCountText}>+{(post.images?.length ?? 0) - 1}</Text>
                      </View>
                    ) : null}
                  </ImageBackground>
                ) : null}
                <View style={[styles.postBody, !hasImages && styles.postBodyNoImage]}>
                  <View style={styles.postMetaRow}>
                    {post.created_at ? (
                      <Text style={styles.postTimeSecondary}>
                        {`${new Date(post.created_at).toLocaleDateString()} • ${new Date(
                          post.created_at,
                        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.postTitleLarge} numberOfLines={2}>
                    {post.title}
                  </Text>
                  {post.description ? (
                    <Text style={styles.postDescription} numberOfLines={3}>
                      {post.description}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.postReadMoreWrap}
                  onPress={() => {
                    setSelectedPost(post);
                    setPostModalVisible(true);
                  }}
                >
                  <Text style={styles.postReadMoreEmphasis}>Read more →</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
            })}
          </ScrollView>
        </View>

        <View style={styles.sosSection}>
          <View style={styles.sosSectionHeader}>
            <Text style={styles.sosSectionTitle}>SOS alerts in your society</Text>
            {sosListLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          {sosList.length === 0 && !sosListLoading ? (
            <Text style={styles.sosEmptyText}>No SOS alerts yet.</Text>
          ) : (
            sosList.map((item) => (
              <View
                key={item.id}
                style={styles.sosCard}
              >
                {(() => {
                  const createdByMe =
                    user?.id != null && item.created_by?.id != null && String(item.created_by.id) === String(user.id);
                  const canEditSOS =
                    item.flat?.id != null && user?.flat_id != null && String(item.flat.id) === String(user.flat_id);
                  const isResolved = item.status === 'RESOLVED';

                  const blockLabel = createdByMe && userBlockName ? `Block ${userBlockName}` : null;
                  const villaNumber = createdByMe ? userFlatNumber ?? item.flat?.flat_number : item.flat?.flat_number;
                  const villaLabel = villaNumber ? `Villa ${villaNumber}` : null;
                  const location = [blockLabel, villaLabel].filter(Boolean).join(', ');

                  const badgeLabel = isResolved ? 'RESOLVED' : 'ACTIVE';
                  const descriptionText = item.description?.trim() ? item.description.trim() : null;
                  const subtitle = descriptionText ?? `SOS active${location ? ` in ${location}` : ''}`;

                  const title = createdByMe
                    ? 'Home'
                    : item.flat?.flat_number
                      ? `Flat ${item.flat.flat_number}${item.flat.floor != null ? ` • Floor ${item.flat.floor}` : ''}`
                      : 'SOS alert';

                  return (
                    <>
                      <View style={styles.sosCardHeader}>
                        <Text style={styles.sosCardTitle}>{title}</Text>
                        <Text
                          style={[
                            styles.sosStatusBadge,
                            isResolved ? styles.sosStatusResolved : styles.sosStatusActive,
                          ]}
                        >
                          {badgeLabel}
                        </Text>
                      </View>

                      <Text style={styles.sosCardSubtitle}>{subtitle}</Text>

                      {item.created_at ? (
                        <View style={styles.sosCardTimeRow}>
                          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                          <Text style={styles.sosDate}>{formatDateTime12hTimeFirst(item.created_at)}</Text>
                        </View>
                      ) : null}
                      {canEditSOS ? (
                        <View style={styles.sosCardFooter}>
                          {!isResolved ? (
                            <TouchableOpacity
                              onPress={() => handleResolveSOS(item)}
                              style={styles.sosActionBtn}
                              disabled={sosListLoading}
                            >
                              <Text style={styles.sosActionText}>Mark resolved</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ flex: 1 }} />
                          )}

                          <TouchableOpacity
                            onPress={() => handleDeleteSOS(item)}
                            style={styles.sosDeleteBtn}
                            disabled={sosListLoading}
                          >
                            <Text style={styles.sosDeleteText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      <View pointerEvents="none" style={styles.sosBottomGradientWrapper}>
                        <LinearGradient
                          style={styles.sosBottomGradientBar}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          colors={isResolved ? ['#16A34A', '#15803D'] : ['#FF6A00', '#572400']}
                        />
                      </View>
                    </>
                  );
                })()}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={sosVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sosLoading) {
            setSosVisible(false);
          }
        }}
      >
        <View style={styles.sosModalOverlay}>
          <View style={styles.sosModalCard}>
            <Text style={styles.sosModalTitle}>Send SOS</Text>
            <Text style={styles.sosModalHint}>This will alert your society from your registered flat.</Text>
            <Text style={styles.sosModalLabel}>Message (optional)</Text>
            <TextInput
              style={styles.sosModalInput}
              placeholder="Describe the emergency..."
              placeholderTextColor={colors.textSecondary}
              value={sosDescription}
              onChangeText={setSosDescription}
              editable={!sosLoading}
              multiline
              numberOfLines={3}
            />
            <View style={styles.sosModalButtonsRow}>
              <TouchableOpacity
                style={styles.sosCancelBtn}
                onPress={() => {
                  if (!sosLoading) {
                    setSosVisible(false);
                  }
                }}
                disabled={sosLoading}
              >
                <Text style={styles.sosCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sosSendBtn, sosLoading && styles.sosSendBtnDisabled]}
                onPress={handleSendSOS}
                disabled={sosLoading}
              >
                {sosLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sosSendText}>Send SOS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={visitorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!visitorActionLoading) {
            setVisitorModalVisible(false);
            setSelectedVisitor(null);
          }
        }}
      >
        <View style={styles.sosModalOverlay}>
          <View style={styles.sosModalCard}>
            <Text style={styles.sosModalTitle}>Visitor details</Text>
            {selectedVisitor ? (
              <>
                <View style={styles.visitorDetailRow}>
                  <Text style={styles.visitorDetailLabel}>Name</Text>
                  <Text style={styles.visitorDetailValue}>{selectedVisitor.name}</Text>
                </View>
                {selectedVisitor.phone ? (
                  <View style={styles.visitorDetailRow}>
                    <Text style={styles.visitorDetailLabel}>Phone</Text>
                    <Text style={styles.visitorDetailValue}>{selectedVisitor.phone}</Text>
                  </View>
                ) : null}
                {selectedVisitor.vehicleNumber ? (
                  <View style={styles.visitorDetailRow}>
                    <Text style={styles.visitorDetailLabel}>Vehicle number</Text>
                    <Text style={styles.visitorDetailValue}>{selectedVisitor.vehicleNumber}</Text>
                  </View>
                ) : null}
                <View style={styles.visitorModalButtonsRow}>
                  <TouchableOpacity
                    style={styles.visitorDisapproveBtn}
                    onPress={() => handleVisitorAction('unapprove')}
                    disabled={visitorActionLoading}
                  >
                    <Text style={styles.visitorDisapproveText}>Disapprove</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.visitorApproveBtn, visitorActionLoading && styles.sosSendBtnDisabled]}
                    onPress={() => handleVisitorAction('approve')}
                    disabled={visitorActionLoading}
                  >
                    {visitorActionLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.visitorApproveText}>Approve</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.visitorModalCloseBtn}
                  onPress={() => {
                    if (!visitorActionLoading) {
                      setVisitorModalVisible(false);
                      setSelectedVisitor(null);
                    }
                  }}
                  disabled={visitorActionLoading}
                >
                  <Text style={styles.sosCancelText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
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
          style={styles.essentialModalOverlay}
          onPress={() => setEssentialContactsVisible(false)}
        />
        <View style={styles.essentialModalCenter}>
          <View style={styles.essentialModalCard}>
            <View style={styles.essentialModalHeader}>
              <Text style={styles.essentialModalTitle}>Essential contacts</Text>
              <TouchableOpacity
                onPress={() => setEssentialContactsVisible(false)}
                style={styles.essentialModalCloseBtn}
              >
                <Text style={styles.essentialModalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            {essentialContactsLoading ? (
              <View style={styles.essentialModalLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.essentialModalHint}>Loading contacts…</Text>
              </View>
            ) : essentialContacts.length === 0 ? (
              <View style={styles.essentialModalEmpty}>
                <Text style={styles.essentialModalHint}>No essential contacts found.</Text>
              </View>
            ) : (
              <FlatList
                data={essentialContacts}
                keyExtractor={(item, index) => String(item.id ?? index)}
                contentContainerStyle={styles.essentialModalList}
                renderItem={({ item }) => {
                  const line1 = [item.title, item.designation].filter(Boolean).join(' • ');
                  const phones = [item.mobile_number1, item.mobile_number2]
                    .filter(Boolean)
                    .join(' / ');
                  return (
                    <View style={styles.essentialContactRow}>
                      <Text style={styles.essentialContactName}>{item.name || '-'}</Text>
                      {!!line1 && <Text style={styles.essentialContactMeta}>{line1}</Text>}
                      {!!phones && <Text style={styles.essentialContactPhone}>{phones}</Text>}
                    </View>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.essentialContactDivider} />}
              />
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={postModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPostModalVisible(false);
          setSelectedPost(null);
        }}
      >
        <View style={styles.sosModalOverlay}>
          <View style={styles.sosModalCard}>
            {selectedPost ? (
              <>
                <Text style={styles.sosModalTitle}>Post details</Text>
                <Text style={[styles.postTitleLarge, { paddingHorizontal: 0 }]}>
                  {selectedPost.title}
                </Text>
                {selectedPost.created_at ? (
                  <Text style={styles.postTimeSecondary}>
                    {formatDateTime12hTimeFirst(selectedPost.created_at)}
                  </Text>
                ) : null}
                <ScrollView style={styles.postModalBody} showsVerticalScrollIndicator={false}>
                  {selectedPost.description ? (
                    <Text style={[styles.postModalDesc, { paddingHorizontal: 0 }]}>
                      {selectedPost.description}
                    </Text>
                  ) : (
                    <Text style={styles.postModalDescPlaceholder}>No description</Text>
                  )}
                  {selectedPost.images && selectedPost.images.length ? (
                    <View style={styles.postModalImageColumn}>
                      {selectedPost.images.map((uri, index) => (
                        <Image
                          key={`${selectedPost.id}-img-${index}`}
                          source={{ uri }}
                          style={styles.postModalImage}
                        />
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              </>
            ) : null}
            <View style={[styles.sosModalButtonsRow, { marginTop: 16 }]}>
              <TouchableOpacity
                style={styles.sosCancelBtn}
                onPress={() => {
                  setPostModalVisible(false);
                  setSelectedPost(null);
                }}
              >
                <Text style={styles.sosCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // USED: root <View> of screen (line ~307)
    container: {
      flex: 1,
      backgroundColor: colors.maincontainerbackground,
      paddingTop: 16,
    },
    // USED: ScrollView contentContainerStyle (line ~309)
    scroll: {
      paddingBottom: 40,
    },
    // USED: header row wrapping "My Home" + SOS + avatar (line ~321)
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 20,
      marginTop: 4,
    },
    homeSectionTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingRight: 10,
    },
    homeSectionIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#FCEFE4',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    homeSectionTextBlock: {
      flex: 1,
    },
    homeSectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#666666',
      marginBottom: 2,
      letterSpacing: 0.5,
    },
    homeSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    homeSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#333333',
      letterSpacing: 0.3,
      flex: 1,
    },
    homeSectionChevron: {
      marginLeft: 2,
    },
    homeDropdown: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 16,
    },
    homeDropdownContent: {
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    homeDropdownTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: '#666666',
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    homeDropdownLine: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
    },
    // USED: "My Home" label text (line ~323) - kept for compatibility
    headerLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    // USED: "Flat X" / "Home" title (line ~324) - kept for compatibility
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    // USED: wrapper for SOS pill + avatar in header (line ~328)
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    // USED: SOS button in header (line ~330)
    headerSosPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // USED: "SOS" text in header pill (line ~337)
    headerSosText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    // USED: notification bell button in Home header
    headerNotificationBtn: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    headerNotificationDot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#EF4444',
    },
    // USED: profile avatar TouchableOpacity in header (line ~339)
    headerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    headerAvatarImage: {
      width: 36,
      height: 36,
    },
    // USED: first letter of user name in avatar (line ~344)
    headerAvatarText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    // USED: generic card container for sections like Community Posts and SOS
    sectionCard: {
      marginHorizontal: 16,
      paddingBottom: 14,
      marginBottom: 16,
    },
    // USED: Entry Updates section card (separate so we can style independently)
    entrySectionCard: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 }, // push shadow down
      shadowOpacity: 0.05,
      shadowRadius: 8,                       // soft blur
      elevation: 4,  
    },
    // USED: horizontal ScrollView content for community posts (line ~316)
    communityPostsList: {
      flexDirection: 'row',
      paddingRight: 16,
    },
    // USED: each notice/post card in Community Posts horizontal list (lines ~319, 330)
    postCardHorizontal: {
      width: 280,
      minWidth: 280,
      minHeight: 240,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
      overflow: 'hidden',
    },
    postCardNoImage: {
      paddingTop: 8,
    },
    // USED: section header row (title + "View All" / "Customise") in generic sections
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    // USED: "Entry Updates", "Community Posts", "Quick Actions" section titles (lines ~354, 313, ~285)
    sectionTitle: {
      fontSize: 16,
      paddingBottom: 18,
      fontWeight: '600',
      color: colors.text,
    },
    // USED: "View All", "Customise" link text (lines ~356, ~287)
    sectionActionText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    // USED: header row specifically for Entry Updates
    entrySectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      marginHorizontal: 16,
    },
    // USED: "Entry Updates" title, styled separately if needed
    entrySectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    // USED: "View All" link for Entry Updates
    entrySectionActionText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    // USED: "Today's Entry" label text above visitor avatars
    entryTodayLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      marginLeft: 4,
    },
    // USED: horizontal ScrollView content for visitor entry chips (line ~358)
    entryRow: {
      paddingRight: 16,
    },
    // USED: each waiting visitor chip (avatar + label) in Entry Updates
    entryChip: {
      alignItems: 'center',
      marginRight: 20,
    },
    // USED: avatar circle inside visitor chip (line ~372)
    entryAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#FFE4D1',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      marginBottom: 6,
    },
    entryStatusDot: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.surface,
      backgroundColor: '#9CA3AF',
    },
    entryStatusDotApproved: {
      backgroundColor: '#16A34A',
    },
    entryStatusDotRejected: {
      backgroundColor: '#DC2626',
    },
    entryStatusDotWaiting: {
      backgroundColor: '#F59E0B',
    },
    // USED: first letter of visitor name in chip (line ~373)
    entryAvatarText: {
      fontWeight: '700',
      color: colors.text,
    },
    // USED: visitor name in chip (line ~375)
    entryName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    // USED: "No visitors waiting", "No community updates yet." (lines ~359, 315)
    emptyInlineText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    // Quick Actions: Customise button (icon + text)
    quickActionCustomise: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    // Quick Actions card container (separate from other section cards)
    quickActionsCard: {
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      paddingBottom: 6,
      marginBottom: 0,
    },
    // Quick Actions header row
    quickActionsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    // Quick Actions title text
    quickActionsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    // USED: Quick Actions grid – 4 columns, 2 rows, consistent spacing
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingHorizontal: 4,
    },
    // USED: each Quick Action button (icon + label)
    quickActionItem: {
      width: '23%',
      alignItems: 'center',
      marginBottom: 8,
    },
    // USED: Quick Action icon container – squircle, soft shadow
    quickActionIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 3,
    },
    // USED: only in commented Quick Action first letter (line ~301)
    actionIconLetter: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    // USED: Quick Action label below icon
    quickActionLabel: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.text,
    },

    vendorSection: {
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 12,
    },
    vendorSectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      paddingTop: 2,
    },
    vendorSectionTitleBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    vendorSectionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surfaceVariant,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    vendorSectionTitleTextCol: {
      flex: 1,
    },
    vendorSectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    vendorSectionSubtitle: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    vendorSectionCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    vendorCategoriesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
      marginTop: 4,
    },
    vendorCategoryItem: {
      width: '33.33%',
      paddingHorizontal: 6,
      alignItems: 'center',
      marginBottom: 14,
    },
    vendorCategoryIconBox: {
      width: 52,
      height: 52,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      backgroundColor: 'transparent',
    },
    vendorCategoryLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 14,
    },
    // UNUSED: vertical post card variant (screen uses postCardHorizontal)
    postCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 10,
    },
    postImage: {
      width: '100%',
      height: 140,
      backgroundColor: '#E5F2E8',
      overflow: 'hidden',
    },
    postImageCountBadge: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    postImageCountText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 12,
    },
    postModalBody: {
      marginTop: 12,
      maxHeight: 320,
    },
    postModalDesc: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      marginBottom: 12,
    },
    postModalDescPlaceholder: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    postModalImageColumn: {
      gap: 10,
    },
    postModalImage: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      marginBottom: 10,
      backgroundColor: '#f1f1f1',
    },
    postBody: {
      flexGrow: 1,
    },
    postBodyNoImage: {
      paddingTop: 4,
    },
    // Row with type + date
    postMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
    },
    // "Event" / "Notice" pill
    postTypePill: {
      fontSize: 12,
      fontWeight: '700',
      color: '#1B873F',
    },
    // Secondary date text
    postTimeSecondary: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    postDateTimeColumn: {
      alignItems: 'flex-end',
    },
    // Large post title below meta
    postTitleLarge: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 4,
    },
    // USED: post description in Community Posts (line ~339)
    postDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingHorizontal: 14,
      paddingTop: 2,
      paddingBottom: 8,
    },
    // "Read more →" link
    postReadMoreEmphasis: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF6A00',
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    postReadMoreWrap: {
      marginTop: 'auto',
    },
    // USED: headerRight SOS button in navigation.setOptions (line ~244)
    sosIconBtn: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    // USED: "SOS" text in headerRight button (line ~252)
    sosIconText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    // USED: modal overlay (dark backdrop) for SOS and Visitor modals (lines ~384, 421)
    sosModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    // USED: modal card container for SOS and Visitor modals (lines ~385, 422)
    sosModalCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // USED: "Send SOS", "Visitor details" modal title (lines ~386, 423)
    sosModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    // USED: hint text in SOS modal (line ~387)
    sosModalHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    // USED: "Message (optional)" label in SOS modal (line ~388)
    sosModalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    // USED: TextInput in SOS modal (line ~390)
    sosModalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: 16,
    },
    // USED: Cancel + Send SOS buttons row (line ~399)
    sosModalButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 4,
    },
    // USED: Cancel button in SOS modal (line ~401)
    sosCancelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    // USED: "Cancel" in SOS modal, "Close" in Visitor modal (lines ~409, 441)
    sosCancelText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    // USED: Send SOS button (line ~411)
    sosSendBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 110,
    },
    // USED: disabled state for Send SOS and Approve buttons (lines ~411, 431)
    sosSendBtnDisabled: {
      opacity: 0.7,
    },
    // USED: "Send SOS" button text (line ~416)
    sosSendText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    // USED: each row in Visitor modal (Name, Phone, Vehicle) (lines ~425, 428, 432)
    visitorDetailRow: {
      marginBottom: 12,
    },
    // USED: "Name", "Phone", "Vehicle number" labels (lines ~426, 429, 433)
    visitorDetailLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
      fontWeight: '500',
    },
    // USED: visitor detail values in modal (lines ~427, 430, 434)
    visitorDetailValue: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '600',
    },
    // USED: Disapprove + Approve row in Visitor modal (line ~436)
    visitorModalButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
      marginBottom: 8,
    },
    // USED: Disapprove button (line ~438)
    visitorDisapproveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      minWidth: 110,
    },
    // USED: "Disapprove" text (line ~442)
    visitorDisapproveText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    // USED: Approve button (line ~444)
    visitorApproveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 110,
    },
    // USED: "Approve" text (line ~450)
    visitorApproveText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    // USED: Close button at bottom of Visitor modal (line ~454)
    visitorModalCloseBtn: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    // USED: wrapper for "SOS alerts in your society" section (line ~351)
    sosSection: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
    },
    // USED: header row of SOS section with title + ActivityIndicator (line ~352)
    sosSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    // USED: "SOS alerts in your society" title (line ~353)
    sosSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    // USED: "No SOS alerts yet." empty state (line ~356)
    sosEmptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      paddingVertical: 8,
    },
    // USED: each SOS alert card in list (line ~359)
    sosCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 4,
      elevation: 4,
    },
    sosBottomGradientWrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 4,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
      overflow: 'hidden',
    },
    sosBottomGradientBar: { flex: 1 },
    // USED: flat number + status badge row in SOS card (line ~360)
    sosCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    // USED: "Flat X • Floor Y" / "SOS alert" in card (lines ~361-365)
    sosCardTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.2,
    },
    // USED: status badge (e.g. RESOLVED) in SOS card (line ~367)
    sosStatusBadge: {
      fontSize: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      color: '#B45309',
      backgroundColor: '#FFE7D0',
      overflow: 'hidden',
      fontWeight: '800',
    },
    sosStatusActive: {
      backgroundColor: '#FFE7D0',
      color: '#D35400',
    },
    sosStatusResolved: {
      backgroundColor: '#D1FAE5',
      color: '#15803D',
    },
    sosCardSubtitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    // USED: SOS description in card (line ~370)
    sosCardDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    // USED: row with clock icon + timestamp in SOS card
    sosCardTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    // USED: created_at date in SOS card
    sosCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    sosDate: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    // USED: "Mark resolved" button
    sosActionBtn: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 14,
      alignItems: 'center',
    },
    sosActionText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '700',
    },
    // USED: Delete button in SOS card (line ~369)
    sosDeleteBtn: {
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    // USED: "Delete" text (line ~370)
    sosDeleteText: {
      fontSize: 16,
      color: '#B91C1C',
      fontWeight: '800',
    },

    essentialModalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    essentialModalCenter: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    essentialModalCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: '80%',
      overflow: 'hidden',
    },
    essentialModalHeader: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    essentialModalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    essentialModalCloseBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    essentialModalCloseText: {
      color: colors.text,
      fontWeight: '700',
    },
    essentialModalLoading: { padding: 18, gap: 10, alignItems: 'center' },
    essentialModalEmpty: { padding: 18 },
    essentialModalHint: { color: colors.textSecondary, fontWeight: '600' },
    essentialModalList: { padding: 16 },
    essentialContactRow: { paddingVertical: 10 },
    essentialContactName: { color: colors.text, fontSize: 16, fontWeight: '800' },
    essentialContactMeta: { color: colors.textSecondary, marginTop: 4, fontWeight: '600' },
    essentialContactPhone: { color: colors.text, marginTop: 6, fontWeight: '700' },
    essentialContactDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
  });
}
