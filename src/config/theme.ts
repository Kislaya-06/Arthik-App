export interface ThemeColors {
  background: string;
  backgroundLight: string;
  card: string;
  cardSubtle: string;
  inputBg: string;
  gradientStart: string;
  gradientEnd: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textTertiary: string;
  mintGreen: string;
  mint: string;
  mintGreenDark: string;
  mintDark: string;
  mintGreenSoft: string;
  peachCoral: string;
  coral: string;
  peachSoft: string;
  forestGreen: string;
  white: string;
  border: string;
  borderSubtle: string;
  navBarBg: string;
  chartTrack: string;
  danger: string;
  isDark: boolean;
  // Keypad tokens
  keypadNumberBg: string;
  keypadNumberBorder: string;
  keypadNumberText: string;
  keypadOperatorBg: string;
  keypadOperatorBorder: string;
  keypadOperatorText: string;
  keypadDeleteBg: string;
  keypadDeleteBorder: string;
  keypadDeleteIcon: string;
  // Money badge gradient tokens
  moneyBadgeGradStart: string;
  moneyBadgeGradMid: string;
  moneyBadgeGradEnd: string;
  moneyBadgeBorder: string;
  moneyBadgeText: string;
}

export const LightColors: ThemeColors = {
  background: '#F8F9FB', // off-white base
  backgroundLight: '#FFFFFF',
  card: '#FFFFFF',
  cardSubtle: '#F5F6F9',
  inputBg: '#F1F2F5',
  gradientStart: '#F0F8F4', // very soft mint green
  gradientEnd: '#FFFFFF',
  textPrimary: '#1A2B4C', // dark navy
  textSecondary: '#8A8FA3', // slate/gray for helper/secondary text
  textMuted: '#B0B4C0',
  textTertiary: '#B0B4C0',
  mintGreen: '#B8E0C8', // primary/positive
  mint: '#B8E0C8',
  mintGreenDark: '#7FB896', // darker mint for primary buttons/accents
  mintDark: '#7FB896',
  mintGreenSoft: '#F0FAF4',
  peachCoral: '#F4B8AE', // secondary/spending
  coral: '#F4B8AE',
  peachSoft: '#FDEEEC',
  forestGreen: '#1A2B4C',
  white: '#FFFFFF',
  border: '#E0E2E8',
  borderSubtle: '#F0F1F4',
  navBarBg: '#1A2B4C',
  chartTrack: '#E8E9EE',
  danger: '#EF4444',
  isDark: false,
  keypadNumberBg: '#E2E8F0',
  keypadNumberBorder: '#CBD5E1',
  keypadNumberText: '#0F172A',
  keypadOperatorBg: '#ADEBB3',
  keypadOperatorBorder: '#95DDA0',
  keypadOperatorText: '#000000',
  keypadDeleteBg: '#FF857A',
  keypadDeleteBorder: '#E87A70',
  keypadDeleteIcon: '#000000',
  moneyBadgeGradStart: '#FDE68A',
  moneyBadgeGradMid: '#FBBF24',
  moneyBadgeGradEnd: '#F59E0B',
  moneyBadgeBorder: 'rgba(217, 119, 6, 0.35)',
  moneyBadgeText: '#1A2B4C',
};

export const DarkColors: ThemeColors = {
  background: '#0B111E', // deep midnight navy base
  backgroundLight: '#131D2F',
  card: '#131D2F', // elevated surface for cards
  cardSubtle: '#1A263B', // secondary surfaces & pills
  inputBg: '#1A263B', // text inputs & search bars
  gradientStart: '#131D2F',
  gradientEnd: '#0B111E',
  textPrimary: '#F8FAFC', // crisp light slate
  textSecondary: '#94A3B8', // muted slate
  textMuted: '#64748B',
  textTertiary: '#64748B',
  mintGreen: '#B8E0C8', // vibrant mint accent
  mint: '#B8E0C8',
  mintGreenDark: '#65A882',
  mintDark: '#65A882',
  mintGreenSoft: 'rgba(184, 224, 200, 0.12)',
  peachCoral: '#F4B8AE', // vibrant coral accent
  coral: '#F4B8AE',
  peachSoft: 'rgba(244, 184, 174, 0.14)',
  forestGreen: '#1A2B4C',
  white: '#FFFFFF',
  border: '#243248', // subtle dark slate border
  borderSubtle: '#182335',
  navBarBg: '#131D2F', // floating bottom bar surface
  chartTrack: '#243248', // dark donut chart track
  danger: '#F87171',
  isDark: true,
  keypadNumberBg: '#334155',
  keypadNumberBorder: '#475569',
  keypadNumberText: '#FFFFFF',
  keypadOperatorBg: '#ADEBB3',
  keypadOperatorBorder: '#8ED696',
  keypadOperatorText: '#000000',
  keypadDeleteBg: '#FF857A',
  keypadDeleteBorder: '#E57065',
  keypadDeleteIcon: '#000000',
  moneyBadgeGradStart: '#FEF08A',
  moneyBadgeGradMid: '#F59E0B',
  moneyBadgeGradEnd: '#D97706',
  moneyBadgeBorder: 'rgba(252, 211, 77, 0.45)',
  moneyBadgeText: '#1A2B4C',
};

/**
 * Spacing tokens (in pixels)
 * Role-based semantic scale derived from recurring layout conventions.
 */
