import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { LightColors, DarkColors, ThemeColors, Theme } from '../config/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  themeMode: ThemeMode;
  systemScheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  setSystemScheme: (scheme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const getInitialSystemScheme = (): 'light' | 'dark' => {
  const current = Appearance.getColorScheme();
  return current === 'dark' ? 'dark' : 'light';
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'system',
      systemScheme: getInitialSystemScheme(),

      setThemeMode: (themeMode: ThemeMode) => set({ themeMode }),

      setSystemScheme: (systemScheme: 'light' | 'dark') => set({ systemScheme }),

      toggleTheme: () => {
        const { themeMode, systemScheme } = get();
        const active = themeMode === 'system' ? systemScheme : themeMode;
        set({ themeMode: active === 'dark' ? 'light' : 'dark' });
      },
    }),
    {
      name: 'arthik-theme-preference',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themeMode: state.themeMode }),
    }
  )
);

// Listen to phone system appearance changes
Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  useThemeStore.getState().setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
});

/**
 * Custom hook to consume the current theme and color tokens anywhere in the app.
 */
export const useTheme = () => {
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useThemeStore((s) => s.systemScheme);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const effectiveScheme = themeMode === 'system' ? systemScheme : themeMode;
  const isDark = effectiveScheme === 'dark';
  const colors: ThemeColors = isDark ? DarkColors : LightColors;

  return {
    colors,
    isDark,
    themeMode,
    theme: {
      ...Theme,
      colors,
    },
    setThemeMode,
    toggleTheme,
  };
};
