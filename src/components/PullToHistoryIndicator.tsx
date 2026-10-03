import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ChevronUp } from 'lucide-react-native';
import { ThemeColors, FontFamily } from '../config/theme';
import { PULL_TO_HISTORY_THRESHOLD } from '../lib/pullToHistoryUtils';

export interface PullToHistoryIndicatorProps {
  pullDepthAnim: Animated.Value;
  colors: ThemeColors;
  isDark: boolean;
  hasTransactions: boolean;
}

export const PullToHistoryIndicator: React.FC<PullToHistoryIndicatorProps> = ({
  pullDepthAnim,
  colors,
  isDark,
  hasTransactions,
}) => {
  if (!hasTransactions) {
    return null;
  }

  const armedColor = isDark ? colors.mintGreen : colors.mintGreenDark;

  const [pullProgress, setPullProgress] = useState(0);

  useEffect(() => {
    const id = pullDepthAnim.addListener(({ value }) => {
      const p = Math.min(1, Math.max(0, value / PULL_TO_HISTORY_THRESHOLD));
      setPullProgress(p);
    });
    return () => {
      pullDepthAnim.removeListener(id);
    };
  }, [pullDepthAnim]);

  // Overall indicator opacity: rests subtle (0.75), reaches full (1.0) on pull
  const containerOpacity = useMemo(
    () =>
      pullDepthAnim.interpolate({
        inputRange: [0, 24],
        outputRange: [0.75, 1],
        extrapolate: 'clamp',
      }),
    [pullDepthAnim]
  );

  // Elastic vertical lift as user pulls upward
  const indicatorTranslateY = useMemo(
    () =>
      pullDepthAnim.interpolate({
        inputRange: [0, PULL_TO_HISTORY_THRESHOLD],
        outputRange: [0, -4],
        extrapolate: 'clamp',
      }),
    [pullDepthAnim]
  );

  // Subtle circle pop scale when reaching 100% armed threshold
  const circleScale = useMemo(
    () =>
      pullDepthAnim.interpolate({
        inputRange: [0, PULL_TO_HISTORY_THRESHOLD - 0.1, PULL_TO_HISTORY_THRESHOLD],
        outputRange: [1, 1, 1.14],
        extrapolate: 'clamp',
      }),
    [pullDepthAnim]
  );

  // Crossfade between "Swipe up for History" and "Release for History" at 72dp
  const pullLabelOpacity = useMemo(
    () =>
      pullDepthAnim.interpolate({
        inputRange: [0, PULL_TO_HISTORY_THRESHOLD - 0.1, PULL_TO_HISTORY_THRESHOLD],
        outputRange: [1, 1, 0],
        extrapolate: 'clamp',
      }),
    [pullDepthAnim]
  );

  const releaseLabelOpacity = useMemo(
    () =>
      pullDepthAnim.interpolate({
        inputRange: [0, PULL_TO_HISTORY_THRESHOLD - 0.1, PULL_TO_HISTORY_THRESHOLD],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
      }),
    [pullDepthAnim]
  );

  // Circular ring geometry (Instagram Vanish Mode style):
  // Diameter: 32, radius: 16, strokeWidth: 2.5, inner radius: 14.5
  // Circumference: 2 * Math.PI * 14.5 ≈ 91.1
  const R = 16;
  const strokeW = 2.5;
  const r = R - strokeW / 2; // 14.75
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pullProgress);

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        {
          opacity: containerOpacity,
          transform: [{ translateY: indicatorTranslateY }],
        },
      ]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel="Swipe up to view full transaction history"
      pointerEvents="none"
    >
      {/* Instagram-style Progress Ring Circle */}
      <Animated.View
        style={[
          styles.circleWrapper,
          {
            transform: [{ scale: circleScale }],
          },
        ]}
      >
        <Svg width={32} height={32} style={styles.svgOverlay} pointerEvents="none">
          {/* Muted background track ring */}
          <Circle
            cx={16}
            cy={16}
            r={r}
            stroke={isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)'}
            strokeWidth={2}
            fill={isDark ? '#141E2F' : '#F1F5F9'}
          />
          {/* Animated clockwise progress ring starting at 12 o'clock */}
          <Circle
            cx={16}
            cy={16}
            r={r}
            stroke={armedColor}
            strokeWidth={strokeW}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 16 16)"
          />
        </Svg>

        <View style={styles.centerIcon}>
          <ChevronUp
            size={13}
            color={pullProgress >= 1 ? armedColor : colors.textSecondary}
            strokeWidth={2.4}
          />
        </View>
      </Animated.View>

      {/* Label: "Swipe up for History" -> "Release for History" */}
      <View style={styles.labelContainer}>
        <Animated.Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
              opacity: pullLabelOpacity,
            },
          ]}
        >
          Swipe up for History
        </Animated.Text>
        <Animated.Text
          style={[
            styles.label,
            styles.absoluteLayer,
            {
              color: armedColor,
              fontFamily: FontFamily.bold,
              opacity: releaseLabelOpacity,
            },
          ]}
        >
          Release for History
        </Animated.Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  circleWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centerIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    marginTop: 6,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  absoluteLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
  },
});

export default PullToHistoryIndicator;
