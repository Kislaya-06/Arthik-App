import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '../config/theme';
import { prepareBlockSweepSegments, PreparedBlockSweepSegment } from '../lib/chartUtils';
import { formatCurrency } from '../lib/formatters';

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
  isFocused?: boolean;
}

export const AnimatedCategoryDonut: React.FC<AnimatedCategoryDonutProps> = ({
  categories,
  totalAmount,
  topCategory,
  palette,
  size = 220,
  strokeWidth = 26,
  isDark,
  textColorPrimary,
  textColorSecondary,
  trackColor,
  triggerKey,
  isFocused = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Selected category interaction (defaults to null -> topCategory shown)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Smooth clockwise sweep animation driver (0 to 1)
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(1)).current;

  // Prepare block-wise sweep segments (separate blocks with rounded caps and 6deg gaps)
  const preparedSegments = useMemo(
    () => prepareBlockSweepSegments(categories, totalAmount, palette, size, strokeWidth, 6),
    [categories, totalAmount, palette, size, strokeWidth]
  );

  // Trigger smooth round sweep on mount, on period change, and on screen focus
  useEffect(() => {
    if (!isFocused) {
      // Screen is not focused (in background).
      // Immediately reset animations so when user returns, the first frame is at 0, not 100%.
      sweepAnim.setValue(0);
      centerOpacity.setValue(0);
      return;
    }

    setSelectedId(null);
    sweepAnim.setValue(0);
    centerOpacity.setValue(0.3);

    const animation = Animated.parallel([
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 750,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(centerOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isFocused, triggerKey, sweepAnim, centerOpacity]);

  const selectedCategory = useMemo(() => {
    if (!selectedId) return null;
    return categories.find((c) => c.id === selectedId) || null;
  }, [selectedId, categories]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const defaultTrackColor = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(0, 0, 0, 0.05)';

  // Active display details for center
  const displayLabel = selectedCategory ? 'Selected' : 'Top spend';
  const displayTitle = selectedCategory?.name || topCategory?.name || 'No spend';
  const displayPercentage = selectedCategory
    ? `${selectedCategory.percentage}%`
    : topCategory
    ? `${topCategory.percentage}%`
    : '0%';
  const displaySubAmount = selectedCategory ? formatCurrency(selectedCategory.amount) : null;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background circular track */}
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

      {/* Active block-wise category slices sweeping smoothly clockwise */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {preparedSegments.map((seg) => {
          const offsetAnim = sweepAnim.interpolate({
            inputRange: seg.offsetInterpolation.inputRange,
            outputRange: seg.offsetInterpolation.outputRange,
            extrapolate: 'clamp',
          });

          const opacityAnim = sweepAnim.interpolate({
            inputRange: seg.opacityInterpolation.inputRange,
            outputRange: seg.opacityInterpolation.outputRange,
            extrapolate: 'clamp',
          });

          const isSelected = selectedId === seg.id;
          const currentStrokeWidth = isSelected ? strokeWidth + 3 : strokeWidth;

          return (
            <AnimatedCircle
              key={seg.id}
              cx={center}
              cy={center}
              r={radius}
              stroke={seg.color}
              strokeWidth={currentStrokeWidth}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={offsetAnim}
              strokeLinecap="round"
              fill="none"
              transform={seg.transform}
              opacity={opacityAnim}
              onPress={() => handleToggleSelect(seg.id)}
            />
          );
        })}
      </Svg>

      {/* Center Top Spend summary */}
      <Animated.View
        style={[
          styles.chartCenterContent,
          { opacity: centerOpacity },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => selectedId && setSelectedId(null)}
          style={styles.centerPressable}
        >
          <Text
            style={[
              styles.chartCenterLabel,
              { color: textColorSecondary, fontFamily: FontFamily.medium },
            ]}
          >
            {displayLabel}
          </Text>
          <Text
            style={[
              styles.chartCenterTitle,
              { color: textColorPrimary, fontFamily: FontFamily.bold },
            ]}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          <Text
            style={[
              styles.chartCenterValue,
              {
                color: isDark ? '#B8E0C8' : '#3E8A5E',
                fontFamily: FontFamily.bold,
              },
            ]}
          >
            {displayPercentage}
          </Text>
          {displaySubAmount && (
            <Text
              style={[
                styles.chartCenterSubAmount,
                { color: textColorSecondary, fontFamily: FontFamily.medium },
              ]}
              numberOfLines={1}
            >
              {displaySubAmount}
            </Text>
          )}
        </Pressable>
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
    paddingHorizontal: 24,
    maxWidth: 160,
  },
  centerPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenterLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  chartCenterTitle: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 2,
    includeFontPadding: false,
  },
  chartCenterValue: {
    fontSize: 15,
    includeFontPadding: false,
  },
  chartCenterSubAmount: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.85,
  },
});

export default AnimatedCategoryDonut;
