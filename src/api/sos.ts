import api from './client';

export type CreateSOS = {
  society_id: string | number;
  title: string;
  flat_id: string | number;
  description?: string;
  created_by: string | number;
};

/** Shape of rows returned from the SmartSociety backend `sos_alerts` table. */
export type SOSAlert = {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string;
  society?: {
    id: number;
    name: string;
    address?: string | null;
  };
  created_by?: {
    id: number;
    name?: string | null;
    email?: string | null;
  };
  flat?: {
    id: number;
    flat_number: string;
    floor?: string | null;
  };
};

export function createSOS(data: CreateSOS) {
  return api.post('/sos/create', data).then((r) => r.data);
}

/** Fetch SOS alerts for a given society (all residents in that society). */
export function getSOSBySociety(societyId: string | number) {
  return api.get<{ success: boolean; data?: SOSAlert[] }>(`/sos/fetch-by-society/${societyId}`).then((r) => r.data);
}

/** Fetch SOS alerts created by a specific user/resident. */
export function getSOSByUser(userId: string | number) {
  return api.get<{ success: boolean; data?: SOSAlert[] }>(`/sos/fetch-by-user/${userId}`).then((r) => r.data);
}

export function getSOSByStatus(status: string) {
  return api.get<{ success: boolean; data?: SOSAlert[] }>(`/sos/status/${status}`).then((r) => r.data);
}

export function updateSOS(id: string | number, status: string) {
  return api.put(`/sos/update/${id}`, { status }).then((r) => r.data);
}

export function deleteSOS(id: string | number) {
  return api.delete(`/sos/delete/${id}`).then((r) => r.data);
}
