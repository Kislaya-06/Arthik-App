import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '../config/theme';
import { useTheme } from '../store/themeStore';
import { computeDualRingState } from '../lib/chartUtils';
import { formatCompactCurrency } from '../lib/formatters';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DualRingChartProps {
  income: number;
  spent: number;
  size?: number;
  strokeWidth?: number;
  outerRadius?: number;
  innerRadius?: number;
  isDark?: boolean;
}

export const DualRingChart: React.FC<DualRingChartProps> = ({
  income,
  spent,
  size = 98,
  strokeWidth = 6.5,
  outerRadius = 42,
  innerRadius = 32,
  isDark = false,
}) => {
  const { colors } = useTheme();
  const [showAmounts, setShowAmounts] = useState(false);

  const center = size / 2;
  const cOuter = 2 * Math.PI * outerRadius;
  const cInner = 2 * Math.PI * innerRadius;

  const state = useMemo(
    () => computeDualRingState(income, spent),
    [income, spent]
  );

  // Animation values for the progress sweeps (0 to 1)
  const outerAnim = useRef(new Animated.Value(0)).current;
  const innerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(outerAnim, {
        toValue: state.outerProgress,
        duration: 550,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(innerAnim, {
        toValue: state.innerProgress,
        duration: 550,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
    ]).start();
  }, [state.outerProgress, state.innerProgress, outerAnim, innerAnim]);

  // Dashoffset interpolations
  const outerOffset = outerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [cOuter, 0],
  });

  const innerOffset = innerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [cInner, 0],
  });

  // Fade out rounded stroke caps when progress is 0 to avoid zero-length dot artifact
  const outerStrokeOpacity = outerAnim.interpolate({
    inputRange: [0, 0.005, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });

  const innerStrokeOpacity = innerAnim.interpolate({
    inputRange: [0, 0.005, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });

  // Track colors with theme token
  const outerTrackColor = colors.mintGreenSoft;
  const innerTrackColor = state.isOverIncome
    ? 'rgba(239, 68, 68, 0.15)'
    : 'rgba(224, 90, 71, 0.15)';

  const primaryFontSize = useMemo(() => {
    const len = state.centerPrimary.length;
    if (len <= 3) return 14;
    if (len <= 4) return 13;
    return 11;
  }, [state.centerPrimary]);

  return (
    <Pressable
      onPress={() => setShowAmounts((prev) => !prev)}
      accessibilityRole="button"
      accessibilityLabel={state.accessibilityLabel}
      accessibilityHint="Double tap to toggle between percentage and detailed amounts"
      style={[styles.container, { width: size, height: size }]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Background Tracks */}
        <Circle
          cx={center}
          cy={center}
          r={outerRadius}
          stroke={outerTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          stroke={innerTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Outer Inflow Arc (Starts at 12 o'clock via -90 deg rotation) */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={outerRadius}
          stroke={state.outerColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${cOuter} ${cOuter}`}
          strokeDashoffset={outerOffset}
          strokeLinecap="round"
          strokeOpacity={outerStrokeOpacity}
          fill="none"
          origin={`${center}, ${center}`}
          rotation="-90"
        />

        {/* Inner Outflow Arc (Starts at 12 o'clock via -90 deg rotation) */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={innerRadius}
          stroke={state.innerColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${cInner} ${cInner}`}
          strokeDashoffset={innerOffset}
          strokeLinecap="round"
          strokeOpacity={innerStrokeOpacity}
          fill="none"
          origin={`${center}, ${center}`}
          rotation="-90"
        />
      </Svg>

      {/* Center Hole Content */}
      <View style={styles.centerContainer} pointerEvents="none">
        {!showAmounts ? (
          <>
            <Text
              style={[
                styles.primaryText,
                {
                  fontSize: primaryFontSize,
                  color: state.isOverIncome ? '#EF4444' : '#1A2B4C',
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {state.centerPrimary}
            </Text>
            {state.centerSecondary ? (
              <Text style={styles.secondaryText} numberOfLines={1}>
                {state.centerSecondary}
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.amountsColumn}>
            <Text
              style={[styles.amountLine, { color: '#15803D' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCompactCurrency(income, { showPlus: true })}
            </Text>
            <Text
              style={[
                styles.amountLine,
                { color: state.isOverIncome ? '#EF4444' : '#E05A47' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCompactCurrency(-spent)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    zIndex: 2,
  },
  primaryText: {
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
    textAlign: 'center',
  },
  secondaryText: {
    fontSize: 9.5,
    fontFamily: FontFamily.medium,
    color: 'rgba(26, 43, 76, 0.65)',
    includeFontPadding: false,
    marginTop: -1,
    textAlign: 'center',
  },
  amountsColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  amountLine: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
