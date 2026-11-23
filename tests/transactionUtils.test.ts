import { describe, it, expect } from 'vitest';
import {
  isIncomeTransaction,
  isCountedIncome,
  isCountedExpense,
  classifyTransaction,
} from '../src/lib/transactionUtils';

describe('isIncomeTransaction (the single source of truth for "is this incoming money?")', () => {
  it('TXN-001: type "income" is income', () => {
    expect(isIncomeTransaction({ type: 'income' })).toBe(true);
  });

  it('TXN-001: type "expense" is never income', () => {
    expect(isIncomeTransaction({ type: 'expense' })).toBe(false);
  });

  it('TXN-002 retired (ADR 0023): a row without a type is an expense, like the database default', () => {
    expect(isIncomeTransaction({})).toBe(false);
    expect(isIncomeTransaction({ type: 'weird' })).toBe(false);
    expect(isIncomeTransaction(undefined)).toBe(false);
    expect(isIncomeTransaction(null)).toBe(false);
    expect(classifyTransaction({})).toBe('spending');
  });
});

describe('isCountedIncome - excludes internal transfers and money back from income', () => {
  it('a normal income row is counted income', () => {
    expect(isCountedIncome({ type: 'income' })).toBe(true);
  });

  it('internal transfers are NOT income (TXN-003): only the structured class decides', () => {
    // Bank A -> Bank B 5,000 must NOT increase spendable income
    expect(isCountedIncome({ type: 'income', transaction_class: 'self_transfer' })).toBe(false);
  });

  it('money back is never income (SPL-003)', () => {
    expect(isCountedIncome({ type: 'income', transaction_class: 'recovery' })).toBe(false);
  });

  it('regular expenses are not income, and are counted spending', () => {
    expect(isCountedIncome({ type: 'expense' })).toBe(false);
    expect(isCountedExpense({ type: 'expense' })).toBe(true);
  });
});
