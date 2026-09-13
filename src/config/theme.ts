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

export const Theme = {
  colors: LightColors,
  borderRadius: {
    card: 24,
    button: 28,
    pill: 20,
    input: 16,
  },
  fonts: {
    regular: 'Quicksand_400Regular',
    medium: 'Quicksand_500Medium',
    semibold: 'Quicksand_600SemiBold',
    bold: 'Quicksand_700Bold',
  },
};
