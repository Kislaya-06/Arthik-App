/**
 * alertButtonPalette.ts
 *
 * Colours for the buttons of the themed alert dialog (AppAlertModal). Pure so the contrast of every
 * button in Light, Dark and AMOLED can be unit-tested (tests/appAlertModal.test.ts requires >= 4.5:1,
 * WCAG AA for 15px text).
 *
 * Why destructive is not simply "white text on colors.danger":
 *   Light danger #EF4444 with white text is 3.76:1 and Dark/AMOLED danger #F87171 with white text is
 *   2.77:1, so "Delete" was the hardest word to read on the screen. Light uses a deeper red (#DC2626,
 *   4.83:1 with white). Dark and AMOLED keep the theme's soft red and switch the text to dark, the same
 *   pattern the app already uses for text on mint and coral pills.
 */

export type AlertButtonVariant = 'default' | 'cancel' | 'destructive';

export interface AlertPaletteColors {
  isDark: boolean;
  mintGreen: string;
  mintGreenDark?: string;
  danger: string;
  cardSubtle: string;
  textPrimary: string;
  border: string;
}

export interface AlertButtonPalette {
  background: string;
  text: string;
  border: string;
}

/** Deeper red used for the destructive button in the light theme (white text 4.83:1). */
export const LIGHT_DESTRUCTIVE_BG = '#DC2626';
/** Text on the light-red destructive button in Dark (theme navy, 5.08:1 on #F87171). */
export const DARK_DESTRUCTIVE_TEXT = '#1A2B4C';

export function alertButtonPalette(
  variant: AlertButtonVariant | undefined,
  colors: AlertPaletteColors,
  isAmoled: boolean
): AlertButtonPalette {
  if (variant === 'destructive') {
    if (!colors.isDark) {
      return { background: LIGHT_DESTRUCTIVE_BG, text: '#FFFFFF', border: 'transparent' };
    }
    return {
      background: colors.danger,
      text: isAmoled ? '#000000' : DARK_DESTRUCTIVE_TEXT,
      border: 'transparent',
    };
  }
  if (variant === 'cancel') {
    return { background: colors.cardSubtle, text: colors.textPrimary, border: colors.border };
  }
  if (isAmoled) {
    return { background: colors.mintGreen, text: '#000000', border: 'transparent' };
  }
  if (!colors.isDark) {
    return { background: colors.mintGreenDark || colors.mintGreen, text: '#1A2B4C', border: 'transparent' };
  }
  return { background: colors.mintGreen, text: '#1A2B4C', border: 'transparent' };
}

/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const [lo, hi] = [lum(a), lum(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}
