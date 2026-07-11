import api from './client';
import type { VendorCategoryKey } from '../constants/vendorCategories';

export type VendorServiceRow = {
  vendor_id: string | number;
  business_name?: string | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  service_id?: string | number | null;
  service_name?: string | null;
  price?: string | number | null;
  category?: string | null;
  images?: string[] | null;
};

export type VendorServiceDetail = {
  id: string | number;
  vendor_id?: string | number | null;
  name?: string | null;
  description?: string | null;
  price?: string | number | null;
  images?: string[] | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export async function fetchVendorsByCategory(category: VendorCategoryKey) {
  const res = await api.get<{
    success: boolean;
    count?: number;
    data?: VendorServiceRow[];
  }>(`/vendors-services/fetch-vendors-by-category/${encodeURIComponent(category)}`);
  return res.data;
}

export async function fetchServiceById(id: string | number) {
  const res = await api.get<VendorServiceDetail>(`/vendors-services/fetch-by-id/${encodeURIComponent(String(id))}`);
  return res.data;
}

