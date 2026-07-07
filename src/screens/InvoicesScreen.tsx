import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, type ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import * as billingApi from '../api/billing';
import type { ResidentInvoice } from '../api/billing';
import {
  formatBillingMonth,
  formatDueDate,
  formatInr,
  formatInvoiceType,
  parseAmount,
  statusStyle,
} from '../lib/invoiceFormat';

type Props = NativeStackScreenProps<HomeStackParamList, 'Invoices'>;

function InvoiceCard({
  item,
  styles,
  colors,
  onPress,
}: {
  item: ResidentInvoice;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const total = parseAmount(item.total_amount);
  const paid = parseAmount(item.paid_amount);
  const due = Math.max(0, total - paid);
  const status = statusStyle(item.status, colors);
  const title = formatInvoiceType(item.invoice_type) || `Invoice #${item.id}`;
  const dueLabel = formatDueDate(item.due_date);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.cardInner}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="receipt-outline" size={26} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusBadgeText, { color: status.text }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.billingMonth}>{formatBillingMonth(item.billing_month)}</Text>
          {dueLabel ? (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>Due {dueLabel}</Text>
            </View>
          ) : null}
          <View style={styles.amountRow}>
            <Text style={styles.amountTotal}>{formatInr(total)}</Text>
            {paid > 0 && paid < total ? (
              <Text style={styles.amountDue}>Due {formatInr(due)}</Text>
            ) : null}
          </View>
          <Text style={styles.tapHint}>View bill</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

export default function InvoicesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const gradientColors = useMemo(
    () => [colors.primary, colors.primaryDark] as const,
    [colors.primary, colors.primaryDark],
  );

  const [list, setList] = useState<ResidentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setError('Sign in to view your invoices.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    try {
      const invoices = await billingApi.fetchResidentInvoices(user.id);
      setList(invoices);
    } catch {
      setList([]);
      setError('Could not load invoices. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openInvoice = (item: ResidentInvoice) => {
    navigation.navigate('InvoiceDetail', {
      invoiceId: String(item.id),
      invoice: item,
    });
  };

  const countLabel = useMemo(() => {
    const n = list.length;
    if (n === 0) return 'No invoices yet';
    if (n === 1) return '1 invoice';
    return `${n} invoices`;
  }, [list.length]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading invoices…</Text>
      </View>
    );
  }

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
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate('Home');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="document-text" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>My Invoices</Text>
              <Text style={styles.headerSubtitle}>{countLabel}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="document-text-outline" size={40} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No invoices</Text>
              <Text style={styles.emptySubtitle}>
                Maintenance and society bills will appear here when generated.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <InvoiceCard
            item={item}
            styles={styles}
            colors={colors}
            onPress={() => openInvoice(item)}
          />
        )}
      />
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
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginRight: 12,
    },
    headerTitleBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
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

    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: '#FFF3D6',
      marginBottom: 12,
    },
    errorBannerText: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '500' },

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
    },
    cardInner: { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'center' },
    cardIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
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
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    billingMonth: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: 6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    metaText: { fontSize: 13, color: colors.textSecondary },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 10,
      marginTop: 4,
    },
    amountTotal: { fontSize: 20, fontWeight: '800', color: colors.text },
    amountDue: { fontSize: 13, fontWeight: '600', color: colors.primary },
    tapHint: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
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
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
