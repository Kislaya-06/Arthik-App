import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getScheme, setScheme, getListener, setListener } = vi.hoisted(() => {
  let scheme: 'light' | 'dark' = 'light';
  let listener: any = null;
  return {
    getScheme: () => scheme,
    setScheme: (s: 'light' | 'dark') => { scheme = s; },
    getListener: () => listener,
    setListener: (l: any) => { listener = l; },
  };
});

vi.mock('react-native', () => ({
  Appearance: {
    getColorScheme: vi.fn(() => getScheme()),
    addChangeListener: vi.fn((cb) => {
      setListener(cb);
      return { remove: vi.fn() };
    }),
  },
}));

// 2. Mock AsyncStorage
const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(async () => {
      storageMap.clear();
    }),
  },
}));

import { useThemeStore } from '../src/store/themeStore';
import { CATEGORY_PALETTE, getNextCategoryColor, getContrastTextColor } from '../src/config/theme';

describe('themeStore (Seam: useThemeStore)', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    setScheme('light');
    useThemeStore.setState({
      themeMode: 'system',
      systemScheme: 'light',
    });
  });

  describe('Slice 1: Default State', () => {
    it('initializes with themeMode="system" and system scheme from Appearance', () => {
      const state = useThemeStore.getState();
      expect(state.themeMode).toBe('system');
      expect(state.systemScheme).toBe('light');
    });
  });

  describe('Slice 2: Explicit Mode Selection (setThemeMode)', () => {
    it('sets mode to dark, light, amoled, or system', () => {
      useThemeStore.getState().setThemeMode('dark');
      expect(useThemeStore.getState().themeMode).toBe('dark');

      useThemeStore.getState().setThemeMode('light');
      expect(useThemeStore.getState().themeMode).toBe('light');

      useThemeStore.getState().setThemeMode('amoled');
      expect(useThemeStore.getState().themeMode).toBe('amoled');

      useThemeStore.getState().setThemeMode('system');
      expect(useThemeStore.getState().themeMode).toBe('system');
    });
  });

  describe('Slice 3: Theme Toggle Logic (toggleTheme)', () => {
    it('toggles from dark to light and vice versa when explicit mode is active', () => {
      useThemeStore.setState({ themeMode: 'dark' });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().themeMode).toBe('light');

      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().themeMode).toBe('dark');
    });

    it('toggles based on systemScheme when themeMode is "system"', () => {
      useThemeStore.setState({ themeMode: 'system', systemScheme: 'light' });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().themeMode).toBe('dark');

      useThemeStore.setState({ themeMode: 'system', systemScheme: 'dark' });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().themeMode).toBe('light');
    });
  });

  describe('Slice 4: System Appearance Listener', () => {
    it('updates systemScheme when OS appearance changes', () => {
      const listener = getListener();
      expect(listener).not.toBeNull();

      listener({ colorScheme: 'dark' });
      expect(useThemeStore.getState().systemScheme).toBe('dark');

      listener({ colorScheme: 'light' });
      expect(useThemeStore.getState().systemScheme).toBe('light');
    });
  });

  describe('Slice 5: Category Color Assignment & Contrast Helpers', () => {
    it('returns the first unused color from CATEGORY_PALETTE', () => {
      const existing = [
        { color: CATEGORY_PALETTE[0] },
        { color: CATEGORY_PALETTE[1] },
      ];
      const next = getNextCategoryColor(existing);
      expect(next).toBe(CATEGORY_PALETTE[2]);
    });

    it('dynamically curates a fresh pastel color when all palette colors are in use', () => {
      const allPalette = CATEGORY_PALETTE.map((c) => ({ color: c }));
      const curated = getNextCategoryColor(allPalette);
      expect(curated).toMatch(/^#[0-9A-F]{6}$/);
      // Must not match any in the palette
      expect(allPalette.some((c) => c.color.toUpperCase() === curated.toUpperCase())).toBe(false);
    });

    it('returns #000000 for bright/pastel backgrounds and #FFFFFF for dark backgrounds', () => {
      // Bright / pastel
      expect(getContrastTextColor('#ADEBB3')).toBe('#000000');
      expect(getContrastTextColor('#FF857A')).toBe('#000000');
      expect(getContrastTextColor('#FFFFFF')).toBe('#000000');
      // Dark
      expect(getContrastTextColor('#0B111E')).toBe('#FFFFFF');
      expect(getContrastTextColor('#6B403C')).toBe('#FFFFFF');
      expect(getContrastTextColor('#000000')).toBe('#FFFFFF');
    });
  });

  describe('Slice 6: AMOLED Mode & AmoledColors', () => {
    it('has pure black #000000 background and isDark=true for AmoledColors', async () => {
      const { AmoledColors } = await import('../src/config/theme');
      expect(AmoledColors.background).toBe('#000000');
      expect(AmoledColors.isDark).toBe(true);
      expect(AmoledColors.textPrimary).toBe('#FFFFFF');
    });

    it('toggles from amoled to light', () => {
      useThemeStore.setState({ themeMode: 'amoled' });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().themeMode).toBe('light');
    });
  });
});

