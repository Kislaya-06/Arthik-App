import { useMemo } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import type { MoneySnapshot } from '../money/scopeMoney';

/** The store data `heroMoney` / `allowanceCardMoney` read, as the same objects the stores hold (ADR 0022). */
export function useMoneySnapshot(): MoneySnapshot {
  const expenses = useExpenseStore((s) => s.expenses);
  const categories = useCategoryStore((s) => s.categories);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);

  return useMemo(
    () => ({
      expenses, categories, gullakDeposits, dailyRecords, planChanges, budgetPeriods,
      dailyBudgetAmount, isAutoRenew, isBudgetModeEnabled, budgetCadence, totalAccumulatedSavings,
    }),
    [expenses, categories, gullakDeposits, dailyRecords, planChanges, budgetPeriods,
      dailyBudgetAmount, isAutoRenew, isBudgetModeEnabled, budgetCadence, totalAccumulatedSavings]
  );
}
