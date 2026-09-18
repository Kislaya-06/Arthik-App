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
  colors: LightColors,
  /**
   * @deprecated Legacy border radius keys. Kept for backwards compatibility until ticket 02 is resolved.
   * Do not use in new code — use `BorderRadius` (or `Theme.radius`) instead.
   */
  borderRadius: {
    card: 24,
    button: 28,
    pill: 20,
    input: 16,
  },
  radius: BorderRadius,
  spacing: Spacing,
  fontSize: FontSize,
  fonts: FontFamily,
  controls: ControlHeight,
};

