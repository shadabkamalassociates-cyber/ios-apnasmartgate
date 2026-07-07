/**
 * JS bridge to the native iOS VisitorCallBridge module.
 *
 * On iOS we receive visitor approval requests as VoIP pushes (PushKit) and
 * surface them as native incoming calls via CallKit, so the device rings
 * continuously and shows a full-screen UI on the lock screen until the
 * resident taps Accept or Decline. This module lets JS:
 *   - Read the VoIP push token (to send to the backend).
 *   - Listen for token updates and accept / decline events.
 *   - Drain "missed" events that fired while no JS listener was attached
 *     (e.g. resident declined from the lock screen while the app was killed).
 *
 * On Android this is a no-op.
 */
import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export type VisitorCallPayload = {
  visitorId: string;
  name: string;
  phone?: string;
  flat?: string;
  vehicle?: string;
  title?: string;
  body?: string;
};

export type PendingVisitorCallEvent = VisitorCallPayload & {
  /** "approve" when user tapped Accept on CallKit, "deny" on Decline. */
  action: 'approve' | 'deny';
  /** Unix timestamp (seconds) when the action was recorded natively. */
  receivedAt?: number;
};

type NativeVisitorCallBridge = {
  getVoipToken?: () => Promise<string | null>;
  consumePendingCallEvents?: () => Promise<PendingVisitorCallEvent[]>;
  endActiveCall?: (visitorId: string) => Promise<void>;
  simulateIncomingCall?: (payload: VisitorCallPayload) => Promise<void>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

const nativeModule = NativeModules.VisitorCallBridge as NativeVisitorCallBridge | undefined;

const nativeEmitter =
  Platform.OS === 'ios' && nativeModule
    ? new NativeEventEmitter(NativeModules.VisitorCallBridge)
    : null;

/** Returns the current VoIP push token (hex string) or null if not yet issued. */
export async function getVoipToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !nativeModule?.getVoipToken) return null;
  try {
    return await nativeModule.getVoipToken();
  } catch {
    return null;
  }
}

/**
 * Drain accept/decline events that were recorded natively while no JS
 * listener was attached. Returns an empty array on Android or if there's
 * nothing pending. Calling this clears the persisted list.
 */
export async function consumePendingVisitorCallEvents(): Promise<PendingVisitorCallEvent[]> {
  if (Platform.OS !== 'ios' || !nativeModule?.consumePendingCallEvents) return [];
  try {
    const result = await nativeModule.consumePendingCallEvents();
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/** End the CallKit incoming-call UI for a visitor (e.g. after the JS flow finishes). */
export async function endActiveVisitorCall(visitorId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !nativeModule?.endActiveCall) return;
  try {
    await nativeModule.endActiveCall(visitorId);
  } catch {
    // Best-effort
  }
}

/**
 * Test helper — present a fake incoming visitor call exactly like a real
 * VoIP push would (rings continuously, full-screen on lock, Accept/Decline
 * buttons fire the same JS events as production). iOS only; no-op elsewhere.
 */
export async function simulateIncomingVisitorCall(
  payload: VisitorCallPayload,
): Promise<boolean> {
  if (Platform.OS !== 'ios' || !nativeModule?.simulateIncomingCall) return false;
  try {
    await nativeModule.simulateIncomingCall(payload);
    return true;
  } catch {
    return false;
  }
}

export function subscribeVoipTokenUpdated(
  listener: (token: string) => void,
): { remove: () => void } {
  if (!nativeEmitter) return { remove: () => {} };
  const sub: EmitterSubscription = nativeEmitter.addListener(
    'VisitorCallVoipTokenUpdated',
    (event: { token?: string }) => {
      if (event?.token) listener(event.token);
    },
  );
  return { remove: () => sub.remove() };
}

export function subscribeVisitorCallAccepted(
  listener: (payload: VisitorCallPayload) => void,
): { remove: () => void } {
  if (!nativeEmitter) return { remove: () => {} };
  const sub: EmitterSubscription = nativeEmitter.addListener(
    'VisitorCallAccepted',
    listener,
  );
  return { remove: () => sub.remove() };
}

export function subscribeVisitorCallDeclined(
  listener: (payload: VisitorCallPayload) => void,
): { remove: () => void } {
  if (!nativeEmitter) return { remove: () => {} };
  const sub: EmitterSubscription = nativeEmitter.addListener(
    'VisitorCallDeclined',
    listener,
  );
  return { remove: () => sub.remove() };
}
