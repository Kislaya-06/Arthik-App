import { describe, it, expect } from 'vitest';
import {
  shouldDeletePhantom500Day,
  resolveHydratedDayBudget,
  resolveRolloverBudget,
  getBackdatedSpendingNotice,
} from '../src/lib/budgetUtils';
import { parseISO } from 'date-fns';
import type { BudgetPlanChange } from '../src/types';

describe('shouldDeletePhantom500Day - Behavior Tests', () => {
  // Reference dates for testing: yesterday vs older days
  const YESTERDAY = '2026-09-17';
  const THREE_DAYS_AGO = '2026-09-14';

  it('keeps real ₹500 budget with zero spend on a day that is not yesterday', () => {
    const isDeleted = shouldDeletePhantom500Day({
      date: THREE_DAYS_AGO,
      yesterdayStr: YESTERDAY,
      daySpent: 0,
      spentOnDate: undefined,
      rawLogBudget: 500,
      rawLogSaved: 500,
      localRecord: { budget: 500 },
      resolvedAutoRenew: true,
      resolvedBudget: 500,
    });

    expect(isDeleted).toBe(false);
  });

  it('keeps real ₹500 budget with zero spend when the day is yesterday', () => {
    const isDeleted = shouldDeletePhantom500Day({
      date: YESTERDAY,
      yesterdayStr: YESTERDAY,
      daySpent: 0,
      spentOnDate: undefined,
      rawLogBudget: 500,
      rawLogSaved: 500,
      localRecord: { budget: 500 },
      resolvedAutoRenew: true,
      resolvedBudget: 500,
    });

    expect(isDeleted).toBe(false);
  });

  it('keeps ₹300 budget with zero spend on a day that is not yesterday', () => {
    const isDeleted = shouldDeletePhantom500Day({
      date: THREE_DAYS_AGO,
      yesterdayStr: YESTERDAY,
      daySpent: 0,
      spentOnDate: undefined,
      rawLogBudget: 300,
      rawLogSaved: 300,
      localRecord: { budget: 300 },
      resolvedAutoRenew: true,
      resolvedBudget: 300,
    });

    expect(isDeleted).toBe(false);
  });

  it('keeps ₹500 budget when there is spend on that day', () => {
    const isDeleted = shouldDeletePhantom500Day({
      date: THREE_DAYS_AGO,
      yesterdayStr: YESTERDAY,
      daySpent: 200,
      spentOnDate: 200,
      rawLogBudget: 500,
      rawLogSaved: 300,
      localRecord: { budget: 500 },
      resolvedAutoRenew: true,
      resolvedBudget: 500,
    });

    expect(isDeleted).toBe(false);
  });

  it('deletes a genuinely fake row: no local record, no spend, 500 budget', () => {
    const isDeleted = shouldDeletePhantom500Day({
      date: '2026-08-15',
      yesterdayStr: YESTERDAY,
      daySpent: 0,
      spentOnDate: undefined,
      rawLogBudget: 500,
      rawLogSaved: 500,
      localRecord: undefined,
      resolvedAutoRenew: true,
      resolvedBudget: 500,
    });

    expect(isDeleted).toBe(true);
  });

  it('deletes row when local record has budget 0 (uninitialized)', () => {
    const isDeleted = shouldDeletePhantom500Day({
      date: THREE_DAYS_AGO,
      yesterdayStr: YESTERDAY,
      daySpent: 0,
      spentOnDate: undefined,
      rawLogBudget: 500,
      rawLogSaved: 500,
      localRecord: { budget: 0 },
      resolvedAutoRenew: true,
      resolvedBudget: 500,
    });

    expect(isDeleted).toBe(true);
  });

  it('keeps ₹500 budget if daySpent is 0 but expenseStore has transactions on that date', () => {
    const isDeleted = shouldDeletePhantom500Day({
      date: THREE_DAYS_AGO,
      yesterdayStr: YESTERDAY,
      daySpent: 0,
      spentOnDate: 150, // expenseStore has logged transactions for this day
      rawLogBudget: 500,
      rawLogSaved: 500,
      localRecord: { budget: 500 },
      resolvedAutoRenew: true,
      resolvedBudget: 500,
    });

    expect(isDeleted).toBe(false);
  });
});

