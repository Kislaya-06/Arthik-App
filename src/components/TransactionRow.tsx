import React, { useMemo } from 'react';
import { Animated } from 'react-native';
import { DollarSign, Wallet } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { Expense } from '../store/expenseStore';
import { Category } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';
import { GradientIconBadge } from './GradientIconBadge';
import { ItemRowShell } from './ui/ItemRowShell';
import { useSharesStore } from '../store/sharesStore';
import { useExpenseStore } from '../store/expenseStore';
import { splitRepaymentLabel } from '../lib/shares';

const NO_SHARES: never[] = [];
const NO_EXPENSES: never[] = [];

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
  // A friend paying back a split: say so, and say which split (created on which day).
  const isRepayment = expense.transaction_class === 'reimbursement';
  const allShares = useSharesStore((s) => (isRepayment ? s.shares : NO_SHARES));
  const allExpenses = useExpenseStore((s) => (isRepayment ? s.expenses : NO_EXPENSES));
  const repayment = useMemo(
    () => (isRepayment ? splitRepaymentLabel(expense, allShares, allExpenses) : null),
    [isRepayment, expense, allShares, allExpenses]
  );

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
  const mainTitle = repayment ? repayment.title : hasNote ? expense.note!.trim() : categoryName;
  const subtitle = repayment ? repayment.short : hasNote ? `${categoryName} · ${modeLabel}` : modeLabel;

  return (
    <ItemRowShell
      iconBadge={
        <GradientIconBadge size={48} color={catColor} isDark={isDark}>
          {({ iconColor }) => <IconComp size={22} color={iconColor} strokeWidth={2.2} />}
        </GradientIconBadge>
      }
      title={mainTitle}
      subtitle={subtitle}
      amount={expense.amount}
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
