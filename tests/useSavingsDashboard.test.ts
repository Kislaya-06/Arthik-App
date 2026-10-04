import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});
// useFocusEffect re-runs every time the screen regains focus. A LAYOUT effect models that here, because freeze()/reveal()
// in the hook runtime re-run layout effects, which is exactly "leave the screen and come back".
vi.mock('@react-navigation/native', async () => {
  const rt = await import('./helpers/hookRuntime');
  return { useFocusEffect: (cb: () => void) => rt.reactHooks.useLayoutEffect(() => cb(), [cb]) };
});

const data = vi.hoisted(() => ({
  today: { date: '2026-10-04', budget: 500, spent: 200, saved: 0, isFinalized: false, status: 'active' } as any,
  past: [] as any[],
  income: 777,
  fetchExpenses: vi.fn(async () => {}),
  syncWithExpenses: vi.fn(),
  toggleAutoRenew: vi.fn(),
  cancelScheduled: vi.fn(),
}));

vi.mock('../src/store/dailyBudgetStore', async () => {
  const { createFakeStore } = await import('./helpers/fakeStore');
  const useDailyBudgetStore = createFakeStore<any>({
    dailyBudgetAmount: 500,
    isAutoRenew: true,
    totalAccumulatedSavings: 1200,
    savingsStreak: 3,
    bestStreak: 5,
    scheduledNextDailyBudget: null,
    dailyRecords: {},
    gullakDeposits: [],
    toggleAutoRenew: data.toggleAutoRenew,
    cancelScheduledNextDailyBudget: data.cancelScheduled,
    syncWithExpenses: data.syncWithExpenses,
    getTodayRecord: () => data.today,
    getPastRecordsList: () => data.past,
    getAvailableIncomeBalance: () => data.income,
  });
  return { useDailyBudgetStore };
});
vi.mock('../src/store/expenseStore', async () => {
  const { createFakeStore } = await import('./helpers/fakeStore');
  const useExpenseStore = createFakeStore<any>({ expenses: [{ id: 'e1' }], fetchExpenses: data.fetchExpenses });
  return { useExpenseStore };
});

import { renderHook, act } from './helpers/hookRuntime';
import { useSavingsDashboard } from '../src/hooks/useSavingsDashboard';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';

const saved = (date: string, amount: number) => ({ date, budget: 500, spent: 500 - amount, saved: amount, isFinalized: true, status: 'saved' });
const missed = (date: string) => ({ date, budget: 500, spent: 600, saved: 0, isFinalized: true, status: 'exceeded' });

