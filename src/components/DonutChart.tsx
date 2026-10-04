import React, { useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, useAnimatedValue } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors, FontFamily } from '../config/theme';
import { RollingText } from './RollingText';
import { useFocusEntryCount } from '../hooks/useFocusEntry';

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

  const anim = useAnimatedValue(0);
  // Counts every visit to the screen: the ring sweeps up from 0 on each one (like the number inside it).
  const entry = useFocusEntryCount();
  const handledEntry = useRef(-1);

  // Layout effect on purpose: it also re-runs when a frozen tab is revealed, and starts before the first paint.
  useLayoutEffect(() => {
    if (handledEntry.current !== entry) {
      handledEntry.current = entry;
      anim.setValue(0);
    }
    const sweep = Animated.timing(anim, {
      toValue: targetSpentRatio,
      duration: 400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    });
    sweep.start();
    return () => {
      sweep.stop();
    };
  }, [targetSpentRatio, anim, entry]);

  // Interpolated stroke dashoffset for the spent (peach) arc
  const spentOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
    extrapolate: 'clamp',
  });

  // Fade out rounded stroke caps when progress is 0 to avoid zero-length dot artifact
  const spentOpacity = anim.interpolate({
    inputRange: [0, 0.005, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
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
            strokeDashoffset={spentOffset}
            strokeLinecap="round"
            strokeOpacity={spentOpacity}
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
          rollOnFocus
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

