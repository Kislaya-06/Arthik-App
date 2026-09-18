import { Expense } from '../store/expenseStore';
import { isDateInPeriod, FilterPeriod } from './dateFilters';

export const FILTERS = ['All', 'Daily', 'Weekly', 'Monthly'] as const;
export type Filter = (typeof FILTERS)[number];

const filterToPeriodMap: Record<'Daily' | 'Weekly' | 'Monthly', FilterPeriod> = {
  Daily: 'day',
  Weekly: 'week',
  Monthly: 'month',
};

/**
 * Pure filter for expenses based on a time filter, reference date, and registration date boundary.
 * Uses isDateInPeriod for Daily, Weekly, and Monthly boundary evaluations.
 */
export const filterExpenses = (
  expenses: Expense[],
  filter: Filter,
  referenceDate: Date,
  userCreatedAtStr?: string
): Expense[] => {
  if (filter === 'All') {
    if (!userCreatedAtStr) return expenses;
    return expenses.filter((e) => {
      const cleanDate = e.expense_date?.split('T')[0]?.trim();
      return !cleanDate || cleanDate >= userCreatedAtStr;
    });
  }

  const period = filterToPeriodMap[filter];
  return expenses.filter((e) =>
    isDateInPeriod(e.expense_date, period, referenceDate, userCreatedAtStr)
  );
};
