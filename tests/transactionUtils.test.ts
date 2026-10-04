import { describe, it, expect } from 'vitest';
import { DEFAULT_INCOME_KEYWORDS, isIncomeTransaction } from '../src/lib/transactionUtils';

describe('isIncomeTransaction (the single source of truth for "is this income?")', () => {
  describe('the explicit type always wins', () => {
    it('type "income" is income, whatever the category says', () => {
      expect(isIncomeTransaction({ type: 'income' }, { name: 'Food & Drinks' })).toBe(true);
      expect(isIncomeTransaction({ type: 'income' }, undefined)).toBe(true);
      expect(isIncomeTransaction({ type: 'income' }, null)).toBe(true);
    });

    it('type "expense" is never income, even in a category named like income', () => {
      expect(isIncomeTransaction({ type: 'expense' }, { name: 'Salary' })).toBe(false);
      expect(isIncomeTransaction({ type: 'expense' }, { name: 'Refund' })).toBe(false);
      expect(isIncomeTransaction({ type: 'expense' }, undefined)).toBe(false);
    });
  });

  describe('legacy rows without a type fall back to the category name', () => {
    it.each(DEFAULT_INCOME_KEYWORDS)('category containing "%s" is income', (kw) => {
      expect(isIncomeTransaction({}, { name: `My ${kw} account` })).toBe(true);
    });

    it('matching ignores upper / lower case', () => {
      expect(isIncomeTransaction({}, { name: 'SALARY' })).toBe(true);
      expect(isIncomeTransaction({}, { name: 'Pocket Money' })).toBe(true);
    });

    it('normal spending categories are not income', () => {
      for (const name of ['Food & Drinks', 'Transport', 'Shopping', 'Health', 'Bills & Utilities', 'Entertainment']) {
        expect(isIncomeTransaction({}, { name })).toBe(false);
      }
    });

    it('no type and no category name means "not income" (safe default)', () => {
      expect(isIncomeTransaction({}, undefined)).toBe(false);
      expect(isIncomeTransaction({}, {})).toBe(false);
      expect(isIncomeTransaction({}, { name: '' })).toBe(false);
      expect(isIncomeTransaction(undefined, undefined)).toBe(false);
      expect(isIncomeTransaction(null, null)).toBe(false);
    });

    it('an unknown type string behaves like "no type" (falls back to the category)', () => {
      expect(isIncomeTransaction({ type: 'weird' }, { name: 'Salary' })).toBe(true);
      expect(isIncomeTransaction({ type: 'weird' }, { name: 'Transport' })).toBe(false);
    });
  });

  it('keywords are lower case, trimmed and unique (a typo here silently breaks income detection)', () => {
    expect(new Set(DEFAULT_INCOME_KEYWORDS).size).toBe(DEFAULT_INCOME_KEYWORDS.length);
    for (const kw of DEFAULT_INCOME_KEYWORDS) {
      expect(kw).toBe(kw.toLowerCase().trim());
      expect(kw.length).toBeGreaterThan(2);
    }
  });
});
