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
  const catColor = category?.color ?? (isIncome ? '#ADEBB3' : '#FFD3AC');
  const bg = catColor;

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

  const categoryName = category?.name ?? (isIncome ? 'Money Added' : 'Other');
  const hasNote = Boolean(expense.note && expense.note.trim().length > 0);
  const mainTitle = hasNote ? expense.note!.trim() : categoryName;
  const subtitle = hasNote ? `${categoryName} · ${modeLabel}` : modeLabel;

  return (
    <View
      style={[
        styles.txRow,
        {
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
    >
      <View style={[styles.txIconContainer, { backgroundColor: bg }]}>
        <IconComp size={22} color="#000000" strokeWidth={2.2} />
      </View>
      <View style={styles.txMiddle}>
        <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {mainTitle}
        </Text>
        <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>{amountLabel}</Text>
        <Text style={[styles.txDate, { color: colors.textMuted }]}>{dateStr}</Text>
      </View>
    </View>
  );
};

export const TransactionRow = React.memo(TransactionRowBase);

const styles = StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  txIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  txSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    marginTop: 3,
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  txAmount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  txDate: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginTop: 3,
  },
});
