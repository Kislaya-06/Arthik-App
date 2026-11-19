import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Offline queue safety for the budget side queues (AGENTS.md section 6.1 / 7, OPT-61 lock rule).
 *
 * Each queue is a JSON list or object in AsyncStorage that is changed with "read -> change -> write".
 * Two real data-loss patterns are guarded here:
 *  1. two writers on the same key overlap and the second write wipes the first;
 *  2. a flush reads the queue, waits for the network, then writes back its OLD copy minus the synced items,
 *     which erases anything the user added while the request was in flight.
 * It also guards that a settings patch made of budget-only fields (weekly / monthly amount, cadence) reaches the server.
 */

// ─── In-memory AsyncStorage with a real async gap, so unlocked read-modify-write loses data ───
const storageMap = new Map<string, string>();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      const value = storageMap.get(key) ?? null;
      await tick();
      return value;
    }),
    setItem: vi.fn(async (key: string, val: string) => {
      await tick();
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      await tick();
      storageMap.delete(key);
    }),
    clear: vi.fn(async () => {
      storageMap.clear();
    }),
  },
}));

vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '70000000-0000-4000-8000-000000000001') }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));
vi.mock('lucide-react-native', () => ({}));

const USER_ID = 'user_queue_safety_1';

// Hooks the tests use to act "while the request is in flight".
const hooks: { onRequest: (() => Promise<void>) | null } = { onRequest: null };
const sent: { table: string; op: string; payload: any }[] = [];

vi.mock('../src/config/supabase', () => {
  const request = async (table: string, op: string, payload: any) => {
    sent.push({ table, op, payload });
    if (hooks.onRequest) {
      const run = hooks.onRequest;
      hooks.onRequest = null;
      await run();
    }
    return { error: null };
  };
  return {
    supabase: {
      from: vi.fn((table: string) => ({
        upsert: vi.fn((payload: any) => request(table, 'upsert', payload)),
        update: vi.fn((payload: any) => ({ eq: vi.fn(() => request(table, 'update', payload)) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => request(table, 'delete', null)) })) })),
      })),
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user_queue_safety_1' } } } }) },
    },
  };
});

vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'user_queue_safety_1', created_at: '2026-01-01T00:00:00Z' } })) },
  registerStoreResetCallback: vi.fn(),
}));
vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: { getState: vi.fn(() => ({ categories: [], syncPendingCategories: vi.fn(async () => {}) })) },
}));
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: { getState: vi.fn(() => ({ isOffline: false })) },
  registerSyncCallback: vi.fn(),
}));
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: { getState: vi.fn(() => ({ addNotification: vi.fn(), setOwnerUserId: vi.fn() })) },
}));
vi.mock('../src/lib/notificationService', () => ({ triggerDeviceNotification: vi.fn() }));

import {
  savePendingSettingsOffline,
  clearPendingSettingsOffline,
  savePendingGullakAdd,
  savePendingGullakDelete,
  savePendingPlanChangeOffline,
  savePendingBudgetPeriodOffline,
  getPendingSettingsKey,
  getPendingGullakAddsKey,
  getPendingGullakDeletesKey,
  getPendingPlanChangesKey,
  getPendingBudgetPeriodsKey,
} from '../src/store/dailyBudget/pendingStorage';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';
import { flushSideQueues } from '../src/store/expense/syncPending';
import type { BudgetPlanChange, BudgetPeriodRecord } from '../src/types';

const readJson = (key: string) => {
  const raw = storageMap.get(key);
  return raw ? JSON.parse(raw) : null;
};

const plan = (id: string, effectiveFrom: string): BudgetPlanChange => ({
  id,
  userId: USER_ID,
  effectiveFrom,
  isEnabled: true,
  cadence: 'daily',
  amount: 100,
});

const period = (id: string, activeStart: string): BudgetPeriodRecord => ({
  id,
  userId: USER_ID,
  cadence: 'weekly',
  periodStart: activeStart,
  periodEnd: activeStart,
  activeStart,
  activeEnd: activeStart,
  budgetAmount: 700,
  spentAmount: 0,
  amountSaved: 700,
  status: 'saved',
  isProrated: false,
});

const deposit = (id: string) => ({
  id,
  amount: 50,
  date: '2026-03-15',
  note: '',
  source: 'external' as const,
  created_at: '2026-03-15T10:00:00Z',
});

beforeEach(() => {
  storageMap.clear();
  sent.length = 0;
  hooks.onRequest = null;
  useDailyBudgetStore.getState().resetDailyBudget();
  useDailyBudgetStore.setState({ hydratedForUserId: USER_ID });
});

