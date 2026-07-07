import api from './client';

export type Flat = {
  id: number;
  society_id: number;
  block_id: number;
  flat_number: string;
  floor?: number | null;
  owner_id?: number | null;
  status?: string | null;
  created_at?: string;
};

export async function fetchFlatsByBlock(blockId: string | number) {
  const res = await api.get<{ success?: boolean; count?: number; data?: Flat[] }>(
    `/flats/fetch-by-block/${blockId}`
  );
  return res.data;
}

