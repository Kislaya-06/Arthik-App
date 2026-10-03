import React from 'react';
import { RefreshControl, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';

/**
 * THE pull-to-refresh for the whole app. Home, History, Savings and Insights all use this one
 * component, so the pull-down animation is identical everywhere: the native Material circle drops
 * in from the top, spins while refreshing and slides away when done. Nothing on the page moves.
 *
 * Android ignores `tintColor`, which is why the screens used to show the default blue/white circle.
 * Here every Android prop is set explicitly from the theme:
 *  - `colors`                  spinner arc  -> accent (mint)
 *  - `progressBackgroundColor` disc behind  -> card surface
 *  - `progressViewOffset`      keeps the disc below the status bar (edge-to-edge)
 */
export interface AppRefreshControlProps extends ViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  /** false disables the pull (used by Home while its list owns the touch). Default true. */
  enabled?: boolean;
  /**
   * Extra distance (dp) the disc stays below the top edge of the scroll area.
   * Default: the status-bar inset, for scroll areas that start at the very top of the screen.
   * Pass 0 when the scroll area already starts below a fixed header (History).
   */
  topOffset?: number;
}

export const AppRefreshControl: React.FC<AppRefreshControlProps> = ({
  refreshing,
  onRefresh,
  enabled = true,
  topOffset,
  ...passthrough
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = isDark ? colors.mintGreen : colors.mintGreenDark;

  return (
    // IMPORTANT: on Android, <ScrollView refreshControl={...}> clones this element and passes the actual
    // ScrollView in as `children` (+ a layout `style`). They MUST be forwarded to the real RefreshControl,
    // otherwise the whole screen renders empty (black).
    <RefreshControl
      {...passthrough}
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      tintColor={accent}
      colors={[accent]}
      progressBackgroundColor={colors.card}
      progressViewOffset={topOffset ?? insets.top}
    />
  );
};

export default AppRefreshControl;
