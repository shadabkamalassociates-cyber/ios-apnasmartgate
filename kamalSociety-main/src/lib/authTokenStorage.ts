import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

/** Keychain service id — isolates auth token from other stored credentials. */
const KEYCHAIN_SERVICE = 'com.kamalsociety.auth';

/** Legacy AsyncStorage key (pre–secure storage). Migrated once, then removed. */
const LEGACY_ASYNC_STORAGE_KEY = '@kamal_resident_token';

const KEYCHAIN_USERNAME = 'resident';

let migrationDone = false;

async function migrateLegacyTokenFromAsyncStorage(): Promise<string | null> {
  if (migrationDone) return null;
  migrationDone = true;

  try {
    const legacy = await AsyncStorage.getItem(LEGACY_ASYNC_STORAGE_KEY);
    if (!legacy) return null;

    await Keychain.setGenericPassword(KEYCHAIN_USERNAME, legacy, {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

/** Read the resident JWT from the device keychain (migrates legacy AsyncStorage once). */
export async function getAuthToken(): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (credentials && credentials.password) {
      return credentials.password;
    }
  } catch {
    // Fall through to legacy migration.
  }

  return migrateLegacyTokenFromAsyncStorage();
}

/** Store the resident JWT in the device keychain. */
export async function setAuthToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, token, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  // Clear any leftover plain-text copy.
  try {
    await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Remove the resident JWT from secure storage. */
export async function removeAuthToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch {
    // ignore
  }

  try {
    await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
  } catch {
    // ignore
  }
}
