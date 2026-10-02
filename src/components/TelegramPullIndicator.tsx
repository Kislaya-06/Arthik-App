import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { ThemeColors, FontFamily, FontSize, Spacing } from '../config/theme';

export interface TelegramPullIndicatorProps {
  onTrigger: () => void;
  colors: ThemeColors;
  isDark: boolean;
}

export const TelegramPullIndicator: React.FC<TelegramPullIndicatorProps> = ({
  onTrigger,
  colors,
  isDark,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const accentColor = isDark ? colors.mintGreen : colors.mintGreenDark;

  return (
    <View style={styles.outerContainer}>
      <Pressable
        onPress={onTrigger}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="View full transaction history"
      >
        <Animated.View
          style={[
            styles.innerCircle,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <ArrowRight size={18} color={accentColor} strokeWidth={2.2} />
        </Animated.View>
        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
              fontFamily: FontFamily.medium,
            },
          ]}
        >
          View Full History
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.gutter,
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.element,
    letterSpacing: 0.2,
  },
});

export default TelegramPullIndicator;
