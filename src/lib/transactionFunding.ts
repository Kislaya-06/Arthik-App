import { format } from 'date-fns/format';
import { Expense } from '../store/expenseStore';
import { DailyRecord } from './budgetCalculations';
import { BudgetPlanChange, BudgetPeriodRecord } from '../types';
import type { AllowancePause } from './allowancePauses';
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
  records?: Record<string, DailyRecord>;
  planChanges?: BudgetPlanChange[];
  todayBudget?: number;
  dailyBudgetAmount?: number;
  isBudgetModeEnabled?: boolean;
  isAutoRenew?: boolean;
  deposits?: Array<{ amount: number | string; source?: 'income' | 'external'; date?: string }>;
  todayStr?: string;
  userCreatedAtStr?: string;
  budgetPeriods?: Record<string, BudgetPeriodRecord>;
  skipped?: AllowancePause[];
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
  records = {},
  planChanges = [],
  todayBudget = 0,
  dailyBudgetAmount = 0,
  isBudgetModeEnabled = true,
  isAutoRenew = true,
  deposits = [],
  todayStr = format(new Date(), 'yyyy-MM-dd'),
  budgetPeriods = {},
  skipped,
}: CalculateExpenseFundingParams): ExpenseFundingBreakdown {
  const isIncome = isIncomeTransaction(expense);
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
    deposits,
    isBudgetModeEnabled,
    isAutoRenew,
    todayStr,
    todayBudget,
    dailyBudgetAmount,
    records,
    planChanges,
    budgetPeriods,
    skipped,
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
  const notCovered = split?.short ?? 0;
  const isOver = (split?.overspend ?? 0) > 0;

  const parts: string[] = [];
  if (bCovered > 0) parts.push(`${formatCurrency(bCovered)} Allowance`);
  if (iCovered > 0) parts.push(`${formatCurrency(iCovered)} Income`);
  if (gCovered > 0) parts.push(`${formatCurrency(gCovered)} Gullak`);
  if (notCovered > 0) parts.push(`${formatCurrency(notCovered)} not covered yet`);

  const primarySource: 'budget' | 'income' | 'gullak' | 'split' =
    bCovered === amount ? 'budget' : iCovered === amount ? 'income' : gCovered === amount ? 'gullak' : 'split';

  const summaryLabel =
    primarySource === 'budget' ? 'Daily Allowance'
    : primarySource === 'income' ? 'Paid from Income'
    : primarySource === 'gullak' ? 'Paid from Gullak'
    : parts.join(' + ');

  const explanation = notCovered > 0
    ? `${formatCurrency(notCovered)} is not covered yet. Your next income will pay it.`
    : gCovered > 0 && iCovered > 0
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
