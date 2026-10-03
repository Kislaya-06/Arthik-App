import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors, FontFamily, FontSize, LineHeight, Spacing } from '../config/theme';
import { getPullProgress, getRingArc, nextArmedState } from '../lib/pullToHistoryPhysics';

/**
 * Instagram "Vanish Mode"-style footer: a small ring + one label that live BELOW the last
 * transaction and travel with the list. They rest hidden behind the nav bar and are revealed by
 * pulling the list up.
 *
 *  - Ring is a countdown: fully white at 0%, a grey track eats it clockwise from 12 o'clock.
 *  - At 100% the whole ring and the label flip to the accent colour in a single frame (no fade).
 *  - Progress is read from `pullDepthAnim` (dp) / `maxTravel`, so ring and movement never disagree.
 */

// Circle geometry (literal sizes per AGENTS.md 9.3). Outer diameter 24dp, 2dp stroke.
const RING_SIZE = 24;
const RING_STROKE = 2;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** Re-render the ring at most this many times per full pull (keeps 60fps cheap). */
const PROGRESS_STEPS = 240;

/** Total height of the footer block (ring + gap + label line). The list uses it for layout. */
export const PULL_FOOTER_HEIGHT = RING_SIZE + Spacing.row + LineHeight.caption;

export interface PullToHistoryIndicatorProps {
  /** Current pull-up depth in dp (0 at rest). */
  pullDepthAnim: Animated.Value;
  /** Depth (dp) that corresponds to 100%. */
  maxTravel: number;
  colors: ThemeColors;
  isDark: boolean;
}

export const PullToHistoryIndicator: React.FC<PullToHistoryIndicatorProps> = ({
  pullDepthAnim,
  maxTravel,
  colors,
  isDark,
}) => {
  const [progress, setProgress] = useState(0);
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);

  useEffect(() => {
    const id = pullDepthAnim.addListener(({ value }) => {
      const p = getPullProgress(value, maxTravel);
      const q = Math.round(p * PROGRESS_STEPS) / PROGRESS_STEPS;
      setProgress((prev) => (prev === q ? prev : q));

      const next = nextArmedState(armedRef.current, p);
      if (next !== armedRef.current) {
        armedRef.current = next;
        setArmed(next);
      }
    });
    return () => {
      pullDepthAnim.removeListener(id);
    };
  }, [pullDepthAnim, maxTravel]);

  const armedColor = isDark ? colors.mintGreen : colors.mintGreenDark;
  const arc = getRingArc(progress, RING_CIRCUMFERENCE);

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={armed ? 'Release to open full transaction history' : 'Swipe up to open full transaction history'}
    >
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {armed ? (
          <Circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            stroke={armedColor}
            strokeWidth={RING_STROKE}
            fill="none"
          />
        ) : (
          <>
            {/* Grey track (the part of the countdown that has already "elapsed") */}
            <Circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke={colors.textMuted}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Remaining white arc — always ends at 12 o'clock and shrinks as you pull */}
            {arc.visible && (
              <Circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                stroke={colors.textPrimary}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${arc.whiteLength} ${RING_CIRCUMFERENCE}`}
                transform={`rotate(${arc.rotationDeg} ${RING_CENTER} ${RING_CENTER})`}
              />
            )}
          </>
        )}
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
