import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '70000000-0000-4000-8000-000000000001'),
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: vi.fn(),
}));

vi.mock('../src/lib/budgetAlerts', () => ({
  notifyLimit: vi.fn(),
  notifyBudgetResumed: vi.fn(),
  notifyBudgetUpdated: vi.fn(),
  notifyRollover: vi.fn(),
  notifyPurePeriodEnded: vi.fn(),
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
    })),
  },
}));

import {
  resolvePendingPlanChange,
  resolveEffectiveFromLabel,
} from '../src/store/dailyBudget/planActions';
import {
  computeCarryableAmount,
  computeGrossIncomeBalance,
} from '../src/store/dailyBudget/metrics';
import type { BudgetPlanChange } from '../src/types';
import type { DailyBudgetState, GullakDeposit } from '../src/store/dailyBudget/types';
import type { Expense } from '../src/store/expense/types';

describe('dailyBudget planActions & metrics helpers', () => {
  describe('resolvePendingPlanChange', () => {
    it('returns null if planChanges is undefined or empty', () => {
      expect(resolvePendingPlanChange(undefined, '2026-03-15')).toBeNull();
      expect(resolvePendingPlanChange([], '2026-03-15')).toBeNull();
    });

    it('returns null if all changes are in the past or today', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: '1',
          userId: 'u1',
          effectiveFrom: '2026-03-10',
          isEnabled: true,
          cadence: 'daily',
          amount: 200,
          createdAt: '2026-03-10T00:00:00Z',
        },
        {
          id: '2',
          userId: 'u1',
          effectiveFrom: '2026-03-15',
          isEnabled: true,
          cadence: 'weekly',
          amount: 1500,
          createdAt: '2026-03-15T00:00:00Z',
        },
      ];
      expect(resolvePendingPlanChange(changes, '2026-03-15')).toBeNull();
    });

    it('returns the earliest future plan change when multiple future changes exist', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: 'later',
          userId: 'u1',
          effectiveFrom: '2026-03-25',
          isEnabled: true,
          cadence: 'monthly',
          amount: 5000,
          createdAt: '2026-03-15T00:00:00Z',
        },
        {
          id: 'earliest',
          userId: 'u1',
          effectiveFrom: '2026-03-16',
          isEnabled: true,
          cadence: 'daily',
          amount: 300,
          createdAt: '2026-03-15T00:00:00Z',
        },
        {
          id: 'past',
          userId: 'u1',
          effectiveFrom: '2026-03-10',
          isEnabled: true,
          cadence: 'daily',
          amount: 200,
          createdAt: '2026-03-10T00:00:00Z',
        },
      ];
      const result = resolvePendingPlanChange(changes, '2026-03-15');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('earliest');
      expect(result?.effectiveFrom).toBe('2026-03-16');
    });
  });

  describe('resolveEffectiveFromLabel', () => {
    it('returns empty string if target is null', () => {
      expect(resolveEffectiveFromLabel(null, '2026-03-15')).toBe('');
    });

    it('formats effective from label for tomorrow', () => {
      const change: BudgetPlanChange = {
        id: '1',
        userId: 'u1',
        effectiveFrom: '2026-03-16',
        isEnabled: true,
        cadence: 'daily',
        amount: 500,
        createdAt: '2026-03-15T00:00:00Z',
      };
      const label = resolveEffectiveFromLabel(change, '2026-03-15');
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
    });
  });

  describe('computeCarryableAmount', () => {
    it('returns 0 when budget mode is disabled (Pure Mode)', () => {
      const mockState = {
        isBudgetModeEnabled: false,
        planChanges: [],
      } as unknown as DailyBudgetState;
      expect(computeCarryableAmount(mockState)).toBe(0);
    });

    it('returns 0 when plan changes list is empty', () => {
      const mockState = {
        isBudgetModeEnabled: true,
        planChanges: [],
      } as unknown as DailyBudgetState;
      expect(computeCarryableAmount(mockState)).toBe(0);
    });
  });

  describe('computeGrossIncomeBalance', () => {
    it('calculates total income minus income-sourced deposits', () => {
      const deposits: GullakDeposit[] = [
        {
          id: 'd1',
          amount: 300,
          date: '2026-03-15',
          source: 'income',
          created_at: '2026-03-15T10:00:00Z',
        },
        {
          id: 'd2',
          amount: 200,
          date: '2026-03-15',
          source: 'external',
          created_at: '2026-03-15T11:00:00Z',
        },
      ];
      const expenses: Expense[] = [
        {
          id: 'e1',
          amount: 1000,
          expense_date: '2026-03-15',
          type: 'income',
        } as unknown as Expense,
        {
          id: 'e2',
          amount: 250,
          expense_date: '2026-03-15',
          type: 'expense',
        } as unknown as Expense,
      ];
      // total income = 1000, incomeDeposits = 300 (external 200 ignored) => remaining = 700
      const balance = computeGrossIncomeBalance(deposits, expenses);
      expect(balance).toBe(700);
    });

    it('returns 0 when income deposits equal or exceed income', () => {
      const deposits: GullakDeposit[] = [
        {
          id: 'd1',
          amount: 1200,
          date: '2026-03-15',
          source: 'income',
          created_at: '2026-03-15T10:00:00Z',
        },
      ];
      const expenses: Expense[] = [
        {
          id: 'e1',
          amount: 1000,
          expense_date: '2026-03-15',
          type: 'income',
        } as unknown as Expense,
      ];
      expect(computeGrossIncomeBalance(deposits, expenses)).toBe(0);
    });
  });
});
