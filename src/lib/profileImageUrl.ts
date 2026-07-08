import { ENV } from '../config/env';

/** API base is `.../api`; uploaded files are served from the same host without `/api`. */
const ORIGIN = ENV.BACKEND_URL.replace(/\/api\/?$/, '');

/**
 * Turn a stored path like `uploads/resident-profile-images/foo.jpg` into a full URL for `<Image source={{ uri }} />`.
 *
 * A cache-bust query param is appended so that React Native's image cache
 * never serves a stale version after a profile-photo update on the server.
 */
export function resolveProfileImageUrl(
  pathOrUrl: string | null | undefined,
  cacheBuster?: string | number,
): string | null {
  if (pathOrUrl == null || String(pathOrUrl).trim() === '') return null;
  const s = String(pathOrUrl).trim();
  const bust = cacheBuster != null ? `?v=${cacheBuster}` : '';

  if (s.startsWith('http://') || s.startsWith('https://')) return `${s}${bust}`;
  const path = s.startsWith('/') ? s.slice(1) : s;
  return `${ORIGIN}/${path}${bust}`;
}
