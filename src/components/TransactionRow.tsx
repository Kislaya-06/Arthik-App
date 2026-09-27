import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DollarSign, Wallet } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { Expense } from '../store/expenseStore';
import { Category } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';
import { formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

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
  const expenseColor = isDark ? colors.peachCoral : '#E05345';
  const incomeColor = isDark ? colors.mintGreen : colors.mintGreenDark;
  const amountColor = isIncome ? incomeColor : expenseColor;

  const modeLabel =
    expense.payment_mode === 'upi'
      ? 'UPI'
      : expense.payment_mode === 'card'
        ? 'Card'
        : 'Cash';

  return (
    <View
      style={[
        styles.txRow,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderSubtle,
        },
      ]}
    >
      <View style={[styles.txIconContainer, { backgroundColor: bg }]}>
        <IconComp size={20} color={catColor} />
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
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  txIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: 14,
  },
  txTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  txSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  txSubtitle: {
    fontSize: 13,
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
    justifyContent: 'center',
    marginLeft: Spacing.group,
  },
  txAmount: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  txDate: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
});
