import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});

import { renderHook } from './helpers/hookRuntime';
import { useInsightsData, UseInsightsDataParams } from '../src/screens/insights/useInsightsData';
import { Expense } from '../src/store/expenseStore';
import { Category } from '../src/store/categoryStore';
import { DailyRecord, GullakDeposit } from '../src/store/dailyBudgetStore';
import { BudgetPeriodRecord } from '../src/types';

function normalizeForSnapshot(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(normalizeForSnapshot);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const k of Object.keys(obj).sort()) {
      res[k] = normalizeForSnapshot(obj[k]);
    }
    return res;
  }
  return obj;
}

describe('useInsightsData (pure analytics and derived calculations)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const categories: Category[] = [
    { id: 'c1', name: 'Food', color: '#FF8A65', icon: 'utensils', user_id: 'u1', is_default: true },
    { id: 'c2', name: 'Commute', color: '#4DB6AC', icon: 'bus', user_id: 'u1', is_default: true },
    { id: 'c3', name: 'Bills', color: '#BA68C8', icon: 'zap', user_id: 'u1', is_default: true },
    { id: 'c4', name: 'Salary', color: '#81C784', icon: 'wallet', user_id: 'u1', is_default: false },
    { id: 'c5', name: 'Transfer', color: '#90A4AE', icon: 'repeat', user_id: 'u1', is_default: false },
  ];

  const expenses: Expense[] = [
    // August (12 items)
    { id: 'e01', amount: 50000, category_id: 'c4', expense_date: '2026-08-01T09:00:00Z', note: 'Aug Salary', user_id: 'u1', type: 'income', payment_mode: 'upi' },
    { id: 'e02', amount: 450, category_id: 'c1', expense_date: '2026-08-03T12:00:00Z', note: 'Lunch', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e03', amount: 120, category_id: 'c2', expense_date: '2026-08-05T08:30:00Z', note: 'Metro', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e04', amount: 1500, category_id: 'c3', expense_date: '2026-08-08T14:00:00Z', note: 'Electricity', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e05', amount: 300, category_id: 'c1', expense_date: '2026-08-11T19:00:00Z', note: 'Dinner', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    { id: 'e06', amount: 80, category_id: 'c2', expense_date: '2026-08-14T09:00:00Z', note: 'Auto', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e07', amount: 650, category_id: 'c1', expense_date: '2026-08-17T13:00:00Z', note: 'Groceries', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e08', amount: 200, category_id: 'c2', expense_date: '2026-08-20T18:00:00Z', note: 'Cab', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e09', amount: 850, category_id: 'c3', expense_date: '2026-08-23T11:00:00Z', note: 'Water', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e10', amount: 400, category_id: 'c1', expense_date: '2026-08-26T20:00:00Z', note: 'Snacks', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    { id: 'e11', amount: 150, category_id: 'c2', expense_date: '2026-08-29T10:00:00Z', note: 'Bus', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e12', amount: 500, category_id: 'c1', expense_date: '2026-08-31T21:00:00Z', note: 'Dinner', user_id: 'u1', type: 'expense', payment_mode: 'upi' },

    // September (14 items: includes reimbursement & self-transfer)
    { id: 'e13', amount: 50000, category_id: 'c4', expense_date: '2026-09-01T09:00:00Z', note: 'Sep Salary', user_id: 'u1', type: 'income', payment_mode: 'upi' },
    { id: 'e14', amount: 350, category_id: 'c1', expense_date: '2026-09-03T12:00:00Z', note: 'Lunch', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    { id: 'e15', amount: 120, category_id: 'c2', expense_date: '2026-09-06T08:30:00Z', note: 'Metro', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e16', amount: 1500, category_id: 'c3', expense_date: '2026-09-09T14:00:00Z', note: 'Wifi', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e17', amount: 800, category_id: 'c1', expense_date: '2026-09-12T13:00:00Z', note: 'Team Lunch Refund', user_id: 'u1', type: 'expense', transaction_class: 'reimbursement', payment_mode: 'upi' },
    { id: 'e18', amount: 400, category_id: 'c1', expense_date: '2026-09-14T20:00:00Z', note: 'Dinner', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e19', amount: 150, category_id: 'c2', expense_date: '2026-09-16T09:00:00Z', note: 'Auto', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    { id: 'e20', amount: 600, category_id: 'c3', expense_date: '2026-09-19T11:00:00Z', note: 'Gas', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e21', amount: 2000, category_id: 'c5', expense_date: '2026-09-21T15:00:00Z', note: 'Self Transfer', user_id: 'u1', type: 'expense', transaction_class: 'self_transfer', payment_mode: 'upi' },
    { id: 'e22', amount: 250, category_id: 'c1', expense_date: '2026-09-24T18:00:00Z', note: 'Coffee', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e23', amount: 100, category_id: 'c2', expense_date: '2026-09-26T08:30:00Z', note: 'Metro', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e24', amount: 500, category_id: 'c1', expense_date: '2026-09-28T19:30:00Z', note: 'Dinner', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e25', amount: 1200, category_id: 'c3', expense_date: '2026-09-30T10:00:00Z', note: 'Maintenance', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e26', amount: 300, category_id: 'c1', expense_date: '2026-09-30T21:00:00Z', note: 'Snacks', user_id: 'u1', type: 'expense', payment_mode: 'cash' },

    // October (14 items up to 2026-10-14)
    { id: 'e27', amount: 50000, category_id: 'c4', expense_date: '2026-10-01T09:00:00Z', note: 'Oct Salary', user_id: 'u1', type: 'income', payment_mode: 'upi' },
    { id: 'e28', amount: 300, category_id: 'c1', expense_date: '2026-10-02T12:00:00Z', note: 'Lunch', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    { id: 'e29', amount: 100, category_id: 'c2', expense_date: '2026-10-04T09:00:00Z', note: 'Metro', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e30', amount: 800, category_id: 'c3', expense_date: '2026-10-05T14:00:00Z', note: 'Electricity', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e31', amount: 250, category_id: 'c1', expense_date: '2026-10-06T19:00:00Z', note: 'Dinner', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e32', amount: 80, category_id: 'c2', expense_date: '2026-10-07T08:30:00Z', note: 'Bus', user_id: 'u1', type: 'expense', payment_mode: 'card' },
    { id: 'e33', amount: 450, category_id: 'c1', expense_date: '2026-10-08T13:00:00Z', note: 'Groceries', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e34', amount: 1200, category_id: 'c3', expense_date: '2026-10-09T16:00:00Z', note: 'Mobile Bill', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e35', amount: 350, category_id: 'c1', expense_date: '2026-10-10T20:00:00Z', note: 'Dinner', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e36', amount: 120, category_id: 'c2', expense_date: '2026-10-11T10:00:00Z', note: 'Cab', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    { id: 'e37', amount: 200, category_id: 'c1', expense_date: '2026-10-12T12:30:00Z', note: 'Lunch', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e38', amount: 150, category_id: 'c1', expense_date: '2026-10-13T19:00:00Z', note: 'Snacks', user_id: 'u1', type: 'expense', payment_mode: 'cash' },
    { id: 'e39', amount: 220, category_id: 'c2', expense_date: '2026-10-14T08:00:00Z', note: 'Fuel', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
    { id: 'e40', amount: 180, category_id: 'c1', expense_date: '2026-10-14T13:00:00Z', note: 'Lunch Today', user_id: 'u1', type: 'expense', payment_mode: 'upi' },
  ];

  // Daily records from 2026-08-01 to 2026-10-14 (75 days)
  const dailyRecords: Record<string, DailyRecord> = {};
  const currDate = new Date('2026-08-01T00:00:00Z');
  const endDate = new Date('2026-10-14T00:00:00Z');
  while (currDate <= endDate) {
    const dStr = currDate.toISOString().split('T')[0];
    dailyRecords[dStr] = {
      date: dStr,
      budget: 500,
      spent: 300,
      saved: 200,
      isFinalized: dStr < '2026-10-14',
      status: 'saved',
    };
    currDate.setUTCDate(currDate.getUTCDate() + 1);
  }

  const gullakDeposits: GullakDeposit[] = [
    { id: 'g1', amount: 500, date: '2026-08-15', source: 'income', created_at: '2026-08-15T10:00:00Z' },
    { id: 'g2', amount: 1000, date: '2026-09-20', source: 'external', created_at: '2026-09-20T10:00:00Z' },
  ];

  const defaultParams: UseInsightsDataParams = {
    period: 'Weekly',
    offset: 0,
    expenses,
    categories,
    dailyRecords,
    gullakDeposits,
    isBudgetModeEnabled: true,
    budgetPeriods: {},
    budgetCadence: 'daily',
    dailyBudgetAmount: 500,
    weeklyBudgetAmount: 3500,
    monthlyBudgetAmount: 15000,
    totalAccumulatedSavings: 15000,
    focusTime: new Date('2026-10-14T10:00:00Z').getTime(),
    user: { created_at: '2026-08-01T00:00:00Z' },
  };

  it('computes Weekly period offset 0 snapshot', () => {
    const { result } = renderHook(() => useInsightsData({ ...defaultParams, period: 'Weekly', offset: 0 }));
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });

  it('computes Weekly period offset -1 snapshot', () => {
    const { result } = renderHook(() => useInsightsData({ ...defaultParams, period: 'Weekly', offset: -1 }));
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });

  it('computes Monthly period offset 0 snapshot', () => {
    const { result } = renderHook(() => useInsightsData({ ...defaultParams, period: 'Monthly', offset: 0 }));
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });

  it('computes Monthly period offset -1 snapshot', () => {
    const { result } = renderHook(() => useInsightsData({ ...defaultParams, period: 'Monthly', offset: -1 }));
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });

  it('computes Yearly period offset 0 snapshot', () => {
    const { result } = renderHook(() => useInsightsData({ ...defaultParams, period: 'Yearly', offset: 0 }));
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });

  it('computes Yearly period offset -1 snapshot', () => {
    const { result } = renderHook(() => useInsightsData({ ...defaultParams, period: 'Yearly', offset: -1 }));
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });

  it('computes snapshot with budget mode OFF (Pure Mode)', () => {
    const { result } = renderHook(() => useInsightsData({ ...defaultParams, isBudgetModeEnabled: false, period: 'Monthly', offset: 0 }));
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });

  it('computes snapshot with weekly cadence + budgetPeriods', () => {
    const budgetPeriods: Record<string, BudgetPeriodRecord> = {
      'w-2026-41': {
        id: 'bp1',
        userId: 'u1',
        cadence: 'weekly',
        periodStart: '2026-10-05',
        periodEnd: '2026-10-11',
        activeStart: '2026-10-05',
        activeEnd: '2026-10-11',
        budgetAmount: 3500,
        spentAmount: 3200,
        amountSaved: 300,
        status: 'saved',
        isProrated: false,
      },
    };
    const { result } = renderHook(() =>
      useInsightsData({
        ...defaultParams,
        budgetCadence: 'weekly',
        budgetPeriods,
        period: 'Weekly',
        offset: 0,
      })
    );
    expect(normalizeForSnapshot(result.current)).toMatchSnapshot();
  });
});
