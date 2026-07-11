import { Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  type Event as NotifeeEvent,
} from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { navigationRef } from '../navigation/navigationRef';
import { updateVisitorStatus, findWaitingAttendance } from '../api/visitor';
import { store } from '../store';
import {
  cancelAllNativeNotifications,
  storeVisitorAlertPayload,
  canUseFullScreenIntent,
  showVisitorAlert,
} from './visitorLaunchBridge';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VisitorAlertPayload = {
  gatepassId: string;
  title?: string;
  body?: string;
  name?: string;
  flat?: string;
  phone?: string;
  vehicle?: string;
  extra?: VisitorNotificationData;
};

type VisitorNotificationData = NonNullable<FirebaseMessagingTypes.RemoteMessage['data']>;

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNEL_ID = 'mygate_call_v4';
const CHANNEL_NAME = 'Gate Pass';
const SOUND_NAME = 'mygate';

/** Must match the FQCN in AndroidManifest — full-screen intent opens this activity (Notifee). */
const ANDROID_VISITOR_ALERT_ACTIVITY = 'com.kamalsociety.VisitorAlertActivity';

// ─── Payload helpers ─────────────────────────────────────────────────────────

function getString(data: VisitorNotificationData | undefined, key: string): string | undefined {
  const v = data?.[key];
  return typeof v === 'string' && v.trim().length ? v : undefined;
}

function getVisitorRequestId(data?: VisitorNotificationData): string | undefined {
  return (
    getString(data, 'visitorId') ??
    getString(data, 'visitor_id') ??
    getString(data, 'gatepassId') ??
    getString(data, 'gatepass_id') ??
    getString(data, 'requestId') ??
    getString(data, 'request_id') ??
    getString(data, 'attendanceId') ??
    getString(data, 'attendance_id') ??
    getString(data, 'id')
  );
}

export function extractVisitorPayloadFromData(data?: VisitorNotificationData): VisitorAlertPayload | null {
  const visitorId = getVisitorRequestId(data);
  if (!visitorId) return null;

  return {
    gatepassId: visitorId,
    title: getString(data, 'title'),
    body: getString(data, 'body'),
    name: getString(data, 'name'),
    flat: getString(data, 'flat') ?? getString(data, 'flatNo'),
    phone: getString(data, 'phone'),
    vehicle: getString(data, 'vehicle') ?? getString(data, 'vehicleinfo'),
    extra: data,
  };
}

export function isNewVisitorMessage(message: FirebaseMessagingTypes.RemoteMessage): boolean {
  const data = message.data;
  const title = (message.notification?.title ?? getString(data, 'title') ?? '').toLowerCase();
  const body = (message.notification?.body ?? getString(data, 'body') ?? '').toLowerCase();
  const actionType = getString(data, 'actionType');
  const screen = getString(data, 'screen');
  return (
    screen === 'ApproveDeny' ||
    !!getVisitorRequestId(data) ||
    title.includes('visitor') ||
    body.includes('visitor') ||
    body.includes('gate') ||
    actionType === 'VISITOR_ENTRY'
  );
}

export function extractVisitorPayload(message: FirebaseMessagingTypes.RemoteMessage): VisitorAlertPayload | null {
  const data = message.data ?? {};
  const basePayload = extractVisitorPayloadFromData(data);
  if (!basePayload) return null;

  const body = message.notification?.body ?? getString(data, 'body') ?? '';
  const nameMatch = body.match(/^(.+?)\s+is waiting/i);

  return {
    ...basePayload,
    title: message.notification?.title ?? basePayload.title,
    body: body || undefined,
    name: basePayload.name ?? nameMatch?.[1],
  };
}

// ─── Channel + iOS category setup ───────────────────────────────────────────

export async function ensureGatePassChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      sound: SOUND_NAME,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibration: true,
    });
  }

  await notifee.setNotificationCategories([
    {
      id: 'gatepass',
      actions: [
        // foreground: false + authenticationRequired: false → can be tapped
        // directly from the lock screen without unlocking the device.
        { id: 'approve', title: 'APPROVE', foreground: false, authenticationRequired: false },
        {
          id: 'deny',
          title: 'DENY',
          foreground: false,
          authenticationRequired: false,
          destructive: true,
        },
      ],
    },
  ]);
}

// ─── Show GatePass notification ─────────────────────────────────────────────

