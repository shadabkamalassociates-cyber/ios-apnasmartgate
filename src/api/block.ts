import api from './client';

export type Block = {
  id: number;
  name: string;
  society_id: number;
  created_at?: string;
};

export async function fetchBlocksBySociety(societyId: string | number) {
  const res = await api.get<{ success?: boolean; count?: number; data?: Block[] }>(
    `/blocks/fetch-blocks-by-society/${societyId}`
  );
  return res.data;
}

