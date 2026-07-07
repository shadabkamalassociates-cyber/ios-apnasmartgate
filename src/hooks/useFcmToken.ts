import { useState, useEffect } from 'react';
import { getFCMToken, onFCMTokenRefresh } from '../services/fcm';

/**
 * Manages FCM token lifecycle: fetches on mount, refreshes automatically.
 * Accepts an optional callback to send the token to your backend.
 */
export function useFcmToken(onTokenReceived?: (token: string) => void) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const t = await getFCMToken();
        if (!cancelled && t) {
          setToken(t);
          onTokenReceived?.(t);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const unsubRefresh = onFCMTokenRefresh((newToken) => {
      if (!cancelled) {
        setToken(newToken);
        onTokenReceived?.(newToken);
      }
    });

    return () => {
      cancelled = true;
      unsubRefresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { token, loading };
}
