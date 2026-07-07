import type { ThemeColors } from '../theme';

export function parseAmount(value?: number | string | null): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isNaN(n) ? 0 : n;
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatInvoiceType(raw?: string | null) {
  if (!raw?.trim()) return '';
  return raw
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatBillingMonth(raw?: string | null) {
  if (!raw?.trim()) return '—';
  const s = raw.trim();
  if (/^\d{4}-\d{2}$/.test(s)) {
    const d = new Date(`${s}-01T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }
  const d = new Date(s.includes('T') ? s : `${s}T12:00:00`);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return s;
}

export function formatDueDate(raw?: string | null) {
  if (!raw?.trim()) return '';
  const d = new Date(raw.includes('T') ? raw : `${raw.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw.trim();
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatBillDate(raw?: string | null) {
  if (!raw?.trim()) return '—';
  const d = new Date(raw.includes('T') ? raw : `${raw.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw.trim();
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function statusStyle(status?: string | null, colors?: ThemeColors) {
  const s = (status ?? 'PENDING').toUpperCase();
  if (s === 'PAID' || s === 'SUCCESS') {
    return { bg: '#E4F7EC', text: colors?.success ?? '#3D9B5E', label: 'Paid' };
  }
  if (s === 'PARTIAL' || s === 'PARTIALLY_PAID') {
    return { bg: '#FFF3E8', text: colors?.primary ?? '#E85D04', label: 'Partial' };
  }
  if (s === 'OVERDUE') {
    return { bg: '#FFE4E6', text: '#D32F2F', label: 'Overdue' };
  }
  return { bg: '#FFF3D6', text: '#B45309', label: s === 'PENDING' ? 'Pending' : s };
}
