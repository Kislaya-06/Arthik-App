import { useTheme } from '../store/themeStore';
import { scrimColor } from '../lib/scrim';

/** Scrim colour for the active theme (see src/lib/scrim.ts). */
export const useScrimColor = (): string => {
  const { isDark, isAmoled } = useTheme();
  return scrimColor(isDark, isAmoled);
};
