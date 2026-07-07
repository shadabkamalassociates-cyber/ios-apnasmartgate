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
import * as eventsApi from '../api/events';
import type { SocietyEvent } from '../api/events';
import { formatTime12h } from '../lib/datetime';

type DateParts = {
  day: string;
  month: string;
  weekday: string;
  full: string;
};

function parseEventDateParts(dateStr?: string): DateParts | null {
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

function formatEventTime(timeStr?: string) {
  if (!timeStr?.trim()) return '';
  const t = timeStr.trim();
  const asDate = new Date(`1970-01-01T${t}`);
  if (!Number.isNaN(asDate.getTime()) && t.includes(':')) {
    return formatTime12h(asDate);
  }
  return t;
}

function formatPrice(isPaid?: boolean, price?: number | string | null) {
  if (!isPaid) return 'Free entry';
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (n == null || Number.isNaN(n)) return 'Paid event';
  return `₹${n}`;
}

function EventMetaRow({
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

function EventCard({
  item,
  onPress,
  styles,
  colors,
  gradientColors,
}: {
  item: SocietyEvent;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  gradientColors: readonly [string, string];
}) {
  const dateParts = parseEventDateParts(item.date);
  const timeLabel = formatEventTime(item.time);
  const scheduleLine = [dateParts?.full, timeLabel].filter(Boolean).join(' • ');
  const isPaid = !!item.is_paid;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.card}>
      <View style={styles.cardInner}>
        <View style={styles.dateChip}>
          <LinearGradient colors={[...gradientColors]} style={styles.dateChipGradient}>
            <Text style={styles.dateChipDay}>{dateParts?.day ?? '—'}</Text>
            {dateParts?.month ? <Text style={styles.dateChipMonth}>{dateParts.month}</Text> : null}
          </LinearGradient>
          {dateParts?.weekday ? <Text style={styles.dateChipWeekday}>{dateParts.weekday}</Text> : null}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title || `Event #${item.id}`}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>

          {scheduleLine ? (
            <EventMetaRow
              icon="calendar-outline"
              label={scheduleLine}
              styles={styles}
              accentColor={colors.primary}
            />
          ) : null}
          {item.location?.trim() ? (
            <EventMetaRow
              icon="location-outline"
              label={item.location.trim()}
              styles={styles}
              accentColor={colors.primary}
            />
          ) : null}
          {item.max_participants != null ? (
            <EventMetaRow
              icon="people-outline"
              label={`Up to ${item.max_participants} participants`}
              styles={styles}
              accentColor={colors.primary}
            />
          ) : null}

          <View style={styles.cardFooter}>
            <View style={[styles.priceBadge, isPaid ? styles.priceBadgePaid : styles.priceBadgeFree]}>
              <Ionicons
                name={isPaid ? 'ticket-outline' : 'gift-outline'}
                size={13}
                color={isPaid ? colors.primaryDark : colors.success}
              />
              <Text style={[styles.priceBadgeText, isPaid ? styles.priceBadgeTextPaid : styles.priceBadgeTextFree]}>
                {formatPrice(item.is_paid, item.price)}
              </Text>
            </View>
            <Text style={styles.tapHint}>View details</Text>
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

export default function EventsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const gradientColors = useMemo(
    () => [colors.primary, colors.primaryDark] as const,
    [colors.primary, colors.primaryDark],
  );

  const [list, setList] = useState<SocietyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SocietyEvent | null>(null);

  const load = async () => {
    if (!user?.society_id) {
      setList([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await eventsApi.getEventsBySociety(user.society_id);
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.society_id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const eventCountLabel = useMemo(() => {
    const n = list.length;
    if (n === 0) return 'No events scheduled';
    if (n === 1) return '1 event in your society';
    return `${n} events in your society`;
  }, [list.length]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading events…</Text>
      </View>
    );
  }

  const detailDate = selectedEvent ? parseEventDateParts(selectedEvent.date) : null;
  const detailTime = selectedEvent ? formatEventTime(selectedEvent.time) : '';

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
              navigation?.navigate?.('Home');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="calendar" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Society Events</Text>
              <Text style={styles.headerSubtitle}>{eventCountLabel}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {!user?.society_id ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="business-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Society not linked</Text>
          <Text style={styles.emptyText}>Link your flat to a society to see community events here.</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="calendar-outline" size={44} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptyText}>
                When your society admin creates an event, it will show up here with date, venue, and entry details.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <EventCard
              item={item}
              colors={colors}
              styles={styles}
              gradientColors={gradientColors}
              onPress={() => setSelectedEvent(item)}
            />
          )}
        />
      )}

      <Modal
        visible={selectedEvent != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedEvent ? (
              <>
                <LinearGradient colors={[...gradientColors]} style={styles.modalHero}>
                  <View style={styles.modalHeroTop}>
                    <View style={styles.modalDateBlock}>
                      <Text style={styles.modalDateDay}>{detailDate?.day ?? '—'}</Text>
                      {detailDate?.month ? <Text style={styles.modalDateMonth}>{detailDate.month}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={() => setSelectedEvent(null)}
                      hitSlop={12}
                    >
                      <Ionicons name="close" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle}>{selectedEvent.title?.trim() || 'Event'}</Text>
                  {detailDate?.weekday || detailTime ? (
                    <Text style={styles.modalHeroMeta}>
                      {[detailDate?.weekday, detailTime].filter(Boolean).join(' • ')}
                    </Text>
                  ) : null}
                </LinearGradient>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {detailDate?.full ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>{detailDate.full}</Text>
                    </View>
                  ) : null}
                  {detailTime ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>Time</Text>
                      <Text style={styles.detailValue}>{detailTime}</Text>
                    </View>
                  ) : null}
                  {selectedEvent.location?.trim() ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>Location</Text>
                      <Text style={styles.detailValue}>{selectedEvent.location.trim()}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Entry</Text>
                    <View
                      style={[
                        styles.modalPricePill,
                        selectedEvent.is_paid ? styles.priceBadgePaid : styles.priceBadgeFree,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalPriceText,
                          selectedEvent.is_paid ? styles.priceBadgeTextPaid : styles.priceBadgeTextFree,
                        ]}
                      >
                        {formatPrice(selectedEvent.is_paid, selectedEvent.price)}
                      </Text>
                    </View>
                  </View>
                  {selectedEvent.max_participants != null ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>Capacity</Text>
                      <Text style={styles.detailValue}>Up to {selectedEvent.max_participants} people</Text>
                    </View>
                  ) : null}
                  {selectedEvent.description?.trim() ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>About</Text>
                      <Text style={styles.detailDescription}>{selectedEvent.description.trim()}</Text>
                    </View>
                  ) : null}
                </ScrollView>

                <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setSelectedEvent(null)} activeOpacity={0.85}>
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

function makeStyles(colors: ThemeColors) {
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
    dateChipDay: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      lineHeight: 26,
    },
    dateChipMonth: {
      fontSize: 10,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: 0.5,
      marginTop: -2,
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
    cardTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
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
    priceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    priceBadgeFree: { backgroundColor: colors.surfaceVariant },
    priceBadgePaid: { backgroundColor: colors.surfaceVariant },
    priceBadgeText: { fontSize: 12, fontWeight: '700' },
    priceBadgeTextFree: { color: colors.success },
    priceBadgeTextPaid: { color: colors.primaryDark },
    tapHint: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
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
    modalDateBlock: {
      minWidth: 64,
    },
    modalDateDay: {
      fontSize: 36,
      fontWeight: '800',
      color: '#FFFFFF',
      lineHeight: 40,
    },
    modalDateMonth: {
      fontSize: 13,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: 1,
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
    modalPricePill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    modalPriceText: {
      fontSize: 15,
      fontWeight: '700',
    },
    modalDoneBtn: {
      marginHorizontal: 20,
      marginVertical: 16,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    modalDoneText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
