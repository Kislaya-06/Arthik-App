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
  /** Mint used as TEXT (income amounts, positive links). Light: deep mint, >= 4.8:1 on every light surface. Dark / AMOLED: the brand mint. */
  mintText: string;
  /** Coral used as TEXT (expense amounts). Light: deep coral, >= 4.8:1 on every light surface. Dark / AMOLED: the brand coral. */
  coralText: string;
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
  mintText: '#2E7A53',
  coralText: '#B9473A',
  isDark: false,
  keypadNumberBg: '#E2E8F0',
  keypadNumberBorder: '#CBD5E1',
  keypadNumberText: '#0F172A',
  // Operators and delete are tinted (not solid) so the digits and the Save button lead (2026-11 polish).
  keypadOperatorBg: '#E8F5EC',
  keypadOperatorBorder: '#B8E0C8',
  keypadOperatorText: '#2E7A53',
  keypadDeleteBg: '#FCE9E6',
  keypadDeleteBorder: '#F4B8AE',
  keypadDeleteIcon: '#B9473A',
  // Info ("how it works") badge: brand mint, never warning amber.
  moneyBadgeGradStart: '#DDF3E4',
  moneyBadgeGradMid: '#B8E0C8',
  moneyBadgeGradEnd: '#7FB896',
  moneyBadgeBorder: 'rgba(46, 122, 83, 0.30)',
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
  mintText: '#B8E0C8',
  coralText: '#F4B8AE',
  isDark: true,
  keypadNumberBg: '#334155',
  keypadNumberBorder: '#475569',
  keypadNumberText: '#FFFFFF',
  // Operators and delete are tinted (not solid) so the digits and the Save button lead (2026-11 polish).
  keypadOperatorBg: 'rgba(184, 224, 200, 0.16)',
  keypadOperatorBorder: 'rgba(184, 224, 200, 0.32)',
  keypadOperatorText: '#B8E0C8',
  keypadDeleteBg: 'rgba(244, 184, 174, 0.16)',
  keypadDeleteBorder: 'rgba(244, 184, 174, 0.32)',
  keypadDeleteIcon: '#F4B8AE',
  // Info ("how it works") badge: brand mint, never warning amber.
  moneyBadgeGradStart: '#DDF3E4',
  moneyBadgeGradMid: '#B8E0C8',
  moneyBadgeGradEnd: '#65A882',
  moneyBadgeBorder: 'rgba(184, 224, 200, 0.45)',
  moneyBadgeText: '#1A2B4C',
};

