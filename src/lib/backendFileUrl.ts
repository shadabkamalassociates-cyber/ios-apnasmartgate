import { ENV } from '../config/env';

/** API base is `.../api`; uploaded/static files live on same origin without `/api`. */
const ORIGIN = ENV.BACKEND_URL.replace(/\/api\/?$/, '');

export function resolveBackendFileUrl(
  pathOrUrl: string | null | undefined,
  opts?: { fallbackUploadsPrefix?: string },
): string | null {
  if (pathOrUrl == null || String(pathOrUrl).trim() === '') return null;
  const s = String(pathOrUrl).trim();

  if (s.startsWith('http://') || s.startsWith('https://')) return s;

  // If it's already a path, just join to origin.
  if (s.includes('/')) {
    const path = s.startsWith('/') ? s.slice(1) : s;
    return `${ORIGIN}/${path}`;
  }

  // Otherwise treat as a bare filename (common with older APIs).
  const prefix = (opts?.fallbackUploadsPrefix ?? '/uploads/').replace(/\/?$/, '/');
  const normalizedPrefix = prefix.startsWith('/') ? prefix.slice(1) : prefix;
  return `${ORIGIN}/${normalizedPrefix}${s}`;
}

