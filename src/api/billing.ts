import api from './client';

/** Row from `invoices` table via `GET /api/billing/get-resident-invoices/:residentId` */
export type ResidentInvoice = {
  id: string | number;
  society_id?: string | number;
  resident_id?: string | number;
  invoice_number?: string | null;
  billing_month?: string | null;
  due_date?: string | null;
  subtotal?: number | string | null;
  penalty?: number | string | null;
  tax?: number | string | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  status?: string | null;
  invoice_type?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  generated_by?: string | null;
};

export type InvoiceLineItem = {
  id?: string | number;
  invoice_id?: string | number;
  charge_head_id?: string | number;
  description?: string | null;
  charge_head_name?: string | null;
  amount?: number | string | null;
  tax?: number | string | null;
};

export type InvoiceDetailPayload = {
  invoice: ResidentInvoice;
  items: InvoiceLineItem[];
};

export type FetchInvoiceByIdResponse = {
  success?: boolean;
  data?: InvoiceDetailPayload;
  message?: string;
};

export type FetchResidentInvoicesResponse = {
  success?: boolean;
  data?: ResidentInvoice[];
  message?: string;
};

/**
 * Matches smart-society `GET /api/billing/get-resident-invoices/:residentId`
 */
export async function fetchResidentInvoices(residentId: string | number) {
  const res = await api.get<FetchResidentInvoicesResponse | ResidentInvoice[]>(
    `/billing/get-resident-invoices/${encodeURIComponent(String(residentId))}`,
  );

  const data = res.data;
  if (Array.isArray(data)) return data;

  if (data && Array.isArray((data as FetchResidentInvoicesResponse).data)) {
    return (data as FetchResidentInvoicesResponse).data!;
  }

  return [] as ResidentInvoice[];
}

/**
 * Matches smart-society `GET /api/billing/get-invoice-by-id/:invoiceId`
 */
export async function fetchInvoiceById(invoiceId: string | number) {
  const res = await api.get<FetchInvoiceByIdResponse>(
    `/billing/get-invoice-by-id/${encodeURIComponent(String(invoiceId))}`,
  );

  const data = res.data?.data;
  if (data?.invoice) {
    return {
      invoice: data.invoice,
      items: Array.isArray(data.items) ? data.items : [],
    } as InvoiceDetailPayload;
  }

  return null;
}
