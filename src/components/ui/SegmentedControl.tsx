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

/**
 * Standardized SegmentedControl primitive for Arthik.
 * Replaces divergent filter toggles with a single stadium pill container,
 * smooth spring physics (tension: 70, friction: 8), and accessible tab semantics.
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedKey,
  onChange,
  style,
  testID,
}) => {
  const { colors, isDark } = useTheme();

  // Normalize options to object format
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
              backgroundColor: colors.card,
              borderRadius: BorderRadius.pill,
              borderColor: isDark ? colors.border : 'rgba(0, 0, 0, 0.04)',
            },
          ]}
        />
      ) : null}

      <View style={styles.optionsRow}>
        {normalizedOptions.map((option) => {
          const isSelected = option.key === selectedKey;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
              style={styles.optionButton}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.optionLabel,
                  {
                    color: isSelected ? colors.textPrimary : colors.textSecondary,
                    fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
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
  },
  sliderPill: {
    position: 'absolute',
    top: Spacing.micro,
    bottom: Spacing.micro,
    left: Spacing.micro,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
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
    paddingHorizontal: 8,
    zIndex: 1,
  },
  optionLabel: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    textAlign: 'center',
  },
});
