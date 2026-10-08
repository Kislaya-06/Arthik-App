import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INCOME_KEYWORDS,
  isIncomeTransaction,
  isInternalTransfer,
  isEligibleIncome,
  isReimbursement,
} from '../src/lib/transactionUtils';

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

  describe('isInternalTransfer - Exclude transfers between user accounts', () => {
    it('detects internal transfer by category name', () => {
      expect(isInternalTransfer({}, { name: 'Transfer' })).toBe(true);
      expect(isInternalTransfer({}, { name: 'Self Transfer' })).toBe(true);
      expect(isInternalTransfer({}, { name: 'Account Transfer' })).toBe(true);
      expect(isInternalTransfer({}, { name: 'Card Bill Payment' })).toBe(true);
      expect(isInternalTransfer({}, { name: 'Credit Card Bill' })).toBe(true);
    });

    it('detects internal transfer by note / description', () => {
      expect(isInternalTransfer({ note: 'Self transfer to SBI account' }, { name: 'Others' })).toBe(true);
      expect(isInternalTransfer({ note: 'Bank A -> Bank B' }, undefined)).toBe(true);
      expect(isInternalTransfer({ note: 'Credit card bill paid' }, undefined)).toBe(true);
    });

    it('detects internal transfer by status or type', () => {
      expect(isInternalTransfer({ status: 'transfer' }, { name: 'Others' })).toBe(true);
      expect(isInternalTransfer({ type: 'transfer' }, { name: 'Others' })).toBe(true);
    });

    it('normal categories and income are not internal transfers', () => {
      expect(isInternalTransfer({ type: 'income' }, { name: 'Salary' })).toBe(false);
      expect(isInternalTransfer({ type: 'income' }, { name: 'Freelance' })).toBe(false);
      expect(isInternalTransfer({ type: 'expense' }, { name: 'Food & Drinks' })).toBe(false);
      expect(isInternalTransfer({ type: 'income' }, { name: 'Refund' })).toBe(false);
    });
  });

  describe('isEligibleIncome - Exclude internal transfers from spendable income', () => {
    it('genuine salary, freelance, refund, gift are eligible income', () => {
      expect(isEligibleIncome({ type: 'income' }, { name: 'Salary' })).toBe(true);
      expect(isEligibleIncome({ type: 'income' }, { name: 'Freelance' })).toBe(true);
      expect(isEligibleIncome({ type: 'income' }, { name: 'Refund' })).toBe(true);
      expect(isEligibleIncome({ type: 'income' }, { name: 'Gift' })).toBe(true);
      expect(isEligibleIncome({}, { name: 'Salary' })).toBe(true);
    });

    it('internal transfers are NOT eligible income (Spec §2)', () => {
      // Bank A -> Bank B 5,000 must NOT increase spendable income
      expect(isEligibleIncome({ type: 'income' }, { name: 'Self Transfer' })).toBe(false);
      expect(isEligibleIncome({ type: 'income', note: 'Transfer between own accounts' }, { name: 'Transfer' })).toBe(false);
      expect(isEligibleIncome({ status: 'transfer' }, { name: 'Others' })).toBe(false);
    });

    it('regular expenses are not eligible income', () => {
      expect(isEligibleIncome({ type: 'expense' }, { name: 'Food & Drinks' })).toBe(false);
      expect(isEligibleIncome({ type: 'expense' }, { name: 'Transport' })).toBe(false);
    });
  });

  describe('isReimbursement - Detect refund / friend repayments', () => {
    it('detects reimbursement by category or note', () => {
      expect(isReimbursement({ type: 'income' }, { name: 'Refund' })).toBe(true);
      expect(isReimbursement({ type: 'income' }, { name: 'Reimbursement' })).toBe(true);
      expect(isReimbursement({ type: 'income', note: 'Rahul paid back auto share' }, { name: 'Others' })).toBe(true);
      expect(isReimbursement({ note: 'Amazon refund for shoes' }, undefined)).toBe(true);
    });

    it('general salary is not a reimbursement', () => {
      expect(isReimbursement({ type: 'income' }, { name: 'Salary' })).toBe(false);
      expect(isReimbursement({ type: 'expense' }, { name: 'Transport' })).toBe(false);
    });
  });
});
