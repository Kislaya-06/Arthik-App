import React, { useMemo } from 'react';
import { Animated } from 'react-native';
import DollarSign from 'lucide-react-native/icons/dollar-sign';
import Wallet from 'lucide-react-native/icons/wallet';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Expense } from '../store/expenseStore';
import { Category } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';
import { GradientIconBadge } from './GradientIconBadge';
import { ItemRowShell } from './ui/ItemRowShell';
import { isRecoveryClass } from '../lib/transactionUtils';
import { grossAmountOf } from '../lib/splitLedger';
import { formatCurrency } from '../lib/formatters';

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

  const isMoneyBack = isRecoveryClass(expense);
  const categoryName = isMoneyBack ? 'Money back' : (category?.name ?? (isIncome ? 'Money Added' : 'Other'));
  const hasNote = Boolean(expense.note && expense.note.trim().length > 0);
  const mainTitle = hasNote ? expense.note!.trim() : categoryName;
  let subtitle = hasNote ? `${categoryName} · ${modeLabel}` : modeLabel;

  // The row shows what was PAID. If part of it came back, or it is split, say so (SPL-001 / SPL-003).
  const paid = grossAmountOf(expense);
  const cameBack = isIncome ? 0 : Math.max(0, paid - (Number(expense.amount) || 0));
  if (expense.split_person && Number(expense.split_amount) > 0) subtitle += ` · Split with ${expense.split_person}`;
  if (cameBack > 0) subtitle += ` · ${formatCurrency(cameBack)} back`;

  return (
    <ItemRowShell
      iconBadge={
        <GradientIconBadge size={48} color={catColor} isDark={isDark}>
          {({ iconColor }) => <IconComp size={22} color={iconColor} strokeWidth={2.2} />}
        </GradientIconBadge>
      }
      title={mainTitle}
      subtitle={subtitle}
      amount={paid}
      direction={isIncome ? 'income' : 'expense'}
      signed
      dateStr={dateStr}
      colors={colors}
      isDark={isDark}
      onPress={onPress}
      phaseAOpacity={phaseAOpacity}
      phaseATranslateY={phaseATranslateY}
    />
  );
};

export const TransactionRow = React.memo(TransactionRowBase);
export default TransactionRow;
