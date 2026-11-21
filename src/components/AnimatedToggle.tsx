import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../store/themeStore';
import {
  DEFAULT_COLOR_DURATION_MS,
  DEFAULT_PRESS_SCALE,
  SLIDE_SPRING,
  TRACK_SPRING,
  thumbLayout,
  toggleGeometry,
  toggleThumbOnColor,
} from '../lib/toggleMotion';

interface AnimatedToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  width?: number;
  height?: number;
  /** Track fill while ON. Default brand mint. */
  onColor?: string;
  /** Thumb colour while OFF. Default white. */
  offColor?: string;
  /** Track colour while OFF. */
  trackColor?: string;
  /** Extra thumb width while pressed, in px. Default: half the thumb diameter. */
  stretch?: number;
  /** Colour cross-fade time in ms (track fill + thumb). Default 200. */
  colorDuration?: number;
  /** Track grows to this scale while pressed (touch version of "hover scale"). Default 1.035. */
  pressScale?: number;
  /** Tick on every change. Default true. */
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Arthik's one on/off switch ("squish switch"). Every toggle in the app uses this.
 *
 * Motion (all on the UI thread, nothing runs on the JS thread per frame; see lib/toggleMotion.ts):
 *  - Press: the thumb stretches sideways and the track lifts slightly.
 *  - Travel: one slide spring; the thumb is longest mid-trip (front edge leads, back edge lags).
 *  - Land: tiny squash, then rest. The thumb never leaves the track (slide spring is clamped).
 *  - ON is a filled track (brand mint by default) with a contrasting thumb (navy on mint, white on a dark fill;
 *    `toggleThumbOnColor`); OFF is a neutral track with a white thumb. No "ON / OFF" words: position and fill
 *    say it, like every native switch. Fill and thumb cross-fade over `colorDuration` using OPACITY of stacked
 *    layers, not per-frame colour interpolation (that was the Android paint-invalidation trap from FIN-13).
 *  - Haptic selection tick on every change. Honours the OS "reduce motion" setting (instant, no stretch).
 *
 * Controlled: the thumb only moves when `value` changes, so a handler that refuses the change
 * (biometric failed, permission denied) leaves the switch where it was.
 */
export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  value,
  onValueChange,
  width = 58,
  height = 30,
  onColor,
  offColor,
  trackColor,
  stretch,
  colorDuration = DEFAULT_COLOR_DURATION_MS,
  pressScale = DEFAULT_PRESS_SCALE,
  haptics = true,
  style,
  accessibilityLabel,
  testID,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(value ? 1 : 0); // slide: 0 off .. 1 on
  const colorP = useSharedValue(value ? 1 : 0); // colour cross-fade: 0 off .. 1 on
  const trackScale = useSharedValue(1);

  useEffect(() => {
    const target = value ? 1 : 0;
    if (reduceMotion) {
      progress.value = target;
      colorP.value = target;
      return;
    }
    progress.value = withSpring(target, SLIDE_SPRING);
    colorP.value = withTiming(target, { duration: colorDuration, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [value, reduceMotion, colorDuration, progress, colorP]);

  const toggle = () => {
    if (haptics) Haptics.selectionAsync().catch(() => {});
    onValueChange(!value);
  };

  const handlePressIn = () => {
    if (reduceMotion) return;
    trackScale.value = withSpring(pressScale, TRACK_SPRING);
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    trackScale.value = withSpring(1, TRACK_SPRING);
  };

  const borderWidth = 1;
  const geometry = useMemo(() => toggleGeometry(width, height, stretch), [width, height, stretch]);
  const { padding, thumbSize } = geometry;

  // OFF track: neutral, dark enough in Light that the white thumb still stands out.
  const trackBg = trackColor || (isDark ? 'rgba(255, 255, 255, 0.16)' : '#E2E8F0');
  const actualOnColor = onColor || colors.mintGreen; // ON track fill
  const thumbOff = offColor || '#FFFFFF';
  const thumbOn = toggleThumbOnColor(actualOnColor);

  const trackBorder = trackColor
    ? 'rgba(255, 255, 255, 0.2)'
    : isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : '#D5DCE5';

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trackScale.value }],
  }));

  const thumbStyle = useAnimatedStyle(() => {
    const l = thumbLayout(progress.value, 0, geometry);
    return {
      left: l.left,
      width: l.width,
      transform: [{ scaleY: l.scaleY }],
    };
  });

  const onLayerStyle = useAnimatedStyle(() => ({ opacity: colorP.value }));
  const fillLayerStyle = useAnimatedStyle(() => ({ opacity: colorP.value }));

  return (
    <Pressable
      onPress={toggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={style}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width,
            height,
            borderRadius: height / 2,
            backgroundColor: trackBg,
            borderColor: trackBorder,
            borderWidth,
          },
          trackStyle,
        ]}
      >
        {/* ON fill: the whole track takes the on-colour */}
        <Animated.View
          pointerEvents="none"
          style={[styles.fillLayer, { backgroundColor: actualOnColor, borderRadius: height / 2 }, fillLayerStyle]}
        />

        {/* Squish thumb: off-colour base + on-colour layer fading in on top */}
        <Animated.View
          style={[
            styles.thumb,
            { top: padding, height: thumbSize, borderRadius: thumbSize / 2 },
            thumbStyle,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.thumbLayer, { backgroundColor: thumbOff, borderRadius: thumbSize / 2 }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumbLayer,
              { backgroundColor: thumbOn, borderRadius: thumbSize / 2 },
              onLayerStyle,
            ]}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    padding: 0,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fillLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default AnimatedToggle;
