import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import Svg, { Circle, Path, Defs, Mask, G } from 'react-native-svg';
import { FontFamily } from '../config/theme';
import { prepareCategoryBlockSegments } from '../lib/chartUtils';
import { formatCurrency } from '../lib/formatters';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface AnimatedCategoryDonutProps {
  categories: Array<{ id: string; name: string; amount: number; percentage: number; color?: string }>;
  totalAmount: number;
  topCategory?: { name: string; percentage: number } | null;
  palette: readonly string[];
  size?: number;
  strokeWidth?: number;
  isDark: boolean;
  textColorPrimary: string;
  textColorSecondary: string;
  trackColor?: string;
  triggerKey?: string | number;
  isFocused?: boolean;
  selectedId?: string | null;
  onSelectCategory?: (id: string | null) => void;
}

export const AnimatedCategoryDonut: React.FC<AnimatedCategoryDonutProps> = ({
  categories,
  totalAmount,
  palette,
  size = 220,
  strokeWidth = 28,
  isDark,
  textColorPrimary,
  textColorSecondary,
  trackColor,
  triggerKey,
  isFocused = true,
  selectedId: propSelectedId,
  onSelectCategory,
}) => {
  const center = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - strokeWidth;
  const trackRadius = rOuter - strokeWidth / 2;
  const circumference = 2 * Math.PI * trackRadius;

  // Selected category interaction (supports controlled and uncontrolled modes)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = propSelectedId !== undefined ? propSelectedId : internalSelectedId;

  // Smooth clockwise sweep animation driver (0 to 1)
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(1)).current;
  const [isSweeping, setIsSweeping] = useState(true);

  // Prepare modern annular sector segments with flat radial dividers & rounded corners
  const preparedSegments = useMemo(
    () => prepareCategoryBlockSegments(categories, totalAmount, palette, size, strokeWidth, 5, 6),
    [categories, totalAmount, palette, size, strokeWidth]
  );

  const handleToggleSelect = useCallback((id: string) => {
    const next = selectedId === id ? null : id;
    if (onSelectCategory) {
      onSelectCategory(next);
    } else {
      setInternalSelectedId(next);
    }
  }, [selectedId, onSelectCategory]);

  // Trigger smooth round sweep on mount, on period change, and on screen focus
  useEffect(() => {
    if (!isFocused) {
      sweepAnim.setValue(0);
      centerOpacity.setValue(0);
      setIsSweeping(false);
      return;
    }

    if (onSelectCategory) {
      onSelectCategory(null);
    } else {
      setInternalSelectedId(null);
    }
    setIsSweeping(true);
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

    animation.start(({ finished }) => {
      if (finished) {
        setIsSweeping(false);
      }
    });

    return () => {
      animation.stop();
    };
  }, [isFocused, triggerKey, sweepAnim, centerOpacity, onSelectCategory]);

  const selectedCategory = useMemo(() => {
    if (!selectedId) return null;
    return categories.find((c) => c.id === selectedId) || null;
  }, [selectedId, categories]);

  const defaultTrackColor = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(0, 0, 0, 0.05)';

  // Active display details for center (non-redundant, uncluttered, beautifully balanced UX)
  const isAnySelected = selectedCategory !== null;
  const displayLabel = isAnySelected ? 'Selected' : 'Categories';
  const displayTitle = isAnySelected
    ? formatCurrency(selectedCategory.amount)
    : `${categories.length}`;
  const displaySubtext = isAnySelected
    ? `${selectedCategory.percentage}% of total`
    : categories.length > 0
    ? 'Tap to inspect'
    : 'No expenses';

  const maskId = `donut_sweep_${String(triggerKey || 'k').replace(/[^a-zA-Z0-9]/g, '_')}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background circular track */}
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={StyleSheet.absoluteFill}
      >
        <Circle
          cx={center}
          cy={center}
          r={trackRadius}
          stroke={trackColor || defaultTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>

      {/* Modern annular wedge segments with smooth clockwise sweep */}
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={StyleSheet.absoluteFill}
      >
        {isSweeping && (
          <Defs>
            <Mask id={maskId}>
              <Circle cx={center} cy={center} r={size} fill="#000000" />
              <AnimatedCircle
                cx={center}
                cy={center}
                r={trackRadius}
                stroke="#FFFFFF"
                strokeWidth={strokeWidth + 4}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={sweepAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [circumference, 0],
                  extrapolate: 'clamp',
                })}
                strokeLinecap="butt"
                fill="none"
                rotation={-90}
                origin={`${center}, ${center}`}
              />
            </Mask>
          </Defs>
        )}

        <G mask={isSweeping ? `url(#${maskId})` : undefined}>
          {preparedSegments.map((seg) => {
            const isSelected = selectedId === seg.id;
            const opacity = isSelected ? 1 : isAnySelected ? 0.22 : 1;

            return (
              <Path
                key={seg.id}
                d={seg.path}
                fill={seg.color}
                fillRule="evenodd"
                opacity={opacity}
                stroke={isSelected ? (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.25)') : 'none'}
                strokeWidth={isSelected ? 1.5 : 0}
                strokeLinejoin="round"
                onPress={() => handleToggleSelect(seg.id)}
              />
            );
          })}
        </G>
      </Svg>

      {/* Center Categories count / Selected Category summary */}
      <Animated.View
        style={[
          styles.chartCenterContent,
          { opacity: centerOpacity, maxWidth: Math.max(56, Math.floor(rInner * 2 - 8)) },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => selectedId && handleToggleSelect(selectedId)}
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
              styles.chartCenterAmount,
              {
                color: textColorPrimary,
                fontFamily: FontFamily.bold,
                fontSize: isAnySelected ? Math.min(18, Math.max(13, Math.round(size * 0.105))) : Math.min(24, Math.max(18, Math.round(size * 0.145))),
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayTitle}
          </Text>
          <Text
            style={[
              styles.chartCenterSubtext,
              {
                color: isAnySelected ? (isDark ? '#B8E0C8' : '#2D7A4D') : textColorSecondary,
                fontFamily: isAnySelected ? FontFamily.bold : FontFamily.medium,
                fontSize: isAnySelected ? 10.5 : 9.5,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displaySubtext}
          </Text>
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
    flexShrink: 0,
  },
  chartCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  centerPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenterLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  chartCenterAmount: {
    textAlign: 'center',
    marginBottom: 2,
    includeFontPadding: false,
  },
  chartCenterSubtext: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default AnimatedCategoryDonut;

