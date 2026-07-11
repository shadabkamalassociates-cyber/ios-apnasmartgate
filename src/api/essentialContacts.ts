import api from './client';

export type EssentialContact = {
  id: string | number;
  name?: string | null;
  mobile_number1?: string | null;
  mobile_number2?: string | null;
  designation?: string | null;
  title?: string | null;
  society_id?: string | number | null;
  created_at?: string | null;
};

export type EssentialContactsResponse = {
  success: boolean;
  count?: number;
  data?: EssentialContact[];
  message?: string;
};

export async function fetchEssentialContactsBySociety(societyId: string | number) {
  const res = await api.get<EssentialContactsResponse>(
    `/essential-contacts/fetch-by-society/${encodeURIComponent(String(societyId))}`
  );
  return res.data;
}

