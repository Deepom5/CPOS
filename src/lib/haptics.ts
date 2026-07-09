/**
 * Thin wrapper around expo-haptics. All calls are fire-and-forget and
 * silently no-op on web or when the engine fails (e.g. Low Power Mode on iOS).
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function safe(promise: Promise<unknown> | undefined) {
  if (!promise) return;
  promise.catch(() => {
    /* ignore — haptics are best-effort */
  });
}

export function tapLight() {
  if (Platform.OS === 'web') return;
  safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function tapMedium() {
  if (Platform.OS === 'web') return;
  safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function tapRigid() {
  if (Platform.OS === 'web') return;
  safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
}

export function tapSoft() {
  if (Platform.OS === 'web') return;
  safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

export function selectionTick() {
  if (Platform.OS === 'web') return;
  safe(Haptics.selectionAsync());
}

export function notifySuccess() {
  if (Platform.OS === 'web') return;
  safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function notifyWarning() {
  if (Platform.OS === 'web') return;
  safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function notifyError() {
  if (Platform.OS === 'web') return;
  safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
