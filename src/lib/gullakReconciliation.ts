import { round2 } from './formatters';
import { Expense } from '../store/expense/types';
import { GullakDeposit } from '../store/dailyBudget/types';

export interface GullakDeficitParams {
  dateStr: string;
  expenseId: string;
  newAmount: number; // 0 if deleting or converting to non-income
  expenses: Expense[];
  gullakDeposits: GullakDeposit[];
}

/**
 * FIN-06 (UNCOVERED-01): Calculates how much Gullak savings on a specific date will lose their
 * income backing if an income entry is deleted or reduced.
 *
 * Real Money Invariant:
 *  - If remaining income on that date >= total income-funded Gullak deposits on that date, deficit is 0.
 *  - If remaining income < total income-funded Gullak deposits, deficit is (totalDeposits - remainingIncome).
 */
export function calculateGullakIncomeDeficit(params: GullakDeficitParams): number {
  const { dateStr, expenseId, newAmount, expenses, gullakDeposits } = params;
  if (!dateStr) return 0;

  const depositsOnDate = (gullakDeposits || []).filter(
    (d) => d.source === 'income' && d.date?.split('T')[0]?.trim() === dateStr
  );
  const totalGullakOnDate = round2(depositsOnDate.reduce((sum, d) => sum + d.amount, 0));
  if (totalGullakOnDate <= 0) return 0;

  const otherIncomeOnDate = round2(
    (expenses || [])
      .filter(
        (e) =>
          e.id !== expenseId &&
          e.type === 'income' &&
          e.expense_date?.split('T')[0]?.trim() === dateStr
      )
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const totalNewIncomeOnDate = round2(otherIncomeOnDate + Math.max(0, newAmount));
  if (totalNewIncomeOnDate >= totalGullakOnDate) return 0;

  return round2(totalGullakOnDate - totalNewIncomeOnDate);
}