describe('resolveHydratedDayBudget - Behavior Tests', () => {
  it('resolves explicit custom budget from raw log when non-500', () => {
    const budget = resolveHydratedDayBudget({
      rawLogBudget: 350,
      localRecordBudget: 200,
      resolvedBudget: 100,
    });
    expect(budget).toBe(350);
  });

  it('resolves explicit ₹500 custom budget in raw log', () => {
    const budget = resolveHydratedDayBudget({
      rawLogBudget: 500,
      localRecordBudget: null,
      resolvedBudget: 300,
    });
    expect(budget).toBe(500);
  });

  it('resolves explicit ₹500 custom budget in local record', () => {
    const budget = resolveHydratedDayBudget({
      rawLogBudget: null,
      localRecordBudget: 500,
      resolvedBudget: 250,
    });
    expect(budget).toBe(500);
  });

  it('resolves to 500 when resolvedBudget is 500 and log/local had 500', () => {
    const budget = resolveHydratedDayBudget({
      rawLogBudget: 500,
      localRecordBudget: 500,
      resolvedBudget: 500,
    });
    expect(budget).toBe(500);
  });

  it('resolves to local record budget when raw log budget is null', () => {
    const budget = resolveHydratedDayBudget({
      rawLogBudget: null,
      localRecordBudget: 400,
      resolvedBudget: 200,
    });
    expect(budget).toBe(400);
  });

  it('resolves to 0 when no budget was set anywhere', () => {
    const budget = resolveHydratedDayBudget({
      rawLogBudget: null,
      localRecordBudget: null,
      resolvedBudget: 0,
    });
    expect(budget).toBe(0);
  });
});

describe('resolveRolloverBudget - Behavior Tests', () => {
  it('past day with budget 500, current allowance 200 -> untouched (500)', () => {
    const result = resolveRolloverBudget(500, 200);
    expect(result).toBe(500);
  });

  it('past day with budget 500, current allowance 500 -> untouched (500)', () => {
    const result = resolveRolloverBudget(500, 500);
    expect(result).toBe(500);
  });

  it('past day with budget 300, current allowance 200 -> untouched (300)', () => {
    const result = resolveRolloverBudget(300, 200);
    expect(result).toBe(300);
  });

  it('past day with budget 500, current allowance 0 -> untouched (500)', () => {
    const result = resolveRolloverBudget(500, 0);
    expect(result).toBe(500);
  });
});

