import api from './client';

export type SocietyEvent = {
  id: number;
  society_id: number;
  title: string;
  description?: string | null;
  date: string;
  time: string;
  location?: string | null;
  max_participants?: number | null;
  is_paid?: boolean;
  price?: number | string | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type EventsBySocietyResponse = {
  success: boolean;
  count?: number;
  data: SocietyEvent[];
  message?: string;
};

export function getEventsBySociety(societyId: string | number) {
  return api
    .get<EventsBySocietyResponse>(`/events/get-by-society/${societyId}`)
    .then((r) => r.data);
}
