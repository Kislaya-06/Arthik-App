import { useMemo } from 'react';
import { format } from 'date-fns';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { computeWaterfallFromState, WaterfallResult } from '../lib/moneyWaterfall';

/**
 * The time-ordered money waterfall (budget -> income -> Gullak) for the current user state.
 * Same engine the Home chips, the Gullak total and the expense detail use, so numbers always agree.
 */
export const useMoneyWaterfall = (): WaterfallResult => {
  const expenses = useExpenseStore((s) => s.expenses);
  const categories = useCategoryStore((s) => s.categories);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  return useMemo(
    () =>
      computeWaterfallFromState({
        expenses,
        categories,
        deposits: gullakDeposits,
        isBudgetModeEnabled,
        isAutoRenew,
        todayStr: todayKey,
        todayBudget: dailyRecords[todayKey]?.budget,
        dailyBudgetAmount,
        records: dailyRecords,
        planChanges,
      }),
    [expenses, categories, gullakDeposits, isBudgetModeEnabled, isAutoRenew, todayKey, dailyRecords, dailyBudgetAmount, planChanges]
  );
};
