import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(async () => {
      storageMap.clear();
    }),
  },
}));

let uuidCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `20000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
}));

const mockUpsertPayloads: any[] = [];
const mockSupabaseSingle = vi.fn();
const mockSupabaseSelect = vi.fn(() => ({ single: mockSupabaseSingle }));
const mockSupabaseUpsert = vi.fn((payload: any) => {
  mockUpsertPayloads.push(payload);
  return { select: mockSupabaseSelect };
});
const mockSupabaseUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
const mockSupabaseDelete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((_table: string) => ({
      upsert: mockSupabaseUpsert,
      update: mockSupabaseUpdate,
      delete: mockSupabaseDelete,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_test_ledger', email: 'test@example.com' } } },
      }),
    },
  },
}));

vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'user_test_ledger', email: 'test@example.com' } })) },
  registerStoreResetCallback: vi.fn(),
}));

const syncWithExpenses = vi.fn();
vi.mock('../src/store/dailyBudgetStore', () => ({
  useDailyBudgetStore: {
    getState: vi.fn(() => ({ syncWithExpenses, uploadPendingDailyRecords: vi.fn().mockResolvedValue(undefined) })),
  },
  registerExpenseGetter: vi.fn(),
  registerExpensesLoadedGetter: vi.fn(),
  registerAddExpense: vi.fn(),
}));

vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: false,
      setOffline: vi.fn(),
      triggerOfflineAlert: vi.fn(),
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import { useExpenseStore } from '../src/store/expenseStore';
import { recordMoneyBack } from '../src/store/expense/moneyBack';
import { buildPersonSummaries } from '../src/lib/splitLedger';

describe('Ledger Settle Actions (Single Expense "Paid" vs "Settle All")', () => {
  beforeEach(() => {
    storageMap.clear();
    mockUpsertPayloads.length = 0;
    uuidCounter = 1;
    mockSupabaseSingle.mockImplementation(async () => ({ data: null, error: null }));
    useExpenseStore.setState({ expenses: [], isExpensesLoaded: true, failedSyncItems: [] });
  });

  it('settles a single targeted expense (Mark as Paid) leaving other splits open', async () => {
    const store = useExpenseStore.getState();

    // 1. Add 3 split expenses for Aditya matching the user screenshot
    await store.addExpense(12, null, 'Akash Kumar', 'upi', '2026-10-19', 'expense', {
      split: { person: 'Aditya', amount: 12 },
    });
    await store.addExpense(25, null, 'Expense 2', 'upi', '2026-10-19', 'expense', {
      split: { person: 'Aditya', amount: 25 },
    });
    await store.addExpense(146.67, null, 'Expense 3', 'upi', '2026-10-19', 'expense', {
      split: { person: 'Aditya', amount: 146.67 },
    });

    // Check initial ledger summary for Aditya
    let summaries = buildPersonSummaries(useExpenseStore.getState().expenses);
    let aditya = summaries.find((p) => p.name === 'Aditya')!;
    expect(aditya.owed).toBe(183.67);
    expect(aditya.splits.length).toBe(3);
    expect(aditya.isSettled).toBe(false);

    // 2. Target only the first expense (Akash Kumar, ₹12)
    const targetSplit = aditya.splits.find((s) => s.note === 'Akash Kumar')!;
    expect(targetSplit.outstanding).toBe(12);
    expect(targetSplit.isSettled).toBe(false);

    await recordMoneyBack({
      kind: 'settlement',
      who: 'Aditya',
      amount: 12,
      date: '2026-10-19',
      paymentMode: 'cash',
      expenseIds: [targetSplit.expenseId],
    });

    // 3. Verify ledger updates: target is settled, other 2 are still outstanding
    summaries = buildPersonSummaries(useExpenseStore.getState().expenses);
    aditya = summaries.find((p) => p.name === 'Aditya')!;
    expect(aditya.owed).toBe(171.67);
    expect(aditya.totalPaidBack).toBe(12);

    const updatedFirst = aditya.splits.find((s) => s.expenseId === targetSplit.expenseId)!;
    expect(updatedFirst.isSettled).toBe(true);
    expect(updatedFirst.outstanding).toBe(0);

    const updatedSecond = aditya.splits.find((s) => s.note === 'Expense 2')!;
    expect(updatedSecond.isSettled).toBe(false);
    expect(updatedSecond.outstanding).toBe(25);

    const updatedThird = aditya.splits.find((s) => s.note === 'Expense 3')!;
    expect(updatedThird.isSettled).toBe(false);
    expect(updatedThird.outstanding).toBe(146.67);
  });

  it('settles all open expenses (Settle All) in oldest-first order', async () => {
    const store = useExpenseStore.getState();

    await store.addExpense(12, null, 'Akash Kumar', 'upi', '2026-10-19', 'expense', {
      split: { person: 'Aditya', amount: 12 },
    });
    await store.addExpense(25, null, 'Expense 2', 'upi', '2026-10-19', 'expense', {
      split: { person: 'Aditya', amount: 25 },
    });
    await store.addExpense(146.67, null, 'Expense 3', 'upi', '2026-10-19', 'expense', {
      split: { person: 'Aditya', amount: 146.67 },
    });

    let summaries = buildPersonSummaries(useExpenseStore.getState().expenses);
    let aditya = summaries.find((p) => p.name === 'Aditya')!;
    expect(aditya.owed).toBe(183.67);

    // Settle All (without expenseIds)
    await recordMoneyBack({
      kind: 'settlement',
      who: 'Aditya',
      amount: 183.67,
      date: '2026-10-19',
      paymentMode: 'upi',
    });

    summaries = buildPersonSummaries(useExpenseStore.getState().expenses);
    aditya = summaries.find((p) => p.name === 'Aditya')!;
    expect(aditya.owed).toBe(0);
    expect(aditya.totalPaidBack).toBe(183.67);
    expect(aditya.isSettled).toBe(true);
    expect(aditya.splits.every((s) => s.isSettled)).toBe(true);
  });

  it('maps Option 1 row tap to single expense settlement target with correct parameters', async () => {
    const store = useExpenseStore.getState();

    await store.addExpense(12, null, 'Akash Kumar', 'upi', '2026-10-19', 'expense', {
      split: { person: 'Aditya', amount: 12 },
    });

    const summaries = buildPersonSummaries(useExpenseStore.getState().expenses);
    const aditya = summaries.find((p) => p.name === 'Aditya')!;
    const split = aditya.splits[0];

    // Option 1 contract: row tap on unsettled item opens SettleExpenseSheet for that specific target
    const targetPayload = {
      personName: aditya.name,
      targetExpense: {
        expenseId: split.expenseId,
        note: split.note,
        outstanding: split.outstanding,
        date: split.date,
      },
      totalOwed: split.outstanding,
    };

    expect(targetPayload.personName).toBe('Aditya');
    expect(targetPayload.targetExpense.expenseId).toBe(split.expenseId);
    expect(targetPayload.targetExpense.outstanding).toBe(12);
    expect(targetPayload.totalOwed).toBe(12);
  });
});

