import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Appearance: {
    getColorScheme: vi.fn(() => 'light'),
    addChangeListener: vi.fn(),
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
      },
    },
  },
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '50000000-0000-4000-8000-000000000001'),
}));

vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { id: 'test_user', created_at: '2026-10-20T00:00:00Z' },
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn().mockReturnValue(Promise.resolve({ error: null })) })),
      upsert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
    })),
  },
}));

import { selfHealDefaultBudget, selfHealCorruptedRows } from '../src/store/dailyBudget/selfHealing';
import type { DailyRecord } from '../src/lib/budgetCalculations';
import type { BudgetPlanChange } from '../src/types';

describe('selfHealing engine', () => {
  describe('selfHealDefaultBudget', () => {
    it('handles ISO timestamp for userCreatedAtStr without skipping join date log', () => {
      const logsData = [
        {
          date: '2026-10-23',
          budget_amount: 350,
          amount_saved: 100,
          spent_amount: 250,
          status: 'saved',
        },
      ];
      const records: Record<string, DailyRecord> = {};
      const resolved = selfHealDefaultBudget({
        resolvedBudget: 500, // Looked like migration default
        remoteBudgetWasMigrationDefault: true,
        logsData,
        userCreatedAtStr: '2026-10-23T15:30:00.000Z', // ISO string
        spentByDate: { '2026-10-23': 250 },
        records,
        userId: 'test_user_iso',
      });

      // Should recognize the 350 budget candidate and not skip 2026-10-23
      expect(resolved).toBe(350);
    });
  });

  describe('selfHealCorruptedRows', () => {
    it('handles ISO timestamp for userCreatedAtStr without skipping join date log', () => {
      const logsData = [
        {
          date: '2026-10-23',
          budget_amount: 300,
          amount_saved: 200,
          spent_amount: 100,
          status: 'saved',
        },
      ];
      const records: Record<string, DailyRecord> = {};
      const planChanges: BudgetPlanChange[] = [
        {
          id: 'pc1',
          userId: 'test_user',
          effectiveFrom: '2026-10-23',
          isEnabled: true,
          cadence: 'daily',
          amount: 300,
        },
      ];

      selfHealCorruptedRows({
        logsData,
        userCreatedAtStr: '2026-10-23T18:45:00.000Z',
        spentByDate: { '2026-10-23': 100 },
        resolvedPlanChanges: planChanges,
        resolvedBudget: 300,
        records,
        incomeByDate: {},
        userId: 'test_user',
        expensesLoaded: true,
      });

      // Record for 2026-10-23 must exist and not be skipped as "pre-registration"
      expect(records['2026-10-23']).toBeDefined();
      expect(records['2026-10-23'].budget).toBe(300);
      expect(records['2026-10-23'].spent).toBe(100);
      expect(records['2026-10-23'].saved).toBe(200);
      expect(records['2026-10-23'].status).toBe('saved');
    });

    it('prioritizes actual spentByDate over stale remote log.spent_amount when expenses are loaded (e.g. after expense deletion)', () => {
      // Remote log still thinks user spent 200, but expense was deleted, so spentByDate is 0 (or undefined)
      const logsData = [
        {
          date: '2026-10-24',
          budget_amount: 300,
          amount_saved: 100,
          spent_amount: 200, // stale remote value
          status: 'saved',
        },
      ];
      const records: Record<string, DailyRecord> = {};
      const planChanges: BudgetPlanChange[] = [
        {
          id: 'pc1',
          userId: 'test_user',
          effectiveFrom: '2026-10-20',
          isEnabled: true,
          cadence: 'daily',
          amount: 300,
        },
      ];

      // When expenses are loaded and empty for that date, spent is 0
      selfHealCorruptedRows({
        logsData,
        userCreatedAtStr: '2026-10-20',
        spentByDate: {}, // user deleted the 200 expense!
        resolvedPlanChanges: planChanges,
        resolvedBudget: 300,
        records,
        incomeByDate: {},
        userId: 'test_user',
        expensesLoaded: true, // Ground truth expenses are loaded
      });

      expect(records['2026-10-24']).toBeDefined();
      expect(records['2026-10-24'].spent).toBe(0);
      // Entire 300 budget is saved now that the expense was deleted!
      expect(records['2026-10-24'].saved).toBe(300);
      expect(records['2026-10-24'].status).toBe('saved');
    });

    it('updates spent to live reduced amount when expense was partially paid back or reduced', () => {
      const logsData = [
        {
          date: '2026-10-24',
          budget_amount: 500,
          amount_saved: 0,
          spent_amount: 600, // stale overspent log
          status: 'missed',
        },
      ];
      const records: Record<string, DailyRecord> = {};
      const planChanges: BudgetPlanChange[] = [
        {
          id: 'pc1',
          userId: 'test_user',
          effectiveFrom: '2026-10-20',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
        },
      ];

      // Money back came in, reducing net spent from 600 to 200
      selfHealCorruptedRows({
        logsData,
        userCreatedAtStr: '2026-10-20',
        spentByDate: { '2026-10-24': 200 },
        resolvedPlanChanges: planChanges,
        resolvedBudget: 500,
        records,
        incomeByDate: {},
        userId: 'test_user',
        expensesLoaded: true,
      });

      expect(records['2026-10-24']).toBeDefined();
      expect(records['2026-10-24'].spent).toBe(200);
      // Saved is now 500 - 200 = 300, status is saved
      expect(records['2026-10-24'].saved).toBe(300);
      expect(records['2026-10-24'].status).toBe('saved');
    });
  });
});