export const Spacing = {
  nano: 2,       // Subtitle/subtext optical leading gap (marginTop/marginBottom: 2)
  micro: 4,      // Tightest gap: subtitle top margins, micro badge offsets
  element: 8,    // Adjacent related elements: icon-to-label gaps, input label margins, compact row gaps
  group: 12,     // Grouped items: modal action button gaps, card icon margins
  row: 14,       // List row and dialog button vertical rhythm (paddingVertical: 14)
  block: 16,     // Standard rhythm between form blocks (AGENTS.md 9.2), default card padding
  surface: 20,   // Inner surface padding, prominent CTA vertical padding
  gutter: 24,    // Screen horizontal padding / gutters (paddingHorizontal: 24), large card padding
  section: 32,   // Major section separation, hero top spacing, bottom scroll buffer
} as const;

/**
 * Border radius tokens (in pixels)
 * Strictly conservative: only dominant recurring conventions.
 * Note: Circle radii (e.g. 40 for 80x80 avatars) are width/2 geometry, not radius tokens.
 */
export const BorderRadius = {
  input: 16,        // Text inputs, modal inputs, compact containers
  card: 24,         // Major surface cards (ProfileCard, SettingsCard, ModalCard)
  cardLarge: 28,    // Hero and summary cards, modal sheets
  pill: 9999,       // Full stadium/pill for interactive buttons, chips, tags (AGENTS.md 9.2)
} as const;

/**
 * Font size tokens (in pixels)
 * Role-based typography scale covering dominant conventions.
 */
export const FontSize = {
  caption: 12,        // Section uppercase labels, timestamps, compact tags
  bodySmall: 14,      // Secondary body text, subtitles, helper notes, version text
  body: 16,           // Regular body text, input text, row labels, standard button text
  cta: 18,            // Primary CTA labels and modal titles (AGENTS.md 9.2)
  sectionTitle: 20,   // Level-2 headers and section titles
  screenTitle: 30,    // Major screen top header titles (Profile, History)
} as const;

/**
 * Font family tokens
 * All four Quicksand font weights supported by the app (AGENTS.md 9.2).
 */
export const FontFamily = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semibold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
} as const;

/**
 * Interactive control dimension tokens (in pixels)
 * Fixed heights for interactive form controls and primary CTAs.
 */
export const ControlHeight = {
  row: 56, // Standard form row height, input containers, date picker trigger (AGENTS.md 9.2)
  cta: 60, // Primary action button height (AGENTS.md 9.2)
} as const;

export const Theme = {
  radius: BorderRadius,
  spacing: Spacing,
  fontSize: FontSize,
  fonts: FontFamily,
  controls: ControlHeight,
};

/**
 * Curated Category Color Palette (26 distinct, vibrant colors)
 * Derived from user-provided palettes and lively modern design tokens.
 */
export const CATEGORY_PALETTE = [
  '#FF857A', // Coral Pink (Food & Drinks)
  '#EBAEE6', // Soft Lilac (Shopping)
  '#4A90D9', // Sky Blue (Transport)
  '#F4A460', // Warm Sand (Bills & Utilities)
  '#9988A1', // Dusty Lavender (Entertainment)
  '#E35336', // Terracotta Red (Health)
  '#ADEBB3', // Pastel Mint Green (Others)
  '#00A699', // Airbnb Teal
  '#FFA726', // Warm Amber
  '#FFD3AC', // Peach Cream
  '#38BDF8', // Vivid Sky Cyan
  '#F472B6', // Rose Pink
  '#10B981', // Emerald Green
  '#6366F1', // Royal Indigo
  '#FB923C', // Sunset Tangerine
  '#D946EF', // Vibrant Fuchsia
  '#06B6D4', // Electric Cyan
  '#8B5CF6', // Soft Violet
  '#84CC16', // Lime Spark
  '#F43F5E', // Rose Coral
  '#F59E0B', // Warm Gold
  '#14B8A6', // Mint Teal
  '#3B82F6', // Blue Ribbon
  '#A0522D', // Sienna Brown
  '#6B403C', // Deep Coffee Brown
  '#F5F5DC', // Soft Beige
] as const;

/**
 * Converts HSL values to a 6-character Hex string (e.g. #RRGGBB).
 */
export const hslToHex = (h: number, s: number, l: number): string => {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

/**
 * Automatically picks the next available unique color for a new category.
 * First checks unused colors from the curated CATEGORY_PALETTE.
 * If all curated colors are already taken, dynamically generates a fresh,
 * harmonious, non-colliding pastel-modern color using the golden angle HSL formula.
 */
export const getNextCategoryColor = (existingCategories: Array<{ color?: string }>): string => {
  const used = new Set(
    existingCategories
      .map((c) => c.color?.toUpperCase().trim())
      .filter((c): c is string => Boolean(c))
  );

  const unusedFromPalette = CATEGORY_PALETTE.find((c) => !used.has(c.toUpperCase()));
  if (unusedFromPalette) {
    return unusedFromPalette;
  }

  // Curate a fresh, unique vibrant pastel color if all curated palette colors are taken
  const total = existingCategories.length;
  for (let i = 0; i < 60; i++) {
    const hue = Math.round(((total + i) * 137.508) % 360); // golden angle distribution
    const curatedColor = hslToHex(hue, 75, 65);
    if (!used.has(curatedColor.toUpperCase())) {
      return curatedColor;
    }
  }

  return CATEGORY_PALETTE[total % CATEGORY_PALETTE.length];
};

/**
 * Returns '#000000' or '#FFFFFF' depending on the perceived luminance of the background hex.
 */
export const getContrastTextColor = (hex?: string): string => {
  if (!hex || hex.length < 6) return '#000000';
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  // Perceived luminance formula (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? '#000000' : '#FFFFFF';
};


