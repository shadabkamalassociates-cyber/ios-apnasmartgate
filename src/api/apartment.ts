import api from './client';

export function getApartments() {
  return api.get<{ success?: boolean; data?: unknown[] }>('/apartment/fetch').then((r) => r.data);
}
