import { describe, it, expect } from 'vitest';
import { calculateBudgetStatus } from '../../src/money/budgetStatus';

describe('calculateBudgetStatus: left / over / ratio for one budget', () => {
  it('under budget', () => {
    expect(calculateBudgetStatus(500, 120.3333)).toEqual({
      budgetLeftUnspent: 379.67,
      amountSpentOverBudget: 0,
      isOverBudget: false,
      budgetUsedRatio: 120.33 / 500,
    });
  });

  it('over budget: nothing left, shows how far over', () => {
    const status = calculateBudgetStatus(1000, 1250.4);
    expect(status).toMatchObject({ budgetLeftUnspent: 0, amountSpentOverBudget: 250.4, isOverBudget: true, budgetUsedRatio: 1 });
  });

  it('exactly on budget is not "over"', () => {
    expect(calculateBudgetStatus(500, 500)).toMatchObject({ budgetLeftUnspent: 0, amountSpentOverBudget: 0, isOverBudget: false, budgetUsedRatio: 1 });
  });

  it('paise do not drift: 3000 budget, 2999.99 spent leaves 0.01', () => {
    expect(calculateBudgetStatus(3000, 2999.99).budgetLeftUnspent).toBe(0.01);
  });

  it('no budget: never "over", ratio 0', () => {
    expect(calculateBudgetStatus(0, 250)).toEqual({ budgetLeftUnspent: 0, amountSpentOverBudget: 0, isOverBudget: false, budgetUsedRatio: 0 });
    expect(calculateBudgetStatus(0, 0)).toEqual({ budgetLeftUnspent: 0, amountSpentOverBudget: 0, isOverBudget: false, budgetUsedRatio: 0 });
  });

  it('broken numbers become 0 instead of NaN', () => {
    expect(calculateBudgetStatus(Number.NaN, Number.NaN).budgetLeftUnspent).toBe(0);
  });
});
