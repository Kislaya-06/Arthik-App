import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react-native', () => {
  const baseIcons: Record<string, any> = {
    Wallet: () => null,
    CreditCard: () => null,
    CheckSquare: () => null,
    HelpCircle: () => null,
    Utensils: () => null,
  };

  return new Proxy(baseIcons, {
    has: () => true,
    get: (target, prop: string) => {
      if (typeof prop === 'string' && prop in target) {
        return target[prop];
      }
      return undefined;
    },
  });
});

import {
  getPaymentIcon,
  getPaymentLabel,
  DEFAULT_INCOME_KEYWORDS,
  isIncomeTransaction,
  PaymentMode,
} from '../src/lib/paymentUtils';
import { getCategoryIcon } from '../src/lib/iconUtils';
import * as LucideIcons from 'lucide-react-native';

describe('paymentUtils & iconUtils (Category 3 Helpers)', () => {
  describe('Slice 1: Payment Mode Labels & Icons', () => {
    it('returns correct label for each payment mode', () => {
      expect(getPaymentLabel('cash')).toBe('Cash');
      expect(getPaymentLabel('card')).toBe('Card');
      expect(getPaymentLabel('upi')).toBe('UPI');
    });

    it('returns corresponding Lucide icon component for each mode', () => {
      expect(getPaymentIcon('cash')).toBe(LucideIcons.Wallet);
      expect(getPaymentIcon('card')).toBe(LucideIcons.CreditCard);
      expect(getPaymentIcon('upi')).toBe(LucideIcons.CheckSquare);
    });
  });

  describe('Slice 2: Income Transaction Classification', () => {
    it('prioritizes explicit type="income" over category name', () => {
      const tx = { type: 'income' };
      const cat = { name: 'Food & Drinks' }; // Expense category
      expect(isIncomeTransaction(tx, cat)).toBe(true);
    });

    it('prioritizes explicit type="expense" even if category contains income keywords', () => {
      const tx = { type: 'expense' };
      const cat = { name: 'Salary Processing Fee' };
      expect(isIncomeTransaction(tx, cat)).toBe(false);
    });

    it('falls back to category keyword match for legacy transactions without explicit type', () => {
      expect(isIncomeTransaction(null, { name: 'Monthly Salary' })).toBe(true);
      expect(isIncomeTransaction({}, { name: 'Freelance Design' })).toBe(true);
      expect(isIncomeTransaction(undefined, { name: 'Stock Dividend' })).toBe(true);
      expect(isIncomeTransaction(undefined, { name: 'Diwali Bonus' })).toBe(true);
      expect(isIncomeTransaction(undefined, { name: 'Rental Property' })).toBe(true);
    });

    it('matches keywords case-insensitively', () => {
      expect(isIncomeTransaction({}, { name: 'POCKET MONEY' })).toBe(true);
      expect(isIncomeTransaction({}, { name: 'cAsHbAcK' })).toBe(true);
    });

    it('returns false for expense categories without income keywords', () => {
      expect(isIncomeTransaction(null, { name: 'Groceries' })).toBe(false);
      expect(isIncomeTransaction(null, { name: 'Uber Ride' })).toBe(false);
      expect(isIncomeTransaction(null, { name: 'Electricity Bill' })).toBe(false);
    });

    it('safely returns false for null or undefined inputs', () => {
      expect(isIncomeTransaction(null, null)).toBe(false);
      expect(isIncomeTransaction(undefined, undefined)).toBe(false);
      expect(isIncomeTransaction({}, null)).toBe(false);
    });
  });

  describe('Slice 3: Icon Resolution Fallback (iconUtils)', () => {
    it('returns matching icon component for known icon names', () => {
      expect(getCategoryIcon('Utensils')).toBe(LucideIcons.Utensils);
    });

    it('falls back to HelpCircle for unknown or misspelled icon names', () => {
      expect(getCategoryIcon('NonExistentIconXYZ')).toBe(LucideIcons.HelpCircle);
      expect(getCategoryIcon('')).toBe(LucideIcons.HelpCircle);
    });
  });
});
