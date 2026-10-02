import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../../store/themeStore';
import { BorderRadius, FontSize, FontFamily, LineHeight, Spacing } from '../../config/theme';

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
  testID?: string;
}

interface OptionItemProps {
  option: SegmentedOption;
  isSelected: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
}

const OptionItem: React.FC<OptionItemProps> = ({
  option,
  isSelected,
  onPress,
  activeColor,
  inactiveColor,
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
            <IconComponent size={15} color={textColor} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.optionLabel,
              {
                color: textColor,
                fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
                marginLeft: IconComponent ? 6 : 0,
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
 * Sliding pill with bouncy spring physics (tension: 70, friction: 8)
 * and per-item press scale (0.94).
 * Supports text-only, icon + text options, badges, and customizable height.
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedKey,
  onChange,
  style,
  height = 44,
  borderRadius = BorderRadius.pill,
  activePillColor,
  activeTextColor,
  inactiveTextColor,
  backgroundColor,
  borderColor,
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
  const isFirstLayout = useRef(true);

  const optionWidth =
    containerWidth > 0 && normalizedOptions.length > 0
      ? (containerWidth - Spacing.micro * 2) / normalizedOptions.length
      : 0;

  useEffect(() => {
    if (optionWidth > 0) {
      const targetX = selectedIndex * optionWidth;
      if (isFirstLayout.current) {
        slideAnim.setValue(targetX);
        isFirstLayout.current = false;
      } else {
        Animated.spring(slideAnim, {
          toValue: targetX,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [selectedIndex, optionWidth, slideAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
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
      {optionWidth > 0 ? (
        <Animated.View
          style={[
            styles.sliderPill,
            {
              width: optionWidth,
              transform: [{ translateX: slideAnim }],
              backgroundColor: resolvedPillBg,
              borderRadius: Math.max(4, borderRadius - 2),
            },
          ]}
        />
      ) : null}

      <View style={styles.optionsRow}>
        {normalizedOptions.map((option) => (
          <OptionItem
            key={option.key}
            option={option}
            isSelected={option.key === selectedKey}
            onPress={() => onChange(option.key)}
            activeColor={resolvedActiveText}
            inactiveColor={resolvedInactiveText}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 44,
    padding: Spacing.micro,
    borderWidth: 1,
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
    overflow: 'visible',
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
