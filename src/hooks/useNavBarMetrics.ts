import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNavBarMetrics, getNavContentInset, type NavBarMetrics } from '../lib/navBarLayout';

/** Responsive nav bar geometry for this phone (width + bottom inset). See navBarLayout.ts. */
export function useNavBarMetrics(): NavBarMetrics {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(() => getNavBarMetrics(width, insets.bottom), [width, insets.bottom]);
}

/** Bottom padding for a scrolling tab screen so its last row always clears the floating nav bar. */
export function useNavBarContentInset(extra = 0): number {
  const m = useNavBarMetrics();
  return getNavContentInset(m, extra);
}
