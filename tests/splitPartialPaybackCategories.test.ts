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
import { convertIncomeToMoneyBack } from '../src/store/expense/moneyBack';
import { buildPersonSummaries } from '../src/lib/splitLedger';
import { sumCountedSpending } from '../src/money/ledger';

const FOOD = '11111111-1111-4111-8111-111111111111';
const TRAVEL = '22222222-2222-4222-8222-222222222222';

const rowsOf = () => useExpenseStore.getState().expenses;
const categoryTotal = (categoryId: string) => sumCountedSpending(rowsOf().filter((e) => e.category_id === categoryId), []);
const counted = (note: string) => rowsOf().find((e) => e.note === note)!.amount;

describe('Friend pays back less than they owe: oldest split clears first, each category gets its own part back', () => {
  beforeEach(async () => {
    storageMap.clear();
    mockUpsertPayloads.length = 0;
    uuidCounter = 1;
    mockSupabaseSingle.mockImplementation(async () => ({ data: null, error: null }));
    useExpenseStore.setState({ expenses: [], isExpensesLoaded: true, failedSyncItems: [] });

    const store = useExpenseStore.getState();
    // Aditya's share: 400 (Food, Oct 1), 300 (Travel, Oct 5), 100 (Food, Oct 10). He owes 800.
    await store.addExpense(1000, FOOD, 'Dinner', 'upi', '2026-10-01', 'expense', { split: { person: 'Aditya', amount: 400 } });
    await store.addExpense(600, TRAVEL, 'Cab', 'upi', '2026-10-05', 'expense', { split: { person: 'Aditya', amount: 300 } });
    await store.addExpense(200, FOOD, 'Snacks', 'upi', '2026-10-10', 'expense', { split: { person: 'Aditya', amount: 100 } });
  });

  it('before any payback every category shows the full amount paid', () => {
    expect(categoryTotal(FOOD)).toBe(1200);
    expect(categoryTotal(TRAVEL)).toBe(600);
  });

  it('income of 500 marked as Aditya\'s payback: Dinner is cleared (400), Cab gets 100 back, Snacks untouched', async () => {
    await useExpenseStore.getState().addExpense(500, null, 'UPI credit', 'upi', '2026-10-12', 'income', { id: '33333333-3333-4333-8333-333333333333' });
    await convertIncomeToMoneyBack({ incomeId: '33333333-3333-4333-8333-333333333333', kind: 'settlement', who: 'Aditya' });

    // What counts as my spending in each category went down by exactly what came back for it.
    expect(counted('Dinner')).toBe(600);
    expect(counted('Cab')).toBe(500);
    expect(counted('Snacks')).toBe(200);
    expect(categoryTotal(FOOD)).toBe(800);
    expect(categoryTotal(TRAVEL)).toBe(500);

    // The ledger agrees: 300 still owed, oldest first.
    const aditya = buildPersonSummaries(rowsOf()).find((p) => p.name === 'Aditya')!;
    expect(aditya.owed).toBe(300);
    expect(aditya.totalPaidBack).toBe(500);

    // The money is NOT income, and the paid amounts in the database are unchanged.
    const payback = rowsOf().find((e) => e.id === '33333333-3333-4333-8333-333333333333')!;
    expect(payback.transaction_class).toBe('recovery');
    expect(rowsOf().find((e) => e.note === 'Dinner')!.gross_amount).toBe(1000);
  });

  it('the next payback continues from the oldest split that is still open', async () => {
    const id1 = '44444444-4444-4444-8444-444444444444';
    const id2 = '55555555-5555-4555-8555-555555555555';
    await useExpenseStore.getState().addExpense(500, null, 'UPI credit', 'upi', '2026-10-12', 'income', { id: id1 });
    await convertIncomeToMoneyBack({ incomeId: id1, kind: 'settlement', who: 'Aditya' });
    await useExpenseStore.getState().addExpense(250, null, 'UPI credit 2', 'upi', '2026-10-13', 'income', { id: id2 });
    await convertIncomeToMoneyBack({ incomeId: id2, kind: 'settlement', who: 'Aditya' });

    // 250 more: Cab's remaining 200 clears, Snacks gets 50 back.
    expect(counted('Cab')).toBe(300);
    expect(counted('Snacks')).toBe(150);
    expect(categoryTotal(TRAVEL)).toBe(300);
    expect(categoryTotal(FOOD)).toBe(750);
  });

  it('deleting the payback row puts every category back exactly', async () => {
    const id = '66666666-6666-4666-8666-666666666666';
    await useExpenseStore.getState().addExpense(500, null, 'UPI credit', 'upi', '2026-10-12', 'income', { id });
    await convertIncomeToMoneyBack({ incomeId: id, kind: 'settlement', who: 'Aditya' });
    await useExpenseStore.getState().deleteExpense(id);

    expect(categoryTotal(FOOD)).toBe(1200);
    expect(categoryTotal(TRAVEL)).toBe(600);
  });
});