describe('useSavingsDashboard (everything the Savings screen shows)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T10:00:00'));
    vi.clearAllMocks();
    data.past = [];
    data.today = { date: '2026-10-04', budget: 500, spent: 200, saved: 0, isFinalized: false, status: 'active' };
    data.income = 777;
    useDailyBudgetStore.setState({ dailyBudgetAmount: 500, isAutoRenew: true, savingsStreak: 3, bestStreak: 5, totalAccumulatedSavings: 1200 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes the stored numbers straight through', () => {
    const r = renderHook(() => useSavingsDashboard()).result.current;
    expect(r.totalAccumulatedSavings).toBe(1200);
    expect(r.dailyBudgetAmount).toBe(500);
    expect(r.isAutoRenew).toBe(true);
    expect(r.savingsStreak).toBe(3);
    expect(r.bestStreak).toBe(5);
    expect(r.availableIncome).toBe(777);
  });

  describe('streaks (cold start safety)', () => {
    it('with NO saved days the streaks are forced to 0, even if stale numbers were loaded from storage', () => {
      data.past = [missed('2026-10-03')];
      const r = renderHook(() => useSavingsDashboard()).result.current;
      expect(r.savedDaysCount).toBe(0);
      expect(r.effectiveStreak).toBe(0);
      expect(r.effectiveBestStreak).toBe(0);
      expect(r.savingsStreak).toBe(3); // the raw store value is still exposed untouched
    });

    it('with saved days the real streaks are used', () => {
      data.past = [saved('2026-10-03', 100), saved('2026-10-02', 50), missed('2026-10-01')];
      const r = renderHook(() => useSavingsDashboard()).result.current;
      expect(r.savedDaysCount).toBe(2);
      expect(r.effectiveStreak).toBe(3);
      expect(r.effectiveBestStreak).toBe(5);
    });

    it('only FINALIZED days that really saved something count as saved days', () => {
      data.past = [
        saved('2026-10-03', 100),
        { ...saved('2026-10-02', 100), isFinalized: false },
        { ...saved('2026-10-01', 0), saved: 0 },
      ];
      expect(renderHook(() => useSavingsDashboard()).result.current.savedDaysCount).toBe(1);
    });
  });

  describe("today's numbers", () => {
    it('are derived from the today record', () => {
      const r = renderHook(() => useSavingsDashboard()).result.current;
      expect(r.todayRecord).toBe(data.today);
      expect(r.todayMetrics).toMatchObject({ budget: 500, spent: 200, remaining: 300, isOverBudget: false });
    });

    it('show "over budget" when more than the allowance was spent', () => {
      data.today = { ...data.today, spent: 650 };
      const r = renderHook(() => useSavingsDashboard()).result.current;
      expect(r.todayMetrics.isOverBudget).toBe(true);
      expect(r.todayMetrics.overAmount).toBe(150);
      expect(r.todayMetrics.remaining).toBe(0);
    });
  });

  describe('filtering past records', () => {
    it('"All" is the default and keeps every past record', () => {
      data.past = [saved('2026-10-03', 100), saved('2025-01-01', 40)];
      const r = renderHook(() => useSavingsDashboard()).result.current;
      expect(r.activeFilter).toBe('All');
      expect(r.pastRecords).toHaveLength(2);
      expect(r.filteredRecords).toHaveLength(2);
    });

    it('changing the filter re-filters, without touching the full past list', () => {
      data.past = [saved('2026-10-03', 100), saved('2025-01-01', 40)];
      const h = renderHook(() => useSavingsDashboard());
      h.result.current.setActiveFilter('This Month');
      expect(h.result.current.activeFilter).toBe('This Month');
      expect(h.result.current.filteredRecords.map((x) => x.date)).toEqual(['2026-10-03']);
      expect(h.result.current.pastRecords).toHaveLength(2);
    });
  });

  describe('loading data when the screen is focused', () => {
    it('the first focus fetches fresh expenses, then syncs the budget with them', async () => {
      renderHook(() => useSavingsDashboard());
      await act(async () => {});
      expect(data.fetchExpenses).toHaveBeenCalledTimes(1);
      expect(data.syncWithExpenses).toHaveBeenCalledTimes(1);
      expect(data.syncWithExpenses).toHaveBeenCalledWith([{ id: 'e1' }]);
    });

    it('coming back within a minute only re-syncs from memory (no new network fetch)', async () => {
      const h = renderHook(() => useSavingsDashboard());
      await act(async () => {});
      expect(data.fetchExpenses).toHaveBeenCalledTimes(1);
      data.syncWithExpenses.mockClear();

      vi.setSystemTime(new Date('2026-10-04T10:00:30')); // 30 seconds later
      h.freeze();
      h.reveal(); // leave the screen and come back
      await act(async () => {});
      expect(data.fetchExpenses).toHaveBeenCalledTimes(1); // still only the first fetch
      expect(data.syncWithExpenses).toHaveBeenCalledTimes(1); // but the budget was re-synced
    });

    it('coming back after a minute fetches fresh expenses again', async () => {
      const h = renderHook(() => useSavingsDashboard());
      await act(async () => {});
      expect(data.fetchExpenses).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date('2026-10-04T10:01:01')); // 61 seconds later
      h.freeze();
      h.reveal();
      await act(async () => {});
      expect(data.fetchExpenses).toHaveBeenCalledTimes(2);
    });

    it('pull to refresh shows the spinner while loading and ALWAYS fetches', async () => {
      const h = renderHook(() => useSavingsDashboard());
      await act(async () => {});
      data.fetchExpenses.mockClear();

      let release!: () => void;
      data.fetchExpenses.mockImplementationOnce(() => new Promise<void>((res) => { release = res; }));
      const pending = h.result.current.onRefresh();
      expect(h.result.current.refreshing).toBe(true);
      release();
      await pending;
      expect(h.result.current.refreshing).toBe(false);
      expect(data.fetchExpenses).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto renew switch', () => {
    it('turning it ON with no budget set opens the budget sheet instead (and does not toggle)', () => {
      useDailyBudgetStore.setState({ dailyBudgetAmount: 0, isAutoRenew: false });
      const h = renderHook(() => useSavingsDashboard());
      h.result.current.handleToggleAutoRenew(true);
      expect(data.toggleAutoRenew).not.toHaveBeenCalled();
      expect(h.result.current.budgetModal).toEqual({ visible: true, mode: 'recurring', initialAmount: 0 });
    });

    it('turning it ON with a budget toggles it', () => {
      const h = renderHook(() => useSavingsDashboard());
      h.result.current.handleToggleAutoRenew(true);
      expect(data.toggleAutoRenew).toHaveBeenCalledWith(true);
      expect(h.result.current.budgetModal.visible).toBe(false);
    });

    it('turning it OFF always just toggles', () => {
      useDailyBudgetStore.setState({ dailyBudgetAmount: 0 });
      const h = renderHook(() => useSavingsDashboard());
      h.result.current.handleToggleAutoRenew(false);
      expect(data.toggleAutoRenew).toHaveBeenCalledWith(false);
    });
  });

  describe('budget sheet', () => {
    it('opens pre-filled with the current budget and closes without forgetting it', () => {
      const h = renderHook(() => useSavingsDashboard());
      expect(h.result.current.budgetModal.visible).toBe(false);
      h.result.current.openBudgetModal();
      expect(h.result.current.budgetModal).toEqual({ visible: true, mode: 'recurring', initialAmount: 500 });
      h.result.current.closeBudgetModal();
      expect(h.result.current.budgetModal.visible).toBe(false);
      expect(h.result.current.budgetModal.initialAmount).toBe(500);
    });
  });

  it('exposes the scheduled next budget and a way to cancel it', () => {
    useDailyBudgetStore.setState({ scheduledNextDailyBudget: 650 });
    const r = renderHook(() => useSavingsDashboard()).result.current;
    expect(r.scheduledNextDailyBudget).toBe(650);
    r.cancelScheduledNextDailyBudget();
    expect(data.cancelScheduled).toHaveBeenCalledTimes(1);
  });
});
