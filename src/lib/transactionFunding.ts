import { format } from 'date-fns';
import { Expense } from '../store/expenseStore';
import { Category } from '../store/categoryStore';
import { DailyRecord } from './budgetCalculations';
import { BudgetPlanChange } from '../types';
import { formatCurrency } from './formatters';
import { isIncomeTransaction, isSelfTransferClass } from './transactionUtils';
import { computeWaterfallFromState } from './moneyWaterfall';

export interface ExpenseFundingBreakdown {
  isIncome: boolean;
  isTransfer: boolean;
  totalAmount: number;
  coveredByBudget: number;
  coveredByIncome: number;
  coveredByGullak: number;
  isOverBudget: boolean;
  primarySource: 'budget' | 'income' | 'gullak' | 'split';
  summaryLabel: string;
  explanation: string;
}

export interface CalculateExpenseFundingParams {
  expense: Expense;
  allExpenses: Expense[];
  categories: Category[];
  records?: Record<string, DailyRecord>;
  planChanges?: BudgetPlanChange[];
  todayBudget?: number;
  dailyBudgetAmount?: number;
  isBudgetModeEnabled?: boolean;
  isAutoRenew?: boolean;
  deposits?: Array<{ amount: number | string; source?: 'income' | 'external'; date?: string }>;
  todayStr?: string;
  userCreatedAtStr?: string;
}

/**
 * Calculates how an expense was funded: Budget (Daily / Weekly / Monthly allowance) -> Income -> Gullak.
 *
 * Uses the SAME time-ordered money waterfall as the Home chips and the Gullak total
 * (src/lib/moneyWaterfall.ts), so this card can never say "paid from income" when the Home
 * screen shows that income is already 0.
 */
export function calculateExpenseFunding({
  expense,
  allExpenses,
  categories,
  records = {},
  planChanges = [],
  todayBudget = 0,
  dailyBudgetAmount = 0,
  isBudgetModeEnabled = true,
  isAutoRenew = true,
  deposits = [],
  todayStr = format(new Date(), 'yyyy-MM-dd'),
}: CalculateExpenseFundingParams): ExpenseFundingBreakdown {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const isIncome = isIncomeTransaction(expense, expense.category_id ? catMap.get(expense.category_id) : undefined);
  const isTransfer = isSelfTransferClass(expense);
  const amount = Number(expense.amount) || 0;

  if (isIncome || isTransfer) {
    return {
      isIncome,
      isTransfer,
      totalAmount: amount,
      coveredByBudget: 0,
      coveredByIncome: 0,
      coveredByGullak: 0,
      isOverBudget: false,
      primarySource: isIncome ? 'income' : 'budget',
      summaryLabel: isIncome ? 'Income Received' : 'Self Transfer',
      explanation: isIncome ? 'Money added to your available Income pool.' : 'Internal account transfer.',
    };
  }

  // Pure Mode has no budget, no income pool and no Gullak: an expense is simply deducted from the overall balance.
  // (It used to say "Paid from Gullak" here, which does not exist in Pure Mode.)
  if (!isBudgetModeEnabled) {
    return {
      isIncome: false,
      isTransfer: false,
      totalAmount: amount,
      coveredByBudget: 0,
      coveredByIncome: 0,
      coveredByGullak: 0,
      isOverBudget: false,
      primarySource: 'budget',
      summaryLabel: 'Your balance',
      explanation: 'Budget Mode is off, so this is simply deducted from your overall balance.',
    };
  }

  const expenses = allExpenses.some((e) => e.id === expense.id) ? allExpenses : [...allExpenses, expense];
  const waterfall = computeWaterfallFromState({
    expenses,
    categories,
    deposits,
    isBudgetModeEnabled,
    isAutoRenew,
    todayStr,
    todayBudget,
    dailyBudgetAmount,
    records,
    planChanges,
  });

  const split = waterfall.byExpense[expense.id];

  // No budget governed this day (paused / zero budget): nothing was taken from income or Gullak.
  if (split && !split.governed) {
    return {
      isIncome: false,
      isTransfer: false,
      totalAmount: amount,
      coveredByBudget: 0,
      coveredByIncome: 0,
      coveredByGullak: 0,
      isOverBudget: false,
      primarySource: 'budget',
      summaryLabel: 'Not budgeted',
      explanation: 'No budget was active on this day, so your income and Gullak were not touched.',
    };
  }

  const bCovered = split?.fromBudget ?? 0;
  const iCovered = split?.fromIncome ?? 0;
  const gCovered = split?.fromGullak ?? 0;
  const isOver = (split?.overspend ?? 0) > 0;

  const parts: string[] = [];
  if (bCovered > 0) parts.push(`${formatCurrency(bCovered)} Allowance`);
  if (iCovered > 0) parts.push(`${formatCurrency(iCovered)} Income`);
  if (gCovered > 0) parts.push(`${formatCurrency(gCovered)} Gullak`);

  const primarySource: 'budget' | 'income' | 'gullak' | 'split' =
    bCovered === amount ? 'budget' : iCovered === amount ? 'income' : gCovered === amount ? 'gullak' : 'split';

  const summaryLabel =
    primarySource === 'budget' ? 'Daily Allowance'
    : primarySource === 'income' ? 'Paid from Income'
    : primarySource === 'gullak' ? 'Paid from Gullak'
    : parts.join(' + ');

  const explanation = gCovered > 0 && iCovered > 0
    ? `Paid ${formatCurrency(iCovered)} from income, and ${formatCurrency(gCovered)} deducted from Gullak savings.`
    : gCovered > 0
    ? `Exceeded limit: ${formatCurrency(gCovered)} was deducted from your Gullak savings.`
    : iCovered > 0
    ? `Exceeded daily allowance: ${formatCurrency(iCovered)} was paid from your available Income.`
    : 'Paid within your daily allowance. No income or Gullak savings were touched.';

  return {
    isIncome: false,
    isTransfer: false,
    totalAmount: amount,
    coveredByBudget: bCovered,
    coveredByIncome: iCovered,
    coveredByGullak: gCovered,
    isOverBudget: isOver,
    primarySource,
    summaryLabel,
    explanation,
  };
}
