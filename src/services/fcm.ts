/**
 * Firebase Cloud Messaging (FCM) service.
 * Handles permission, token retrieval, and notification handlers.
 */

import messaging from '@react-native-firebase/messaging';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

/** Open the app's notification/settings screen so the user can enable notifications. */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

/** Check whether notification permission is already granted (does NOT prompt). */
export async function hasNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (!granted) return false;
    }
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

/** Request notification permission (required on Android 13+ and iOS). */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (!alreadyGranted) {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (status !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      }
    }

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch {
    return false;
  }
}

/** Get the current FCM token. Returns null if permission denied or token unavailable. */
export async function getFCMToken(): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[FCM] Notification permission not granted');
      return null;
    }
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }

    // On iOS the APNs token may not be ready immediately after permission is
    // granted (native registration is async). Retry a few times with a short
    // delay so we don't falsely report "no token".
    const maxAttempts = Platform.OS === 'ios' ? 3 : 1;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const token = await messaging().getToken();
        if (token) return token;
      } catch (e) {
        console.warn(`[FCM] getToken attempt ${i + 1} failed:`, e);
      }
      if (i < maxAttempts - 1) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
      }
    }

    console.warn('[FCM] getToken() returned empty after retries');
    return null;
  } catch (e) {
    console.warn('[FCM] getFCMToken error:', e);
    return null;
  }
}

/** Subscribe to token refresh (e.g. when app is restored). Call with a callback to send new token to backend. */
export function onFCMTokenRefresh(callback: (token: string) => void | Promise<void>): () => void {
  const unsubscribe = messaging().onTokenRefresh(callback);
  return unsubscribe;
}

/** Set handler for messages received while app is in background/quit. Must be called outside of any component (e.g. in index.js). */
export function setBackgroundMessageHandler(
  handler: (message: import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage) => Promise<void>
): void {
  messaging().setBackgroundMessageHandler(handler);
}

/** Foreground message handler. Use in a useEffect to show in-app UI when a notification is received in foreground. */
export function onForegroundMessage(
  callback: (message: import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  const unsubscribe = messaging().onMessage(callback);
  return unsubscribe;
}

/**
 * Called when the user taps a system-shown notification while the app was
 * in background (but still running). On Android, messages with a
 * `notification` payload are shown by the system and bypass
 * setBackgroundMessageHandler, so we need this to handle them.
 */
export function onNotificationOpenedApp(
  callback: (message: import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  return messaging().onNotificationOpenedApp(callback);
}

/**
 * Returns the notification that caused the app to open from a killed state.
 * Null if the app was not opened from a notification.
 */
export async function getInitialNotification(): Promise<import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage | null> {
  return messaging().getInitialNotification();
}

/** Check if running on a device that supports FCM (not simulator on iOS for token). Android emulator can get token. */
export function isFCMSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}
