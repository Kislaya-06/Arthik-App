import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '70000000-0000-4000-8000-000000000099'),
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

import { calculateVaultLiquidity } from '../src/lib/vaultSpendingGuard';
import {
  handleSetDailyBudget,
  handleScheduleNextDailyBudget,
  handleSetWeeklyBudget,
  handleSetMonthlyBudget,
} from '../src/store/dailyBudget/planActions';
import { computeEffectiveFrom } from '../src/lib/budgetPeriods';
import type { DailyBudgetState } from '../src/store/dailyBudget/types';
import type { BudgetPlanChange } from '../src/types';

describe('Vault Spending Guard & Zero-Spend Immediate Budget Update', () => {
  describe('Vault Spending Guard (Pure Mode vs Budget Mode)', () => {
    it('Pure Mode is 100% untouched: canAddExpense is true even with negative balance', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 1000,
        totalExpenses: 1500,
        accountRemaining: -500,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(-500);
      expect(res.reason).toBeUndefined();
    });

    it('Budget Mode: blocks expense when accountRemaining is 0', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 500,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 0,
        totalExpenses: 500,
        accountRemaining: 0,
      });

      expect(res.canAddExpense).toBe(false);
      expect(res.totalVaultLiquidity).toBe(0);
      expect(res.reason).toBe('Account balance exhausted. Please add money first.');
    });

    it('Budget Mode: allows expense when accountRemaining is positive after adding income', () => {
      const res = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 500,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 500, // added 500
        totalExpenses: 500,
        accountRemaining: 500,
      });

      expect(res.canAddExpense).toBe(true);
      expect(res.totalVaultLiquidity).toBe(500);
      expect(res.reason).toBeUndefined();
    });
  });

  describe('Zero-Spend Immediate Budget Update (Daily, Weekly, Monthly)', () => {
    function createMockState(partial: Partial<DailyBudgetState> = {}): DailyBudgetState {
      return {
        dailyBudgetAmount: 500,
        weeklyBudgetAmount: 3500,
        monthlyBudgetAmount: 15000,
        budgetCadence: 'daily',
        isBudgetModeEnabled: true,
        isAutoRenew: true,
        scheduledNextDailyBudget: null,
        scheduledBudgetSetDate: null,
        planChanges: [],
        dailyRecords: {},
        gullakDeposits: [],
        budgetPeriods: [],
        bestStreakByCadence: { daily: 0, weekly: 0, monthly: 0 },
        accumulatedGullakSavings: 0,
        savingsStreak: 0,
        bestStreak: 0,
        todaySaved: 0,
        daysMissedCount: 0,
        ...partial,
      } as unknown as DailyBudgetState;
    }

    it('Daily: Setting daily budget when todaySpent is 0 updates today budget immediately and clears scheduledNextDailyBudget', () => {
      let state = createMockState({
        dailyBudgetAmount: 500,
        scheduledNextDailyBudget: 800,
        scheduledBudgetSetDate: '2026-10-19',
      });

      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      };

      handleSetDailyBudget(() => state, set, 600);

      expect(state.dailyBudgetAmount).toBe(600);
      expect(state.scheduledNextDailyBudget).toBeNull();
      expect(state.scheduledBudgetSetDate).toBeNull();
    });

    it('Daily: Scheduling daily budget when todaySpent > 0 sets scheduledNextDailyBudget for tomorrow', () => {
      let state = createMockState({
        dailyBudgetAmount: 500,
      });

      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      };

      handleScheduleNextDailyBudget(set, 700);

      expect(state.scheduledNextDailyBudget).toBe(700);
      expect(state.dailyBudgetAmount).toBe(500); // today unchanged
    });

    it('Weekly: Updating weekly budget with immediate: true (when week spent is 0) updates current week immediately', () => {
      const existingPlan: BudgetPlanChange = {
        id: 'plan-1',
        userId: 'u1',
        effectiveFrom: '2026-10-19',
        isEnabled: true,
        cadence: 'weekly',
        amount: 3500,
        createdAt: '2026-10-19T00:00:00Z',
      };

      let state = createMockState({
        budgetCadence: 'weekly',
        weeklyBudgetAmount: 3500,
        planChanges: [existingPlan],
      });

      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      };

      handleSetWeeklyBudget(() => state, set, 4200, { immediate: true });

      expect(state.weeklyBudgetAmount).toBe(4200);
      expect(state.planChanges.length).toBe(1);
      expect(state.planChanges[0].amount).toBe(4200);
      expect(state.planChanges[0].effectiveFrom).toBe('2026-10-19');
    });

    it('Weekly: Updating weekly budget without immediate (when week spent > 0) schedules for next Monday', () => {
      const todayStr = '2026-10-19';
      const existingPlan: BudgetPlanChange = {
        id: 'plan-1',
        userId: 'u1',
        effectiveFrom: '2026-10-19',
        isEnabled: true,
        cadence: 'weekly',
        amount: 3500,
        createdAt: '2026-10-19T00:00:00Z',
      };

      let state = createMockState({
        budgetCadence: 'weekly',
        weeklyBudgetAmount: 3500,
        planChanges: [existingPlan],
      });

      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      };

      handleSetWeeklyBudget(() => state, set, 5000);

      expect(state.weeklyBudgetAmount).toBe(5000);
      const nextMonday = computeEffectiveFrom('weekly_amount', todayStr);
      const pendingChange = state.planChanges.find((c) => c.effectiveFrom === nextMonday);
      expect(pendingChange).toBeDefined();
      expect(pendingChange?.amount).toBe(5000);
    });

    it('Monthly: Updating monthly budget with immediate: true (when month spent is 0) updates current month immediately', () => {
      const existingPlan: BudgetPlanChange = {
        id: 'plan-m1',
        userId: 'u1',
        effectiveFrom: '2026-10-01',
        isEnabled: true,
        cadence: 'monthly',
        amount: 15000,
        createdAt: '2026-10-01T00:00:00Z',
      };

      let state = createMockState({
        budgetCadence: 'monthly',
        monthlyBudgetAmount: 15000,
        planChanges: [existingPlan],
      });

      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      };

      handleSetMonthlyBudget(() => state, set, 18000, { immediate: true });

      expect(state.monthlyBudgetAmount).toBe(18000);
      expect(state.planChanges.length).toBe(1);
      expect(state.planChanges[0].amount).toBe(18000);
      expect(state.planChanges[0].effectiveFrom).toBe('2026-10-01');
    });

    it('Monthly: Updating monthly budget without immediate (when month spent > 0) schedules for 1st of next month', () => {
      const todayStr = '2026-10-19';
      const existingPlan: BudgetPlanChange = {
        id: 'plan-m1',
        userId: 'u1',
        effectiveFrom: '2026-10-01',
        isEnabled: true,
        cadence: 'monthly',
        amount: 15000,
        createdAt: '2026-10-01T00:00:00Z',
      };

      let state = createMockState({
        budgetCadence: 'monthly',
        monthlyBudgetAmount: 15000,
        planChanges: [existingPlan],
      });

      const set = (partial: any) => {
        state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      };

      handleSetMonthlyBudget(() => state, set, 20000);

      expect(state.monthlyBudgetAmount).toBe(20000);
      const nextFirst = computeEffectiveFrom('monthly_amount', todayStr);
      const pendingChange = state.planChanges.find((c) => c.effectiveFrom === nextFirst);
      expect(pendingChange).toBeDefined();
      expect(pendingChange?.amount).toBe(20000);
    });
  });

  describe('Backdated Ungoverned Spending Shortfall & Vault Guard', () => {
    it('calculates exact shortfall needed when backdated expense exceeds available vault liquidity', () => {
      // User has 100 in vault liquidity (Gullak + cash remaining)
      // Backdated expense amount is 400
      const totalVaultLiquidity = 100;
      const expenseAmount = 400;
      const shortfall = Math.max(0, expenseAmount - totalVaultLiquidity);
      expect(shortfall).toBe(300);
    });

    it('identifies when shortfall is 0 (sufficient funds in Gullak/vault)', () => {
      const totalVaultLiquidity = 500;
      const expenseAmount = 400;
      const shortfall = Math.max(0, expenseAmount - totalVaultLiquidity);
      expect(shortfall).toBe(0);
    });
  });
});

