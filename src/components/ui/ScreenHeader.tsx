import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { ControlHeight, FontFamily, FontSize, LineHeight, Spacing } from '../../config/theme';
import { FIXED_SHAPE_MAX_FONT_SCALE } from '../../lib/fontScale';
import { HeaderBackButton, HEADER_BACK_ICON_SIZE } from './HeaderBackButton';

/**
 * Header of every pushed page (ADR 0021, centered-title amendment).
 *
 * Anatomy: 48dp bar, 4dp below the safe area. Back arrow on the left, optional actions on the right,
 * a 20px bold title centred on the WHOLE bar (Apple HIG navigation bar / Material 3 center-aligned
 * top app bar). The title is drawn in an absolute layer inset by the same amount on both sides, so
 * it stays exactly centred whatever sits at the edges; the inset is the wider of the two sides.
 * The right side is measured once; until then a safe default is used. Because the inset is
 * symmetric, the measurement can only change how much room the title has, never where its centre is,
 * so the title never jumps.
 *
 * Content below the header starts `Spacing.element` after the bar.
 */

/** Room the back arrow needs on its side: icon + the gap to the title. */
const BACK_SIDE = HEADER_BACK_ICON_SIZE + Spacing.block;
/** Assumed width of right-side actions before they are measured (two 20px icons + gap). */
const DEFAULT_RIGHT_SIDE = 72;

interface ScreenHeaderProps {
  title: string;
  /** Show the back arrow (default true). */
  showBack?: boolean;
  /** Custom back action; default goes back when possible. */
  onBack?: () => void;
  backDisabled?: boolean;
  /** Actions on the right (icon buttons, a pill, step dots). */
  right?: React.ReactNode;
  /** Small element drawn before the title, inside the centred layer (e.g. a category badge). */
  titleAccessory?: React.ReactNode;
  /** Apply the screen gutter (default true). Pass false when the parent already pads the screen. */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  showBack = true,
  onBack,
  backDisabled,
  right,
  titleAccessory,
  inset = true,
  style,
}) => {
  const { colors } = useTheme();
  const hasRight = right !== null && right !== undefined && right !== false;
  const [rightWidth, setRightWidth] = useState<number | null>(null);

  const onRightLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    setRightWidth((prev) => (prev === w ? prev : w));
  }, []);

  const leftSide = showBack ? BACK_SIDE : 0;
  const rightSide = hasRight ? (rightWidth ?? DEFAULT_RIGHT_SIDE) + Spacing.element : 0;
  const side = Math.max(leftSide, rightSide);

  return (
    <View style={[styles.bar, inset && styles.inset, style]}>
      {showBack ? <HeaderBackButton onPress={onBack} disabled={backDisabled} /> : <View />}

      <View
        pointerEvents="none"
        style={[styles.titleLayer, { left: (inset ? Spacing.gutter : 0) + side, right: (inset ? Spacing.gutter : 0) + side }]}
      >
        {titleAccessory}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}
          style={[styles.title, { color: colors.textPrimary }]}
        >
          {title}
        </Text>
      </View>

      {hasRight ? (
        <View style={styles.right} onLayout={onRightLayout}>
          {right}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: ControlHeight.standard,
    marginTop: Spacing.micro,
    marginBottom: Spacing.element,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inset: {
    paddingHorizontal: Spacing.gutter,
  },
  titleLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  title: {
    flexShrink: 1,
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.block,
  },
});

export default ScreenHeader;
