/** Decode base64url to string (works in React Native without `atob`). */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (typeof atobFn === 'function') {
    return atobFn(padded);
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < padded.length; i += 4) {
    const enc1 = chars.indexOf(padded[i]);
    const enc2 = chars.indexOf(padded[i + 1]);
    const enc3 = chars.indexOf(padded[i + 2]);
    const enc4 = chars.indexOf(padded[i + 3]);
    if (enc1 < 0 || enc2 < 0) break;
    output += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
    if (enc3 >= 0 && padded[i + 2] !== '=') {
      output += String.fromCharCode(((enc2 & 15) << 4) | (enc3 >> 2));
    }
    if (enc4 >= 0 && padded[i + 3] !== '=') {
      output += String.fromCharCode(((enc3 & 3) << 6) | enc4);
    }
  }
  return output;
}

/** Decode JWT payload without verification (client-side id/role extraction only). */
export function parseJwtPayload(token: string): { id?: string | number; role?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    return JSON.parse(base64UrlDecode(base64Url)) as { id?: string | number; role?: string };
  } catch {
    return null;
  }
}
