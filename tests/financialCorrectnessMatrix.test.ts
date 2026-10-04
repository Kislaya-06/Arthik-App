import { describe, it, expect } from 'vitest';
import {
  getPeriodBounds,
  upsertPendingChange,
  buildPeriodsToFinalize,
  getCurrentPeriodSummary,
} from '../src/lib/budgetPeriods';
import {
  checkCadenceCapacity,
  buildCadenceSwitchPlan,
} from '../src/lib/cadenceSwitch';
import { calculateVaultLiquidity } from '../src/lib/vaultSpendingGuard';
import { getUnproratedPacingPreview } from '../src/lib/budgetModeUtils';
import { evaluateDayStatus, computeSpentByDate } from '../src/lib/budgetCalculations';
import { BudgetPlanChange } from '../src/types';

describe('Financial Correctness Scenario Matrix', () => {
  // =========================================================================
  // SCENARIO 1: Mid-Week Start with Zero Proration (Wednesday Start)
  // =========================================================================
  describe('Scenario 1: Mid-Week Start with Zero Proration', () => {
    it('allocates 100% full budget without day-fraction reduction and computes non-binding pace', () => {
      const todayStr = '2026-10-07'; // Wednesday
      const weeklyAmount = 7000;

      // 1. Pacing Preview
      const preview = getUnproratedPacingPreview('weekly', weeklyAmount, todayStr, todayStr);
      expect(preview).not.toBeNull();
      // Wed, Thu, Fri, Sat, Sun = 5 days remaining
      expect(preview?.remainingDays).toBe(5);
      expect(preview?.fullBudget).toBe(7000);
      expect(preview?.isProrated).toBe(false);
      // Suggested pace = 7000 / 5 = 1400/day
      expect(preview?.suggestedDailyPace).toBe(1400);

      // 2. Plan Change
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: todayStr,
          isEnabled: true,
          cadence: 'weekly',
          amount: weeklyAmount,
          createdAt: todayStr,
        },
      ];

      // 3. Live Period Summary
      const summary = getCurrentPeriodSummary(changes, { '2026-10-07': 1000 }, todayStr);
      expect(summary).not.toBeNull();
      expect(summary?.budget).toBe(7000); // 100% unprorated
      expect(summary?.spent).toBe(1000);
      expect(summary?.remaining).toBe(6000);
      expect(summary?.suggestedDailyPace).toBe(1200); // 6000 / 5 days = 1200
    });
  });

  // =========================================================================
  // SCENARIO 2: Mid-Month Start in Leap Year (Feb 15, 2028)
  // =========================================================================
  describe('Scenario 2: Mid-Month Start in Leap Year (Feb 15, 2028)', () => {
    it('correctly handles 29-day leap February and allocates full budget', () => {
      const todayStr = '2028-02-15';
      const monthlyAmount = 28000;

      // Bounds check for leap Feb
      const bounds = getPeriodBounds('monthly', todayStr);
      expect(bounds).toEqual({
        start: '2028-02-01',
        end: '2028-02-29',
        totalDays: 29,
      });

      // Preview check: Feb 15 to Feb 29 = 15 days remaining
      const preview = getUnproratedPacingPreview('monthly', monthlyAmount, todayStr, todayStr);
      expect(preview?.remainingDays).toBe(15);
      expect(preview?.fullBudget).toBe(28000);
      expect(preview?.suggestedDailyPace).toBe(Math.round(28000 / 15)); // 1867/day
    });
  });

  // =========================================================================
  // SCENARIO 3: Normal Weekly Cycle Completion (Sunday Midnight Rollover)
  // =========================================================================
  describe('Scenario 3: Normal Weekly Cycle Completion', () => {
    it('deposits remaining eligible unspent budget into Gullak at natural cycle end', () => {
      // Week: Mon 2026-10-05 to Sun 2026-10-11
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-10-05',
        },
      ];

      // User spends 600 each day for 7 days = 4200 total
      const spentByDate: Record<string, number> = {
        '2026-10-05': 600,
        '2026-10-06': 600,
        '2026-10-07': 600,
        '2026-10-08': 600,
        '2026-10-09': 600,
        '2026-10-10': 600,
        '2026-10-11': 600,
      };

      // Rollover runs on Monday 2026-10-12
      const finalized = buildPeriodsToFinalize(changes, spentByDate, '2026-10-12', []);

      expect(finalized).toHaveLength(1);
      const period = finalized[0];
      expect(period.cadence).toBe('weekly');
      expect(period.periodStart).toBe('2026-10-05');
      expect(period.periodEnd).toBe('2026-10-11');
      expect(period.budgetAmount).toBe(7000);
      expect(period.spentAmount).toBe(4200);
      expect(period.amountSaved).toBe(2800); // 7000 - 4200 = 2800 rolls to Gullak
      expect(period.status).toBe('saved');
      expect(period.isProrated).toBe(false);
    });
  });

  // =========================================================================
  // SCENARIO 4: Normal Weekly Cycle Overspending (Deficit Isolation)
  // =========================================================================
  describe('Scenario 4: Weekly Overspending on Cycle End', () => {
    it('sets Gullak deposit to 0 and does not carry forward negative debt', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-10-05',
        },
      ];

      // User spends 8500 total (over by 1500)
      const spentByDate: Record<string, number> = {
        '2026-10-05': 2000,
        '2026-10-06': 2000,
        '2026-10-07': 2000,
        '2026-10-08': 2500,
      };

      const finalized = buildPeriodsToFinalize(changes, spentByDate, '2026-10-12', []);
      expect(finalized).toHaveLength(1);
      const period = finalized[0];
      expect(period.spentAmount).toBe(8500);
      expect(period.amountSaved).toBe(0); // STRICT INVARIANT: No negative Gullak
      expect(period.status).toBe('missed');
    });
  });

  // =========================================================================
  // SCENARIO 5: Mid-Cycle Switch (Weekly -> Monthly, Additive Mode)
  // =========================================================================
  describe('Scenario 5: Mid-Cycle Switch (Weekly -> Monthly, Additive Mode)', () => {
    it('guarantees 0 Gullak deposit and carries unspent balance into tomorrow active pool', () => {
      // Weekly ₹7,000 from Monday 2026-10-05.
      // By Wednesday 2026-10-07, spent = ₹3,000. Unspent = ₹4,000.
      const switchPlan = buildCadenceSwitchPlan({
        currentCadence: 'weekly',
        targetCadence: 'monthly',
        currentBudget: 7000,
        currentSpent: 3000,
        targetAmount: 30000,
        carryMode: 'additive',
        todayStr: '2026-10-07',
      });

      expect(switchPlan.unspentAmount).toBe(4000);
      expect(switchPlan.carriedAmount).toBe(4000);
      expect(switchPlan.effectiveBudgetPool).toBe(34000); // 30000 + 4000
      expect(switchPlan.gullakDeposit).toBe(0); // STRICT INVARIANT
      expect(switchPlan.effectiveFrom).toBe('2026-10-08'); // Tomorrow

      // Now verify period slice finalization for the early-ended weekly slice
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-10-05',
        },
        {
          id: 'p2',
          userId: 'u1',
          effectiveFrom: '2026-10-08',
          isEnabled: true,
          cadence: 'monthly',
          amount: 30000,
          carryMode: 'additive',
          carriedOverAmount: 4000,
          createdAt: '2026-10-07',
        },
      ];

      const spentByDate = {
        '2026-10-05': 1000,
        '2026-10-06': 1000,
        '2026-10-07': 1000,
      };

      // Run finalization on Thursday Oct 8
      const finalized = buildPeriodsToFinalize(changes, spentByDate, '2026-10-08', []);
      expect(finalized).toHaveLength(1);
      const earlySlice = finalized[0];
      expect(earlySlice.cadence).toBe('weekly');
      expect(earlySlice.activeStart).toBe('2026-10-05');
      expect(earlySlice.activeEnd).toBe('2026-10-07');
      expect(earlySlice.amountSaved).toBe(0); // ZERO GULLAK DEPOSIT on early switch
      expect(earlySlice.carriedOverAmount).toBe(4000); // Carried forward
    });
  });

  // =========================================================================
  // SCENARIO 6: Mid-Cycle Switch (Monthly -> Weekly, Allocation Mode)
  // =========================================================================
  describe('Scenario 6: Mid-Cycle Switch (Monthly -> Weekly, Allocation Mode)', () => {
    it('maintains fixed target cap with carried amount as headstart', () => {
      const switchPlan = buildCadenceSwitchPlan({
        currentCadence: 'monthly',
        targetCadence: 'weekly',
        currentBudget: 30000,
        currentSpent: 12000,
        targetAmount: 7000,
        carryMode: 'allocation',
        todayStr: '2026-10-15',
      });

      expect(switchPlan.unspentAmount).toBe(18000);
      expect(switchPlan.effectiveBudgetPool).toBe(7000); // Fixed cap
      expect(switchPlan.gullakDeposit).toBe(0);
    });
  });

  // =========================================================================
  // SCENARIO 7: Mid-Cycle Switch in Overspent State (Deficit Isolation)
  // =========================================================================
  describe('Scenario 7: Mid-Cycle Switch in Overspent State', () => {
    it('isolates deficit and prevents negative carry-forward into new cadence pool', () => {
      const switchPlan = buildCadenceSwitchPlan({
        currentCadence: 'weekly',
        targetCadence: 'daily',
        currentBudget: 7000,
        currentSpent: 8500, // overspent by 1500
        targetAmount: 500,
        carryMode: 'additive',
        todayStr: '2026-10-08',
      });

      expect(switchPlan.unspentAmount).toBe(0); // Clamped
      expect(switchPlan.carriedAmount).toBe(0); // No negative debt
      expect(switchPlan.effectiveBudgetPool).toBe(500); // Clean start
      expect(switchPlan.gullakDeposit).toBe(0);
    });
  });

  // =========================================================================
  // SCENARIO 8: All Month Length Boundaries
  // =========================================================================
  describe('Scenario 8: All Month Length Boundaries', () => {
    it('correctly maps 28, 29, 30, and 31 day month boundaries without timezone offset bugs', () => {
      // 28 days: Feb 2025
      const feb25 = getPeriodBounds('monthly', '2025-02-10');
      expect(feb25.totalDays).toBe(28);
      expect(feb25.start).toBe('2025-02-01');
      expect(feb25.end).toBe('2025-02-28');

      // 29 days: Feb 2028 (Leap)
      const feb28 = getPeriodBounds('monthly', '2028-02-10');
      expect(feb28.totalDays).toBe(29);
      expect(feb28.start).toBe('2028-02-01');
      expect(feb28.end).toBe('2028-02-29');

      // 30 days: April 2026
      const apr26 = getPeriodBounds('monthly', '2026-04-10');
      expect(apr26.totalDays).toBe(30);
      expect(apr26.start).toBe('2026-04-01');
      expect(apr26.end).toBe('2026-04-30');

      // 31 days: October 2026
      const oct26 = getPeriodBounds('monthly', '2026-10-10');
      expect(oct26.totalDays).toBe(31);
      expect(oct26.start).toBe('2026-10-01');
      expect(oct26.end).toBe('2026-10-31');
    });
  });

  // =========================================================================
  // SCENARIO 9: Digital Vault Spending Guard (Pure Mode vs Budget Mode)
  // =========================================================================
  describe('Scenario 9: Digital Vault Spending Guard', () => {
    it('blocks expense creation when net liquidity is 0 or negative', () => {
      // Pure mode: 5000 income, 5000 spent -> net = 0 -> BLOCKED
      const guardPureEmpty = calculateVaultLiquidity({
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 5000,
        totalExpenses: 5000,
      });
      expect(guardPureEmpty.canAddExpense).toBe(false);
      expect(guardPureEmpty.totalVaultLiquidity).toBe(0);

      // Pure mode: 5000 income, 4000 spent -> net = 1000 -> ALLOWED
      const guardPureActive = calculateVaultLiquidity({
        isBudgetModeEnabled: false,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 5000,
        totalExpenses: 4000,
      });
      expect(guardPureActive.canAddExpense).toBe(true);
      expect(guardPureActive.totalVaultLiquidity).toBe(1000);

      // Budget mode paused (autoRenew false, 0 budget, 0 income) -> BLOCKED
      const guardBudgetPaused = calculateVaultLiquidity({
        isBudgetModeEnabled: true,
        budgetCadence: 'daily',
        dailyBudgetAmount: 0,
        weeklyBudgetAmount: 0,
        monthlyBudgetAmount: 0,
        totalIncome: 0,
        totalExpenses: 0,
        isAutoRenew: false,
      });
      expect(guardBudgetPaused.canAddExpense).toBe(false);
    });
  });

  // =========================================================================
  // SCENARIO 10: Idempotency & Duplicate Prevention
  // =========================================================================
  describe('Scenario 10: Idempotency & Duplicate Prevention', () => {
    it('skips already finalized period keys and produces 0 duplicates on multi-execution', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-10-05',
        },
      ];
      const spentByDate = { '2026-10-05': 1000 };

      // First run: finalizes weekly_2026-10-05
      const firstRun = buildPeriodsToFinalize(changes, spentByDate, '2026-10-12', []);
      expect(firstRun).toHaveLength(1);
      const key = firstRun[0].id; // 'weekly_2026-10-05'

      // Second run: pass key as already finalized
      const secondRun = buildPeriodsToFinalize(changes, spentByDate, '2026-10-12', [key]);
      expect(secondRun).toHaveLength(0); // 100% IDEMPOTENT, 0 DUPLICATES
    });

    it('upsertPendingChange replaces pending change for the same effectiveFrom date', () => {
      const initialChanges: BudgetPlanChange[] = [
        {
          id: 'c1',
          userId: 'u1',
          effectiveFrom: '2026-10-08',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-10-07T10:00:00Z',
        },
      ];

      const modifiedChange: BudgetPlanChange = {
        id: 'c2',
        userId: 'u1',
        effectiveFrom: '2026-10-08', // same effective date
        isEnabled: true,
        cadence: 'monthly', // changed to monthly
        amount: 30000,
        createdAt: '2026-10-07T12:00:00Z',
      };

      const updated = upsertPendingChange(initialChanges, modifiedChange);
      expect(updated).toHaveLength(1);
      expect(updated[0].cadence).toBe('monthly');
      expect(updated[0].amount).toBe(30000);
      expect(updated[0].id).toBe('c2');
    });
  });

  // =========================================================================
  // SCENARIO 11: Capacity Limit Warning on Monthly -> Weekly / Daily Switches
  // =========================================================================
  describe('Scenario 11: Capacity Limit Warning', () => {
    it('detects when requested weekly budget exceeds remaining monthly pool', () => {
      // 12 days left in month. Remaining monthly budget = 14000.
      // User requests 10,000/week (requires approx 10000 * 12/7 = 17143 > 14000).
      const capacity = checkCadenceCapacity({
        currentCadence: 'monthly',
        currentRemaining: 14000,
        remainingDays: 12,
        targetCadence: 'weekly',
        targetAmount: 10000,
      });

      expect(capacity.isExceeding).toBe(true);
      expect(capacity.maxSafeWeeklyAmount).toBe(Math.floor(14000 / (12 / 7))); // ~8166
      expect(capacity.warningMessage).toContain('exceeds your available allowance');
    });
  });

  // =========================================================================
  // SCENARIO 12: Transaction Mutations (Add, Increase, Decrease, Delete)
  // =========================================================================
  describe('Scenario 12: Transaction Mutations on Active Period & Daily Record', () => {
    it('accurately updates spent, remaining, and status across add, edit, and delete lifecycle', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-10-05',
        },
      ];

      // 1. Initial State: Expense of 1,500 on 2026-10-05
      type TestExpense = { amount: number; type: 'expense' | 'income'; expense_date?: string };
      const expensesInitial: TestExpense[] = [
        { amount: 1500, type: 'expense', expense_date: '2026-10-05T12:00:00Z' },
      ];
      const spentInitial = computeSpentByDate(expensesInitial, (e) => e.type === 'income');
      const summaryInitial = getCurrentPeriodSummary(changes, spentInitial, '2026-10-07');
      expect(summaryInitial?.spent).toBe(1500);
      expect(summaryInitial?.remaining).toBe(5500);
      expect(summaryInitial?.isOver).toBe(false);

      const dayInitial = evaluateDayStatus(1000, spentInitial['2026-10-05']);
      expect(dayInitial.saved).toBe(0);
      expect(dayInitial.status).toBe('exceeded'); // 1500 > 1000 daily target

      // 2. Edit Mutation (Amount Increase to 8,000 -> Overspending whole week)
      const expensesIncreased: TestExpense[] = [
        { amount: 8000, type: 'expense', expense_date: '2026-10-05T12:00:00Z' },
      ];
      const spentIncreased = computeSpentByDate(expensesIncreased, (e) => e.type === 'income');
      const summaryIncreased = getCurrentPeriodSummary(changes, spentIncreased, '2026-10-07');
      expect(summaryIncreased?.spent).toBe(8000);
      expect(summaryIncreased?.remaining).toBe(0); // Clamped, non-negative
      expect(summaryIncreased?.isOver).toBe(true);
      expect(summaryIncreased?.overBy).toBe(1000);

      // 3. Edit Mutation (Amount Correction down to 500)
      const expensesDecreased: TestExpense[] = [
        { amount: 500, type: 'expense', expense_date: '2026-10-05T12:00:00Z' },
      ];
      const spentDecreased = computeSpentByDate(expensesDecreased, (e) => e.type === 'income');
      const summaryDecreased = getCurrentPeriodSummary(changes, spentDecreased, '2026-10-07');
      expect(summaryDecreased?.spent).toBe(500);
      expect(summaryDecreased?.remaining).toBe(6500);
      expect(summaryDecreased?.isOver).toBe(false);
      expect(summaryDecreased?.overBy).toBe(0);

      const dayDecreased = evaluateDayStatus(1000, spentDecreased['2026-10-05']);
      expect(dayDecreased.saved).toBe(500);
      expect(dayDecreased.status).toBe('saved');

      // 4. Delete Mutation (Expense removed)
      const emptyExpenses: TestExpense[] = [];
      const spentDeleted = computeSpentByDate(emptyExpenses, (e) => e.type === 'income');
      const summaryDeleted = getCurrentPeriodSummary(changes, spentDeleted, '2026-10-07');
      expect(summaryDeleted?.spent).toBe(0);
      expect(summaryDeleted?.remaining).toBe(7000);
      expect(summaryDeleted?.isOver).toBe(false);

      const dayDeleted = evaluateDayStatus(1000, 0);
      expect(dayDeleted.saved).toBe(1000);
      expect(dayDeleted.status).toBe('saved');
    });
  });

  // =========================================================================
  // SCENARIO 13: Normal Monthly Cycle Completion at Month-End (31-Day October)
  // =========================================================================
  describe('Scenario 13: Normal Monthly Cycle Completion at Month-End', () => {
    it('deposits remaining eligible unspent budget into Gullak at month end without proration', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 31000,
          createdAt: '2026-10-01',
        },
      ];

      // Total spent = 24,000 across October
      const spentByDate: Record<string, number> = {
        '2026-10-10': 10000,
        '2026-10-20': 10000,
        '2026-10-31': 4000,
      };

      // Rollover runs on Nov 1, 2026
      const finalized = buildPeriodsToFinalize(changes, spentByDate, '2026-11-01', []);
      expect(finalized).toHaveLength(1);
      const period = finalized[0];
      expect(period.cadence).toBe('monthly');
      expect(period.periodStart).toBe('2026-10-01');
      expect(period.periodEnd).toBe('2026-10-31');
      expect(period.budgetAmount).toBe(31000);
      expect(period.spentAmount).toBe(24000);
      expect(period.amountSaved).toBe(7000); // 31000 - 24000 = 7000 saved into Gullak
      expect(period.status).toBe('saved');
      expect(period.isProrated).toBe(false);
    });
  });

  // =========================================================================
  // SCENARIO 14: Mid-Month Cadence Switch: Monthly -> Daily (Additive Carry-Forward)
  // =========================================================================
  describe('Scenario 14: Mid-Month Cadence Switch (Monthly -> Daily, Additive)', () => {
    it('carries full remaining monthly allowance into daily pool with zero Gullak deposit', () => {
      // Monthly 30,000 from Oct 1. On Oct 15, spent = 12,000. Unspent = 18,000.
      const switchPlan = buildCadenceSwitchPlan({
        currentCadence: 'monthly',
        targetCadence: 'daily',
        currentBudget: 30000,
        currentSpent: 12000,
        targetAmount: 500,
        carryMode: 'additive',
        todayStr: '2026-10-15',
      });

      expect(switchPlan.unspentAmount).toBe(18000);
      expect(switchPlan.carriedAmount).toBe(18000);
      expect(switchPlan.effectiveBudgetPool).toBe(18500); // 500 daily + 18000 carry-forward
      expect(switchPlan.gullakDeposit).toBe(0); // STRICT ZERO GULLAK DEPOSIT
      expect(switchPlan.effectiveFrom).toBe('2026-10-16');

      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-01',
          isEnabled: true,
          cadence: 'monthly',
          amount: 30000,
          createdAt: '2026-10-01',
        },
        {
          id: 'p2',
          userId: 'u1',
          effectiveFrom: '2026-10-16',
          isEnabled: true,
          cadence: 'daily',
          amount: 500,
          carryMode: 'additive',
          carriedOverAmount: 18000,
          createdAt: '2026-10-15',
        },
      ];

      const spentByDate = {
        '2026-10-10': 12000,
      };

      // Run finalization on Oct 16
      const finalized = buildPeriodsToFinalize(changes, spentByDate, '2026-10-16', []);
      expect(finalized).toHaveLength(1);
      const earlySlice = finalized[0];
      expect(earlySlice.cadence).toBe('monthly');
      expect(earlySlice.activeStart).toBe('2026-10-01');
      expect(earlySlice.activeEnd).toBe('2026-10-15');
      expect(earlySlice.amountSaved).toBe(0); // ZERO GULLAK DEPOSIT
      expect(earlySlice.carriedOverAmount).toBe(18000);
    });
  });

  // =========================================================================
  // SCENARIO 15: Exact Spend and Zero Spend Cycle Boundaries
  // =========================================================================
  describe('Scenario 15: Exact Spend and Zero Spend Cycle Boundaries', () => {
    it('handles zero spend (100% saved) and exact spend (status even, 0 saved)', () => {
      const changes: BudgetPlanChange[] = [
        {
          id: 'p1',
          userId: 'u1',
          effectiveFrom: '2026-10-05',
          isEnabled: true,
          cadence: 'weekly',
          amount: 7000,
          createdAt: '2026-10-05',
        },
      ];

      // Zero spend
      const zeroFinalized = buildPeriodsToFinalize(changes, {}, '2026-10-12', []);
      expect(zeroFinalized[0].amountSaved).toBe(7000);
      expect(zeroFinalized[0].status).toBe('saved');

      // Exact spend
      const exactSpentByDate = { '2026-10-05': 7000 };
      const exactFinalized = buildPeriodsToFinalize(changes, exactSpentByDate, '2026-10-12', []);
      expect(exactFinalized[0].amountSaved).toBe(0);
      expect(exactFinalized[0].status).toBe('even');
    });
  });

  // =========================================================================
  // SCENARIO 16: Timezone & String Date Invariant (yyyy-MM-dd)
  // =========================================================================
  describe('Scenario 16: Timezone and ISO String Date Invariant', () => {
    it('maintains strict yyyy-MM-dd date boundaries across month and year transitions', () => {
      // Month boundary: Nov 30 to Dec 1
      const novBounds = getPeriodBounds('monthly', '2026-11-30');
      expect(novBounds.start).toBe('2026-11-01');
      expect(novBounds.end).toBe('2026-11-30');
      expect(novBounds.totalDays).toBe(30);

      const decBounds = getPeriodBounds('monthly', '2026-12-01');
      expect(decBounds.start).toBe('2026-12-01');
      expect(decBounds.end).toBe('2026-12-31');
      expect(decBounds.totalDays).toBe(31);

      // Year boundary: Dec 31 to Jan 1
      const newYearBounds = getPeriodBounds('monthly', '2027-01-01');
      expect(newYearBounds.start).toBe('2027-01-01');
      expect(newYearBounds.end).toBe('2027-01-31');
      expect(newYearBounds.totalDays).toBe(31);
    });
  });
});
