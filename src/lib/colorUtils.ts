import { getContrastTextColor } from '../config/theme';

/**
 * Mix a hex color with pure white (#FFFFFF) by the given factor (0..1).
 * Used to calculate the luminous highlight stop for badge gradients.
 */
export function tintColor(hex: string, factor: number): string {
  if (!hex || hex.length < 3) return '#FFFFFF';
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, 'F').slice(0, 6);

  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;

  const f = Math.max(0, Math.min(1, factor));
  const newR = Math.round(r + (255 - r) * f);
  const newG = Math.round(g + (255 - g) * f);
  const newB = Math.round(b + (255 - b) * f);

  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Mix a hex color with pure black (#000000) by the given factor (0..1).
 * Used to calculate the deeper depth stop for badge gradients.
 */
export function shadeColor(hex: string, factor: number): string {
  if (!hex || hex.length < 3) return '#000000';
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);

  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;

  const f = Math.max(0, Math.min(1, factor));
  const newR = Math.round(r * (1 - f));
  const newG = Math.round(g * (1 - f));
  const newB = Math.round(b * (1 - f));

  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Calculates a 3-stop diagonal gradient palette from any base category or status hex color.
 * Produces soft, tactile, high-end enamel badges that eliminate harsh eye strain and match
 * the app's signature aesthetic (like BrandedHeroCard's mint gradient).
 */
export function getBadgeGradientColors(baseHex: string, isDark = false): {
  startColor: string;
  midColor: string;
  endColor: string;
  strokeColor: string;
  iconColor: string;
} {
  const clean = (baseHex || '#ADEBB3').trim();
  // 0% luminous highlight, 50% base, 100% gentle depth
  const startColor = tintColor(clean, isDark ? 0.22 : 0.16);
  const midColor = clean;
  const endColor = shadeColor(clean, isDark ? 0.14 : 0.10);

  // Subtle border that creates a crisp rim light
  const strokeColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)';

  // Contrast check: if the base color is dark, use crisp white icon.
  // Otherwise use Arthik's signature brand navy (#1A2B4C, used in hero card and typography)
  // which looks far richer and softer on the eyes than jet black #000000.
  const isLightBg = getContrastTextColor(clean) === '#000000';
  const iconColor = isLightBg ? '#1A2B4C' : '#FFFFFF';

  return {
    startColor,
    midColor,
    endColor,
    strokeColor,
    iconColor,
  };
}
