import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
} from 'react-native';
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
}

const OptionItem: React.FC<OptionItemProps> = ({
  option,
  isSelected,
  onPress,
  activeColor,
  inactiveColor,
  fontSize,
  iconSize = 16,
}) => {
  const { colors } = useTheme();
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.94,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const IconComponent = option.icon;
  const textColor = isSelected ? activeColor : inactiveColor;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={option.label}
      style={styles.optionButton}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
    >
      <Animated.View
        style={[
          styles.optionContent,
          { transform: [{ scale: pressScale }] },
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
            <IconComponent size={iconSize} color={textColor} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.optionLabel,
              {
                color: textColor,
                fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
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
};

/**
 * Standardized SegmentedControl primitive for Arthik.
 * Implements Apple Design WWDC Dual-Edge Liquid Morph animation:
 * - Critically damped primary slide spring (zero overshoot outside bounds)
 * - Direction-aware leading edge stretch & vertical volume squish
 * - Strict track clipping (overflow: 'hidden') keeping the pill inside the container
 * - Per-item press scale (0.94)
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
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

  const [containerWidth, setContainerWidth] = React.useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const stretchAnim = useRef(new Animated.Value(1)).current;
  const squishAnim = useRef(new Animated.Value(1)).current;
  const leadAnim = useRef(new Animated.Value(0)).current;
  const isFirstLayout = useRef(true);
  const prevIndexRef = useRef(selectedIndex);

  const optionWidth =
    containerWidth > 0 && normalizedOptions.length > 0
      ? (containerWidth - Spacing.micro * 2) / normalizedOptions.length
      : 0;

  useEffect(() => {
    if (optionWidth > 0) {
      const targetX = selectedIndex * optionWidth;
      const distance = Math.abs(selectedIndex - prevIndexRef.current);
      const direction = selectedIndex > prevIndexRef.current ? 1 : -1;
      prevIndexRef.current = selectedIndex;

      if (isFirstLayout.current) {
        slideAnim.setValue(targetX);
        stretchAnim.setValue(1);
        squishAnim.setValue(1);
        leadAnim.setValue(0);
        isFirstLayout.current = false;
        return;
      }

      // 1. Primary slide: Apple-calibrated critically damped spring (zero overshoot)
      Animated.spring(slideAnim, {
        toValue: targetX,
        tension: 100,
        friction: 16,
        useNativeDriver: true,
      }).start();

      // 2. Dual-Edge Liquid Morph: leading edge stretch & vertical volume squish
      if (distance > 0) {
        const maxStretch = Math.min(1.28, 1 + distance * 0.08);
        const minSquish = Math.max(0.88, 1 - distance * 0.04);
        const maxLead = Math.min(14, distance * 4.5) * direction;
        const launchDuration = Math.min(130, 60 + distance * 22);

        stretchAnim.stopAnimation();
        squishAnim.stopAnimation();
        leadAnim.stopAnimation();

        Animated.parallel([
          Animated.sequence([
            Animated.timing(stretchAnim, {
              toValue: maxStretch,
              duration: launchDuration,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(stretchAnim, {
              toValue: 1,
              tension: 140,
              friction: 14,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(squishAnim, {
              toValue: minSquish,
              duration: launchDuration,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(squishAnim, {
              toValue: 1,
              tension: 140,
              friction: 14,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(leadAnim, {
              toValue: maxLead,
              duration: launchDuration,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(leadAnim, {
              toValue: 0,
              tension: 140,
              friction: 14,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }
    }
  }, [selectedIndex, optionWidth, slideAnim, stretchAnim, squishAnim, leadAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
      if (!isFirstLayout.current && normalizedOptions.length > 0) {
        const newOptWidth = (width - Spacing.micro * 2) / normalizedOptions.length;
        slideAnim.setValue(selectedIndex * newOptWidth);
      }
    }
  };

  const resolvedBg = backgroundColor ?? colors.cardSubtle;
  const resolvedBorder = borderColor ?? colors.borderSubtle;
  const resolvedPillBg = activePillColor ?? colors.mintGreen;
  const resolvedActiveText = activeTextColor ?? colors.forestGreen;
  const resolvedInactiveText = inactiveTextColor ?? colors.textSecondary;

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
            style={[
              styles.sliderPill,
              {
                width: optionWidth,
                transform: [
                  { translateX: slideAnim },
                  { translateX: leadAnim },
                  { scaleX: stretchAnim },
                  { scaleY: squishAnim },
                ],
                backgroundColor: resolvedPillBg,
                borderRadius: Math.max(4, borderRadius - 2),
              },
            ]}
          />
        )}
      </View>

      {/* Options Row: interactive tabs and floating badges */}
      <View style={styles.optionsRow}>
        {normalizedOptions.map((option) => (
          <OptionItem
            key={option.key}
            option={option}
            isSelected={option.key === selectedKey}
            onPress={() => onChange(option.key)}
            activeColor={resolvedActiveText}
            inactiveColor={resolvedInactiveText}
            fontSize={fontSize}
            iconSize={iconSize}
          />
        ))}
      </View>
    </View>
  );
};

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
