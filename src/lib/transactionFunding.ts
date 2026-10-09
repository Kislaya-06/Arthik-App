import { format } from 'date-fns';
import { Expense } from '../store/expenseStore';
import { Category } from '../store/categoryStore';
import { DailyRecord } from './budgetCalculations';
import { BudgetPlanChange } from '../types';
import { formatCurrency, round2 } from './formatters';
import { isCountedExpense, isCountedIncome, isIncomeTransaction, isSelfTransferClass } from './transactionUtils';
import { resolvePlanForDate, getPeriodBounds } from './budgetPeriods';

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
  deposits?: Array<{ amount: number | string; source?: 'income' | 'external' }>;
  todayStr?: string;
  userCreatedAtStr?: string;
}

function getPoolBudget(
  dStr: string,
  todayStr: string,
  isBudgetMode: boolean,
  isAutoRenew: boolean,
  todayBudget: number,
  dailyBudget: number,
  records: Record<string, DailyRecord>,
  planChanges: BudgetPlanChange[]
): { poolKey: string; poolBudget: number } {
  if (!isBudgetMode) return { poolKey: `pure_${dStr}`, poolBudget: 0 };
  if (dStr === todayStr) {
    return { poolKey: `daily_${dStr}`, poolBudget: isAutoRenew ? (todayBudget || dailyBudget || 0) : 0 };
  }
  if (records[dStr]?.budget !== undefined) return { poolKey: `daily_${dStr}`, poolBudget: records[dStr].budget };
  const plan = resolvePlanForDate(planChanges, dStr);
  if (plan) {
    if (!plan.isEnabled) return { poolKey: `paused_${dStr}`, poolBudget: 0 };
    if (plan.cadence !== 'daily') {
      const b = getPeriodBounds(plan.cadence, dStr);
      return { poolKey: `${plan.cadence}_${b.start}_${b.end}`, poolBudget: plan.amount };
    }
    return { poolKey: `daily_${dStr}`, poolBudget: plan.amount };
  }
  return { poolKey: `daily_${dStr}`, poolBudget: dailyBudget || 0 };
}

/**
 * Calculates how an expense was funded (Daily Allowance, Income, Gullak).
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

  // Available income pool
  const totalIncome = allExpenses.reduce((sum, e) => sum + (isCountedIncome(e, e.category_id ? catMap.get(e.category_id) : undefined) ? (Number(e.amount) || 0) : 0), 0);
  const incomeDeposits = (deposits || []).reduce((sum, d) => sum + (d.source === 'income' ? (Number(d.amount) || 0) : 0), 0);
  const totalAvailableIncome = round2(Math.max(0, totalIncome - incomeDeposits));

  // Chronological counted expenses
  const counted = allExpenses.filter((e) => isCountedExpense(e, e.category_id ? catMap.get(e.category_id) : undefined));
  if (!counted.some((e) => e.id === expense.id)) counted.push(expense);
  counted.sort((a, b) => (a.expense_date?.split('T')[0] || '').localeCompare(b.expense_date?.split('T')[0] || '') || (a.created_at || '').localeCompare(b.created_at || '') || (a.id || '').localeCompare(b.id || ''));

  const poolSpent: Record<string, number> = {};
  let cumOverspent = 0;
  let bCovered = 0, iCovered = 0, gCovered = 0, isOver = false;

  for (const item of counted) {
    const itemAmt = Number(item.amount) || 0;
    const itemDate = item.expense_date?.split('T')[0] || todayStr;
    const { poolKey, poolBudget } = getPoolBudget(itemDate, todayStr, isBudgetModeEnabled, isAutoRenew, todayBudget, dailyBudgetAmount, records, planChanges);

    const poolRem = Math.max(0, round2(poolBudget - (poolSpent[poolKey] || 0)));
    const itemBudgetCov = Math.min(itemAmt, poolRem);
    const itemOver = round2(Math.max(0, itemAmt - itemBudgetCov));
    poolSpent[poolKey] = round2((poolSpent[poolKey] || 0) + itemBudgetCov);

    const incRem = Math.max(0, round2(totalAvailableIncome - Math.min(totalAvailableIncome, cumOverspent)));
    const itemIncCov = Math.min(itemOver, incRem);
    const itemGulCov = round2(Math.max(0, itemOver - itemIncCov));
    cumOverspent = round2(cumOverspent + itemOver);

    if (item.id === expense.id) {
      bCovered = itemBudgetCov;
      iCovered = itemIncCov;
      gCovered = itemGulCov;
      isOver = itemOver > 0;
      break;
    }
  }

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
