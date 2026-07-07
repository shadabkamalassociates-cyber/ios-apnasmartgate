import api from './client';

export type Society = {
  id: number;
  name: string;
  address?: string;
  status?: string;
  created_at?: string;
  created_by_admin?: number;
};

export async function fetchAllSocieties() {
  const res = await api.get<{ success?: boolean; count?: number; data?: Society[] }>('/society/fetch-all');
  return res.data;
}

