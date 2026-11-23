import { describe, it, expect, vi } from 'vitest';

const { baseIcons } = vi.hoisted(() => {
  const baseIcons: Record<string, any> = {
    Wallet: () => null,
    CreditCard: () => null,
    CheckSquare: () => null,
    HelpCircle: () => null,
    Utensils: () => null,
  };
  return { baseIcons };
});

vi.mock('lucide-react-native', () => {
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

vi.mock('lucide-react-native/icons/wallet', () => ({ default: baseIcons.Wallet }));
vi.mock('lucide-react-native/icons/credit-card', () => ({ default: baseIcons.CreditCard }));
vi.mock('lucide-react-native/icons/square-check-big', () => ({ default: baseIcons.CheckSquare }));

import {
  getPaymentIcon,
  getPaymentLabel,
} from '../src/lib/paymentUtils';
import { isIncomeTransaction } from '../src/lib/transactionUtils';
import { getCategoryIcon } from '../src/lib/iconUtils';
import { CATEGORY_ICONS } from '../src/lib/categoryIconRegistry';
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
    it('type="income" is income, type="expense" is not (TXN-001)', () => {
      expect(isIncomeTransaction({ type: 'income' })).toBe(true);
      expect(isIncomeTransaction({ type: 'expense' })).toBe(false);
    });

    it('safely returns false for null or undefined inputs', () => {
      expect(isIncomeTransaction(null)).toBe(false);
      expect(isIncomeTransaction(undefined)).toBe(false);
      expect(isIncomeTransaction({})).toBe(false);
    });
  });

  describe('Slice 3: Icon Resolution Fallback (iconUtils)', () => {
    it('returns matching icon component for known icon names', () => {
      expect(getCategoryIcon('Utensils')).toBe(CATEGORY_ICONS.Utensils);
    });

    it('falls back to HelpCircle for unknown or misspelled icon names', () => {
      expect(getCategoryIcon('NonExistentIconXYZ')).toBe(CATEGORY_ICONS.HelpCircle);
      expect(getCategoryIcon('')).toBe(CATEGORY_ICONS.HelpCircle);
    });
  });
});
