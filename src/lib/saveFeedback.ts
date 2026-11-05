import * as Haptics from 'expo-haptics';

/** Success haptic for a confirmed save (expense, deposit, budget). Haptics map: docs/design-system.md. */
export function saveSuccessHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
