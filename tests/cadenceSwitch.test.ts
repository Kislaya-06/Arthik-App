import { describe, it, expect } from 'vitest';
import {
  checkCadenceCapacity,
  calculateCadenceCarryForward,
  buildCadenceSwitchPlan,
} from '../src/lib/cadenceSwitch';

describe('Cadence Switching Engine (cadenceSwitch.ts)', () => {
  // =========================================================================
  // 1. calculateCadenceCarryForward
  // =========================================================================
  describe('1. calculateCadenceCarryForward - Additive vs Allocation', () => {
    it('Additive mode adds unspent budget on top of target budget (Audio Clip 1)', () => {
      // Weekly ₹7,000 budget, ₹4,000 spent -> ₹3,000 unspent.
      // Switching to Monthly ₹30,000 in Additive mode:
      const result = calculateCadenceCarryForward({
        unspentAmount: 3000,
        targetBudget: 30000,
        carryMode: 'additive',
      });

      expect(result).toEqual({
        carriedAmount: 3000,
        effectiveBudgetPool: 33000,
        allocatedHeadstart: 0,
        mode: 'additive',
      });
    });

    it('Allocation mode counts unspent balance as headstart toward target budget', () => {
      // Monthly ₹30,000 budget, ₹12,000 spent -> ₹18,000 unspent.
      // Switching to Weekly ₹7,000 in Allocation mode:
      const result = calculateCadenceCarryForward({
        unspentAmount: 18000,
        targetBudget: 7000,
        carryMode: 'allocation',
      });

      expect(result).toEqual({
        carriedAmount: 18000,
        effectiveBudgetPool: 7000,
        allocatedHeadstart: 7000,
        mode: 'allocation',
      });
    });

    it('Overspent condition yields 0 carry-forward (Audio Clip 4)', () => {
      // Weekly ₹7,000, spent ₹8,000 -> -₹1,000 over budget
      const result = calculateCadenceCarryForward({
        unspentAmount: -1000,
        targetBudget: 30000,
        carryMode: 'additive',
      });

      expect(result).toEqual({
        carriedAmount: 0,
        effectiveBudgetPool: 30000,
        allocatedHeadstart: 0,
        mode: 'additive',
      });
    });

    it('Zero unspent yields 0 carry-forward without mutating base pool', () => {
      const result = calculateCadenceCarryForward({
        unspentAmount: 0,
        targetBudget: 500,
        carryMode: 'allocation',
      });

      expect(result).toEqual({
        carriedAmount: 0,
        effectiveBudgetPool: 500,
        allocatedHeadstart: 0,
        mode: 'allocation',
      });
    });
  });

  // =========================================================================
  // 2. checkCadenceCapacity (Audio Clip 2 Edge Case)
  // =========================================================================
  describe('2. checkCadenceCapacity - Monthly to Weekly/Daily Over-Capacity Warning', () => {
    it('Flags warning when Monthly -> Weekly target exceeds remaining allowance', () => {
      // 18th of month, 12 days left (12/7 = ~1.71 weeks).
      // Remaining monthly budget = ₹18,000.
      // User sets Weekly budget to ₹15,000.
      // Required = 15,000 * 1.714 = ~₹25,714 > ₹18,000!
      const val = checkCadenceCapacity({
        currentCadence: 'monthly',
        currentRemaining: 18000,
        remainingDays: 12,
        targetCadence: 'weekly',
        targetAmount: 15000,
      });

      expect(val.isExceeding).toBe(true);
      expect(val.maxSafeWeeklyAmount).toBe(10500); // 18000 / (12/7) = 10500
      expect(val.warningMessage).toContain('exceeds your available allowance');
    });

    it('Allows sustainable weekly budget when within monthly remaining capacity', () => {
      // Remaining ₹18,000 for 12 days. Setting ₹7,000/week (requires ~₹12,000).
      const val = checkCadenceCapacity({
        currentCadence: 'monthly',
        currentRemaining: 18000,
        remainingDays: 12,
        targetCadence: 'weekly',
        targetAmount: 7000,
      });

      expect(val.isExceeding).toBe(false);
      expect(val.warningMessage).toBeUndefined();
    });

    it('Flags warning when Monthly -> Daily target exceeds remaining allowance', () => {
      // 12 days left, ₹6,000 remaining. User tries to set ₹1,000/day (requires ₹12,000).
      const val = checkCadenceCapacity({
        currentCadence: 'monthly',
        currentRemaining: 6000,
        remainingDays: 12,
        targetCadence: 'daily',
        targetAmount: 1000,
      });

      expect(val.isExceeding).toBe(true);
      expect(val.maxSafeDailyAmount).toBe(500); // 6000 / 12 = 500
    });

    it('Allows transitions without capacity constraints (e.g. Daily to Monthly, Weekly to Monthly)', () => {
      const val = checkCadenceCapacity({
        currentCadence: 'weekly',
        currentRemaining: 3000,
        remainingDays: 4,
        targetCadence: 'monthly',
        targetAmount: 25000,
      });

      expect(val.isExceeding).toBe(false);
    });
  });

  // =========================================================================
  // 3. buildCadenceSwitchPlan - All 6 Transitions & Invariants
  // =========================================================================
  describe('3. buildCadenceSwitchPlan - All 6 Transitions', () => {
    const todayStr = '2026-10-18'; // Sunday

    it('Transition 1: Weekly -> Monthly (Next-day activation, gullak = 0)', () => {
      const plan = buildCadenceSwitchPlan({
        currentCadence: 'weekly',
        targetCadence: 'monthly',
        currentBudget: 7000,
        currentSpent: 4000,
        targetAmount: 30000,
        carryMode: 'additive',
        todayStr,
      });

      expect(plan.effectiveFrom).toBe('2026-10-19'); // Tomorrow
      expect(plan.unspentAmount).toBe(3000);
      expect(plan.carriedAmount).toBe(3000);
      expect(plan.effectiveBudgetPool).toBe(33000);
      expect(plan.gullakDeposit).toBe(0);
    });

    it('Transition 2: Monthly -> Weekly with Allocation Mode', () => {
      const plan = buildCadenceSwitchPlan({
        currentCadence: 'monthly',
        targetCadence: 'weekly',
        currentBudget: 30000,
        currentSpent: 12000,
        targetAmount: 7000,
        carryMode: 'allocation',
        todayStr,
      });

      expect(plan.effectiveFrom).toBe('2026-10-19');
      expect(plan.unspentAmount).toBe(18000);
      expect(plan.carriedAmount).toBe(18000);
      expect(plan.effectiveBudgetPool).toBe(7000);
      expect(plan.gullakDeposit).toBe(0);
    });

    it('Transition 3: Daily -> Weekly carries today unspent to weekly pool', () => {
      const plan = buildCadenceSwitchPlan({
        currentCadence: 'daily',
        targetCadence: 'weekly',
        currentBudget: 500,
        currentSpent: 150,
        targetAmount: 3500,
        carryMode: 'additive',
        todayStr,
      });

      expect(plan.effectiveFrom).toBe('2026-10-19');
      expect(plan.unspentAmount).toBe(350);
      expect(plan.effectiveBudgetPool).toBe(3850);
      expect(plan.gullakDeposit).toBe(0);
    });

    it('Transition 4: Daily -> Monthly carries today unspent to monthly pool', () => {
      const plan = buildCadenceSwitchPlan({
        currentCadence: 'daily',
        targetCadence: 'monthly',
        currentBudget: 500,
        currentSpent: 300,
        targetAmount: 15000,
        carryMode: 'additive',
        todayStr,
      });

      expect(plan.effectiveFrom).toBe('2026-10-19');
      expect(plan.unspentAmount).toBe(200);
      expect(plan.effectiveBudgetPool).toBe(15200);
      expect(plan.gullakDeposit).toBe(0);
    });

    it('Transition 5: Weekly -> Daily carries unspent to daily pool/buffer', () => {
      const plan = buildCadenceSwitchPlan({
        currentCadence: 'weekly',
        targetCadence: 'daily',
        currentBudget: 7000,
        currentSpent: 3000,
        targetAmount: 500,
        carryMode: 'additive',
        todayStr,
      });

      expect(plan.effectiveFrom).toBe('2026-10-19');
      expect(plan.unspentAmount).toBe(4000);
      expect(plan.effectiveBudgetPool).toBe(4500);
      expect(plan.gullakDeposit).toBe(0);
    });

    it('Transition 6: Monthly -> Daily carries unspent to daily pool/buffer', () => {
      const plan = buildCadenceSwitchPlan({
        currentCadence: 'monthly',
        targetCadence: 'daily',
        currentBudget: 25000,
        currentSpent: 10000,
        targetAmount: 800,
        carryMode: 'allocation',
        todayStr,
      });

      expect(plan.effectiveFrom).toBe('2026-10-19');
      expect(plan.unspentAmount).toBe(15000);
      expect(plan.carriedAmount).toBe(15000);
      expect(plan.effectiveBudgetPool).toBe(800);
      expect(plan.gullakDeposit).toBe(0);
    });

    it('Overspent weekly switch yields 0 carryover and 0 Gullak deposit', () => {
      const plan = buildCadenceSwitchPlan({
        currentCadence: 'weekly',
        targetCadence: 'monthly',
        currentBudget: 7000,
        currentSpent: 8500, // ₹1,500 overspent
        targetAmount: 30000,
        carryMode: 'additive',
        todayStr,
      });

      expect(plan.effectiveFrom).toBe('2026-10-19');
      expect(plan.unspentAmount).toBe(0);
      expect(plan.carriedAmount).toBe(0);
      expect(plan.effectiveBudgetPool).toBe(30000);
      expect(plan.gullakDeposit).toBe(0);
    });
  });
});
