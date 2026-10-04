import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated, useAnimatedValue } from 'react-native';
import { ThemeColors, FontFamily, FontSize, LineHeight, Spacing } from '../../config/theme';
import { AmountText } from './AmountText';
import { formatCurrency } from '../../lib/formatters';

export interface ItemRowShellProps {
  iconBadge: React.ReactNode;
  title: string;
  subtitle: string;
  amount: number;
  direction?: 'income' | 'expense';
  signed?: boolean;
  dateStr: string;
  colors: ThemeColors;
  isDark: boolean;
  onPress?: () => void;
  phaseAOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
  phaseATranslateY?: Animated.AnimatedInterpolation<number> | Animated.Value;
}

export const ItemRowShell: React.FC<ItemRowShellProps> = ({
  iconBadge,
  title,
  subtitle,
  amount,
  direction = 'expense',
  signed = true,
  dateStr,
  colors,
  isDark,
  onPress,
  phaseAOpacity,
  phaseATranslateY,
}) => {
  const pressScale = useAnimatedValue(1);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.98,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const isPhaseAActive = phaseAOpacity !== undefined || phaseATranslateY !== undefined;

  const rowContent = (
    <Animated.View
      style={[
        styles.txRow,
        {
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          transform: [{ scale: pressScale }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.badgeAndMiddle,
          isPhaseAActive
            ? {
                opacity: phaseAOpacity ?? 1,
                transform: phaseATranslateY ? [{ translateY: phaseATranslateY }] : undefined,
              }
            : null,
        ]}
      >
        {iconBadge}
        <View style={styles.txMiddle}>
          <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Animated.View>
      <View style={styles.txRight}>
        <AmountText
          role="row"
          value={amount}
          direction={direction}
          signed={signed}
        />
        <Text style={[styles.txDate, { color: colors.textMuted }]}>{dateStr}</Text>
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.pressableContainer,
          {
            backgroundColor: pressed
              ? (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)')
              : 'transparent',
          },
        ]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${formatCurrency(amount)}`}
      >
        {rowContent}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${formatCurrency(amount)}`}
    >
      {rowContent}
    </View>
  );
};

const styles = StyleSheet.create({
  pressableContainer: {
    borderRadius: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  badgeAndMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: Spacing.group,
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  txSubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: Spacing.group,
  },
  txDate: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
});
