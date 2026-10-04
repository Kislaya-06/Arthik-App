import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, useAnimatedValue } from 'react-native';
import { DollarSign, Wallet } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { Expense } from '../store/expenseStore';
import { Category } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';
import { GradientIconBadge } from './GradientIconBadge';
import { AmountText } from './ui/AmountText';
import { formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

export type TxRowProps = {
  expense: Expense;
  category: Category | undefined;
  isIncome: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  onPress?: () => void;
  phaseAOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
  phaseATranslateY?: Animated.AnimatedInterpolation<number> | Animated.Value;
};

const TransactionRowBase: React.FC<TxRowProps> = ({
  expense,
  category,
  isIncome,
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

  const IconComp = category ? (getCategoryIcon(category.icon) ?? DollarSign) : (isIncome ? Wallet : DollarSign);
  const catColor = category?.color ?? (isIncome ? '#ADEBB3' : '#FFD3AC');

  const dateStr = useMemo(() => {
    try {
      if (expense.created_at) {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        if (expense.expense_date === todayStr) {
          return format(parseISO(expense.created_at), 'h:mm a');
        }
      }
      return format(parseISO(expense.expense_date), 'd MMM');
    } catch {
      return expense.expense_date;
    }
  }, [expense.expense_date, expense.created_at]);

  const modeLabel =
    expense.payment_mode === 'upi'
      ? 'UPI'
      : expense.payment_mode === 'card'
        ? 'Card'
        : 'Cash';

  const categoryName = category?.name ?? (isIncome ? 'Money Added' : 'Other');
  const hasNote = Boolean(expense.note && expense.note.trim().length > 0);
  const mainTitle = hasNote ? expense.note!.trim() : categoryName;
  const subtitle = hasNote ? `${categoryName} · ${modeLabel}` : modeLabel;

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
        <GradientIconBadge size={48} color={catColor} isDark={isDark}>
          {({ iconColor }) => <IconComp size={22} color={iconColor} strokeWidth={2.2} />}
        </GradientIconBadge>
        <View style={styles.txMiddle}>
          <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {mainTitle}
          </Text>
          <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Animated.View>
      <View style={styles.txRight}>
        <AmountText
          role="row"
          value={expense.amount}
          direction={isIncome ? 'income' : 'expense'}
          signed
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
        accessibilityLabel={`${mainTitle}, ${formatCurrency(expense.amount)}`}
      >
        {rowContent}
      </Pressable>
    );
  }

  return rowContent;
};

export const TransactionRow = React.memo(TransactionRowBase);

const styles = StyleSheet.create({
  pressableContainer: {
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
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
    minWidth: 0,
  },
  txMiddle: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
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

export default TransactionRow;
