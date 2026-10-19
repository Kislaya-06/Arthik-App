import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../store/themeStore';
import { BorderRadius, FontSize, FontFamily, LineHeight, Spacing, ControlHeight } from '../../config/theme';

export interface SegmentedOption {
  key: string;
  label: string;
  badge?: string | number;
  icon?: React.ComponentType<{ size: number; color: string }> | ((props: { size: number; color: string }) => React.ReactNode);
}

export interface SegmentedControlProps {
  options: (string | SegmentedOption)[];
  selectedKey: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
  borderRadius?: number;
  activePillColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  fontSize?: number;
  iconSize?: number;
  testID?: string;
}

interface OptionItemProps {
  option: SegmentedOption;
  isSelected: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  fontSize?: number;
  iconSize?: number;
  index?: number;
  totalOptions?: number;
}

const OptionItem: React.FC<OptionItemProps> = React.memo(({
  option,
  isSelected,
  onPress,
  activeColor,
  inactiveColor,
  fontSize,
  iconSize = 16,
  index = 0,
  totalOptions = 1,
}) => {
  const { colors } = useTheme();
  const pressScale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.97, { damping: 14, stiffness: 240 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 240 });
  };

  const IconComponent = option.icon;
  const iconColor = isSelected ? activeColor : inactiveColor;
  const labelColor = isSelected ? activeColor : inactiveColor;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      accessible
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={option.label}
      style={styles.optionButton}
      hitSlop={{
        top: 10,
        bottom: 10,
        left: index === 0 ? 16 : 0,
        right: index === totalOptions - 1 ? 16 : 0,
      }}
    >
      <Animated.View
        style={[
          styles.optionContent,
          animStyle,
        ]}
      >
        {option.badge ? (
          <View style={styles.badgeWrapper} pointerEvents="none">
            <View style={[styles.badgePill, { backgroundColor: colors.mintGreenDark }]}>
              <Text style={styles.badgeText}>{option.badge}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.labelRow}>
          {IconComponent ? (
            <IconComponent size={iconSize} color={iconColor} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.optionLabel,
              {
                color: labelColor,
                fontFamily: FontFamily.bold,
                marginLeft: IconComponent ? 6 : 0,
                ...(fontSize ? { fontSize, lineHeight: fontSize + 4 } : {}),
              },
            ]}
          >
            {option.label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

/**
 * Standardized SegmentedControl primitive for Arthik.
 * Implements Apple iOS UISegmentedControl physical motion:
 * - Critically damped primary slide spring on native UI thread (stiffness: 447.4, damping: 49, mass: 1)
 * - Zero rubber-band deformation: fixed stadium geometry preserving exact corner radius
 * - Native haptic feedback on touch (Haptics.selectionAsync)
 * - Strict track clipping keeping the pill inside the container radius
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = React.memo(({
  options,
  selectedKey,
  onChange,
  style,
  height = ControlHeight.standard,
  borderRadius = BorderRadius.pill,
  activePillColor,
  activeTextColor,
  inactiveTextColor,
  backgroundColor,
  borderColor,
  fontSize,
  iconSize,
  testID,
}) => {
  const { colors } = useTheme();

  const normalizedOptions: SegmentedOption[] = options.map((opt) =>
    typeof opt === 'string' ? { key: opt, label: opt } : opt
  );

  const selectedIndex = Math.max(
    0,
    normalizedOptions.findIndex((opt) => opt.key === selectedKey)
  );

  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useSharedValue(0);
  const isFirstLayout = useRef(true);
  const prevIndexRef = useRef(selectedIndex);
  const prevOptionWidthRef = useRef(0);
  const prevOptionsCountRef = useRef(normalizedOptions.length);

  const trackInset = Spacing.micro;
  const optionWidth =
    containerWidth > 0 && normalizedOptions.length > 0
      ? (containerWidth - trackInset * 2) / normalizedOptions.length
      : 0;

  const animateTo = useCallback((targetIndex: number, optWidth: number) => {
    if (optWidth <= 0) return;
    const targetX = targetIndex * optWidth;
    prevIndexRef.current = targetIndex;

    // Apple-calibrated critically damped spring on native UI thread (stiffness: 447.4, damping: 49, mass: 1)
    // Preserves in-flight velocity vector for smooth momentum redirect during rapid taps
    slideAnim.value = withSpring(targetX, {
      stiffness: 447.4,
      damping: 49,
      mass: 1,
      overshootClamping: true,
    });
  }, [slideAnim]);

  // Synchronous touch-driven selection: Starts animation on UI thread on Frame 0
  const handleSelect = useCallback((key: string, idx: number) => {
    Haptics.selectionAsync().catch(() => {});
    if (idx !== prevIndexRef.current && optionWidth > 0) {
      animateTo(idx, optionWidth);
    }
    React.startTransition(() => {
      onChange(key);
    });
  }, [animateTo, onChange, optionWidth]);

  useEffect(() => {
    if (optionWidth > 0) {
      const targetX = selectedIndex * optionWidth;

      if (isFirstLayout.current) {
        slideAnim.value = targetX;
        isFirstLayout.current = false;
        prevIndexRef.current = selectedIndex;
        prevOptionWidthRef.current = optionWidth;
        prevOptionsCountRef.current = normalizedOptions.length;
        return;
      }

      const optionsCountChanged = prevOptionsCountRef.current !== normalizedOptions.length;
      const optionWidthChanged = Math.abs(prevOptionWidthRef.current - optionWidth) > 0.5;
      const indexChanged = prevIndexRef.current !== selectedIndex;

      if (optionsCountChanged || optionWidthChanged) {
        // Options array resized or width changed: snap or smooth re-align to correct new geometry
        cancelAnimation(slideAnim);
        slideAnim.value = targetX;
        prevIndexRef.current = selectedIndex;
        prevOptionWidthRef.current = optionWidth;
        prevOptionsCountRef.current = normalizedOptions.length;
      } else if (indexChanged) {
        animateTo(selectedIndex, optionWidth);
      }
    }
  }, [selectedIndex, optionWidth, normalizedOptions.length, animateTo, slideAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    // Guard against sub-pixel float noise and spurious reflow cancellations
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
      if (!isFirstLayout.current && normalizedOptions.length > 0) {
        const newOptWidth = (width - trackInset * 2) / normalizedOptions.length;
        slideAnim.value = selectedIndex * newOptWidth;
        prevOptionWidthRef.current = newOptWidth;
      }
    }
  };

  const resolvedBg = backgroundColor ?? colors.cardSubtle;
  const resolvedBorder = borderColor ?? colors.borderSubtle;
  const resolvedPillBg = activePillColor ?? colors.mintGreen;
  const resolvedActiveText = activeTextColor ?? colors.forestGreen;
  const resolvedInactiveText = inactiveTextColor ?? colors.textSecondary;

  const animatedHighlightStyle = useAnimatedStyle(() => ({
    width: optionWidth,
    transform: [{ translateX: slideAnim.value }],
  }));

  return (
    <View
      onLayout={handleLayout}
      accessible
      accessibilityRole="tablist"
      testID={testID}
      style={[
        styles.container,
        {
          height,
          backgroundColor: resolvedBg,
          borderRadius,
          borderColor: resolvedBorder,
        },
        style,
      ]}
    >
      {/* Clipped Slider Track: Strictly clips pill inside container radius */}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.trackWrapper,
          { borderRadius: Math.max(0, borderRadius - 1) },
        ]}
        pointerEvents="none"
      >
        {optionWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sliderPill,
              animatedHighlightStyle,
              {
                backgroundColor: resolvedPillBg,
                borderRadius: Math.max(4, borderRadius - 2),
              },
            ]}
          />
        )}
      </View>

      {/* Options Row: interactive tabs and floating badges */}
      <View style={styles.optionsRow}>
        {normalizedOptions.map((option, idx) => (
          <OptionItem
            key={option.key}
            option={option}
            isSelected={option.key === selectedKey}
            onPress={() => handleSelect(option.key, idx)}
            activeColor={resolvedActiveText}
            inactiveColor={resolvedInactiveText}
            fontSize={fontSize}
            iconSize={iconSize}
            index={idx}
            totalOptions={normalizedOptions.length}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: ControlHeight.standard,
    padding: Spacing.micro,
    borderWidth: 1,
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
    overflow: 'visible',
  },
  trackWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  sliderPill: {
    position: 'absolute',
    top: Spacing.micro,
    bottom: Spacing.micro,
    left: Spacing.micro,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    zIndex: 10,
    elevation: 4,
  },
  optionButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  optionContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    textAlign: 'center',
    includeFontPadding: false,
  },
  badgeWrapper: {
    position: 'absolute',
    top: -22,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgePill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    lineHeight: 11,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
});

export default SegmentedControl;
