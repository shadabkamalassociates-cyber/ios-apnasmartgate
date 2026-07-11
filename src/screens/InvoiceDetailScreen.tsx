import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, type ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/types';
import * as billingApi from '../api/billing';
import type { InvoiceLineItem, ResidentInvoice } from '../api/billing';
import {
  formatBillDate,
  formatBillingMonth,
  formatInr,
  formatInvoiceType,
  parseAmount,
  statusStyle,
} from '../lib/invoiceFormat';
import {
  downloadInvoiceBillWithAlert,
  shareInvoiceBill,
} from '../lib/invoiceBillExport';

type Props = NativeStackScreenProps<HomeStackParamList, 'InvoiceDetail'>;

function BillRow({
  label,
  value,
  styles,
  bold,
  accent,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={styles.billRow}>
      <Text style={[styles.billRowLabel, bold && styles.billRowLabelBold]}>{label}</Text>
      <Text
        style={[
          styles.billRowValue,
          bold && styles.billRowValueBold,
          accent && styles.billRowValueAccent,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function LineItemsTable({
  items,
  styles,
  fallbackLabel,
  fallbackAmount,
}: {
  items: InvoiceLineItem[];
  styles: ReturnType<typeof makeStyles>;
  fallbackLabel: string;
  fallbackAmount: number;
}) {
  const rows =
    items.length > 0
      ? items.map((row) => ({
          key: String(row.id ?? row.charge_head_id ?? row.description),
          label: (row.charge_head_name || row.description || 'Charge').trim(),
          amount: parseAmount(row.amount),
        }))
      : [{ key: 'fallback', label: fallbackLabel, amount: fallbackAmount }];

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.tableDescCol]}>Description</Text>
        <Text style={[styles.tableHeaderCell, styles.tableAmtCol]}>Amount</Text>
      </View>
      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[styles.tableRow, index === rows.length - 1 && styles.tableRowLast]}
        >
          <Text style={[styles.tableCell, styles.tableDescCol]} numberOfLines={3}>
            {row.label}
          </Text>
          <Text style={[styles.tableCell, styles.tableAmtCol, styles.tableAmtText]}>
            {formatInr(row.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BillPaper({
  invoice,
  items,
  styles,
  colors,
}: {
  invoice: ResidentInvoice;
  items: InvoiceLineItem[];
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const subtotal = parseAmount(invoice.subtotal);
  const penalty = parseAmount(invoice.penalty);
  const tax = parseAmount(invoice.tax);
  const total = parseAmount(invoice.total_amount);
  const paid = parseAmount(invoice.paid_amount);
  const balanceDue = Math.max(0, total - paid);
  const status = statusStyle(invoice.status, colors);
  const billTitle = formatInvoiceType(invoice.invoice_type) || 'Society Bill';
  const lineFallback = formatInvoiceType(invoice.invoice_type) || 'Maintenance charges';

  return (
    <View style={styles.billPaper}>
      <View style={styles.billTopStripe} />
      <View style={styles.billHeader}>
        <Text style={styles.billBrand}>Apna Smart Gate</Text>
        <Text style={styles.billTitle}>{billTitle}</Text>
        <Text style={styles.billInvoiceNo}>
          {invoice.invoice_number?.trim() || `Bill #${invoice.id}`}
        </Text>
        <View style={[styles.billStatusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.billStatusText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.billDivider} />

      <View style={styles.billMetaGrid}>
        <View style={styles.billMetaCell}>
          <Text style={styles.billMetaLabel}>Billing period</Text>
          <Text style={styles.billMetaValue}>{formatBillingMonth(invoice.billing_month)}</Text>
        </View>
        <View style={styles.billMetaCell}>
          <Text style={styles.billMetaLabel}>Issue date</Text>
          <Text style={styles.billMetaValue}>{formatBillDate(invoice.created_at)}</Text>
        </View>
        <View style={styles.billMetaCell}>
          <Text style={styles.billMetaLabel}>Due date</Text>
          <Text style={styles.billMetaValue}>{formatBillDate(invoice.due_date)}</Text>
        </View>
        <View style={styles.billMetaCell}>
          <Text style={styles.billMetaLabel}>Bill type</Text>
          <Text style={styles.billMetaValue}>{formatInvoiceType(invoice.invoice_type) || '—'}</Text>
        </View>
      </View>

      <View style={styles.billDivider} />

      <Text style={styles.sectionHeading}>Charges</Text>
      <LineItemsTable
        items={items}
        styles={styles}
        fallbackLabel={lineFallback}
        fallbackAmount={subtotal > 0 ? subtotal : total}
      />

      <View style={styles.billDivider} />

      <View style={styles.totalsBlock}>
        <BillRow label="Subtotal" value={formatInr(subtotal)} styles={styles} />
        {penalty > 0 ? (
          <BillRow label="Penalty" value={formatInr(penalty)} styles={styles} />
        ) : null}
        {tax > 0 ? <BillRow label="Tax" value={formatInr(tax)} styles={styles} /> : null}
        <BillRow label="Total amount" value={formatInr(total)} styles={styles} bold />
        <BillRow label="Amount paid" value={formatInr(paid)} styles={styles} />
        <BillRow
          label="Balance due"
          value={formatInr(balanceDue)}
          styles={styles}
          bold
          accent={balanceDue > 0}
        />
      </View>

      {invoice.notes?.trim() ? (
        <>
          <View style={styles.billDivider} />
          <Text style={styles.sectionHeading}>Notes</Text>
          <Text style={styles.notesText}>{invoice.notes.trim()}</Text>
        </>
      ) : null}

      <View style={styles.billFooter}>
        <Text style={styles.billFooterText}>
          This is a computer-generated bill. Please pay by the due date to avoid late fees.
        </Text>
        {invoice.updated_at ? (
          <Text style={styles.billFooterMuted}>
            Last updated {formatBillDate(invoice.updated_at)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function InvoiceDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const gradientColors = useMemo(
    () => [colors.primary, colors.primaryDark] as const,
    [colors.primary, colors.primaryDark],
  );

  const preview = route.params?.invoice;
  const invoiceId = route.params.invoiceId;

  const [invoice, setInvoice] = useState<ResidentInvoice | null>(preview ?? null);
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'share' | 'download' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await billingApi.fetchInvoiceById(invoiceId);
      if (detail?.invoice) {
        setInvoice(detail.invoice);
        setItems(detail.items);
      } else if (!preview) {
        setError('Invoice not found.');
      }
    } catch {
      if (!preview) {
        setError('Could not load bill details.');
      }
    } finally {
      setLoading(false);
    }
  }, [invoiceId, preview]);

  useEffect(() => {
    load();
  }, [load]);

  const headerTitle = formatInvoiceType(invoice?.invoice_type) || 'Bill details';

  const runExport = async (action: 'share' | 'download') => {
    if (!invoice || exporting) return;
    setExporting(action);
    try {
      if (action === 'share') {
        await shareInvoiceBill(invoice, items);
      } else {
        await downloadInvoiceBillWithAlert(invoice, items);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert(
        action === 'share' ? 'Share failed' : 'Download failed',
        message,
        [{ text: 'OK' }],
      );
    } finally {
      setExporting(null);
    }
  };

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
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {invoice?.invoice_number?.trim() || 'Invoice'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {loading && !invoice ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading bill…</Text>
        </View>
      ) : error && !invoice ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : invoice ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator
              style={styles.inlineLoader}
              size="small"
              color={colors.primary}
            />
          ) : null}
          <BillPaper invoice={invoice} items={items} styles={styles} colors={colors} />
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.85}
              disabled={!!exporting}
              onPress={() => runExport('share')}
            >
              {exporting === 'share' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="share-outline" size={20} color={colors.primary} />
              )}
              <Text style={styles.actionButtonText}>Share bill</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              activeOpacity={0.85}
              disabled={!!exporting}
              onPress={() => runExport('download')}
            >
              {exporting === 'download' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              )}
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                Download PDF
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.maincontainerbackground,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      padding: 24,
    },
    loadingText: { fontSize: 14, color: colors.textSecondary },
    errorText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    inlineLoader: { marginBottom: 8 },

    headerGradient: {
      paddingTop: 8,
      paddingBottom: 16,
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
    headerTitleBlock: { flex: 1 },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    headerSubtitle: {
      marginTop: 4,
      fontSize: 13,
      color: 'rgba(255,255,255,0.88)',
      fontWeight: '500',
    },

    actionBar: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    actionButtonTextPrimary: {
      color: '#FFFFFF',
    },

    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },

    billPaper: {
      backgroundColor: '#FFFFFF',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    billTopStripe: {
      height: 6,
      backgroundColor: colors.primary,
    },
    billHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      alignItems: 'center',
    },
    billBrand: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    billTitle: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    billInvoiceNo: {
      marginTop: 6,
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    billStatusPill: {
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
    },
    billStatusText: { fontSize: 12, fontWeight: '800' },

    billDivider: {
      height: 1,
      backgroundColor: '#E5E7EB',
      marginHorizontal: 20,
    },

    billMetaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    },
    billMetaCell: {
      width: '47%',
    },
    billMetaLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    billMetaValue: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },

    sectionHeading: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },

    table: {
      marginHorizontal: 20,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 4,
      overflow: 'hidden',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#F9FAFB',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    tableHeaderCell: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
    },
    tableRowLast: { borderBottomWidth: 0 },
    tableCell: { fontSize: 14, color: colors.text },
    tableDescCol: { flex: 1, paddingRight: 8 },
    tableAmtCol: { width: 96, textAlign: 'right' },
    tableAmtText: { fontWeight: '700' },

    totalsBlock: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 8,
    },
    billRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    billRowLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    billRowLabelBold: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    billRowValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    billRowValueBold: {
      fontSize: 17,
      fontWeight: '800',
    },
    billRowValueAccent: {
      color: colors.primary,
    },

    notesText: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    billFooter: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: '#F9FAFB',
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      gap: 6,
    },
    billFooterText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    billFooterMuted: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
      opacity: 0.8,
    },
  });
}
