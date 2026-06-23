import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';
import { STORAGE_TOKEN_KEY, logFetchApiRequest, logApiResponseSuccess } from '../api/client';

export type ImageFile = {
  uri: string;
  type?: string;
  name?: string;
};

/**
 * Upload multipart form data using `fetch` instead of axios.
 * Axios on RN sometimes mis-handles large multipart payloads (413).
 * `fetch` delegates to the native networking layer which streams
 * the body and sets the correct `multipart/form-data; boundary=…` header.
 *
 * This mirrors the working profile-image upload in resident.ts.
 */
export async function fetchMultipart<T = any>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const baseUrl = ENV.BACKEND_URL;
  const url = `${baseUrl}${path}`;

  const token = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
  const headers: Record<string, string> = {};
  if (token) {
    headers['Cookie'] = `token=${token}`;
    headers['Authorization'] = `Bearer ${token}`;
  }

  logFetchApiRequest({
    method,
    url,
    contentTypeNote: 'multipart/form-data (fetch — boundary set by native)',
    body: { _type: 'FormData', note: 'multipart — parts not listed' },
  });

  const resp = await fetch(url, { method, body: formData, headers });
  const contentType = resp.headers.get('content-type') ?? '';
  const rawText = await resp.text();

  const isJsonLike = /\bjson\b/i.test(contentType);
  const parsed: unknown = (() => {
    if (!rawText) return null;
    if (!isJsonLike) return null;
    try {
      return JSON.parse(rawText) as unknown;
    } catch {
      return null;
    }
  })();

  const payloadForLog = parsed ?? (rawText ? { _type: 'text', preview: rawText.slice(0, 400) } : null);
  logApiResponseSuccess(resp.status, method, url, payloadForLog);

  if (!resp.ok) {
    // Important: don't surface backend internals to the UI.
    // Screens typically display `err.response.data.message` or `err.message`,
    // so keep both generic.
    const err: any = new Error('Error');
    err.response = {
      status: resp.status,
      data: { message: 'Error' },
    };
    throw err;
  }

  // Successful responses should be JSON; if backend returns text, return it as-is.
  return (parsed ?? (rawText as unknown)) as T;
}

/**
 * Build a FormData with text fields + image files appended under `fieldName`.
**/
export function buildImageFormData(
  fields: Record<string, string | undefined>,
  images: ImageFile[],
  fieldName: string,
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== '') {
      fd.append(key, value);
    }
  }
  images.forEach((img, i) => {
    fd.append(fieldName, {
      uri: img.uri,
      type: img.type ?? 'image/jpeg',
      name: img.name ?? `upload-${i}.jpg`,
    } as any);
  });
  return fd;
}
