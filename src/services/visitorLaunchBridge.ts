import { NativeEventEmitter, NativeModules, type EmitterSubscription } from 'react-native';

type NativeVisitorLaunchModule = {
  consumeInitialVisitorPayload?: () => Promise<Record<string, string> | null>;
  showVisitorAlert?: (payload: Record<string, string>) => Promise<void>;
  storeVisitorAlertPayload?: (payload: Record<string, string>) => Promise<void>;
  canUseFullScreenIntent?: () => Promise<boolean>;
  openFullScreenIntentSettings?: () => Promise<void>;
  cancelAllNotifications?: () => Promise<void>;
  isBatteryOptimizationDisabled?: () => Promise<boolean>;
  requestIgnoreBatteryOptimization?: () => Promise<boolean>;
  playRingSound?: () => Promise<void>;
  stopRingSound?: () => Promise<void>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

const nativeModule = NativeModules.VisitorLaunchBridge as NativeVisitorLaunchModule | undefined;
const nativeEmitter = nativeModule ? new NativeEventEmitter(NativeModules.VisitorLaunchBridge) : null;

export async function consumeInitialVisitorPayload(): Promise<Record<string, string> | null> {
  if (!nativeModule?.consumeInitialVisitorPayload) return null;
  return nativeModule.consumeInitialVisitorPayload();
}

export async function showVisitorAlert(payload: Record<string, string>): Promise<void> {
  if (!nativeModule?.showVisitorAlert) return;
  await nativeModule.showVisitorAlert(payload);
}

export async function storeVisitorAlertPayload(payload: Record<string, string>): Promise<void> {
  if (!nativeModule?.storeVisitorAlertPayload) return;
  await nativeModule.storeVisitorAlertPayload(payload);
}

export async function canUseFullScreenIntent(): Promise<boolean> {
  if (!nativeModule?.canUseFullScreenIntent) return true;
  return nativeModule.canUseFullScreenIntent();
}

export async function openFullScreenIntentSettings(): Promise<void> {
  if (!nativeModule?.openFullScreenIntentSettings) return;
  await nativeModule.openFullScreenIntentSettings();
}

export async function cancelAllNativeNotifications(): Promise<void> {
  if (!nativeModule?.cancelAllNotifications) return;
  await nativeModule.cancelAllNotifications();
}

export async function isBatteryOptimizationDisabled(): Promise<boolean> {
  if (!nativeModule?.isBatteryOptimizationDisabled) return false;
  return nativeModule.isBatteryOptimizationDisabled();
}

export async function requestIgnoreBatteryOptimization(): Promise<boolean> {
  if (!nativeModule?.requestIgnoreBatteryOptimization) return false;
  return nativeModule.requestIgnoreBatteryOptimization();
}

export function subscribeVisitorLaunchOpened(
  listener: (payload: Record<string, string>) => void
): { remove: () => void } {
  if (!nativeEmitter) {
    return { remove: () => {} };
  }

  const subscription: EmitterSubscription = nativeEmitter.addListener('visitorLaunchOpened', listener);
  return {
    remove: () => subscription.remove(),
  };
}

export async function playNativeRingSound(): Promise<void> {
  if (!nativeModule?.playRingSound) return;
  try {
    await nativeModule.playRingSound();
  } catch {}
}

export async function stopNativeRingSound(): Promise<void> {
  if (!nativeModule?.stopRingSound) return;
  try {
    await nativeModule.stopRingSound();
  } catch {}
}