describe('pending settings queue', () => {
  it('keeps both patches when two settings are saved at the same moment', async () => {
    await Promise.all([
      savePendingSettingsOffline(USER_ID, { weekly_budget: 700 }),
      savePendingSettingsOffline(USER_ID, { budget_cadence: 'weekly' }),
      savePendingSettingsOffline(USER_ID, { monthly_budget: 3000 }),
    ]);
    expect(readJson(getPendingSettingsKey(USER_ID))).toEqual({
      weekly_budget: 700,
      budget_cadence: 'weekly',
      monthly_budget: 3000,
    });
  });

  it('does not lose a patch saved while another key is being cleared', async () => {
    await savePendingSettingsOffline(USER_ID, { daily_budget: 100, is_auto_renew: true });
    await Promise.all([
      clearPendingSettingsOffline(USER_ID, ['daily_budget']),
      savePendingSettingsOffline(USER_ID, { weekly_budget: 700 }),
    ]);
    expect(readJson(getPendingSettingsKey(USER_ID))).toEqual({ is_auto_renew: true, weekly_budget: 700 });
  });

  it('sends a weekly-amount-only patch to the profile on reconnect and clears it', async () => {
    await savePendingSettingsOffline(USER_ID, { weekly_budget: 700 });
    await flushSideQueues(USER_ID, (() => ({ expenses: [] })) as any);
    expect(sent).toContainEqual({ table: 'profiles', op: 'update', payload: { weekly_budget: 700 } });
    expect(storageMap.has(getPendingSettingsKey(USER_ID))).toBe(false);
  });

  it('sends cadence-only and monthly-only patches too', async () => {
    await savePendingSettingsOffline(USER_ID, { budget_cadence: 'monthly', monthly_budget: 9000 });
    await flushSideQueues(USER_ID, (() => ({ expenses: [] })) as any);
    expect(sent).toContainEqual({
      table: 'profiles',
      op: 'update',
      payload: { budget_cadence: 'monthly', monthly_budget: 9000 },
    });
    expect(storageMap.has(getPendingSettingsKey(USER_ID))).toBe(false);
  });

  it('keeps a setting the user changed while the sync request was in flight', async () => {
    await savePendingSettingsOffline(USER_ID, { daily_budget: 100, is_auto_renew: true });
    hooks.onRequest = async () => {
      await savePendingSettingsOffline(USER_ID, { daily_budget: 250 }); // newer value saved mid-request
      await savePendingSettingsOffline(USER_ID, { weekly_budget: 700 }); // a brand-new key saved mid-request
    };
    await flushSideQueues(USER_ID, (() => ({ expenses: [] })) as any);
    expect(sent[0]).toEqual({
      table: 'profiles',
      op: 'update',
      payload: { daily_budget: 100, is_auto_renew: true },
    });
    // The sent keys with an unchanged value are cleared; the newer 250 and the new weekly amount are kept for the next sync.
    expect(readJson(getPendingSettingsKey(USER_ID))).toEqual({ daily_budget: 250, weekly_budget: 700 });
  });
});

describe('budget side queues keep items added while a sync request is in flight', () => {
  it('Gullak deposits: a deposit queued mid-sync stays queued', async () => {
    await savePendingGullakAdd(USER_ID, deposit('d1'));
    hooks.onRequest = async () => {
      await savePendingGullakAdd(USER_ID, deposit('d2'));
    };
    await useDailyBudgetStore.getState().syncPendingGullakDeposits();
    expect(readJson(getPendingGullakAddsKey(USER_ID)).map((d: any) => d.id)).toEqual(['d2']);
  });

  it('Gullak deposits: two deposits saved at the same moment are both queued', async () => {
    await Promise.all([savePendingGullakAdd(USER_ID, deposit('d1')), savePendingGullakAdd(USER_ID, deposit('d2'))]);
    expect(readJson(getPendingGullakAddsKey(USER_ID)).map((d: any) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('Gullak deletes: a delete queued mid-sync stays queued', async () => {
    await savePendingGullakDelete(USER_ID, 'x1');
    hooks.onRequest = async () => {
      await savePendingGullakDelete(USER_ID, 'x2');
    };
    await useDailyBudgetStore.getState().syncPendingGullakDeposits();
    expect(readJson(getPendingGullakDeletesKey(USER_ID))).toEqual(['x2']);
  });

  it('plan changes: a change queued mid-sync stays queued', async () => {
    await savePendingPlanChangeOffline(USER_ID, plan('p1', '2026-03-15'));
    hooks.onRequest = async () => {
      await savePendingPlanChangeOffline(USER_ID, plan('p2', '2026-03-16'));
    };
    await useDailyBudgetStore.getState().syncPendingPlanChanges();
    expect(readJson(getPendingPlanChangesKey(USER_ID)).map((c: any) => c.id)).toEqual(['p2']);
  });

  it('plan changes: two changes saved at the same moment are both queued', async () => {
    await Promise.all([
      savePendingPlanChangeOffline(USER_ID, plan('p1', '2026-03-15')),
      savePendingPlanChangeOffline(USER_ID, plan('p2', '2026-03-16')),
    ]);
    expect(readJson(getPendingPlanChangesKey(USER_ID)).map((c: any) => c.id).sort()).toEqual(['p1', 'p2']);
  });

  it('budget periods: a period queued mid-sync stays queued', async () => {
    await savePendingBudgetPeriodOffline(USER_ID, period('b1', '2026-03-02'));
    hooks.onRequest = async () => {
      await savePendingBudgetPeriodOffline(USER_ID, period('b2', '2026-03-09'));
    };
    await useDailyBudgetStore.getState().uploadPendingBudgetPeriods();
    expect(readJson(getPendingBudgetPeriodsKey(USER_ID)).map((p: any) => p.id)).toEqual(['b2']);
  });

  it('a queued item that did sync is removed (nothing is sent twice)', async () => {
    await savePendingPlanChangeOffline(USER_ID, plan('p1', '2026-03-15'));
    await useDailyBudgetStore.getState().syncPendingPlanChanges();
    expect(storageMap.has(getPendingPlanChangesKey(USER_ID))).toBe(true); // key may remain with an empty list
    expect(readJson(getPendingPlanChangesKey(USER_ID))).toEqual([]);
    expect(sent.filter((s) => s.table === 'budget_plan_changes')).toHaveLength(1);
  });
});
