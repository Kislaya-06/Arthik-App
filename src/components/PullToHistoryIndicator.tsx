import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { useSharedValue, useAnimatedReaction, useAnimatedProps } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ThemeColors, FontFamily, FontSize, LineHeight, Spacing } from '../config/theme';
import { getPullProgress, nextArmedState } from '../lib/pullToHistoryPhysics';

/**
 * Instagram "Vanish Mode"-style footer: a small ring + one label that live BELOW the last
 * transaction and travel with the list. They rest hidden behind the nav bar and are revealed by
 * pulling the list up.
 *
 *  - Ring is a countdown: fully white at 0%, a grey track eats it clockwise from 12 o'clock.
 *  - At 100% the whole ring and the label flip to the accent colour in a single frame (no fade).
 *  - Progress is read from `pullDepth` (dp) / `maxTravel`, driven 100% natively on the UI thread
 *    via AnimatedCircle + useAnimatedProps to avoid 60fps React state re-renders during gestures.
 */

// Circle geometry (literal sizes per AGENTS.md 9.3). Outer diameter 24dp, 2dp stroke.
const RING_SIZE = 24;
const RING_STROKE = 2;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Total height of the footer block (ring + gap + label line). The list uses it for layout. */
export const PULL_FOOTER_HEIGHT = RING_SIZE + Spacing.row + LineHeight.caption;

export interface PullToHistoryIndicatorProps {
  /** Current pull-up depth in dp (0 at rest) as a Reanimated SharedValue. */
  pullDepth?: SharedValue<number>;
  /** Legacy Animated.Value fallback. */
  pullDepthAnim?: RNAnimated.Value;
  /** Depth (dp) that corresponds to 100%. */
  maxTravel: number;
  colors: ThemeColors;
  isDark: boolean;
}

export const PullToHistoryIndicator: React.FC<PullToHistoryIndicatorProps> = ({
  pullDepth,
  pullDepthAnim,
  maxTravel,
  colors,
  isDark,
}) => {
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const armedShared = useSharedValue(false);
  const fallbackDepth = useSharedValue(0);

  const activeDepth = pullDepth ?? fallbackDepth;

  // UI-thread reaction when Reanimated SharedValue is provided:
  // ONLY schedules React state updates when the discrete armed state flips (0 or 1 time per gesture)
  useAnimatedReaction(
    () => {
      'worklet';
      if (!pullDepth) return false;
      const p = getPullProgress(pullDepth.value, maxTravel);
      const nextArmed = nextArmedState(armedShared.value, p);
      if (nextArmed !== armedShared.value) {
        armedShared.value = nextArmed;
      }
      return nextArmed;
    },
    (curr, prev) => {
      'worklet';
      if ((prev === null && curr) || (prev !== null && curr !== prev)) {
        scheduleOnRN(setArmed, curr);
      }
    },
    [pullDepth, maxTravel]
  );

  // Legacy fallback for Animated.Value
  useEffect(() => {
    if (!pullDepthAnim || pullDepth) return;
    const id = pullDepthAnim.addListener(({ value }) => {
      fallbackDepth.value = value;
      const p = getPullProgress(value, maxTravel);
      const next = nextArmedState(armedRef.current, p);
      if (next !== armedRef.current) {
        armedRef.current = next;
        armedShared.value = next;
        setArmed(next);
      }
    });
    return () => {
      pullDepthAnim.removeListener(id);
    };
  }, [pullDepthAnim, pullDepth, maxTravel]);

  const armedColor = isDark ? colors.mintGreen : colors.mintGreenDark;

  // UI-thread animated props for the white countdown arc:
  // Offset (2 - p) * C eats the arc clockwise starting from 12 o'clock, leaving the remaining arc ending at 12 o'clock.
  const animatedWhiteProps = useAnimatedProps(() => {
    'worklet';
    const depth = activeDepth.value;
    const p = getPullProgress(depth, maxTravel);
    const isArmed = armedShared.value;
    const whiteLength = (1 - p) * RING_CIRCUMFERENCE;
    return {
      strokeDashoffset: (2 - p) * RING_CIRCUMFERENCE,
      strokeOpacity: !isArmed && whiteLength > 0.75 ? 1 : 0,
    };
  });

  // UI-thread animated props for the armed full ring:
  // Snaps to full opacity the moment the pull crosses the arm threshold.
  const animatedArmedProps = useAnimatedProps(() => {
    'worklet';
    return {
      strokeOpacity: armedShared.value ? 1 : 0,
    };
  });

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={armed ? 'Release to open full transaction history' : 'Swipe up to open full transaction history'}
    >
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Grey track (the part of the countdown that has already "elapsed") */}
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          stroke={colors.textMuted}
          strokeWidth={RING_STROKE}
          fill="none"
        />

        {/* Remaining white arc — driven natively on the UI thread */}
        <AnimatedCircle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          stroke={colors.textPrimary}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={2 * RING_CIRCUMFERENCE}
          strokeOpacity={1}
          transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          animatedProps={animatedWhiteProps}
        />

        {/* Full armed ring (mint green) — flipped natively on threshold crossing */}
        <AnimatedCircle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          stroke={armedColor}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeOpacity={0}
          animatedProps={animatedArmedProps}
        />
      </Svg>

      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.label,
            { color: armed ? armedColor : colors.textSecondary },
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
        >
          {armed ? 'Release for History' : 'Swipe up for History'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    height: PULL_FOOTER_HEIGHT,
    alignItems: 'center',
  },
  labelWrap: {
    marginTop: Spacing.row,
    height: LineHeight.caption,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
});

export default PullToHistoryIndicator;
