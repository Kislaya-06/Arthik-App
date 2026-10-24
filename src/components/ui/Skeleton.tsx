import React, { useEffect } from 'react';
import { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../store/themeStore';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { BorderRadius } from '../../config/theme';
import {
  SKELETON_PULSE_HIGH,
  SKELETON_PULSE_LOW,
  SKELETON_PULSE_MS,
  SKELETON_STATIC_OPACITY,
} from '../../lib/skeletonMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  /** Corner radius. Defaults to a full capsule (`BorderRadius.pill`), right for text lines. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A grey placeholder shape shown where content is still loading (OPT-41).
 *
 * Use it ONLY where it replaces a block of content (a list, a card, a grid).
 * Do NOT use it inside buttons or next to a short label: keep `ActivityIndicator` there.
 * Hidden from screen readers on its own; the screen that shows it should label the group
 * (for example `accessibilityLabel="Loading"` with `accessibilityState={{ busy: true }}`).
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height, radius = BorderRadius.pill, style }) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? SKELETON_STATIC_OPACITY : SKELETON_PULSE_HIGH);

  useEffect(() => {
    cancelAnimation(opacity);
    if (reduceMotion) {
      opacity.value = SKELETON_STATIC_OPACITY;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(SKELETON_PULSE_LOW, { duration: SKELETON_PULSE_MS }),
        withTiming(SKELETON_PULSE_HIGH, { duration: SKELETON_PULSE_MS })
      ),
      -1,
      false
    );
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.cardSubtle }, animatedStyle, style]}
    />
  );
};

export default Skeleton;
