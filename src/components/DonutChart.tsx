import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors, FontFamily } from '../config/theme';
import { RollingText } from './RollingText';
import { useRingSweep } from '../hooks/useRingSweep';

export type DonutProps = {
  spent: number;
  total: number;
  colors: ThemeColors;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  spentColor?: string;
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
  baseColor,
  textColor,
  subtextColor,
}) => {
  const SIZE = size;
  const STROKE_WIDTH = strokeWidth;
  const R = (SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const CENTER = SIZE / 2;

  const hasData = total > 0;
  const targetSpentRatio = hasData ? Math.max(0, Math.min(spent / total, 1)) : 0;
  const targetSpentPercentage = hasData ? Math.round((spent / total) * 100) : 0;
  const isOverspent = hasData && spent > total;

  // Sweeps up from empty on every visit, on the UI thread, without a blink on return (see useRingSweep).
  const anim = useRingSweep(targetSpentRatio, 240);

  // strokeDashoffset from progress; the rounded cap is hidden at 0 so no zero-length dot is drawn.
  const spentProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - anim.value),
    strokeOpacity: Math.min(1, anim.value / 0.005),
  }));

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
      </Svg>

      <View style={styles.centerContent} pointerEvents="none">
        <RollingText
          text={`${targetSpentPercentage}%`}
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

