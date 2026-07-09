/**
 * AapnaSmartGate - Resident app
 * Integrates with Smart Society backend. Theme: cosmic orange, follows system light/dark.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { store, persistor } from './src/store';
import { RootNavigator, navigationRef } from './src/navigation';
import { useTheme } from './src/theme';
import {
  getFCMToken,
  getInitialNotification,
  hasNotificationPermission,
  onForegroundMessage,
  onNotificationOpenedApp,
  openAppSettings,
  requestNotificationPermission,
  onFCMTokenRefresh,
} from './src/services/fcm';
import {
  ensureGatePassChannel,
  handleNotificationNavigation,
  showGatePassNotification,
  registerNotifeeForegroundEvents,
  handleInitialNotifeeNotification,
  extractVisitorPayload,
  isNewVisitorMessage,
} from './src/services/visitorNotification';
import {
  consumeInitialVisitorPayload,
  subscribeVisitorLaunchOpened,
} from './src/services/visitorLaunchBridge';
import {
  consumePendingVisitorCallEvents,
  endActiveVisitorCall,
  getVoipToken,
  subscribeVisitorCallAccepted,
  subscribeVisitorCallDeclined,
  subscribeVoipTokenUpdated,
  type PendingVisitorCallEvent,
  type VisitorCallPayload,
} from './src/services/visitorCallBridge';
import { useSelector } from 'react-redux';
import type { RootState } from './src/store';
import { updateVoipToken, updateFcmToken } from './src/api/getpass';

function NotificationImportanceOverlay({
  onAllow,
  onOpenSettings,
  colors,
}: {
  onAllow: () => void;
  onOpenSettings: () => void;
  colors: Record<string, string>;
}) {
  return (
    <View style={[overlayStyles.container, { backgroundColor: colors.maincontainerbackground }]}>
      <View style={overlayStyles.iconWrapper}>
        <Text style={overlayStyles.icon}>🔔</Text>
      </View>
      <Text style={[overlayStyles.title, { color: colors.text }]}>
        Notifications are important
      </Text>
      <Text style={[overlayStyles.body, { color: colors.textSecondary }]}>
        This app needs notification permission to alert you about visitor entry
        requests, gate pass updates, and important society announcements. Without
        notifications you may miss critical alerts.
      </Text>
      <TouchableOpacity
        style={[overlayStyles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={onAllow}
        activeOpacity={0.8}
      >
        <Text style={overlayStyles.primaryBtnText}>Allow notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[overlayStyles.secondaryBtn, { borderColor: colors.primary }]}
        onPress={onOpenSettings}
        activeOpacity={0.8}
      >
        <Text style={[overlayStyles.secondaryBtnText, { color: colors.primary }]}>
          Open settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 999,
  },
  iconWrapper: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 340,
  },
  primaryBtn: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryBtn: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

function AppContent() {
  const { isDark, colors } = useTheme();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const residentId = useSelector((state: RootState) => state.auth.user?.id);

  // ─── Send the FCM push token to the backend ─────────────────────────
  const sendFCM = useCallback(async (token: string) => {
    if (residentId == null) return;
    try {
      await updateFcmToken(residentId, token);
    } catch {
      // Best-effort
    }
  }, [residentId]);

  useEffect(() => {
    let cancelled = false;
    const unsub = onFCMTokenRefresh((token: string) => {
      if (!cancelled) sendFCM(token);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [sendFCM]);

  const askPermission = useCallback(async (isRetry = false) => {
    const granted = await requestNotificationPermission();
    setPermissionDenied(!granted);
    if (!granted && isRetry) {
      openAppSettings();
    }
    // Fetch and send token on startup if permitted
    if (granted) {
      const token = await getFCMToken();
      if (token) {
        sendFCM(token);
      }
    }
  }, [sendFCM]);

  useEffect(() => {
    ensureGatePassChannel();

    // Delay the permission request so the Activity is fully settled; this
    // prevents the Activity-restart crash on some Android 13+ devices.
    const timer = setTimeout(() => {
      askPermission();
    }, 800);

    // Re-check when the user comes back from system settings.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        hasNotificationPermission().then((ok) => setPermissionDenied(!ok));
      }
    });

    // Notifee foreground event handler (tap / action press on notifications)
    const unsubNotifee = registerNotifeeForegroundEvents();

    // Notifee: check if app was opened from a notification in killed state
    handleInitialNotifeeNotification();

    // FCM foreground messages → show Notifee notification with actions
    const unsubForeground = onForegroundMessage((remoteMessage) => {
      showGatePassNotification(remoteMessage);
    });

    // FCM: user tapped a system-shown notification while app was in background
    const unsubOpenedApp = onNotificationOpenedApp((remoteMessage) => {
      if (isNewVisitorMessage(remoteMessage)) {
        const payload = extractVisitorPayload(remoteMessage);
        if (payload) {
          handleNotificationNavigation({
            screen: 'ApproveDeny',
            visitorName: payload.name ?? 'Visitor',
            requestId: payload.gatepassId,
            gatepassId: payload.gatepassId,
            flat: payload.flat ?? '',
            phone: payload.phone ?? '',
            vehicle: payload.vehicle ?? '',
          });
        }
      }
    });

    // FCM: app was killed, opened via notification tap
    getInitialNotification().then((remoteMessage) => {
      if (remoteMessage && isNewVisitorMessage(remoteMessage)) {
        const payload = extractVisitorPayload(remoteMessage);
        if (payload) {
          handleNotificationNavigation({
            screen: 'ApproveDeny',
            visitorName: payload.name ?? 'Visitor',
            requestId: payload.gatepassId,
            gatepassId: payload.gatepassId,
            flat: payload.flat ?? '',
            phone: payload.phone ?? '',
            vehicle: payload.vehicle ?? '',
          });
        }
      }
    });

    // Native bridge: handle visitor action forwarded from VisitorAlertActivity.
    // VisitorAlertActivity sets visitorAction = "approve" | "unapprove" and
    // relaunches MainActivity with all original extras.
    const processNativeLaunchPayload = async (
      payload: Record<string, string> | null,
    ) => {
      if (!payload) return;

      const rawAction = payload.visitorAction;
      const actionId =
        rawAction === 'unapprove'
          ? 'deny'
          : rawAction === 'approve'
            ? 'approve'
            : undefined;

      const data: Record<string, string> = {
        visitorName: payload.name || 'Visitor',
        name: payload.name || 'Visitor',
        requestId: payload.visitorId || '',
        gatepassId: payload.visitorId || '',
        flat: payload.flat || '',
        phone: payload.phone || '',
        vehicle: payload.vehicle || '',
      };

      setTimeout(() => handleNotificationNavigation(data, actionId), 600);
    };

    // Cold start: user acted on full-screen alert while app was killed
    consumeInitialVisitorPayload().then(processNativeLaunchPayload);

    // Warm start: user acted on full-screen alert while app was alive (onNewIntent)
    const visitorLaunchSub = subscribeVisitorLaunchOpened((payload) => {
      processNativeLaunchPayload(payload);
    });

    // ─── iOS CallKit (PushKit) integration ──────────────────────────────
    //
    // On iOS, visitor approval requests arrive as VoIP pushes which surface
    // as native incoming-call screens (CallKit). When the resident taps
    // Accept / Decline on that screen we receive an event here and replay
    // it through the same approve/deny flow used by Notifee on Android.

    const handleCallEvent = (
      action: 'approve' | 'deny',
      payload: VisitorCallPayload,
    ) => {
      const data: Record<string, string> = {
        visitorName: payload.name || 'Visitor',
        name: payload.name || 'Visitor',
        requestId: payload.visitorId || '',
        gatepassId: payload.visitorId || '',
        flat: payload.flat || '',
        phone: payload.phone || '',
        vehicle: payload.vehicle || '',
      };
      // End the CallKit screen if it's still up (it usually isn't by now).
      if (payload.visitorId) {
        endActiveVisitorCall(payload.visitorId);
      }
      setTimeout(() => handleNotificationNavigation(data, action), 400);
    };

    // Drain accept/decline events that fired while the JS bundle wasn't
    // running (e.g. resident declined from the lock screen on a killed app).
    consumePendingVisitorCallEvents().then((events: PendingVisitorCallEvent[]) => {
      // Process most recent first; only the latest action per visitor matters.
      const seen = new Set<string>();
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (!e?.visitorId || seen.has(e.visitorId)) continue;
        seen.add(e.visitorId);
        handleCallEvent(e.action, e);
      }
    });

    const acceptedSub = subscribeVisitorCallAccepted((payload) => {
      handleCallEvent('approve', payload);
    });
    const declinedSub = subscribeVisitorCallDeclined((payload) => {
      handleCallEvent('deny', payload);
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
      unsubNotifee();
      unsubForeground();
      unsubOpenedApp();
      visitorLaunchSub.remove();
      acceptedSub.remove();
      declinedSub.remove();
    };
  }, [askPermission]);

  // VoIP token logic has been completely removed.
  // The backend now relies entirely on FCM tokens to send standard push notification banners.

  const navigationTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        primary: colors.primary,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    }),
    [colors.background, colors.border, colors.primary, colors.surface, colors.text, isDark],
  );

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.maincontainerbackground}
      />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.maincontainerbackground }}
        edges={['top']}
      >
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
        {permissionDenied && (
          <NotificationImportanceOverlay
            colors={colors as unknown as Record<string, string>}
            onAllow={() => askPermission(true)}
            onOpenSettings={() => openAppSettings()}
          />
        )}
      </SafeAreaView>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
