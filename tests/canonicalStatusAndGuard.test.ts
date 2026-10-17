import { describe, it, expect } from 'vitest';
import { normalizeLegacyRecordStatuses } from '../src/store/dailyBudget/legacyStatus';
import { calculateCycleFinancials, evaluateDayStatus } from '../src/lib/budgetCalculations';
import { calculateVaultLiquidity, VAULT_GUARD_MESSAGE } from '../src/lib/vaultSpendingGuard';

describe('BUD-008: one status vocabulary', () => {
  it("an overspend is 'missed' everywhere (never 'exceeded')", () => {
    expect(calculateCycleFinancials({ scheduledBudget: 100, spent: 150 }).status).toBe('missed');
    expect(evaluateDayStatus(100, 150)).toEqual({ saved: 0, status: 'missed' });
  });

  it("cached days from older versions with 'exceeded' are read as 'missed'; everything else is untouched", () => {
    const old: any = {
      '2026-10-01': { date: '2026-10-01', budget: 500, spent: 700, saved: 0, isFinalized: true, status: 'exceeded' },
      '2026-10-02': { date: '2026-10-02', budget: 500, spent: 100, saved: 400, isFinalized: true, status: 'saved' },
      '2026-10-03': { date: '2026-10-03', budget: 0, spent: 0, saved: 0, isFinalized: true, status: 'unknown' },
    };
    const fixed = normalizeLegacyRecordStatuses(old);
    expect(fixed['2026-10-01']).toMatchObject({ status: 'missed', spent: 700, budget: 500 });
    expect(fixed['2026-10-02']).toBe(old['2026-10-02']);
    expect(fixed['2026-10-03']).toBe(old['2026-10-03']);
    expect(normalizeLegacyRecordStatuses(undefined)).toEqual({});
  });
});

describe('SEC-001: spending guard (amended)', () => {
  it('blocks spending with canonical message in Budget Mode when account has no money, allows in Pure Mode', () => {
    const pure = calculateVaultLiquidity({
      isBudgetModeEnabled: false, budgetCadence: 'daily', dailyBudgetAmount: 0, weeklyBudgetAmount: 0, monthlyBudgetAmount: 0,
      totalIncome: 0, totalExpenses: 0,
    });
    expect(pure.canAddExpense).toBe(true);
    expect(pure.reason).toBeUndefined();

    const budget = calculateVaultLiquidity({
      isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 500, weeklyBudgetAmount: 0, monthlyBudgetAmount: 0,
      totalIncome: 0, totalExpenses: 0, accountRemaining: 0,
    });
    expect(budget.canAddExpense).toBe(false);
    expect(budget.reason).toBe(VAULT_GUARD_MESSAGE);
    expect(VAULT_GUARD_MESSAGE).toBe('Account balance exhausted. Please add money first.');
  });

  it('allows overspending beyond the allowance while real money remains', () => {
    const r = calculateVaultLiquidity({
      isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 100, weeklyBudgetAmount: 0, monthlyBudgetAmount: 0,
      totalIncome: 1000, totalExpenses: 0, accountRemaining: 1100,
    });
    expect(r.canAddExpense).toBe(true);
    expect(r.reason).toBeUndefined();
  });
});
