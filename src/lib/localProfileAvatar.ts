import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKey = (userId: string) => `@kamal_local_profile_avatar:${userId}`;

/** Stored as a compact data URL (base64). Not synced to server — backend has no profile-image fields. */
export async function getLocalProfileAvatar(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export async function setLocalProfileAvatar(userId: string, dataUrl: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), dataUrl);
}

export async function clearLocalProfileAvatar(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}
