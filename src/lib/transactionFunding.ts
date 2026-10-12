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

  // Available income pool for current active period / today
  const totalIncome = allExpenses.reduce((sum, e) => sum + (isCountedIncome(e, e.category_id ? catMap.get(e.category_id) : undefined) ? (Number(e.amount) || 0) : 0), 0);
  const incomeDeposits = (deposits || []).reduce((sum, d) => sum + (d.source === 'income' ? (Number(d.amount) || 0) : 0), 0);
  const totalAvailableIncome = round2(Math.max(0, totalIncome - incomeDeposits));

  const targetDate = expense.expense_date?.split('T')[0] || todayStr;
  const { poolKey: targetPoolKey, poolBudget: targetPoolBudget } = getPoolBudget(
    targetDate,
    todayStr,
    isBudgetModeEnabled,
    isAutoRenew,
    todayBudget,
    dailyBudgetAmount,
    records,
    planChanges
  );

  const isTodayOrActivePool =
    targetDate === todayStr ||
    targetPoolKey.startsWith('weekly_') ||
    targetPoolKey.startsWith('monthly_');

  // Chronological counted expenses
  const counted = allExpenses.filter((e) => isCountedExpense(e, e.category_id ? catMap.get(e.category_id) : undefined));
  if (!counted.some((e) => e.id === expense.id)) counted.push(expense);

  // Evaluate expenses belonging to the same budget pool/period as the target expense.
  // Past finalized days' expenses were already settled on their respective days and must NEVER
  // consume or wipe out today's available income pool.
  const poolExpenses = counted.filter((item) => {
    const itemDate = item.expense_date?.split('T')[0] || todayStr;
    const { poolKey } = getPoolBudget(
      itemDate,
      todayStr,
      isBudgetModeEnabled,
      isAutoRenew,
      todayBudget,
      dailyBudgetAmount,
      records,
      planChanges
    );
    return poolKey === targetPoolKey;
  });

  poolExpenses.sort(
    (a, b) =>
      (a.expense_date?.split('T')[0] || '').localeCompare(b.expense_date?.split('T')[0] || '') ||
      (a.created_at || '').localeCompare(b.created_at || '') ||
      (a.id || '').localeCompare(b.id || '')
  );

  let poolBudgetSpent = 0;
  let cumOverspentInPool = 0;
  let bCovered = 0, iCovered = 0, gCovered = 0, isOver = false;

  // For the active pool (today or active cadence), the available income is the unspent income pool.
  // For a past closed day, available income was only whatever income was received on that specific past day.
  const availableIncomeForPool = isTodayOrActivePool
    ? totalAvailableIncome
    : allExpenses
        .filter(
          (e) =>
            isCountedIncome(e, e.category_id ? catMap.get(e.category_id) : undefined) &&
            e.expense_date?.split('T')[0] === targetDate
        )
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  for (const item of poolExpenses) {
    const itemAmt = Number(item.amount) || 0;
    const poolRem = Math.max(0, round2(targetPoolBudget - poolBudgetSpent));
    const itemBudgetCov = Math.min(itemAmt, poolRem);
    const itemOver = round2(Math.max(0, itemAmt - itemBudgetCov));
    poolBudgetSpent = round2(poolBudgetSpent + itemBudgetCov);

    const incRem = Math.max(0, round2(availableIncomeForPool - cumOverspentInPool));
    const itemIncCov = Math.min(itemOver, incRem);
    const itemGulCov = round2(Math.max(0, itemOver - itemIncCov));
    cumOverspentInPool = round2(cumOverspentInPool + itemOver);

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
