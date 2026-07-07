import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import * as visitorApi from '../api/visitor';
import { formatDateTime12hTimeFirst } from '../lib/datetime';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ThemeColors } from '../theme/colors';

type VisitorRecord = {
  id: number;
  check_in?: string;
  check_out?: string;
  status?: string;
  visitor?: { id: number; name: string; phone?: string; vehicleinfo?: string };
};

/** Local calendar day match for check-in (ISO or date string from API). */
function isCheckInToday(checkIn?: string): boolean {
  if (!checkIn) return false;
  const d = new Date(checkIn);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function sortByCheckInDesc(a: VisitorRecord, b: VisitorRecord): number {
  const ta = a.check_in ? new Date(a.check_in).getTime() : 0;
  const tb = b.check_in ? new Date(b.check_in).getTime() : 0;
  return tb - ta;
}

export default function VisitorsScreen({ navigation }: { navigation: { navigate: (a: string, p?: object) => void } }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [list, setList] = useState<VisitorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const load = async () => {
    const flatId = user?.flat_id;
    if (flatId == null) {
      setList([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await visitorApi.getVisitorsByFlatId(flatId);
      const data = (res as { data?: VisitorRecord[] })?.data ?? [];
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.flat_id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleStatusChange = async (id: number, status: 'approve' | 'unapprove') => {
    try {
      setActioningId(id);
      await visitorApi.updateVisitorStatus(id, status);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to update visitor status');
    } finally {
      setActioningId(null);
    }
  };

  const getStatusLabel = (status?: string) => {
    if (!status) return '';
    if (status === 'approve') return 'APPROVED';
    if (status === 'unapprove') return 'REJECTED';
    if (status === 'waiting') return 'WAITING';
    return status.toUpperCase();
  };

  const styles = makeStyles(colors, isDark);

  const { todayVisitors, previousVisitors } = useMemo(() => {
    const today: VisitorRecord[] = [];
    const previous: VisitorRecord[] = [];
    for (const item of list) {
      if (isCheckInToday(item.check_in)) today.push(item);
      else previous.push(item);
    }
    today.sort(sortByCheckInDesc);
    previous.sort(sortByCheckInDesc);
    return { todayVisitors: today, previousVisitors: previous };
  }, [list]);

  const getStatusStyle = (status?: string) => {
    if (status === 'approve') {
      return {
        bg: isDark ? 'rgba(74, 222, 128, 0.15)' : '#F5EDCB',
        text: isDark ? colors.success : '#5C6B2F',
      };
    }
    if (status === 'unapprove') {
      return {
        bg: isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(185, 28, 28, 0.1)',
        text: colors.error,
      };
    }
    if (status === 'waiting') {
      return {
        bg: isDark ? 'rgba(244, 140, 6, 0.15)' : 'rgba(232, 93, 4, 0.08)',
        text: colors.primaryLight,
      };
    }
    return { bg: colors.surfaceVariant, text: colors.text };
  };

  const renderVisitorCard = (item: VisitorRecord) => {
    const statusStyle = getStatusStyle(item.status);
    const isWaiting = item.status === 'waiting';
    const isActioning = actioningId === item.id;
    const waitingCardStatusStyle = isDark
      ? { bg: 'rgba(244, 140, 6, 0.2)', text: '#FFD6B0' }
      : { bg: '#FFE7D6', text: '#7A3E12' };
    const waitingAvatarIconColor = isDark ? '#F7C79E' : '#9A4F15';
    const waitingMetaIconColor = isDark ? '#C5BBB2' : '#7A7A7A';

    return (
      <View
        key={item.id}
        style={[styles.card, !isWaiting && styles.cardSettled]}
      >
        {isWaiting ? (
          <>
            <View style={styles.waitingTopRow}>
              <View style={styles.cardBody}>
                <View style={[styles.avatar, styles.avatarWaitingCard]}>
                  <Ionicons name="person-outline" size={24} color={waitingAvatarIconColor} />
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.cardInfoHeader}>
                    <View style={styles.cardNameBlock}>
                      <Text style={[styles.cardName, styles.waitingCardName]}>
                        {item.visitor?.name ?? 'Visitor'}
                      </Text>
                      {item.visitor?.phone ? (
                        <Text style={[styles.cardPhone, styles.waitingCardPhone]}>{item.visitor.phone}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>

              {item.status ? (
                <View style={[styles.statusBadge, styles.waitingStatusBadge, { backgroundColor: waitingCardStatusStyle.bg }]}>
                  <Text style={[styles.statusBadgeText, styles.waitingStatusBadgeText, { color: waitingCardStatusStyle.text }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              ) : null}
            </View>

            {item.check_in ? (
              <View style={[styles.metaRow, styles.waitingMetaRow]}>
                <Ionicons name="time-outline" size={15} color={waitingMetaIconColor} />
                <Text style={[styles.metaText, styles.waitingMetaText]}>{formatDateTime12hTimeFirst(item.check_in)}</Text>
              </View>
            ) : null}

            {item.visitor?.vehicleinfo ? (
              <View style={[styles.metaRow, styles.waitingMetaRow, styles.waitingVehicleRow]}>
                <Ionicons name="car-outline" size={15} color={waitingMetaIconColor} />
                <Text style={[styles.metaText, styles.waitingMetaText]}>{item.visitor.vehicleinfo}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.cardBody}>
            <View style={[styles.avatar, styles.avatarMuted]}>
              <Ionicons name="person" size={22} color={colors.textSecondary} />
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardInfoHeader}>
                <View style={styles.cardNameBlock}>
                  <Text style={styles.cardName}>{item.visitor?.name ?? 'Visitor'}</Text>
                  {item.visitor?.phone ? <Text style={styles.cardPhone}>{item.visitor.phone}</Text> : null}
                </View>
                {item.status ? (
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.visitor?.vehicleinfo ? (
                <View style={styles.metaRow}>
                  <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{item.visitor.vehicleinfo}</Text>
                </View>
              ) : null}

              {item.check_in ? (
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{formatDateTime12hTimeFirst(item.check_in)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {isWaiting ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => handleStatusChange(item.id, 'approve')}
              disabled={isActioning}
              activeOpacity={0.8}
            >
              {isActioning ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.approveBtnText}>Approve</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleStatusChange(item.id, 'unapprove')}
              disabled={isActioning}
              activeOpacity={0.8}
            >
              {isActioning ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.rejectBtnText}>Reject</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Visitors</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('VisitorForm', { onSaved: load, source: 'visitors' })}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color={colors.border} />
            <Text style={styles.emptyText}>No visitors logged</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('VisitorForm', { onSaved: load, source: 'visitors' })}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>Add a visitor</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Today's visitors ───────────────── */}
            <View style={styles.queueSection}>
              <Text style={styles.liveStatusLabel}>LIVE STATUS</Text>
              <View style={styles.queueRow}>
                <Text style={styles.queueTitle}>Queue Management</Text>
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              </View>
            </View>

            {todayVisitors.length === 0 ? (
              <View style={[styles.sectionEmptyBox, styles.sectionEmptyBoxNoBackground]}>
                <Ionicons name="calendar-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.sectionEmptyText}>No visitors today yet</Text>
              </View>
            ) : (
              todayVisitors.map((item) => renderVisitorCard(item))
            )}

            {/* ── Previous visitors ───────────────── */}
            <View style={styles.previousSection}>
              <View style={styles.sectionDivider} />
              <Text style={styles.previousSectionLabel}>HISTORY</Text>
              <Text style={styles.previousSectionTitle}>Previous visitors</Text>
              <Text style={styles.sectionHint}>Earlier check-ins and past visits</Text>
            </View>

            {previousVisitors.length === 0 ? (
              <View style={styles.sectionEmptyBox}>
                <Ionicons name="time-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.sectionEmptyText}>No previous visitors on record</Text>
              </View>
            ) : (
              previousVisitors.map((item) => renderVisitorCard(item))
            )}

            <View style={styles.footer}>
              <Ionicons name="home-outline" size={28} color={colors.border} />
              <Text style={styles.footerText}>END OF VISITOR LOG</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.maincontainerbackground,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* ── Header ─────────────────────────── */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    addBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    addBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },

    /* ── Scroll ─────────────────────────── */
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },

    /* ── Queue Management ───────────────── */
    queueSection: {
      marginBottom: 20,
    },
    liveStatusLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    queueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    queueTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
    },
    todayBadge: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    todayBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    sectionHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 8,
      lineHeight: 18,
    },

    /* ── Previous section ───────────────── */
    previousSection: {
      marginTop: 8,
      marginBottom: 12,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 20,
      marginTop: 4,
    },
    previousSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    previousSectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    sectionEmptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 28,
      paddingHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 16,
      gap: 8,
    },
    sectionEmptyBoxNoBackground: {
      backgroundColor: 'transparent',
    },
    sectionEmptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    /* ── Card ───────────────────────────── */
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 13,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    cardSettled: {
      backgroundColor: isDark ? colors.surface : '#F6F5F3',
      shadowOpacity: isDark ? 0.1 : 0.03,
      elevation: 1,
    },
    waitingTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    cardBody: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    avatarWaiting: {
      backgroundColor: colors.primary,
      borderRadius: 22,
    },
    avatarWaitingCard: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(244, 140, 6, 0.18)' : '#FFE0CC',
      marginTop: 0,
      marginRight: 12,
    },
    avatarMuted: {
      backgroundColor: isDark ? colors.surfaceVariant : '#EDEDED',
    },
    cardInfo: {
      flex: 1,
    },
    cardInfoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 2,
    },
    cardNameBlock: {
      flex: 1,
      marginRight: 8,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    waitingCardName: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 3,
    },
    cardPhone: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    waitingCardPhone: {
      fontSize: 15,
      color: isDark ? '#D9D1C8' : '#5A5A5A',
    },

    /* ── Status badge ───────────────────── */
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    waitingStatusBadge: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      alignSelf: 'flex-start',
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    waitingStatusBadgeText: {
      fontSize: 12,
      letterSpacing: 0.8,
    },

    /* ── Meta row (time, vehicle) ────────── */
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    metaText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    waitingMetaRow: {
      marginTop: 12,
      gap: 8,
    },
    waitingVehicleRow: {
      marginTop: 7,
    },
    waitingMetaText: {
      fontSize: 15,
      color: isDark ? '#DED7D1' : '#595959',
      fontWeight: '500',
    },

    /* ── Action buttons ─────────────────── */
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    approveBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 16,
    },
    approveBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },
    rejectBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceVariant : '#EEF1F4',
    },
    rejectBtnText: {
      color: isDark ? '#F3B38B' : '#A33E10',
      fontSize: 15,
      fontWeight: '800',
    },

    /* ── Empty state ────────────────────── */
    empty: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 12,
      marginBottom: 20,
    },
    emptyBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
    },
    emptyBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },

    /* ── Footer ─────────────────────────── */
    footer: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    footerText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.border,
      letterSpacing: 1,
    },
  });
}
