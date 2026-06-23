import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';

const STORAGE_TOKEN_KEY = '@kamal_resident_token';

export { STORAGE_TOKEN_KEY };

const api: AxiosInstance = axios.create({
  baseURL: ENV.BACKEND_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/** Get stored token and set Cookie header for backend (protect middleware expects cookie) */
async function attachAuth(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
    if (token) {
      api.defaults.headers.common['Cookie'] = `token=${token}`;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return token;
    }
  } catch (_) {}
  delete api.defaults.headers.common['Cookie'];
  delete api.defaults.headers.common['Authorization'];
  return null;
}

/**
 * Default axios `Content-Type: application/json` breaks multipart on RN.
 * Delete the header entirely so the native networking layer (OkHttp / NSURLSession)
 * sets `multipart/form-data; boundary=…` automatically.
 */
function setMultipartContentTypeForFormData(config: InternalAxiosRequestConfig) {
  const data = config.data;
  if (data == null) return;
  const isFormData =
    typeof FormData !== 'undefined' &&
    data instanceof FormData;
  if (!isFormData) return;

  const h = config.headers;
  if (h && typeof (h as { delete?: (k: string) => boolean }).delete === 'function') {
    (h as { delete: (k: string) => boolean }).delete('Content-Type');
  } else if (h && typeof h === 'object') {
    delete (h as Record<string, unknown>)['Content-Type'];
  }
}

/** Keys whose values must not appear in logs (passwords, tokens). */
const SENSITIVE_KEY_RE = /password|token|secret|authorization|cookie|credential/i;

export function redactSensitiveRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[redacted]';
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSensitiveRecord(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Serialize request body for logs (JSON objects redacted; FormData summarized). */
function describeRequestBodyForLog(data: unknown): unknown {
  if (data == null || data === '') return null;
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return {
      _type: 'FormData',
      note: 'multipart/form-data — native stack sets boundary; parts not listed here',
    };
  }
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return redactSensitiveRecord(parsed as Record<string, unknown>);
      }
      return parsed;
    } catch {
      const s = data.length > 400 ? `${data.slice(0, 400)}…` : data;
      return { _type: 'string', preview: s };
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return redactSensitiveRecord({ ...(data as Record<string, unknown>) });
  }
  return data;
}

function getContentTypeHeader(config: InternalAxiosRequestConfig): string | undefined {
  const h = config.headers;
  if (!h || typeof h !== 'object') return undefined;
  if (typeof (h as { get?: (k: string) => string }).get === 'function') {
    return (h as { get: (k: string) => string }).get('Content-Type');
  }
  return (h as Record<string, string>)['Content-Type'] ?? (h as Record<string, string>)['content-type'];
}

function logOutgoingAxiosRequest(config: InternalAxiosRequestConfig) {
  const method = (config.method ?? 'get').toUpperCase();
  const fullUrl = `${config.baseURL ?? ''}${config.url ?? ''}`;
  const contentType = getContentTypeHeader(config);
  const params =
    config.params != null && typeof config.params === 'object' && Object.keys(config.params).length > 0
      ? config.params
      : undefined;
  console.log('[API] request', {
    method,
    url: fullUrl,
    contentType: contentType ?? '(axios default or adapter)',
    body: describeRequestBodyForLog(config.data),
    ...(params != null && { params }),
  });
}

/** Log a non-Axios request (e.g. `fetch` + `FormData`) so it matches the Axios request log. */
export function logFetchApiRequest(opts: {
  method: string;
  url: string;
  contentTypeNote?: string;
  body: unknown;
}) {
  console.log('[API] request', {
    method: opts.method.toUpperCase(),
    url: opts.url,
    transport: 'fetch',
    contentType: opts.contentTypeNote ?? '(native multipart boundary)',
    body: opts.body,
  });
}

export function logApiResponseSuccess(status: number, method: string, url: string, data: unknown) {
  const payload =
    data != null && typeof data === 'object' && !Array.isArray(data)
      ? redactSensitiveRecord(data as Record<string, unknown>)
      : data;
  console.log('[API] response', { status, method: method.toUpperCase(), url, data: payload });
}

export function logApiResponseError(err: any) {
  const status: number | undefined = err?.response?.status;
  const method = (err?.config?.method ?? 'get').toUpperCase();
  const fullUrl = `${err?.config?.baseURL ?? ''}${err?.config?.url ?? ''}`;
  const data = err?.response?.data;
  const payload =
    data != null && typeof data === 'object' && !Array.isArray(data)
      ? redactSensitiveRecord(data as Record<string, unknown>)
      : data;

  console.log('[API] error', {
    status: status ?? '(no status)',
    method,
    url: fullUrl || '(unknown url)',
    message: err?.message,
    data: payload,
  });
}

api.interceptors.request.use(
  async (config) => {
    await attachAuth();
    setMultipartContentTypeForFormData(config);
    logOutgoingAxiosRequest(config);
    return config;
  },
  (err) => Promise.reject(err)
);

api.interceptors.response.use(
  (res) => {
    const method = (res.config.method ?? 'get').toUpperCase();
    const fullUrl = `${res.config.baseURL ?? ''}${res.config.url ?? ''}`;
    logApiResponseSuccess(res.status, method, fullUrl, res.data);
    return res;
  },
  async (err) => {
    logApiResponseError(err);
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
      delete api.defaults.headers.common['Cookie'];
      delete api.defaults.headers.common['Authorization'];
    }
    return Promise.reject(err);
  }
);

export default api;
