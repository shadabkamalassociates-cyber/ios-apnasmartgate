import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getLocalProfileAvatar } from '../lib/localProfileAvatar';

/**
 * Loads optional on-device profile photo for the current user.
 * When `refetchOnFocus` is true, reloads when the screen gains focus (e.g. Home after editing Profile).
 */
export function useLocalProfileAvatar(
  userId: string | number | undefined | null,
  options?: { refetchOnFocus?: boolean }
) {
  const refetchOnFocus = options?.refetchOnFocus ?? false;
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (userId == null || userId === '') {
      setDataUrl(null);
      return;
    }
    const next = await getLocalProfileAvatar(String(userId));
    setDataUrl(next);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus) {
        reload();
      }
    }, [refetchOnFocus, reload])
  );

  return { localAvatarDataUrl: dataUrl, reloadLocalAvatar: reload };
}
