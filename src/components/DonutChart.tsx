import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors, FontFamily } from '../config/theme';

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
  triggerKey,
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

  const anim = useRef(new Animated.Value(targetSpentRatio)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [displayPercentage, setDisplayPercentage] = useState(targetSpentPercentage);

  useEffect(() => {
    let isMounted = true;

    // Smooth continuous transition from CURRENT value to new target (no reset to 0)
    const sweep = Animated.timing(anim, {
      toValue: targetSpentRatio,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    const listenerId = anim.addListener(({ value }) => {
      if (!isMounted) return;
      setDisplayPercentage(Math.round(value * 100));
    });

    sweep.start(({ finished }) => {
      if (finished && isMounted) {
        setDisplayPercentage(targetSpentPercentage);
      }
    });

    return () => {
      isMounted = false;
      anim.removeListener(listenerId);
      sweep.stop();
    };
  }, [targetSpentRatio, targetSpentPercentage, anim, triggerKey]);

  // Interpolated stroke dashoffset for the spent (peach) arc
  const spentOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.container, { width: SIZE, height: SIZE, transform: [{ scale: scaleAnim }] }]}>
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
            rotation={-90}
            origin={`${CENTER},${CENTER}`}
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
            rotation={-90}
            origin={`${CENTER},${CENTER}`}
            strokeLinecap="round"
          />
        )}
      </Svg>

      <View style={styles.centerContent} pointerEvents="none">
        <Text
          style={[
            styles.percentageText,
            {
              fontSize: Math.max(15, Math.round(SIZE * 0.20)),
              lineHeight: Math.max(18, Math.round(SIZE * 0.24)),
              color: textColor || (isOverspent ? colors.danger : colors.textPrimary),
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {`${displayPercentage}%`}
        </Text>
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
    </Animated.View>
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

