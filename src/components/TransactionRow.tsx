import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DollarSign, Wallet } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { Expense } from '../store/expenseStore';
import { Category } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';
import { formatCurrency } from '../lib/formatters';
import { Spacing, FontSize, FontFamily } from '../config/theme';

const pastelBg = (hex: string) => hex + '30'; // 19% opacity overlay

export type TxRowProps = {
  expense: Expense;
  category: Category | undefined;
  isIncome: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
};

const TransactionRowBase: React.FC<TxRowProps> = ({ expense, category, isIncome, colors, isDark }) => {
  const IconComp = category ? (getCategoryIcon(category.icon) ?? DollarSign) : (isIncome ? Wallet : DollarSign);
  const catColor = category?.color ?? (isIncome ? colors.mintGreen : '#94A3B8');
  const bg = pastelBg(catColor);

  const dateStr = useMemo(() => {
    try {
      return format(parseISO(expense.expense_date), 'd MMM');
    } catch {
      return expense.expense_date;
    }
  }, [expense.expense_date]);

  const amountLabel = isIncome ? `+${formatCurrency(Math.abs(expense.amount))}` : `−${formatCurrency(Math.abs(expense.amount))}`;
  const amountColor = isIncome ? (isDark ? colors.mintGreen : colors.mintGreenDark) : colors.textPrimary;

  const modeLabel =
    expense.payment_mode === 'upi'
      ? 'UPI'
      : expense.payment_mode === 'card'
        ? 'Card'
        : 'Cash';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconContainer, { backgroundColor: bg }]}>
        <IconComp size={22} color={catColor} />
      </View>
      <View style={styles.txMiddle}>
        <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {category?.name ?? (isIncome ? 'Money Added' : 'Other')}
        </Text>
        <View style={styles.txSubtitleRow}>
          {expense.note ? (
            <>
              <Text
                style={[styles.txSubtitle, styles.txNoteText, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {expense.note}
              </Text>
              <Text
                style={[styles.txSubtitle, styles.txModeText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {` · ${modeLabel}`}
              </Text>
            </>
          ) : (
            <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {modeLabel}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>{amountLabel}</Text>
        <Text style={[styles.txDate, { color: colors.textSecondary }]}>{dateStr}</Text>
      </View>
    </View>
  );
};

export const TransactionRow = React.memo(TransactionRowBase);

const styles = StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.surface,
  },
  txIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: Spacing.block,
  },
  txTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  txSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.nano,
  },
  txSubtitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
  },
  txNoteText: {
    flexShrink: 1,
  },
  txModeText: {
    flexShrink: 0,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  txDate: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.nano,
  },
});
