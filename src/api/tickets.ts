import { buildImageFormData, fetchMultipart, type ImageFile } from '../lib/uploadImage';

export type CreateTicketInput = {
  title: string;
  description: string;
  created_by_resident: string | number;
  created_by_admin?: string | number;
  images?: ImageFile[];
};

export type CreateTicketResponse = {
  message?: string;
  data?: unknown;
  error?: string;
};

export async function createTicket(input: CreateTicketInput) {
  const fd = buildImageFormData(
    {
      title: input.title,
      description: input.description,
      created_by_resident: String(input.created_by_resident),
      ...(input.created_by_admin != null ? { created_by_admin: String(input.created_by_admin) } : {}),
    },
    input.images ?? [],
    'images',
  );

  return fetchMultipart<CreateTicketResponse>('/tickets/create', fd, 'POST');
}

