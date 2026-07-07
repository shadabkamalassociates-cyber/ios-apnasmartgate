import api from './client';
import { fetchMultipart, buildImageFormData } from '../lib/uploadImage';

export type CreateComplaint = {
  society_id: string | number;
  apartment_id: string | number;
  raised_by: string | number;
  title: string;
  description?: string;
};

/** Matches backend multer field `attachment_url` (image, max 5MB on server). */
export type CreateComplaintAttachment = {
  uri: string;
  type?: string;
  name?: string;
};

export type UpdateComplaint = {
  title?: string;
  description?: string;
  status?: string;
  assigned_to?: string | number;
};

export function createComplaint(data: CreateComplaint, attachment?: CreateComplaintAttachment | null) {
  if (attachment?.uri) {
    const fd = buildImageFormData(
      {
        society_id: String(data.society_id),
        apartment_id: String(data.apartment_id),
        raised_by: String(data.raised_by),
        title: data.title,
        description: data.description,
      },
      [{ uri: attachment.uri, type: attachment.type, name: attachment.name ?? 'complaint.jpg' }],
      'attachment_url',
    );
    return fetchMultipart('/complaint/create', fd);
  }
  return api.post('/complaint/create', data).then((r) => r.data);
}

export function getComplaintsByRaisedBy(raisedBy: string | number) {
  return api.get(`/complaint/raised-by/${raisedBy}`).then((r) => r.data);
}

export function updateComplaint(id: string | number, data: UpdateComplaint) {
  return api.put(`/complaint/udpate/${id}`, data).then((r) => r.data);
}

export function updateComplaintStatus(id: string | number, status: string) {
  return api.put(`/complaint/status-update/${id}`, { status }).then((r) => r.data);
}

export function deleteComplaint(id: string | number) {
  return api.delete(`/complaint/delete/${id}`).then((r) => r.data);
}
