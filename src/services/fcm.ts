/**
 * Firebase Cloud Messaging (FCM) service.
 * Handles permission, token retrieval, and notification handlers.
 */

import {
  getMessaging,
  hasPermission as fcmHasPermission,
  requestPermission as fcmRequestPermission,
  AuthorizationStatus,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
  getToken,
  onTokenRefresh,
  setBackgroundMessageHandler as fcmSetBackgroundMessageHandler,
  onMessage,
  onNotificationOpenedApp as fcmOnNotificationOpenedApp,
  getInitialNotification as fcmGetInitialNotification,
} from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

const messaging = getMessaging();

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
    const authStatus = await fcmHasPermission(messaging);
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
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

    const authStatus = await fcmRequestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
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
    if (!isDeviceRegisteredForRemoteMessages(messaging)) {
      await registerDeviceForRemoteMessages(messaging);
    }

    // On both platforms the native token generation may not be ready immediately 
    // or Google Play Services might be busy. Retry a few times with a short
    // delay so we don't falsely report "no token" or fail on SERVICE_NOT_AVAILABLE.
    const maxAttempts = 3;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const token = await getToken(messaging);
        if (token) {
          console.log('[FCM] Successfully retrieved token:', token);
          return token;
        }
      } catch (e) {
        console.warn(`[FCM] getToken attempt ${i + 1} failed:`, e);
        // If it's a SERVICE_NOT_AVAILABLE or similar corrupted state, clearing the token cache can sometimes fix it
        try {
          await messaging.deleteToken();
        } catch (deleteError) {
          // ignore
        }
      }
      if (i < maxAttempts - 1) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 2500)); // Increased delay
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
  const unsubscribe = onTokenRefresh(messaging, callback);
  return unsubscribe;
}

/** Set handler for messages received while app is in background/quit. Must be called outside of any component (e.g. in index.js). */
export function setBackgroundMessageHandler(
  handler: (message: FirebaseMessagingTypes.RemoteMessage) => Promise<void>
): void {
  fcmSetBackgroundMessageHandler(messaging, handler);
}

/** Foreground message handler. Use in a useEffect to show in-app UI when a notification is received in foreground. */
export function onForegroundMessage(
  callback: (message: FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  const unsubscribe = onMessage(messaging, callback);
  return unsubscribe;
}

/**
 * Called when the user taps a system-shown notification while the app was
 * in background (but still running). On Android, messages with a
 * `notification` payload are shown by the system and bypass
 * setBackgroundMessageHandler, so we need this to handle them.
 */
export function onNotificationOpenedApp(
  callback: (message: FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  return fcmOnNotificationOpenedApp(messaging, callback);
}

/**
 * Returns the notification that caused the app to open from a killed state.
 * Null if the app was not opened from a notification.
 */
export async function getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
  return fcmGetInitialNotification(messaging);
}

/** Check if running on a device that supports FCM (not simulator on iOS for token). Android emulator can get token. */
export function isFCMSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}