describe('getBackdatedSpendingNotice - Behavior & Shortfall Tests', () => {
  const TODAY_STR = '2026-10-15'; // Thursday
  const YESTERDAY_DATE = parseISO('2026-10-14'); // Wednesday
  const SUNDAY_DATE = parseISO('2026-10-11'); // Sunday
  const SUNDAY_STR = '2026-10-11';

  it('returns null when Budget Mode is OFF (Pure Mode allows unconstrained spending)', () => {
    const notice = getBackdatedSpendingNotice({
      selectedDate: SUNDAY_DATE,
      todayStr: TODAY_STR,
      isBudgetModeEnabled: false,
      planChanges: [],
      dailyRecords: undefined,
      evaluatedAmount: 400,
      totalVaultLiquidity: 500,
      totalAccumulatedSavings: 500,
    });
    expect(notice).toBeNull();
  });

  it('returns null when selected date is today or in the future', () => {
    const noticeToday = getBackdatedSpendingNotice({
      selectedDate: parseISO('2026-10-15'),
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges: [],
      dailyRecords: undefined,
      evaluatedAmount: 400,
      totalVaultLiquidity: 500,
      totalAccumulatedSavings: 500,
    });
    expect(noticeToday).toBeNull();

    const noticeFuture = getBackdatedSpendingNotice({
      selectedDate: parseISO('2026-10-16'),
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges: [],
      dailyRecords: undefined,
      evaluatedAmount: 400,
      totalVaultLiquidity: 500,
      totalAccumulatedSavings: 500,
    });
    expect(noticeFuture).toBeNull();
  });

  it('returns null when selected past date had an active budget (daily cadence)', () => {
    const planChanges: BudgetPlanChange[] = [
      {
        id: 'p1',
        userId: 'u1',
        cadence: 'daily',
        amount: 500,
        effectiveFrom: '2026-10-10',
        isEnabled: true,
        createdAt: '2026-10-10',
      },
    ];
    const dailyRecords = {
      [SUNDAY_STR]: {
        date: SUNDAY_STR,
        budget: 500,
        spent: 0,
        saved: 500,
        isFinalized: true,
        status: 'saved' as const,
      },
    };

    const notice = getBackdatedSpendingNotice({
      selectedDate: SUNDAY_DATE,
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges,
      dailyRecords,
      evaluatedAmount: 400,
      totalVaultLiquidity: 1000,
      totalAccumulatedSavings: 500,
    });
    expect(notice).toBeNull();
  });

  it('returns informative notice when past date had NO active budget and user has sufficient Gullak funds', () => {
    // Sunday had no budget (plan starts Monday 2026-10-12)
    const planChanges: BudgetPlanChange[] = [
      {
        id: 'p1',
        userId: 'u1',
        cadence: 'daily',
        amount: 500,
        effectiveFrom: '2026-10-12',
        isEnabled: true,
        createdAt: '2026-10-12',
      },
    ];

    const notice = getBackdatedSpendingNotice({
      selectedDate: SUNDAY_DATE,
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges,
      dailyRecords: {},
      evaluatedAmount: 400,
      totalVaultLiquidity: 500,
      totalAccumulatedSavings: 500,
    });

    expect(notice).not.toBeNull();
    expect(notice?.dayName).toBe('Sunday');
    expect(notice?.isUngoverned).toBe(true);
    expect(notice?.hasShortfall).toBe(false);
    expect(notice?.shortfallAmount).toBe(0);
    expect(notice?.title).toBe('Sunday had no active budget');
    expect(notice?.description).toContain('₹400 will be drawn from your Gullak (₹500 available)');
  });

  it('formats "Yesterday" correctly for the day immediately before today', () => {
    const notice = getBackdatedSpendingNotice({
      selectedDate: YESTERDAY_DATE,
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges: [],
      dailyRecords: {},
      evaluatedAmount: 200,
      totalVaultLiquidity: 500,
      totalAccumulatedSavings: 500,
    });

    expect(notice).not.toBeNull();
    expect(notice?.dayName).toBe('Yesterday');
    expect(notice?.title).toBe('Yesterday had no active budget');
  });

  it('provides generic prompt when evaluated amount is 0', () => {
    const notice = getBackdatedSpendingNotice({
      selectedDate: SUNDAY_DATE,
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges: [],
      dailyRecords: {},
      evaluatedAmount: 0,
      totalVaultLiquidity: 500,
      totalAccumulatedSavings: 500,
    });

    expect(notice).not.toBeNull();
    expect(notice?.description).toBe('Expenses on this date will be drawn from your Gullak (₹500 available).');
  });

  it('returns shortfall notice with exact calculated shortage when amount exceeds available vault liquidity', () => {
    // User wants to spend 400 on Sunday, but only has 100 in liquidity
    const notice = getBackdatedSpendingNotice({
      selectedDate: SUNDAY_DATE,
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges: [],
      dailyRecords: {},
      evaluatedAmount: 400,
      totalVaultLiquidity: 100,
      totalAccumulatedSavings: 100,
    });

    expect(notice).not.toBeNull();
    expect(notice?.hasShortfall).toBe(true);
    expect(notice?.shortfallAmount).toBe(300);
    expect(notice?.title).toBe('Sunday had no budget · ₹300 short');
    expect(notice?.description).toBe('You only have ₹100 in Gullak. Add ₹300 to log this expense.');
  });

  it('returns balance ₹0 notice when available liquidity is zero or negative', () => {
    const notice = getBackdatedSpendingNotice({
      selectedDate: SUNDAY_DATE,
      todayStr: TODAY_STR,
      isBudgetModeEnabled: true,
      planChanges: [],
      dailyRecords: {},
      evaluatedAmount: 250,
      totalVaultLiquidity: 0,
      totalAccumulatedSavings: 0,
    });

    expect(notice).not.toBeNull();
    expect(notice?.hasShortfall).toBe(true);
    expect(notice?.shortfallAmount).toBe(250);
    expect(notice?.title).toBe('Sunday had no budget · Balance ₹0');
    expect(notice?.description).toBe('Your vault balance is ₹0. Please add money first to log this expense.');
  });
});

