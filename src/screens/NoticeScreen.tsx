import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme, type ThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as noticeApi from '../api/notice';
import type { NoticeItem } from '../api/notice';
import { formatDateTime12hTimeFirst } from '../lib/datetime';
import { getSeenNoticeIdsLocally, markNoticeSeenLocally } from '../lib/noticeSeenStorage';

/** Notice-only oranges: lighter than primaryDark, but still clearly orange (not yellow-peach). */
function getNoticePalette(colors: ThemeColors) {
  return {
    gradient: [colors.primary, colors.primaryLight] as const,
    accent: colors.primary,
    accentSoft: '#F97316',
    borderUnread: '#FB923C',
    button: colors.primary,
  };
}

type DateParts = {
  day: string;
  month: string;
  weekday: string;
  full: string;
};

function parseNoticeDateParts(dateStr?: string): DateParts | null {
  if (!dateStr?.trim()) return null;
  const raw = dateStr.trim();
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { day: '—', month: '', weekday: '', full: raw };
  }
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    full: d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

function NoticeMetaRow({
  icon,
  label,
  styles,
  accentColor,
}: {
  icon: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  accentColor: string;
}) {
  if (!label) return null;
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIconWrap}>
        <Ionicons name={icon as any} size={14} color={accentColor} />
      </View>
      <Text style={styles.metaText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function NoticeCard({
  item,
  isUnread,
  onPress,
  styles,
  colors,
  gradientColors,
  accentColor,
}: {
  item: NoticeItem;
  isUnread: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  gradientColors: readonly [string, string];
  accentColor: string;
}) {
  const dateParts = parseNoticeDateParts(item.created_at);
  const author = item.created_by_name?.trim() || 'Society admin';
  const postedAt = item.created_at ? formatDateTime12hTimeFirst(item.created_at) : '';

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[styles.card, isUnread && styles.cardUnread]}>
      <View style={styles.cardInner}>
        <View style={styles.dateChip}>
          <LinearGradient colors={[...gradientColors]} style={styles.dateChipGradient}>
            <Ionicons name="megaphone" size={22} color="#FFFFFF" />
          </LinearGradient>
          {dateParts?.weekday ? <Text style={styles.dateChipWeekday}>{dateParts.weekday}</Text> : null}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title?.trim() || `Notice #${item.id}`}
            </Text>
            <View style={styles.cardTopEnd}>
              {isUnread ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </View>

          <NoticeMetaRow icon="person-outline" label={author} styles={styles} accentColor={accentColor} />
          {postedAt ? (
            <NoticeMetaRow icon="time-outline" label={postedAt} styles={styles} accentColor={accentColor} />
          ) : null}

          <View style={styles.cardFooter}>
            <View style={styles.noticeTypePill}>
              <Ionicons name="notifications-outline" size={13} color={accentColor} />
              <Text style={styles.noticeTypePillText}>Society notice</Text>
            </View>
            <Text style={styles.tapHint}>Read more</Text>
          </View>

          {item.description?.trim() ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description.trim()}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function NoticeScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const noticePalette = useMemo(() => getNoticePalette(colors), [colors]);
  const styles = useMemo(() => makeStyles(colors, noticePalette), [colors, noticePalette]);
  const gradientColors = noticePalette.gradient;

  const [list, setList] = useState<NoticeItem[]>([]);
  const [seenNoticeIds, setSeenNoticeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);

  const load = async () => {
    if (!user?.society_id) {
      setList([]);
      setSeenNoticeIds(new Set());
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await noticeApi.getNoticesBySociety(user.society_id);
      setList(Array.isArray(data) ? data : []);
      setSeenNoticeIds(user?.id != null ? await getSeenNoticeIdsLocally(user.id) : new Set());
    } catch {
      setList([]);
      setSeenNoticeIds(new Set());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.society_id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const unreadCount = useMemo(
    () => list.filter((n) => n?.id != null && !seenNoticeIds.has(String(n.id))).length,
    [list, seenNoticeIds],
  );

  const noticeCountLabel = useMemo(() => {
    const n = list.length;
    if (n === 0) return 'No notices posted';
    if (unreadCount > 0) {
      return unreadCount === 1 ? '1 unread notice' : `${unreadCount} unread notices`;
    }
    if (n === 1) return '1 notice — all caught up';
    return `${n} notices — all caught up`;
  }, [list.length, unreadCount]);

  const markNoticeSeen = async (item: NoticeItem) => {
    if (item?.id == null || user?.id == null || user?.society_id == null) return;
    await markNoticeSeenLocally(user.id, item.id);
    setSeenNoticeIds((prev) => {
      const next = new Set(prev);
      next.add(String(item.id));
      return next;
    });
    noticeApi
      .markNoticeViewed({
        noticeId: item.id,
        userId: user.id,
        societyId: user.society_id,
      })
      .catch(() => {});
  };

  const openNotice = (item: NoticeItem) => {
    setSelectedNotice(item);
    void markNoticeSeen(item);
  };

  const closeNotice = () => setSelectedNotice(null);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={noticePalette.accentSoft} />
        <Text style={styles.loadingText}>Loading notices…</Text>
      </View>
    );
  }

  const detailDate = selectedNotice ? parseNoticeDateParts(selectedNotice.created_at) : null;
  const detailAuthor = selectedNotice?.created_by_name?.trim() || 'Society admin';
  const detailPosted = selectedNotice?.created_at
    ? formatDateTime12hTimeFirst(selectedNotice.created_at)
    : '';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...gradientColors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
                return;
              }
              navigation?.navigate?.('HomeTab');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="notifications" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Society Notices</Text>
              <Text style={styles.headerSubtitle}>{noticeCountLabel}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {!user?.society_id ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="business-outline" size={40} color={noticePalette.accentSoft} />
          </View>
          <Text style={styles.emptyTitle}>Society not linked</Text>
          <Text style={styles.emptyText}>Link your flat to a society to receive admin notices here.</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={noticePalette.accentSoft} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-outline" size={44} color={noticePalette.accentSoft} />
              </View>
              <Text style={styles.emptyTitle}>No notices yet</Text>
              <Text style={styles.emptyText}>
                When your society admin posts an announcement, it will appear here with the full message.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <NoticeCard
              item={item}
              isUnread={item?.id != null && !seenNoticeIds.has(String(item.id))}
              colors={colors}
              styles={styles}
              gradientColors={gradientColors}
              accentColor={noticePalette.accentSoft}
              onPress={() => openNotice(item)}
            />
          )}
        />
      )}

      <Modal
        visible={selectedNotice != null}
        transparent
        animationType="fade"
        onRequestClose={closeNotice}
      >
        <Pressable style={styles.modalOverlay} onPress={closeNotice}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedNotice ? (
              <>
                <LinearGradient colors={[...gradientColors]} style={styles.modalHero}>
                  <View style={styles.modalHeroTop}>
                    <View style={styles.modalIconCircle}>
                      <Ionicons name="megaphone" size={28} color="#FFFFFF" />
                    </View>
                    <TouchableOpacity style={styles.modalCloseBtn} onPress={closeNotice} hitSlop={12}>
                      <Ionicons name="close" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle}>
                    {selectedNotice.title?.trim() || `Notice #${selectedNotice.id}`}
                  </Text>
                  {detailPosted ? <Text style={styles.modalHeroMeta}>{detailPosted}</Text> : null}
                </LinearGradient>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Posted by</Text>
                    <Text style={styles.detailValue}>{detailAuthor}</Text>
                  </View>
                  {detailDate?.full ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>{detailDate.full}</Text>
                    </View>
                  ) : null}
                  {selectedNotice.society_name?.trim() ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>Society</Text>
                      <Text style={styles.detailValue}>{selectedNotice.society_name.trim()}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Message</Text>
                    <Text style={styles.detailDescription}>
                      {selectedNotice.description?.trim() || 'No description provided for this notice.'}
                    </Text>
                  </View>
                </ScrollView>

                <TouchableOpacity style={styles.modalDoneBtn} onPress={closeNotice} activeOpacity={0.85}>
                  <Text style={styles.modalDoneText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(
  colors: ThemeColors,
  palette: ReturnType<typeof getNoticePalette>,
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.maincontainerbackground,
    },
    centered: { justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },

    headerGradient: {
      paddingTop: 8,
      paddingBottom: 20,
      paddingHorizontal: 16,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginRight: 12,
    },
    headerTitleBlock: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextWrap: { flex: 1 },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      marginTop: 4,
      fontSize: 13,
      color: 'rgba(255,255,255,0.88)',
      fontWeight: '500',
    },

    listContent: {
      padding: 16,
      paddingTop: 20,
      paddingBottom: 40,
      flexGrow: 1,
    },

    card: {
      marginBottom: 14,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
      overflow: 'hidden',
    },
    cardUnread: {
      borderColor: palette.borderUnread,
      borderWidth: 1.5,
    },
    cardInner: {
      flexDirection: 'row',
      padding: 14,
      gap: 14,
    },
    dateChip: {
      alignItems: 'center',
      width: 56,
    },
    dateChipGradient: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateChipWeekday: {
      marginTop: 6,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    cardBody: { flex: 1, minWidth: 0 },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 4,
    },
    cardTopEnd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cardTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    newBadge: {
      backgroundColor: '#EF4444',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
    },
    newBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 6,
    },
    metaIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metaText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      paddingTop: 4,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      gap: 8,
    },
    noticeTypePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: colors.surfaceVariant,
    },
    noticeTypePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: palette.accentSoft,
    },
    tapHint: {
      fontSize: 12,
      fontWeight: '600',
      color: palette.accentSoft,
    },
    cardDesc: {
      marginTop: 10,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    empty: {
      alignItems: 'center',
      paddingVertical: 56,
      paddingHorizontal: 28,
    },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '88%',
      overflow: 'hidden',
    },
    modalHero: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 22,
    },
    modalHeroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    modalIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    modalHeroMeta: {
      marginTop: 6,
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
      fontWeight: '500',
    },
    modalBody: {
      paddingHorizontal: 20,
      paddingTop: 8,
      maxHeight: 340,
    },
    detailBlock: {
      marginBottom: 18,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    detailValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
    },
    detailDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    modalDoneBtn: {
      marginHorizontal: 20,
      marginVertical: 16,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: palette.button,
      alignItems: 'center',
    },
    modalDoneText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
