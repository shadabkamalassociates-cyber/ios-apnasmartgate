import api from './client';

export type Maid = {
  id: string | number;
  society_id?: string | number | null;
  name?: string | null;
  phone?: string | null;
  aadhaar_number?: string | null;
  address?: string | null;
  photo?: string | null;
  status?: 'pending' | 'verified' | 'blocked' | string | null;
  is_verified?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  society_name?: string | null;
};

export type MaidListResponse = {
  success: boolean;
  data?: Maid[];
  message?: string;
};

export async function fetchAllMaids() {
  const res = await api.get<MaidListResponse>('/maid/fetch-all');
  return res.data;
}

export async function fetchMaidsBySociety(societyId: string | number) {
  const res = await api.get<MaidListResponse>(
    `/maid/fetch-by-society/${encodeURIComponent(String(societyId))}`
  );
  return res.data;
}

