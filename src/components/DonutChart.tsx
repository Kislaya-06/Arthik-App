import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors, FontFamily } from '../config/theme';
import { RollingText } from './RollingText';
import { useRingSweep } from '../hooks/useRingSweep';
import { heroRingProgress } from '../lib/heroRing';

export type DonutProps = {
  spent: number;
  /** Money of the period. Spending above it draws a second lap (UX-004). */
  total: number;
  colors: ThemeColors;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  spentColor?: string;
  /** Second lap (spending above 100%). Darker than spentColor so the lap reads as "more than all of it". */
  overflowColor?: string;
  baseColor?: string;
  textColor?: string;
  subtextColor?: string;
  triggerKey?: string | number;
};

const DEFAULT_SIZE = 100;
const DEFAULT_STROKE_WIDTH = 14;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DonutChartBase: React.FC<DonutProps> = ({
  spent,
  total,
  colors,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  trackColor,
  spentColor,
  overflowColor,
  baseColor,
  textColor,
  subtextColor,
}) => {
  const SIZE = size;
  const STROKE_WIDTH = strokeWidth;
  const R = (SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const CENTER = SIZE / 2;

  // Real percent, up to two drawn laps (UX-004).
  const ring = heroRingProgress(spent, total);
  const hasData = total > 0 || spent > 0;
  const isOverspent = ring.isOver;

  // Sweeps on the UI thread on first show and whenever the value changes; never replays on a revisit (see useRingSweep).
  const anim = useRingSweep(ring.ratio, 240, 2);

  // strokeDashoffset from progress; the rounded cap is hidden at 0 so no zero-length dot is drawn.
  const spentProps = useAnimatedProps(() => {
    const lap = Math.min(1, anim.value);
    return {
      strokeDashoffset: CIRCUMFERENCE * (1 - lap),
      strokeOpacity: Math.min(1, lap / 0.005),
    };
  });
  // Second lap: only the part above 100% (0 until the first lap is full).
  const overflowProps = useAnimatedProps(() => {
    const lap = Math.max(0, Math.min(1, anim.value - 1));
    return {
      strokeDashoffset: CIRCUMFERENCE * (1 - lap),
      strokeOpacity: Math.min(1, lap / 0.005),
    };
  });

  return (
    <View style={[styles.container, { width: SIZE, height: SIZE }]}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        {/* Track (grey/custom bg) */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          stroke={trackColor || colors.chartTrack}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />

        {/* Base Income arc (mint green full ring when data present) */}
        {hasData && (
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke={baseColor || colors.mintGreen}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}

        {/* Animated Spent arc (peach coral sweeping clockwise from top) */}
        {hasData && (
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke={spentColor || (isOverspent ? colors.danger : colors.peachCoral)}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE}
            strokeLinecap="round"
            strokeOpacity={0}
            animatedProps={spentProps}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}

        {/* Second lap (spent more than the period had), drawn over the first from the top */}
        {isOverspent && (
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke={overflowColor || colors.coralText}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE}
            strokeLinecap="round"
            strokeOpacity={0}
            animatedProps={overflowProps}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}
      </Svg>

      <View style={styles.centerContent} pointerEvents="none">
        <RollingText
          text={ring.percentLabel}
          style={StyleSheet.flatten([
            styles.percentageText,
            {
              fontSize: Math.max(15, Math.round(SIZE * 0.20)),
              lineHeight: Math.max(18, Math.round(SIZE * 0.24)),
              color: textColor || (isOverspent ? colors.danger : colors.textPrimary),
            },
          ])}
          fitWidth={Math.round(SIZE * 0.6)}
          minScale={0.7}
        />
        <Text
          style={[
            styles.labelText,
            {
              fontSize: Math.max(9, Math.round(SIZE * 0.11)),
              color: subtextColor || colors.textSecondary,
              letterSpacing: 0.8,
            },
          ]}
        >
          SPENT
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
    lineHeight: 20,
  },
  labelText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.6,
    marginTop: 1,
    includeFontPadding: false,
  },
});

export const DonutChart = React.memo(DonutChartBase);

