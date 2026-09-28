import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '../config/theme';
import { prepareCategorySegments, PreparedSegment } from '../lib/chartUtils';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface AnimatedCategoryDonutProps {
  categories: Array<{ id: string; name: string; amount: number; percentage: number }>;
  totalAmount: number;
  topCategory: { name: string; percentage: number } | null;
  palette: string[];
  size?: number;
  strokeWidth?: number;
  isDark: boolean;
  textColorPrimary: string;
  textColorSecondary: string;
  trackColor?: string;
  triggerKey?: string | number;
}

export const AnimatedCategoryDonut: React.FC<AnimatedCategoryDonutProps> = ({
  categories,
  totalAmount,
  topCategory,
  palette,
  size = 220,
  strokeWidth = 28,
  isDark,
  textColorPrimary,
  textColorSecondary,
  trackColor,
  triggerKey,
}) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const targetPercentage = topCategory?.percentage ?? 0;

  // ── Drivers ───────────────────────────────────────────────────────────────
  // Smooth sequential sweep progress (0 to 1)
  const anim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(1)).current;

  // State to hold previous segments during period cross-fade transitions
  const [prevSegments, setPrevSegments] = useState<PreparedSegment[] | null>(null);
  const prevOpacity = useRef(new Animated.Value(0)).current;

  const hasMountedRef = useRef(false);
  const prevTriggerKeyRef = useRef<string | number | undefined>(triggerKey);

  const preparedSegments = useMemo(
    () => prepareCategorySegments(categories, totalAmount, palette, size, strokeWidth),
    [categories, totalAmount, palette, size, strokeWidth]
  );

  const preparedSegmentsRef = useRef(preparedSegments);
  useEffect(() => {
    preparedSegmentsRef.current = preparedSegments;
  }, [preparedSegments]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      // First mount: soft entrance fade + silky smooth clockwise sweep
      hasMountedRef.current = true;
      prevTriggerKeyRef.current = triggerKey;

      opacityAnim.setValue(0);
      anim.setValue(0);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 750,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false,
        }),
      ]).start();
      return;
    }

    // Returning to screen / tab switch with same triggerKey: DO NOT reset or re-animate!
    if (triggerKey === prevTriggerKeyRef.current) {
      // Ensure steady fully rendered state
      anim.setValue(1);
      opacityAnim.setValue(1);
      return;
    }

    // Trigger key changed (e.g. Weekly -> Monthly, or week navigation):
    // Perform a luxurious cross-fade sweep where the previous donut softly fades out
    // while the new donut sweeps in clockwise, completely eliminating any blank/black frame.
    const oldSegments = preparedSegmentsRef.current;
    prevTriggerKeyRef.current = triggerKey;

    if (oldSegments && oldSegments.length > 0) {
      setPrevSegments(oldSegments);
      prevOpacity.setValue(0.4);
      Animated.timing(prevOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setPrevSegments(null);
      });
    }

    // Animate new segments
    anim.setValue(0);
    opacityAnim.setValue(0.7);

    // Soft center text transition
    centerOpacity.setValue(0.5);
    Animated.timing(centerOpacity, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const sweep = Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 1,
        duration: 750,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
    ]);
    sweep.start();

    return () => {
      sweep.stop();
    };
  }, [triggerKey, anim, opacityAnim, prevOpacity, centerOpacity]);

  const defaultTrackColor = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Subtle background track: ALWAYS visible, prevents any visual blink */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor || defaultTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>

      {/* Ghost layer of previous segments during period cross-fade transition */}
      {prevSegments && prevSegments.length > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: prevOpacity }]} pointerEvents="none">
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            {prevSegments.map((seg) => (
              <Circle
                key={`prev-${seg.id}`}
                cx={center}
                cy={center}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={0}
                strokeLinecap="butt"
                fill="none"
                transform={seg.transform}
              />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* Active category segments with sequential clockwise sweep */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {preparedSegments.map((seg) => {
            const offsetAnim = anim.interpolate({
              inputRange: seg.interpolation.inputRange,
              outputRange: seg.interpolation.outputRange,
              extrapolate: 'clamp',
            });

            return (
              <AnimatedCircle
                key={seg.id}
                cx={center}
                cy={center}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={offsetAnim}
                strokeLinecap="butt"
                fill="none"
                transform={seg.transform}
              />
            );
          })}
        </Svg>
      </Animated.View>

      {/* Center Top Spend summary */}
      <Animated.View style={[styles.chartCenterContent, { opacity: centerOpacity }]} pointerEvents="none">
        <Text
          style={[
            styles.chartCenterLabel,
            { color: textColorSecondary, fontFamily: FontFamily.medium },
          ]}
        >
          Top spend
        </Text>
        <Text
          style={[
            styles.chartCenterTitle,
            { color: textColorPrimary, fontFamily: FontFamily.bold },
          ]}
          numberOfLines={2}
        >
          {topCategory?.name || 'No spend'}
        </Text>
        <Text
          style={[
            styles.chartCenterValue,
            { color: textColorSecondary, fontFamily: FontFamily.medium },
          ]}
        >
          {`${targetPercentage}%`}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chartCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  chartCenterLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  chartCenterTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  chartCenterValue: {
    fontSize: 14,
  },
});

export default AnimatedCategoryDonut;
