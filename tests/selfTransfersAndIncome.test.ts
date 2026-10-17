import { describe, it, expect } from 'vitest';
import { normalizeTransferDescriptor, findMatchingTransferRule } from '../src/lib/transferRules';
import {
  isCountedIncome, isCountedExpense, isEligibleIncome, getTransactionClass, isExcludedFromTotals,
} from '../src/lib/transactionUtils';
import { calculateExpenseTotals, calculatePeriodSummary } from '../src/lib/homeCalculations';
import {
  computeSpentByDate, computeIncomeByDate, calculateCycleFinancials, evaluateDayStatus,
} from '../src/lib/budgetCalculations';
import { makeIncomeClassifier, makeEligibleIncomeClassifier } from '../src/lib/incomeClassifier';

const exp400: any = { id: 'e1', amount: 400, type: 'expense', expense_date: '2026-10-05' };
const salary: any = { id: 'i1', amount: 1000, type: 'income', expense_date: '2026-10-06' };
const friendBack: any = { id: 'r1', amount: 200, type: 'income', expense_date: '2026-10-06' };
const transferOut: any = { id: 't1', amount: 5000, type: 'expense', expense_date: '2026-10-06', transaction_class: 'self_transfer' };
const transferIn: any = { id: 't2', amount: 5000, type: 'income', expense_date: '2026-10-06', transaction_class: 'self_transfer' };

describe('TXN-004: repayments and refunds are plain income', () => {
  it('a friend paying back counts as income on the day it arrives, the original expense stays fully spent', () => {
    const totals = calculateExpenseTotals([exp400, friendBack, salary], {});
    expect(totals).toEqual({ totalIncome: 1200, totalSpent: 400 });
    expect(isCountedIncome(friendBack)).toBe(true);
    expect(isEligibleIncome(friendBack)).toBe(true);
    expect(computeIncomeByDate([friendBack], makeEligibleIncomeClassifier())).toEqual({ '2026-10-06': 200 });
  });

  it('a row still carrying the retired "reimbursement" class (old cache / old queue) is treated as normal income', () => {
    const legacy: any = { ...friendBack, transaction_class: 'reimbursement', reimburses_share_id: 's1' };
    expect(getTransactionClass(legacy)).toBe('normal');
    expect(isExcludedFromTotals(legacy)).toBe(false);
    expect(isCountedIncome(legacy)).toBe(true);
    expect(calculateExpenseTotals([legacy], {})).toEqual({ totalIncome: 200, totalSpent: 0 });
  });

  it('income never changes the budget pool or what is saved to Gullak (BUD-003)', () => {
    const noIncome = calculateCycleFinancials({ scheduledBudget: 100, spent: 150 });
    expect(noIncome.isOverBudget).toBe(true);
    // evaluateDayStatus ignores income on purpose: overspend is paid by the waterfall (income, then Gullak)
    expect(evaluateDayStatus(100, 150, 500)).toEqual({ saved: 0, status: 'missed' });
    const summary = calculatePeriodSummary({
      activeFilter: 'Daily', dailyBudgetAmount: 100, isAutoRenew: true, todayBudget: 100, dailyRecords: {},
      totalIncome: 50, totalSpent: 150, filtered: [], referenceDate: new Date('2026-10-06T10:00:00'),
    });
    expect(summary.periodIncome).toBe(50);
  });
});

describe('TXN-003: self-transfers', () => {
  it('a self-transfer is neither income nor expense nor budget/Gullak input', () => {
    for (const t of [transferOut, transferIn]) {
      expect(isCountedIncome(t)).toBe(false);
      expect(isCountedExpense(t)).toBe(false);
      expect(isExcludedFromTotals(t)).toBe(true);
    }
    expect(calculateExpenseTotals([transferOut, transferIn], {})).toEqual({ totalIncome: 0, totalSpent: 0 });
    expect(computeSpentByDate([transferOut, transferIn], makeIncomeClassifier())).toEqual({});
    expect(computeIncomeByDate([transferOut, transferIn], makeEligibleIncomeClassifier())).toEqual({});
  });

  it('only the structured class marks a transfer: notes and category names are never guessed', () => {
    const lookalike: any = { id: 'x', amount: 300, type: 'income', expense_date: '2026-10-06', note: 'transfer from mom -> to bank' };
    expect(isEligibleIncome(lookalike, { name: 'Self transfer' })).toBe(true);
    expect(isCountedIncome(lookalike)).toBe(true);
    const spend: any = { id: 'y', amount: 300, type: 'expense', expense_date: '2026-10-06', note: 'credit card bill' };
    expect(isCountedExpense(spend)).toBe(true);
  });

  it('remembered transfer rules are narrow: descriptor based, never amount based', () => {
    expect(normalizeTransferDescriptor('₹5000')).toBeNull();
    expect(normalizeTransferDescriptor('5000')).toBeNull();
    expect(normalizeTransferDescriptor('abc')).toBeNull();
    const d = normalizeTransferDescriptor('HDFC → SBI savings');
    expect(d).toBe('hdfc sbi savings');
    const rules = [{ id: 'r', user_id: 'u', descriptor: d as string }];
    expect(findMatchingTransferRule(rules, 'hdfc sbi  SAVINGS')?.id).toBe('r');
    expect(findMatchingTransferRule(rules, 'Zomato dinner')).toBeNull();
    expect(findMatchingTransferRule(rules, '')).toBeNull();
  });
});

describe('TXN-001: direction comes from the explicit type', () => {
  it('type wins over any category keyword', () => {
    expect(isCountedIncome({ type: 'expense' }, { name: 'Salary' })).toBe(false);
    expect(isCountedExpense({ type: 'expense' }, { name: 'Salary' })).toBe(true);
    expect(isCountedIncome({ type: 'income' }, { name: 'Groceries' })).toBe(true);
  });
});
