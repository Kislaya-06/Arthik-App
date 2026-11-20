import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GradientIconBadge } from '../../components/GradientIconBadge';
import { CATEGORY_PALETTE, FontFamily, FontSize } from '../../config/theme';
import { FIXED_SHAPE_MAX_FONT_SCALE } from '../../lib/fontScale';

/**
 * TallyBar: how much of what was shared has come back. The filled part is the money paid back, the track is
 * what is still owed. Static (no motion): it is a reading, not a celebration. Track and fill are siblings so
 * the track's opacity never fades the fill.
 */
export const TallyBar: React.FC<{
  paid: number;
  total: number;
  fillColor: string;
  trackColor: string;
  trackOpacity?: number;
  height?: number;
}> = ({ paid, total, fillColor, trackColor, trackOpacity = 1, height = 6 }) => {
  const ratio = total > 0 ? Math.min(1, Math.max(0, paid / total)) : 0;
  return (
    <View
      style={[styles.bar, { height, borderRadius: height / 2 }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: trackColor, opacity: trackOpacity }]} />
      {ratio > 0 ? (
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fillColor, borderRadius: height / 2 }]} />
      ) : null}
    </View>
  );
};

/** Same person, same colour, every time (from the name, not from list order). */
const colorForName = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
};

/** The person's first letter in a gradient badge (design-system §9.9: badges are GradientIconBadge). */
export const PersonInitial: React.FC<{ name: string; isDark: boolean; size?: number }> = ({ name, isDark, size = 40 }) => {
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <GradientIconBadge size={size} color={colorForName(name.trim().toLowerCase())} isDark={isDark}>
      {({ iconColor }) => (
        <Text
          maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}
          style={[styles.initial, { color: iconColor }]}
          accessible={false}
        >
          {initial}
        </Text>
      )}
    </GradientIconBadge>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  initial: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
});
