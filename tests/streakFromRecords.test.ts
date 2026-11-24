/**
 * Streaks follow the records (owner decision 2026-11-25, ROL-002): a backdated expense or money back that turns a
 * past day / week from saved into missed (or back) changes the current AND the best streak. The best streak is
 * never kept from an older, larger number that the records no longer show.
 */
import { describe, it, expect, vi } from 'vitest';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-11-25T12:00:00'));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));
vi.mock('lucide-react-native', () => ({ Wallet: () => null, CheckSquare: () => null, CreditCard: () => null, HelpCircle: () => null }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '30000000-0000-4000-8000-000000000001') }));
vi.mock('../src/config/supabase', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'u1', created_at: '2026-11-01T00:00:00Z' } })) },
  registerStoreResetCallback: vi.fn(),
}));

import { computeMetrics } from '../src/store/dailyBudget/metrics';
import type { DailyRecord } from '../src/store/dailyBudgetStore';
import type { BudgetPeriodRecord } from '../src/types';

const day = (date: string, status: 'saved' | 'missed'): DailyRecord => ({
  date,
  budget: 100,
  spent: status === 'saved' ? 50 : 200,
  saved: status === 'saved' ? 50 : 0,
  isFinalized: true,
  status,
});

const records = (missedOn?: string) => {
  const out: Record<string, DailyRecord> = {};
  for (let d = 18; d <= 24; d++) {
    const key = `2026-11-${d}`;
    out[key] = day(key, key === missedOn ? 'missed' : 'saved');
  }
  return out;
};

describe('streak follows the records (ROL-002)', () => {
  it('daily: a backdated expense that misses a past day lowers current and best streak', () => {
    const before = computeMetrics(records(), [], '2026-11-01', {}, 'daily');
    expect(before.savingsStreak).toBe(7);
    expect(before.bestStreak).toBe(7);

    const after = computeMetrics(records('2026-11-21'), [], '2026-11-01', {}, 'daily');
    expect(after.savingsStreak).toBe(3);
    expect(after.bestStreak).toBe(3);
    expect(after.bestStreakByCadence.daily).toBe(3);
  });

  it('daily: money back that turns the day saved again brings the streak back', () => {
    expect(computeMetrics(records('2026-11-21'), [], '2026-11-01', {}, 'daily').savingsStreak).toBe(3);
    const back = computeMetrics(records(), [], '2026-11-01', {}, 'daily');
    expect(back.savingsStreak).toBe(7);
    expect(back.bestStreak).toBe(7);
  });

  it('weekly: a past week that becomes missed lowers the weekly best streak', () => {
    const week = (id: string, start: string, status: 'saved' | 'missed'): BudgetPeriodRecord => ({
      id,
      cadence: 'weekly',
      periodStart: start,
      periodEnd: start,
      activeStart: start,
      activeEnd: start,
      budgetAmount: 700,
      spentAmount: status === 'saved' ? 500 : 900,
      amountSaved: status === 'saved' ? 200 : 0,
      status,
      isProrated: false,
    } as BudgetPeriodRecord);
    const periods = (missed: boolean) => ({
      w1: week('w1', '2026-11-02', 'saved'),
      w2: week('w2', '2026-11-09', missed ? 'missed' : 'saved'),
      w3: week('w3', '2026-11-16', 'saved'),
    });
    const before = computeMetrics({}, [], '2026-11-01', periods(false), 'weekly');
    expect(before.bestStreakByCadence.weekly).toBe(3);
    const after = computeMetrics({}, [], '2026-11-01', periods(true), 'weekly');
    expect(after.savingsStreak).toBe(1);
    expect(after.bestStreakByCadence.weekly).toBe(1);
    expect(after.bestStreak).toBe(1);
  });
});