export async function showGatePassNotification(
  message: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  if (!isNewVisitorMessage(message)) return;
  const payload = extractVisitorPayload(message);
  if (!payload) return;

  await ensureGatePassChannel();

  const notifId = `visitor-${payload.gatepassId}`;
  const title = payload.title ?? 'Visitor Entry Request';
  const body =
    payload.body ??
    (payload.name ? `${payload.name} is waiting at the gate` : 'A visitor is waiting at the gate');
  const visitorDisplayName = payload.name ?? 'Visitor';

  // Cancel the system FCM auto-notification BEFORE showing ours.
  // Wait for it to appear first, then cancel, then show our Notifee one.
  // NEVER cancel after showing — NotificationManager.cancelAll() kills Notifee too.
  await cancelAllNativeNotifications();
  await notifee.cancelAllNotifications();
  await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
  await cancelAllNativeNotifications();
  await notifee.cancelAllNotifications();

  if (Platform.OS === 'android') {
    await storeVisitorAlertPayload({
      title,
      body,
      name: visitorDisplayName,
      visitorId: payload.gatepassId,
      gatepassId: payload.gatepassId,
      flat: payload.flat ?? '',
      phone: payload.phone ?? '',
      vehicle: payload.vehicle ?? '',
    });
  }

  // Now show OUR notification with Approve/Deny action buttons
  await notifee.displayNotification({
    id: notifId,
    title,
    body,
    data: {
      screen: 'ApproveDeny',
      visitorName: visitorDisplayName,
      name: visitorDisplayName,
      requestId: payload.gatepassId,
      gatepassId: payload.gatepassId,
      title,
      body,
      flat: payload.flat ?? '',
      phone: payload.phone ?? '',
      vehicle: payload.vehicle ?? '',
    },
    android: {
      channelId: CHANNEL_ID,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: SOUND_NAME,
      loopSound: true,
      ongoing: true,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default', launchActivity: ANDROID_VISITOR_ALERT_ACTIVITY },
      fullScreenAction: {
        id: 'default',
        launchActivity: ANDROID_VISITOR_ALERT_ACTIVITY,
      },
      actions: [
        { title: 'APPROVE', pressAction: { id: 'approve', launchActivity: 'default' } },
        { title: 'DENY', pressAction: { id: 'deny', launchActivity: 'default' } },
      ],
      autoCancel: true,
      vibrationPattern: [300, 600],
    },
    ios: {
      sound: 'mygate.mp3',
      categoryId: 'gatepass',
      // Break through Focus / DND so the resident actually hears the alert.
      // 'critical' would also bypass the silent switch but requires the
      // Apple-granted "Critical Alerts" entitlement.
      interruptionLevel: 'timeSensitive',
    },
  });

  // Fallback: on Android 14+ when USE_FULL_SCREEN_INTENT is not granted,
  // Notifee's fullScreenAction won't launch the activity. Try launching it
  // directly as a best-effort fallback.
  if (Platform.OS === 'android') {
    try {
      const canFSI = await canUseFullScreenIntent();
      if (!canFSI) {
        await showVisitorAlert({
          title,
          body,
          name: visitorDisplayName,
          visitorId: payload.gatepassId,
          gatepassId: payload.gatepassId,
          flat: payload.flat ?? '',
          phone: payload.phone ?? '',
          vehicle: payload.vehicle ?? '',
        });
      }
    } catch {
      // Best-effort — activity start may be blocked on some devices
    }
  }
}

// ─── Navigation from notification data ──────────────────────────────────────

export function handleNotificationNavigation(
  data?: Record<string, string> | { [key: string]: string },
  actionId?: string,
): void {
  if (!data) return;

  const visitorName = data.visitorName || data.name;
  const requestId = data.requestId || data.gatepassId;

  if (visitorName && navigationRef.isReady()) {
    navigationRef.navigate('ApproveDeny', {
      visitorName,
      requestId,
      actionId,
      phone: data.phone || undefined,
      flat: data.flat || undefined,
      vehicle: data.vehicle || undefined,
    });
  }
}

// ─── Backend action from notification buttons ───────────────────────────────

export async function handleNotificationAction(
  data?: Record<string, string> | { [key: string]: string },
  actionId?: string,
): Promise<void> {
  if (!data || !actionId) return;
  if (actionId !== 'approve' && actionId !== 'deny') return;

  const visitorId = data.requestId || data.gatepassId;
  const visitorName = data.visitorName || data.name;

  const flatId = store.getState().auth.user?.flat_id;
  if (flatId == null) return;

  const status = actionId === 'approve' ? 'approve' : 'unapprove';
  try {
    const match = await findWaitingAttendance(visitorId, visitorName, flatId);
    if (!match) return;
    await updateVisitorStatus(match.attendanceId, status);
  } catch {
    // Best-effort from background handler
  }
}

// ─── Notifee event handlers ─────────────────────────────────────────────────

/** Register in index.js — handles background/killed notification events. */
export async function onNotifeeBackgroundEvent({ type, detail }: NotifeeEvent): Promise<void> {
  const data = detail.notification?.data as Record<string, string> | undefined;

  if (type === EventType.ACTION_PRESS && detail.pressAction) {
    await handleNotificationAction(data, detail.pressAction.id);
  }
}

/** Register in App.tsx useEffect — handles foreground notification events. Returns cleanup fn. */
export function registerNotifeeForegroundEvents(): () => void {
  return notifee.onForegroundEvent(({ type, detail }) => {
    const data = detail.notification?.data as Record<string, string> | undefined;

    if (type === EventType.ACTION_PRESS && detail.pressAction) {
      const actionId = detail.pressAction.id;
      // Keep action parity across platforms: persist approve/deny immediately
      // from notification actions, then continue with in-app navigation.
      handleNotificationAction(data, actionId).finally(() => {
        handleNotificationNavigation(data, actionId);
      });
    } else if (type === EventType.PRESS) {
      handleNotificationNavigation(data);
    }
  });
}

/** Check for a notification that launched the app from killed state. */
export async function handleInitialNotifeeNotification(): Promise<void> {
  const initial = await notifee.getInitialNotification();
  if (!initial) return;

  const data = initial.notification.data as Record<string, string> | undefined;
  const actionId = initial.pressAction?.id;

  if (actionId && actionId !== 'default') {
    await handleNotificationAction(data, actionId);
    handleNotificationNavigation(data, actionId);
  } else {
    handleNotificationNavigation(data);
  }
}
