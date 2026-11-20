/**
 * scrim.ts
 *
 * The dimmed background behind every centered dialog and bottom sheet. One value per theme, so every
 * popup in the app dims the screen the same amount (AppAlertModal's values).
 */
export const SCRIM_LIGHT = 'rgba(15, 23, 42, 0.45)';
export const SCRIM_DARK = 'rgba(0, 0, 0, 0.72)';
export const SCRIM_AMOLED = 'rgba(0, 0, 0, 0.88)';

export function scrimColor(isDark: boolean, isAmoled: boolean): string {
  if (isAmoled) return SCRIM_AMOLED;
  return isDark ? SCRIM_DARK : SCRIM_LIGHT;
}