export const AmoledColors: ThemeColors = {
  background: '#000000', // pure AMOLED pitch black (0% emission)
  backgroundLight: '#080808',
  card: '#0A0A0A', // elevated surface on AMOLED pure black
  cardSubtle: '#121212', // secondary surface & pills
  inputBg: '#121212', // inputs & search bars
  gradientStart: '#000000',
  gradientEnd: '#000000',
  textPrimary: '#FFFFFF', // crisp brilliant white
  textSecondary: '#A1A1AA', // muted neutral zinc
  textMuted: '#71717A',
  textTertiary: '#52525B',
  mintGreen: '#B8E0C8', // signature mint accent
  mint: '#B8E0C8',
  mintGreenDark: '#65A882',
  mintDark: '#65A882',
  mintGreenSoft: 'rgba(184, 224, 200, 0.12)',
  peachCoral: '#F4B8AE', // vibrant coral accent
  coral: '#F4B8AE',
  peachSoft: 'rgba(244, 184, 174, 0.14)',
  forestGreen: '#1A2B4C',
  white: '#FFFFFF',
  border: '#1F1F1F', // crisp dark border defining surfaces against #000000
  borderSubtle: '#141414',
  navBarBg: '#050505', // floating bottom bar surface
  chartTrack: '#1A1A1A',
  danger: '#F87171',
  mintText: '#B8E0C8',
  coralText: '#F4B8AE',
  isDark: true,
  keypadNumberBg: '#141414',
  keypadNumberBorder: '#262626',
  keypadNumberText: '#FFFFFF',
  // Operators and delete are tinted (not solid) so the digits and the Save button lead (2026-11 polish).
  keypadOperatorBg: 'rgba(184, 224, 200, 0.16)',
  keypadOperatorBorder: 'rgba(184, 224, 200, 0.32)',
  keypadOperatorText: '#B8E0C8',
  keypadDeleteBg: 'rgba(244, 184, 174, 0.16)',
  keypadDeleteBorder: 'rgba(244, 184, 174, 0.32)',
  keypadDeleteIcon: '#F4B8AE',
  // Info ("how it works") badge: brand mint, never warning amber.
  moneyBadgeGradStart: '#DDF3E4',
  moneyBadgeGradMid: '#B8E0C8',
  moneyBadgeGradEnd: '#65A882',
  moneyBadgeBorder: 'rgba(184, 224, 200, 0.45)',
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
 * Role-based semantic scale covering dominant visual hierarchy.
 */
export const FontSize = {
  micro: 11,          // Chart X/Y axis labels, compact calendar cell dates
  caption: 12,        // Section uppercase labels, timestamps, compact tags, status pills
  bodySmall: 14,      // Secondary body text, subtitles, helper notes, version text
  body: 16,           // Regular body text, input text, row labels, standard button text
  titleSmall: 18,     // Sub-section headers, list group titles, prominent alert headers
  titleMedium: 20,    // Level-2 headers, section titles, card headers, modal titles
  titleLarge: 28,     // Major screen top header titles (Profile, History, Savings, Insights)
  display: 34,        // Major screen hero headers, welcome greetings, auth splash
  // Backward-compatibility aliases during expand-contract migration:
  cta: 18,            // Deprecated: use titleSmall or AppButton
  sectionTitle: 20,   // Deprecated: use titleMedium
  screenTitle: 30,    // Deprecated: use titleLarge (28) or display (34)
} as const;

/**
 * Line height tokens (in pixels)
 * Explicit vertical rhythm tied to semantic font roles.
 */
export const LineHeight = {
  micro: 14,
  caption: 16,
  bodySmall: 18,
  body: 22,
  titleSmall: 24,
  titleMedium: 26,
  titleLarge: 34,
  display: 42,
} as const;

/**
 * Letter spacing tokens (in pixels)
 * label: every small UPPERCASE label (section labels, form field labels, card captions such as
 * "TOTAL SPENT"). One value so all of them read with the same rhythm. Badges, chart labels and
 * fixed-size tiles keep their own tuned spacing (they are fixed shapes).
 */
export const LetterSpacing = {
  label: 0.8,
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
 * Fixed heights for interactive form controls, inputs, and buttons.
 */
export const ControlHeight = {
  compact: 36,  // In-card action chips, compact filter buttons
  standard: 48, // Modal buttons, search input bars
  row: 56,      // Standard form row height, input containers, date picker trigger (AGENTS.md 9.2)
  cta: 60,      // Primary action button height (AGENTS.md 9.2)
} as const;

/**
 * Screen hue tokens: the one hero colour of the Savings tab (Gullak violet) and of Insights (coral).
 * Home mint is the brand; these two are calm, low-saturation tints of the same family so the three tabs read as
 * one product, not three templates. White text on `gullak.from` stays >= 4.5:1; Insights text is dark (#2D1E1E).
 * `gullak.ink` is the violet used as TEXT on white (Deposit button, active pill text on white).
 * Every Gullak card / sheet gradient and the ambient glow (lib/ambientBackground TONES) use these values.
 */
export const ScreenHue = {
  gullak: { from: '#8267C1', to: '#412E60', ink: '#412E60' },
  insights: { from: '#E0887B', to: '#F3D7BE' },
} as const;

/**
 * Motion & Animation Tokens (Emil Kowalski / Apple-grade craft)
 * Central source of truth for duration budgets, easing curves, and spring physics.
 */
export const Motion = {
  duration: {
    instant: 80,
    press: 120,
    snappy: 180,
    standard: 240,
    sheet: 300,
    sweep: 320,
  },
  curves: {
    // Strong UI ease-out: starts fast, crisp deceleration
    easeOut: [0.23, 1, 0.32, 1] as const,
    // On-screen morphing / moving elements
    easeInOut: [0.77, 0, 0.175, 1] as const,
    // iOS sheet and drawer dismissal curve
    easeDrawer: [0.32, 0.72, 0, 1] as const,
  },
  springs: {
    // Subtle button & card press feedback (0.97 scale compression)
    press: { tension: 120, friction: 10 },
    // Snappy tactile release for buttons & cards (fast return with zero overshoot)
    release: { tension: 180, friction: 14 },
    // Crisp settlement with zero oscillation
    settle: { stiffness: 447.4, damping: 49, mass: 1 },
    // Interactive sheet snapping
    sheet: { damping: 24, stiffness: 280, mass: 0.9 },
    // High-frequency keypad release
    keypad: { tension: 180, friction: 12 },
  },
  scale: {
    press: 0.97,
    chip: 0.96,
  },
} as const;

export const Theme = {
  radius: BorderRadius,
  spacing: Spacing,
  fontSize: FontSize,
  lineHeight: LineHeight,
  letterSpacing: LetterSpacing,
  fonts: FontFamily,
  controls: ControlHeight,
  motion: Motion,
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


