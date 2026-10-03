import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));
vi.mock('lucide-react-native', () => ({}));
vi.mock('expo-notifications', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
}));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '20000000-0000-4000-8000-000000000001') }));
vi.mock('../src/config/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), upsert: vi.fn().mockResolvedValue({ error: null }) })), auth: { getSession: vi.fn() } },
}));

import { buildPlanContext } from '../src/lib/notificationSync';
import { buildNotificationPlan } from '../src/lib/notificationPolicy';
import { useExpenseStore } from '../src/store/expenseStore';
import { useCategoryStore } from '../src/store/categoryStore';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';

// Wednesday 7 Oct 2026, 14:00 local
const NOW = new Date(2026, 9, 7, 14, 0, 0);
const cat = (id: string, name: string) => ({ id, user_id: 'u', name, icon: 'x', color: '#000', is_default: false });
const exp = (id: string, amount: number, date: string, category_id: string | null, extra: any = {}) => ({
  id, user_id: 'u', amount, category_id, payment_mode: 'upi' as const, expense_date: date, type: 'expense' as const, created_at: `${date}T09:00:00`, ...extra,
});

beforeEach(() => {
  useCategoryStore.setState({ categories: [cat('food', 'Food'), cat('travel', 'Travel')] } as any);
  useExpenseStore.setState({ expenses: [], isExpensesLoaded: true } as any);
  useDailyBudgetStore.setState({
    isBudgetModeEnabled: false, budgetCadence: 'daily', isAutoRenew: false, dailyBudgetAmount: 500,
    dailyRecords: {}, budgetPeriods: {}, planChanges: [], savingsStreak: 0,
  } as any);
});

describe('buildPlanContext (store data -> planner input)', () => {
  it('Pure Mode: weekly / monthly stats, top category, previous week, loggedToday', () => {
    useExpenseStore.setState({
      expenses: [
        exp('1', 300, '2026-10-05', 'food'),            // Mon this week
        exp('2', 900, '2026-10-06', 'travel'),          // Tue
        exp('3', 200, '2026-10-07', 'food', { created_at: '2026-10-07T08:00:00' }), // today
        exp('4', 1000, '2026-09-30', 'food'),           // last week (Wed)
        exp('5', 500, '2026-09-10', 'travel'),          // last month
        exp('6', 5000, '2026-10-06', null, { type: 'income' }), // income never counts
      ],
    } as any);
    const c = buildPlanContext(NOW);
    expect(c.profile).toBe('pure');
    expect(c.loggedToday).toBe(true);
    expect(c.week.txnCount).toBe(3);
    expect(c.week.spent).toBe(1400);
    expect(c.week.prevSpent).toBe(1000);
    expect(c.week.topCategory).toEqual({ name: 'Travel', amount: 900 });
    expect(c.month.txnCount).toBe(3); // only the three October expenses (September rows and income are excluded)
  });

  it('a transaction entered today for an older date still counts as "logged today"', () => {
    useExpenseStore.setState({ expenses: [exp('1', 100, '2026-10-02', 'food', { created_at: '2026-10-07T10:00:00' })] } as any);
    expect(buildPlanContext(NOW).loggedToday).toBe(true);
  });

  it('nothing logged today -> a nudge is planned for tonight', () => {
    useExpenseStore.setState({ expenses: [exp('1', 100, '2026-10-05', 'food')] } as any);
    const c = buildPlanContext(NOW);
    expect(c.loggedToday).toBe(false);
    expect(buildNotificationPlan(c).some((p) => p.type === 'log_nudge')).toBe(true);
  });

  it('Gullak daily: budget, today spent, week days and Gullak savings', () => {
    useDailyBudgetStore.setState({
      isBudgetModeEnabled: true, isAutoRenew: true, budgetCadence: 'daily', dailyBudgetAmount: 500, savingsStreak: 2,
      dailyRecords: {
        '2026-10-05': { date: '2026-10-05', budget: 500, spent: 300, saved: 200, isFinalized: true, status: 'saved' },
        '2026-10-06': { date: '2026-10-06', budget: 500, spent: 700, saved: 0, isFinalized: true, status: 'exceeded' },
        '2026-10-07': { date: '2026-10-07', budget: 500, spent: 180, saved: 320, isFinalized: false, status: 'active' },
      },
    } as any);
    useExpenseStore.setState({ expenses: [exp('1', 180, '2026-10-07', 'food'), exp('2', 300, '2026-10-05', 'food'), exp('3', 700, '2026-10-06', 'food')] } as any);
    const c = buildPlanContext(NOW);
    expect(c.profile).toBe('gullak');
    expect(c.dailyBudget).toBe(500);
    expect(c.todaySpent).toBe(180);
    expect(c.streak).toBe(2);
    expect(c.week.daysTracked).toBe(3);
    expect(c.week.daysUnderBudget).toBe(2);
    expect(c.week.savedToGullak).toBe(520);
    const plan = buildNotificationPlan(c);
    expect(plan.find((p) => p.type === 'gullak_reward')?.title).toBe('₹320 saved yesterday');
  });

  it('Gullak without auto-renew has no daily budget (so no daily promises)', () => {
    useDailyBudgetStore.setState({ isBudgetModeEnabled: true, isAutoRenew: false, budgetCadence: 'daily', dailyBudgetAmount: 500 } as any);
    expect(buildPlanContext(NOW).dailyBudget).toBe(0);
  });
});
