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
import { FontFamily } from '../config/theme';
import {
  DEFAULT_COLOR_DURATION_MS,
  DEFAULT_PRESS_SCALE,
  SLIDE_SPRING,
  TRACK_SPRING,
  thumbLayout,
  toggleGeometry,
} from '../lib/toggleMotion';

interface AnimatedToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  width?: number;
  height?: number;
  onColor?: string;
  offColor?: string;
  trackColor?: string;
  /** Extra thumb width while pressed, in px. Default: half the thumb diameter. */
  stretch?: number;
  /** Colour cross-fade time in ms (thumb + ON/OFF text). Default 320. */
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
 *  - Colours: thumb and ON/OFF text cross-fade over `colorDuration` using OPACITY of stacked layers, not
 *    per-frame colour interpolation (that was the Android paint-invalidation trap from FIN-13).
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

  // Track remains a constant light/dark color as per the premium toggle style
  const trackBg = trackColor || (isDark ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2');

  const defaultOffColor = isDark ? '#666666' : '#C4C4C4';
  const defaultOnColor = colors.mintGreen;
  const actualOffColor = offColor || defaultOffColor;
  const actualOnColor = onColor || defaultOnColor;

  const trackBorder = trackColor
    ? 'rgba(255, 255, 255, 0.2)'
    : isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : '#E5E5E5';

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
  const textOnStyle = useAnimatedStyle(() => ({ opacity: colorP.value }));
  const textOffStyle = useAnimatedStyle(() => ({ opacity: 1 - colorP.value }));

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
        {/* OFF Text (Right Side) */}
        <Animated.Text
          style={[
            styles.text,
            { right: height <= 26 ? 4 : padding + 3, color: actualOffColor },
            textOffStyle,
          ]}
        >
          OFF
        </Animated.Text>

        {/* ON Text (Left Side) */}
        <Animated.Text
          style={[
            styles.text,
            { left: height <= 26 ? 4.5 : padding + 3.5, color: actualOnColor },
            textOnStyle,
          ]}
        >
          ON
        </Animated.Text>

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
            style={[styles.thumbLayer, { backgroundColor: actualOffColor, borderRadius: thumbSize / 2 }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumbLayer,
              { backgroundColor: actualOnColor, borderRadius: thumbSize / 2 },
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
  text: {
    position: 'absolute',
    fontFamily: FontFamily.bold,
    fontSize: 9.5,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default AnimatedToggle;
