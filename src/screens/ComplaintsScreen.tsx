 import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Image,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme, type ThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as complaintApi from '../api/complaint';
import { resolveComplaintAttachmentUri } from '../lib/postImages';
import { ENV } from '../config/env';

type ComplaintItem = {
  id: number;
  title: string;
  description?: string;
  status?: string;
  created_at?: string;
  attachment_url?: string | null;
};

export default function ComplaintsScreen({ navigation }: { navigation: { navigate: (a: string, p?: object) => void } }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [list, setList] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'rejected'>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) {
      console.log('[Complaints] Skipping fetch, missing user id', { user });
      // If user id isn't available (or can't be resolved), don't keep the
      // screen stuck in the loading state.
      setList([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const path = `/complaint/raised-by/${user.id}`;
    const fullUrl = `${ENV.BACKEND_URL}${path}`;
    console.log('[Complaints] API call:', 'GET', fullUrl);

    try {
      const data = await complaintApi.getComplaintsByRaisedBy(user.id);
      try {
        console.log('[Complaints] Response data:', JSON.stringify(data, null, 2));
      } catch {
        console.log('[Complaints] Response data (object):', data);
      }

      const listData = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data)
        ? (data as any)
        : [];

      console.log('[Complaints] Parsed rows:', listData.length, 'items');

      setList(listData as ComplaintItem[]);
    } catch (e) {
      console.log('[Complaints] Error while fetching complaints:', e);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete complaint', 'Are you sure you want to delete this complaint?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await complaintApi.deleteComplaint(id);
            load();
          } catch (e) {
            Alert.alert('Error', (e as Error).message || 'Failed to delete complaint');
          }
        },
      },
    ]);
  };

  const handleMarkComplete = (item: ComplaintItem) => {
    const s = (item.status ?? '').toString().trim().toLowerCase();
    if (s === 'completed') return;

    Alert.alert('Mark as complete', 'Are you sure this complaint is resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, complete',
        onPress: async () => {
          try {
            await complaintApi.updateComplaintStatus(item.id, 'completed');
            load();
          } catch (e) {
            Alert.alert('Error', (e as Error).message || 'Failed to update complaint');
          }
        },
      },
    ]);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const styles = makeStyles(colors);

  const formatComplaintDate = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    // Match the screenshot format like "OCT 24, 2023"
    const v = dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    return v.toUpperCase();
  };

  const getStatusPillStyle = (status?: string) => {
    const s = (status ?? 'open').toString().trim().toLowerCase();
    // Map backend status -> pill colors
    if (s === 'open') {
      return {
        backgroundColor: colors.primary + '22',
        color: colors.primary,
        borderColor: 'transparent',
      };
    }

    if (s === 'completed') {
      return {
        backgroundColor: colors.success + '22',
        color: colors.success,
        borderColor: 'transparent',
      };
    }

    if (s === 'rejected') {
      return {
        backgroundColor: colors.error + '22',
        color: colors.error,
        borderColor: 'transparent',
      };
    }

    if (s === 'in_progress' || s === 'in-progress') {
      return {
        backgroundColor: colors.accent + '22',
        color: colors.accent,
        borderColor: 'transparent',
      };
    }

    // Fallback for unexpected statuses
    return {
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      borderColor: colors.border,
    };
  };

  const getPeopleCountMaybe = (item: ComplaintItem) => {
    // Your backend response may include a count field (e.g. replies/comments).
    // We keep this defensive so the UI won't break if the field doesn't exist.
    const anyItem = item as any;
    const raw =
      anyItem?.people_count ??
      anyItem?.comments_count ??
      anyItem?.replies_count ??
      anyItem?.responses_count ??
      null;
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(String(raw));
    if (!Number.isFinite(n)) return null;
    const safe = Math.max(0, Math.floor(n));
    return safe;
  };

  const stats = useMemo(() => {
    const total = list.length;
    let inProgress = 0;
    let resolved = 0;
    for (const c of list) {
      const s = (c.status ?? '').toString().trim().toLowerCase();
      if (s === 'in_progress' || s === 'in-progress') inProgress++;
      if (s === 'completed') resolved++;
    }
    return { total, inProgress, resolved };
  }, [list]);

  const filteredList = useMemo(() => {
    let result = list;

    if (activeFilter !== 'all') {
      result = result.filter((c) => {
        const s = (c.status ?? '').toString().trim().toLowerCase();
        if (activeFilter === 'in_progress') return s === 'in_progress' || s === 'in-progress';
        if (activeFilter === 'completed') return s === 'completed';
        if (activeFilter === 'rejected') return s === 'rejected';
        if (activeFilter === 'open') return s === 'open';
        return true;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          (c.title ?? '').toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q),
      );
    }

    return result;
  }, [list, search, activeFilter]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My complaints</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('ComplaintForm', { onSaved: load })}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchAndStatsWrap}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search your complaints..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, activeFilter !== 'all' && styles.filterBtnActive]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={22} color={activeFilter !== 'all' ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRowContent}
          >
            <TouchableOpacity
              style={styles.statCardWrap}
              onPress={() => setActiveFilter('all')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primaryLight, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                // style={styles.statCard}
                style={{ flex: 1, borderRadius: 16, justifyContent: 'space-between', paddingVertical: 0, paddingHorizontal: 0}}
              >
                <View style={styles.statCard}>
                <Text style={[styles.statLabel, styles.statLabelActive]} numberOfLines={1}>
                  TOTAL FILED
                </Text>
                <Text style={[styles.statNumber, styles.statNumberActive]}>
                  {stats.total}
                </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCardWrap}
              onPress={() => setActiveFilter('in_progress')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.statCard,
                  styles.statCardInactive,
                  activeFilter === 'in_progress' && styles.statCardSelected,
                ]}
              >
                <Text style={styles.statLabel} numberOfLines={1}>
                  IN PROGRESS
                </Text>
                <Text style={styles.statNumber}>{stats.inProgress}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCardWrap}
              onPress={() => setActiveFilter('completed')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.statCard,
                  styles.statCardInactive,
                  activeFilter === 'completed' && styles.statCardSelected,
                ]}
              >
                <Text style={styles.statLabel} numberOfLines={1}>
                  RESOLVED
                </Text>
                <Text style={styles.statNumber}>{stats.resolved}</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No complaints yet</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('ComplaintForm', { onSaved: load })}
            >
              <Text style={styles.emptyBtnText}>Raise a complaint</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const pill = getStatusPillStyle(item.status);
          const pillLabel = (item.status ?? 'open').toString().trim().toUpperCase().replace('IN_PROGRESS', 'IN PROGRESS');

          return (
            <View style={styles.card}>
              <View style={styles.topRow}>
                <View style={[styles.statusPill, { backgroundColor: pill.backgroundColor, borderColor: pill.borderColor }]}>
                  <Text style={[styles.statusPillText, { color: pill.color }]}>
                    {pillLabel}
                  </Text>
                </View>
                {item.created_at ? <Text style={styles.cardDate}>{formatComplaintDate(item.created_at)}</Text> : null}
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>

              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}

              {item.attachment_url ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    const uri = resolveComplaintAttachmentUri(item.attachment_url);
                    setSelectedPhotoUri(uri || null);
                    setPhotoModalVisible(true);
                  }}
                >
                  <View style={styles.thumbWrap}>
                    <Image
                      source={{ uri: resolveComplaintAttachmentUri(item.attachment_url) }}
                      style={styles.cardThumb}
                      resizeMode="cover"
                    />
                  </View>
                </TouchableOpacity>
              ) : null}

              <View style={styles.bottomRow}>
                <View style={styles.peopleRow}>
                  <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                  {getPeopleCountMaybe(item) != null ? (
                    <Text style={styles.peopleCountText}>+{getPeopleCountMaybe(item)}</Text>
                  ) : null}
                </View>

                <View style={styles.actionsRow}>
                  {!['completed', 'rejected'].includes((item.status ?? '').toString().trim().toLowerCase()) ? (
                    <TouchableOpacity
                      onPress={() => handleMarkComplete(item)}
                      style={styles.actionBtn}
                      hitSlop={10}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                      <Text style={[styles.actionText, { color: colors.success }]}>Complete</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    style={styles.actionBtn}
                    hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFilterModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalSheetTitle}>Filter by status</Text>

            {([
              { key: 'all', label: 'All complaints', icon: 'list-outline' },
              { key: 'open', label: 'Open', icon: 'alert-circle-outline' },
              { key: 'in_progress', label: 'In Progress', icon: 'time-outline' },
              { key: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
              { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline' },
            ] as const).map((opt) => {
              const isActive = activeFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.modalOption, isActive && styles.modalOptionActive]}
                  onPress={() => {
                    setActiveFilter(opt.key);
                    setFilterModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {isActive ? (
                    <Ionicons name="checkmark" size={20} color={colors.primary} style={styles.modalCheck} />
                  ) : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setFilterModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <Pressable style={styles.photoModalBackdrop} onPress={() => setPhotoModalVisible(false)}>
          <Pressable style={styles.photoModalSheet} onPress={() => {}}>
            <TouchableOpacity
              style={styles.photoModalCloseBtn}
              onPress={() => setPhotoModalVisible(false)}
              activeOpacity={0.8}
              hitSlop={10}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            {selectedPhotoUri ? (
              <Image source={{ uri: selectedPhotoUri }} style={styles.photoModalImage} resizeMode="contain" />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // Main screen wrapper.
    container: { flex: 1, backgroundColor: colors.maincontainerbackground },
    // Centers loading and empty-state fallback content.
    centered: { justifyContent: 'center', alignItems: 'center' },
    // Top title and add button row.
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingTop: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    // Screen heading text.
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    // Primary action button in the header.
    addBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    // Header add button label.
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    // FlatList spacing around complaint cards.
    listContent: { paddingHorizontal: 16, paddingBottom: 32 },

    // Wrapper for search controls and status summary cards.
    searchAndStatsWrap: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    // Horizontal row containing the search input and filter button.
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    // Rounded search field container.
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 48,
      gap: 10,
    },
    // Text input inside the search field.
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 0,
    },
    // Square button used to open complaint filters.
    filterBtn: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Container spacing below the summary card carousel.
    statsRow: {
      marginBottom: 18,
    },
    // Horizontal layout for the summary cards.
    statsRowContent: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
      paddingRight: 6,
    },
    // Fixed-size wrapper keeps all summary cards equal height.
    statCardWrap: {
      width: 148,
      height: 100,
      // For debugging
      // borderWidth: 1,
      // borderColor: colors.border,
    },
    // Shared card body for summary stat cards.
    statCard: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 14,
      justifyContent: 'space-between',
    },
    // Background style for inactive stat cards.
    statCardInactive: {
      backgroundColor: colors.surface,
    },
    // Border style shown on the selected inactive card.
    statCardSelected: { 
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    // Summary card title text.
    statLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.textSecondary,
      minHeight: 28,
      lineHeight: 14,
    },
    // Summary card title text on the gradient card.
    statLabelActive: {
      color: '#fff',
    },
    // Summary card numeric value.
    statNumber: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginTop: 4,
    },
    // Summary card numeric value on the gradient card.
    statNumberActive: {
      color: '#fff',
    },
    // Individual complaint card container.
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 1,
    },
    // Top row for status pill and created date.
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    // Rounded status label container.
    statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
    // Status label text.
    statusPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
    // Complaint created date text.
    cardDate: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8, marginTop: 4 },

    // Complaint title text.
    cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
    // Complaint description preview text.
    cardDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
    // Thumbnail image for complaint attachments.
    cardThumb: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.border,
    },
    // Circular frame around the attachment thumbnail.
    thumbWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      alignSelf: 'flex-end',
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
    },

    // Bottom row for people count and card actions.
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    // Row containing the people icon and count.
    peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    // People count text beside the icon.
    peopleCountText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },

    // Row containing action buttons on a complaint card.
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    // Shared layout for each action button.
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    // Text label used inside card action buttons.
    actionText: { fontSize: 13, fontWeight: '800' },

    // Highlight state for the filter button.
    filterBtnActive: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },

    // Dark overlay behind the filter bottom sheet.
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
      padding: 16,
    },
    // Filter bottom sheet container.
    modalSheet: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      paddingBottom: 8,
    },
    // Filter sheet title text.
    modalSheetTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
    },
    // Dark overlay behind the full-size photo preview.
    photoModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    // Photo preview sheet container.
    photoModalSheet: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      padding: 12,
      alignItems: 'center',
    },
    // Floating close button for the photo preview.
    photoModalCloseBtn: {
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 2,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Large image area inside the photo preview.
    photoModalImage: {
      width: '100%',
      height: 320,
      backgroundColor: colors.border,
    },
    // Single row inside the filter sheet.
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
      gap: 12,
    },
    // Background for the selected filter option.
    modalOptionActive: {
      backgroundColor: colors.primary + '12',
    },
    // Filter option label text.
    modalOptionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    // Selected filter option label text.
    modalOptionTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    // Checkmark alignment for the selected filter option.
    modalCheck: {
      marginLeft: 'auto',
    },
    // Cancel button at the bottom of the filter sheet.
    modalCancelBtn: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    // Cancel button label text.
    modalCancelText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },

    // Empty-state container when no complaints are available.
    empty: { alignItems: 'center', paddingVertical: 48 },
    // Empty-state message text.
    emptyText: { fontSize: 16, color: colors.textSecondary, marginBottom: 16 },
    // Empty-state call-to-action button.
    emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    // Empty-state call-to-action label.
    emptyBtnText: { color: '#fff', fontWeight: '600' },
  });
}
