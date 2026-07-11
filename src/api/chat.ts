import api from './client';

export type ChatRow = {
  id: string | number;
  resident_id?: string | number;
  vendor_id?: string | number;
  created_at?: string;
  vendor_name?: string | null;
  vendor_profile_image?: string | null;
  resident_name?: string | null;
  resident_profile_image?: string | null;
};

export type ChatMessage = {
  id: string | number;
  chat_id: string | number;
  sender_id: string | number;
  message: string;
  created_at?: string;
  is_seen?: boolean;
};

export async function createOrGetChat(resident_id: string | number, vendor_id: string | number) {
  const res = await api.post<{ success: boolean; data: ChatRow; message?: string }>('/chat/create', {
    resident_id,
    vendor_id,
  });
  return res.data;
}

/** Requires backend POST /chat/inbox (see backend notes in chat feature). */
export async function fetchInbox(resident_id: string | number) {
  const res = await api.post<{ success: boolean; count?: number; data: ChatRow[]; message?: string }>(
    '/chat/inbox',
    { resident_id },
  );
  return res.data;
}

export async function fetchMessages(chatId: string | number) {
  const res = await api.get<{ success: boolean; data: ChatMessage[]; message?: string }>(
    `/chat/messages/${encodeURIComponent(String(chatId))}`,
  );
  return res.data;
}

export async function sendMessage(payload: {
  chat_id: string | number;
  sender_id: string | number;
  message: string;
}) {
  const res = await api.post<{ success: boolean; data: ChatMessage; message?: string }>('/chat/send', payload);
  return res.data;
}

export async function markMessagesSeen(chatId: string | number) {
  const res = await api.put<{ success: boolean; message?: string }>(
    `/chat/seen/${encodeURIComponent(String(chatId))}`,
  );
  return res.data;
}
