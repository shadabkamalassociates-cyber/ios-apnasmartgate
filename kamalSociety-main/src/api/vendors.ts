import api from './client';

export type VendorDetail = {
  id: string | number;
  user_id?: string | number | null;
  name?: string | null;
  phone?: string | null;
  business_name?: string | null;
  business_registration_number?: string | null;
  business_address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | number | null;
  gst_number?: string | null;
  pan_number?: string | null;
  years_of_experience?: string | number | null;
  website_url?: string | null;
  description?: string | null;
  email?: string | null;
  verification_status?: string | null;
  verification_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export async function fetchVendorById(id: string | number) {
  const res = await api.get<VendorDetail | VendorDetail[]>(
    `/vendors/fetch-by-id/${encodeURIComponent(String(id))}`
  );
  const data = res.data as unknown;
  if (Array.isArray(data)) return (data[0] ?? null) as VendorDetail | null;
  return (data ?? null) as VendorDetail | null;
}

