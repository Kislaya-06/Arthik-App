import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
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
  flameBitsAt,
  flameCoreAt,
  flameEnergy,
  flameFrameAt,
  flameGrowthFor,
  flameHeartAt,
  flameLoopMs,
  flameOutlineAt,
  FLAME_HEADROOM,
  FLAME_VIEWBOX,
  FLAME_PATHS,
  EMBER_CONFIGS,
  StreakFlameConfig,
} from '../lib/flameUtils';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Motion } from '../config/theme';

export { getStreakFlameConfig, FLAME_PATHS, EMBER_CONFIGS, StreakFlameConfig };

const AnimatedPath = Animated.createAnimatedComponent(Path);

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
 * A living streak flame, drawn like an animated emoji fire. Every frame the fire's outline is
 * redrawn on the UI thread: the tip whips side to side, the side tongues lick up and down on their
 * own beats, a hot yellow heart with a white-hot centre dances inside, and small flame bits break off
 * the top and fade. Colours are the tier's red / yellow / white (getStreakFlameConfig), unchanged.
 * - Grows a little with every streak day (flameGrowthFor), so a long streak is a visibly bigger fire.
 * - Hotter colours and a livelier fire per tier (getStreakFlameConfig, flameEnergy).
 * - No glow or halo behind it.
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
  const energy = flameEnergy(lickStretch);
  // Flame bits only on a real streak (the still, dormant flame has none).
  const bitCount = Math.min(config.emberCount, 2);

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

  // The whole fire stretches up and settles from its base (the base never moves, like real fire).
  const bodyStyle = useAnimatedStyle(() => {
    const f = flameFrameAt(phase.value, lickStretch, swayDegrees);
    return {
      transform: [{ scale: settle.value * growth }, { scaleX: f.scaleX }, { scaleY: f.scaleY }],
    };
  });

  const outerProps = useAnimatedProps(() => ({ d: flameOutlineAt(phase.value, energy) }));
  const middleProps = useAnimatedProps(() => ({ d: flameOutlineAt(phase.value, energy, 0.7, 1.7) }));
  const heartProps = useAnimatedProps(() => {
    const f = flameFrameAt(phase.value, lickStretch, swayDegrees);
    return { d: flameHeartAt(phase.value, energy), opacity: f.innerOpacity };
  });
  const coreProps = useAnimatedProps(() => ({ d: flameCoreAt(phase.value, energy) }));
  const bitsProps = useAnimatedProps(() => ({ d: flameBitsAt(phase.value, animate ? bitCount : 0) }));

  const outerColor = colorOverride || config.outerColor;
  const dormant = config.tier === 0;
  const box = { width: size, height: size };
  // The drawing reaches above the icon box so the tip and flame bits can rise past it.
  const headroom = (size * FLAME_HEADROOM) / 24;
  const canvas = { top: -headroom, width: size, height: size + headroom };

  return (
    <Animated.View style={[box, styles.origin, bodyStyle, style]} pointerEvents="none">
      <Svg viewBox={FLAME_VIEWBOX} fill="none" style={[styles.canvas, canvas]}>
        <Defs>
          {/* Same colours as before: deep red tips turning bright yellow at the base. */}
          <LinearGradient id={`${gradientId}o`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={outerColor} />
            <Stop offset="0.6" stopColor={outerColor} />
            <Stop offset="1" stopColor={config.innerColor} stopOpacity={dormant ? 0.5 : 1} />
          </LinearGradient>
          {/* Inner tongue: the same red-to-yellow fire, lighter because it starts lower. */}
          <LinearGradient id={`${gradientId}m`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={outerColor} />
            <Stop offset="1" stopColor={config.innerColor} />
          </LinearGradient>
          {/* The heart is hottest (palest) at the bottom. */}
          <LinearGradient id={`${gradientId}i`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={config.innerColor} />
            <Stop offset="1" stopColor={config.coreColor ?? config.innerColor} />
          </LinearGradient>
        </Defs>
        <AnimatedPath animatedProps={bitsProps} fill={outerColor} opacity={0.95} />
        <AnimatedPath animatedProps={outerProps} fill={`url(#${gradientId}o)`} />
        <AnimatedPath animatedProps={middleProps} fill={`url(#${gradientId}m)`} opacity={dormant ? 0.6 : 0.9} />
        <AnimatedPath animatedProps={heartProps} fill={`url(#${gradientId}i)`} fillOpacity={dormant ? 0.6 : 0.95} />
        {config.coreColor && config.tier >= 2 && (
          <AnimatedPath animatedProps={coreProps} fill={config.coreColor} opacity={0.9} />
        )}
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Fire moves from its base, like a real fire (the tip moves, the base stays put).
  origin: { transformOrigin: '50% 92%' },
  canvas: { position: 'absolute', left: 0 },
});

export default StreakFlame;
