import { describe, it, expect } from 'vitest';
import {
  shouldDeletePhantom500Day,
  resolveHydratedDayBudget,
  resolveRolloverBudget,
} from '../src/lib/budgetUtils';

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
