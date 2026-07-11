import api from './client';

export type NoticeItem = {
  id: number;
  society_id?: number;
  created_by?: number;
  title?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  society_name?: string;
};

export function getNoticesBySociety(societyId: string | number) {
  return api.get<NoticeItem[]>(`/notice/fetch-by-society/${societyId}`).then((r) => r.data);
}

export function getNoticesByCreatedBy(createdBy: string | number) {
  return api.get<NoticeItem[]>(`/notice/fetch-by-created-by/${createdBy}`).then((r) => r.data);
}

export type MarkNoticeViewedResponse = { success: boolean };

// Backend route is `GET /notice/mark-notice-view` and reads from `req.body`.
// Use axios `request` so we can send a body with a GET. We also mirror the
// payload as query params so it still works if a proxy strips the GET body.
export function markNoticeViewed(payload: {
  noticeId: string | number;
  userId: string | number;
  societyId: string | number;
}) {
  return api
    .request<MarkNoticeViewedResponse>({
      method: 'GET',
      url: '/notice/mark-notice-view',
      data: payload,
      params: payload,
    })
    .then((r) => r.data);
}

