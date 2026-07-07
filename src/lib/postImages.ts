import { ENV } from '../config/env';

/** Site origin for static paths like `/uploads/...` (API base is often `.../api`). */
function staticOriginBase(): string {
  const base = ENV.BACKEND_URL.replace(/\/$/, '');
  return base.endsWith('/api') ? base.slice(0, -4) : base;
}

/** Turn API-relative paths into loadable URIs (e.g. `uploads/post-images/...`, posts). */
export function resolveImageUri(raw: string): string {
  const u = raw.trim();
  if (!u) return '';
  if (u.startsWith('data:')) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${staticOriginBase()}${path}`;
}

/**
 * Complaints: DB may store `uploads/complaint-attachments/<file>` but shared multer writes to `uploads/<file>`.
 * Map stored paths to the URL that actually serves the file.
 */
export function resolveComplaintAttachmentUri(raw: string | null | undefined): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const normalized = s.replace(/^uploads\/complaint-attachments\//i, 'uploads/');
  return resolveImageUri(normalized);
}

/**
 * Reverse of {@link resolveImageUri} for edit payloads: returns API-relative paths like `uploads/post-images/...`.
 * Returns null for local device URIs or unrecognized URLs.
 */
export function displayUriToApiRelativePath(displayUri: string): string | null {
  const u = displayUri.trim();
  if (!u) return null;
  if (u.startsWith('data:') || u.startsWith('file:') || u.startsWith('content:')) return null;

  const base = staticOriginBase().replace(/\/$/, '');
  if (u.startsWith(base)) {
    const rest = u.slice(base.length).replace(/^\//, '');
    return rest || null;
  }

  if (!/^https?:\/\//i.test(u) && !u.startsWith('//')) {
    const cleaned = u.replace(/^\//, '');
    if (cleaned.startsWith('uploads/')) return cleaned;
  }

  try {
    const parsed = new URL(u);
    const baseUrl = new URL(base);
    if (parsed.origin === baseUrl.origin) {
      return parsed.pathname.replace(/^\//, '');
    }
  } catch {
    /* ignore */
  }

  return null;
}

function collectFromRaw(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item === 'string' && item.trim()) {
        const resolved = resolveImageUri(item);
        if (resolved) out.push(resolved);
      } else if (item && typeof item === 'object') {
        const u =
          (item as { url?: string }).url ??
          (item as { uri?: string }).uri ??
          (item as { src?: string }).src;
        if (typeof u === 'string' && u.trim()) {
          const resolved = resolveImageUri(u);
          if (resolved) out.push(resolved);
        }
      }
    }
    return out;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s) as unknown;
      return collectFromRaw(parsed);
    } catch {
      const resolved = resolveImageUri(s);
      return resolved ? [resolved] : [];
    }
  }
  return [];
}

/**
 * Same image extraction for Home preview and Posts feed — handles `images`, JSON strings, `image`, and object rows.
 */
export function normalizePostImages(rawPost: unknown): string[] {
  if (!rawPost || typeof rawPost !== 'object') return [];
  const p = rawPost as Record<string, unknown>;
  const merged = [
    ...collectFromRaw(p.images),
    ...collectFromRaw(p.image),
    ...collectFromRaw(p.image_urls),
    ...collectFromRaw(p.imageUrls),
    ...collectFromRaw(p.photos),
  ].filter(Boolean);
  return [...new Set(merged)];
}

/** Support `{ data: Post[] }` and `{ posts: Post[] }` from fetch-all. */
export function extractPostsArray(res: unknown): unknown[] {
  if (!res || typeof res !== 'object') return [];
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.data)) return r.data;
  if (Array.isArray(r.posts)) return r.posts;
  return [];
}
