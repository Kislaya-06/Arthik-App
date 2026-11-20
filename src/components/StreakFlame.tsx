import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useIsFocused } from '@react-navigation/native';
import {
  getStreakFlameConfig,
  flameFrameAt,
  flameGrowthFor,
  flameLoopMs,
  FLAME_PATHS,
  EMBER_CONFIGS,
  StreakFlameConfig,
} from '../lib/flameUtils';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Motion } from '../config/theme';

export { getStreakFlameConfig, FLAME_PATHS, EMBER_CONFIGS, StreakFlameConfig };

export interface StreakFlameProps {
  streak: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  colorOverride?: string;
}

function useSafeIsFocused(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}

/**
 * A living streak flame: a gradient flame that flickers and leans on the UI thread, with no halo.
 * - Grows a little with every streak day (flameGrowthFor), so a long streak is a visibly bigger fire.
 * - Hotter colours and a livelier flicker per tier (getStreakFlameConfig).
 * - Still when the streak is 0, when "reduce motion" is on, or while its screen is not visible.
 */
export const StreakFlame: React.FC<StreakFlameProps> = ({ streak, size = 18, style, colorOverride }) => {
  const config = useMemo(() => getStreakFlameConfig(streak), [streak]);
  const growth = flameGrowthFor(streak);
  const reduceMotion = useReduceMotion();
  const isFocused = useSafeIsFocused();
  const animate = streak > 0 && !reduceMotion && isFocused;
  const loopMs = flameLoopMs(config);
  const { lickStretch, swayDegrees } = config;

  // Unique gradient ids per instance (the badge and the calendar can be on screen together).
  const gradientId = useRef(`flame${Math.random().toString(36).slice(2, 9)}`).current;

  const phase = useSharedValue(0);
  useEffect(() => {
    if (!animate) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(withTiming(1, { duration: loopMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [animate, loopMs, phase]);

  // Small settle when the streak changes (a new day joined the streak).
  const settle = useSharedValue(1);
  const prevStreakRef = useRef(streak);
  useEffect(() => {
    if (prevStreakRef.current !== streak && streak > 0 && !reduceMotion) {
      settle.value = 0.9;
      settle.value = withSpring(1, Motion.springs.settle);
    }
    prevStreakRef.current = streak;
  }, [streak, reduceMotion, settle]);

  const bodyStyle = useAnimatedStyle(() => {
    const f = flameFrameAt(phase.value, lickStretch, swayDegrees);
    return {
      transform: [
        { scale: settle.value * growth },
        { rotate: `${f.rotateDeg}deg` },
        { scaleX: f.scaleX },
        { scaleY: f.scaleY },
      ],
    };
  });
  const innerStyle = useAnimatedStyle(() => {
    const f = flameFrameAt(phase.value, lickStretch, swayDegrees);
    return { opacity: f.innerOpacity, transform: [{ scale: f.innerScale }] };
  });

  const outerColor = colorOverride || config.outerColor;
  const dormant = config.tier === 0;
  const box = { width: size, height: size };

  return (
    <Animated.View style={[box, styles.origin, bodyStyle, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Fire is hottest (yellow) at its base and reddest at its tip. */}
          <LinearGradient id={`${gradientId}o`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={outerColor} />
            <Stop offset="0.6" stopColor={outerColor} />
            <Stop offset="1" stopColor={config.innerColor} stopOpacity={dormant ? 0.5 : 1} />
          </LinearGradient>
        </Defs>
        <Path d={FLAME_PATHS.outer} fill={`url(#${gradientId}o)`} fillRule="evenodd" clipRule="evenodd" />
      </Svg>

      {/* Inner tongue flickers on its own rhythm, so the flame looks alive rather than just "breathing". */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.innerOrigin, innerStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Defs>
            <LinearGradient id={`${gradientId}i`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={config.innerColor} />
              <Stop offset="1" stopColor={config.coreColor ?? config.innerColor} />
            </LinearGradient>
          </Defs>
          <Path
            d={FLAME_PATHS.inner}
            fill={`url(#${gradientId}i)`}
            fillRule="evenodd"
            clipRule="evenodd"
            opacity={dormant ? 0.6 : 0.95}
          />
          {config.coreColor && config.tier >= 2 && (
            <Path d={FLAME_PATHS.core} fill={config.coreColor} fillRule="evenodd" clipRule="evenodd" opacity={0.9} />
          )}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Flame moves from its base, like a real fire (the tip moves, the base stays put).
  origin: { transformOrigin: '50% 92%' },
  innerOrigin: { transformOrigin: '50% 85%' },
});

export default StreakFlame;
