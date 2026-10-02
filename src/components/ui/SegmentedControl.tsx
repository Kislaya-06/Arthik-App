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
}

export interface SegmentedControlProps {
  options: (string | SegmentedOption)[];
  selectedKey: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
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
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.93,
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
        <Text
          numberOfLines={1}
          style={[
            styles.optionLabel,
            {
              color: isSelected ? activeColor : inactiveColor,
              fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
            },
          ]}
        >
          {option.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

/**
 * Standardized SegmentedControl primitive for Arthik.
 * Sliding mint-green pill with bouncy spring physics (tension: 70, friction: 8)
 * and per-item press scale (0.93) matching BouncyFilterToggle feel exactly.
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedKey,
  onChange,
  style,
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

  const optionWidth = containerWidth > 0 && normalizedOptions.length > 0
    ? (containerWidth - Spacing.micro * 2) / normalizedOptions.length
    : 0;

  useEffect(() => {
    if (optionWidth > 0) {
      Animated.spring(slideAnim, {
        toValue: selectedIndex * optionWidth,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIndex, optionWidth, slideAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  return (
    <View
      onLayout={handleLayout}
      accessible
      accessibilityRole="tablist"
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: colors.cardSubtle,
          borderRadius: BorderRadius.pill,
          borderColor: colors.borderSubtle,
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
              backgroundColor: colors.mintGreen,
              borderRadius: BorderRadius.pill,
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
            activeColor={colors.forestGreen}
            inactiveColor={colors.textSecondary}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
