import type { InvoiceLineItem, ResidentInvoice } from '../api/billing';
import {
  formatBillDate,
  formatBillingMonth,
  formatInr,
  formatInvoiceType,
  parseAmount,
  statusStyle,
} from './invoiceFormat';

const BRAND_NAME = 'Apna Smart Gate';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type BillLineRow = { label: string; amount: number };

export function getBillLineRows(
  invoice: ResidentInvoice,
  items: InvoiceLineItem[],
): BillLineRow[] {
  const subtotal = parseAmount(invoice.subtotal);
  const total = parseAmount(invoice.total_amount);
  const fallbackLabel = formatInvoiceType(invoice.invoice_type) || 'Maintenance charges';

  if (items.length > 0) {
    return items.map((row) => ({
      label: (row.charge_head_name || row.description || 'Charge').trim(),
      amount: parseAmount(row.amount),
    }));
  }

  return [{ label: fallbackLabel, amount: subtotal > 0 ? subtotal : total }];
}

export function buildInvoiceShareMessage(
  invoice: ResidentInvoice,
  items: InvoiceLineItem[],
): string {
  const subtotal = parseAmount(invoice.subtotal);
  const penalty = parseAmount(invoice.penalty);
  const tax = parseAmount(invoice.tax);
  const total = parseAmount(invoice.total_amount);
  const paid = parseAmount(invoice.paid_amount);
  const balanceDue = Math.max(0, total - paid);
  const status = statusStyle(invoice.status).label;
  const lines = getBillLineRows(invoice, items);

  const chargeLines = lines
    .map((row) => `  • ${row.label}: ${formatInr(row.amount)}`)
    .join('\n');

  return [
    `${BRAND_NAME}`,
    `${formatInvoiceType(invoice.invoice_type) || 'Society Bill'}`,
    `Invoice: ${invoice.invoice_number?.trim() || invoice.id}`,
    `Status: ${status}`,
    `Billing period: ${formatBillingMonth(invoice.billing_month)}`,
    `Issue date: ${formatBillDate(invoice.created_at)}`,
    `Due date: ${formatBillDate(invoice.due_date)}`,
    '',
    'Charges:',
    chargeLines,
    '',
    `Subtotal: ${formatInr(subtotal)}`,
    penalty > 0 ? `Penalty: ${formatInr(penalty)}` : null,
    tax > 0 ? `Tax: ${formatInr(tax)}` : null,
    `Total: ${formatInr(total)}`,
    `Paid: ${formatInr(paid)}`,
    `Balance due: ${formatInr(balanceDue)}`,
    invoice.notes?.trim() ? `\nNotes: ${invoice.notes.trim()}` : null,
    '',
    'Generated via Apna Smart Gate app.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildInvoiceBillHtml(
  invoice: ResidentInvoice,
  items: InvoiceLineItem[],
): string {
  const subtotal = parseAmount(invoice.subtotal);
  const penalty = parseAmount(invoice.penalty);
  const tax = parseAmount(invoice.tax);
  const total = parseAmount(invoice.total_amount);
  const paid = parseAmount(invoice.paid_amount);
  const balanceDue = Math.max(0, total - paid);
  const status = statusStyle(invoice.status);
  const billTitle = formatInvoiceType(invoice.invoice_type) || 'Society Bill';
  const invoiceNo = escapeHtml(invoice.invoice_number?.trim() || `Bill #${invoice.id}`);
  const lineRows = getBillLineRows(invoice, items);

  const chargeRowsHtml = lineRows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td class="amt">${escapeHtml(formatInr(row.amount))}</td>
      </tr>`,
    )
    .join('');

  const optionalRows = [
    penalty > 0
      ? `<div class="total-row"><span>Penalty</span><span>${escapeHtml(formatInr(penalty))}</span></div>`
      : '',
    tax > 0
      ? `<div class="total-row"><span>Tax</span><span>${escapeHtml(formatInr(tax))}</span></div>`
      : '',
  ].join('');

  const notesBlock = invoice.notes?.trim()
    ? `<h3>Notes</h3><p class="notes">${escapeHtml(invoice.notes.trim())}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 24px;
      font-size: 14px;
      line-height: 1.45;
    }
    .stripe { height: 6px; background: #E85D04; margin: -24px -24px 20px; }
    .brand {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 8px;
    }
    h1 {
      text-align: center;
      font-size: 22px;
      margin: 0 0 6px;
    }
    .invoice-no {
      text-align: center;
      color: #6B7280;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .status {
      display: inline-block;
      padding: 5px 14px;
      border-radius: 20px;
      background: ${status.bg};
      color: ${status.text};
      font-size: 12px;
      font-weight: 800;
    }
    .status-wrap { text-align: center; margin-bottom: 20px; }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #E5E7EB;
    }
    .meta-item { width: 46%; }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #6B7280;
      font-weight: 600;
    }
    .meta-value {
      margin-top: 4px;
      font-weight: 700;
      font-size: 14px;
    }
    h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #6B7280;
      margin: 0 0 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E5E7EB;
      margin-bottom: 20px;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #F3F4F6;
    }
    th {
      background: #F9FAFB;
      font-size: 11px;
      text-transform: uppercase;
      color: #6B7280;
    }
    td.amt { text-align: right; font-weight: 700; width: 110px; }
    .totals { margin-bottom: 20px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      color: #374151;
    }
    .total-row.bold {
      font-weight: 800;
      font-size: 16px;
      color: #111827;
      margin-top: 6px;
    }
    .total-row.accent span:last-child { color: #E85D04; }
    .notes { color: #4B5563; margin: 0 0 16px; }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #6B7280;
      padding-top: 16px;
      border-top: 1px solid #E5E7EB;
    }
  </style>
</head>
<body>
  <div class="stripe"></div>
  <div class="brand">${BRAND_NAME}</div>
  <h1>${escapeHtml(billTitle)}</h1>
  <div class="invoice-no">${invoiceNo}</div>
  <div class="status-wrap"><span class="status">${escapeHtml(status.label)}</span></div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Billing period</div>
      <div class="meta-value">${escapeHtml(formatBillingMonth(invoice.billing_month))}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Issue date</div>
      <div class="meta-value">${escapeHtml(formatBillDate(invoice.created_at))}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Due date</div>
      <div class="meta-value">${escapeHtml(formatBillDate(invoice.due_date))}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Bill type</div>
      <div class="meta-value">${escapeHtml(formatInvoiceType(invoice.invoice_type) || '—')}</div>
    </div>
  </div>

  <h3>Charges</h3>
  <table>
    <thead>
      <tr><th>Description</th><th class="amt">Amount</th></tr>
    </thead>
    <tbody>${chargeRowsHtml}</tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${escapeHtml(formatInr(subtotal))}</span></div>
    ${optionalRows}
    <div class="total-row bold"><span>Total amount</span><span>${escapeHtml(formatInr(total))}</span></div>
    <div class="total-row"><span>Amount paid</span><span>${escapeHtml(formatInr(paid))}</span></div>
    <div class="total-row bold accent"><span>Balance due</span><span>${escapeHtml(formatInr(balanceDue))}</span></div>
  </div>

  ${notesBlock}

  <div class="footer">
  This is a computer-generated bill. Please pay by the due date to avoid late fees.
  </div>
</body>
</html>`;
}

export function invoicePdfFileName(invoice: ResidentInvoice): string {
  const base =
    invoice.invoice_number?.trim().replace(/[^\w-]+/g, '_') ||
    `invoice_${String(invoice.id).slice(0, 8)}`;
  return `${base}.pdf`;
}
