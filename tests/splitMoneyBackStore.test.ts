import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same mock set as tests/expenseStore.test.ts (reused on purpose).
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
  randomUUID: vi.fn(() => `10000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
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
        data: { session: { user: { id: 'user_test_123', email: 'test@example.com' } } },
      }),
    },
  },
}));

vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'user_test_123', email: 'test@example.com' } })) },
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

let mockIsOffline = false;
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: mockIsOffline,
      setOffline: vi.fn((val: boolean) => {
        mockIsOffline = val;
      }),
      triggerOfflineAlert: vi.fn(),
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import { useExpenseStore } from '../src/store/expenseStore';
import { recordMoneyBack, convertIncomeToMoneyBack, previewMoneyBack } from '../src/store/expense/moneyBack';

const get = () => useExpenseStore.getState();
const row = (id: string) => get().expenses.find((e) => e.id === id)!;

describe('Split + money back through the expense store (SPL-001..SPL-006)', () => {
  beforeEach(() => {
    storageMap.clear();
    uuidCounter = 1;
    mockIsOffline = false;
    mockUpsertPayloads.length = 0;
    syncWithExpenses.mockClear();
    useExpenseStore.setState({ expenses: [], isExpensesLoaded: true, failedSyncItems: [] });
    mockSupabaseSingle.mockImplementation(async () => ({ data: null, error: null }));
  });

  const addDinner = () =>
    get().addExpense(300, null, 'Dinner', 'upi', '2026-10-10', 'expense', {
      id: '20000000-0000-4000-8000-000000000001',
      split: { person: 'Prithvish', amount: 200 },
    });
  const DINNER = '20000000-0000-4000-8000-000000000001';

  it('saves the split columns and keeps the full amount paid', async () => {
    await addDinner();
    expect(mockUpsertPayloads[0]).toMatchObject({ amount: 300, split_person: 'Prithvish', split_amount: 200, transaction_class: 'normal' });
    expect(row(DINNER).amount).toBe(300);
    expect(row(DINNER).split_amount).toBe(200);
  });

  it('a normal expense is sent WITHOUT the new columns, so the app works before the SQL is run', async () => {
    await get().addExpense(50, null, 'Tea', 'cash', '2026-10-10', 'expense');
    const payload = mockUpsertPayloads[0];
    expect(Object.keys(payload)).not.toContain('split_person');
    expect(Object.keys(payload)).not.toContain('recovery_kind');
    expect(Object.keys(payload)).not.toContain('recovery_allocations');
  });

  it('a money-back row reduces the counted amount of the original expense and is never income', async () => {
    await addDinner();
    await get().addExpense(200, null, 'Prithvish paid back', 'upi', '2026-10-18', 'income', {
      transactionClass: 'recovery',
      recovery: { kind: 'settlement', person: 'Prithvish', allocations: [{ expense_id: DINNER, amount: 200 }] },
    });
    expect(mockUpsertPayloads[1]).toMatchObject({
      type: 'income',
      transaction_class: 'recovery',
      recovery_kind: 'settlement',
      recovery_person: 'Prithvish',
      recovery_allocations: [{ expense_id: DINNER, amount: 200 }],
    });
    expect(row(DINNER).amount).toBe(100); // counted
    expect(row(DINNER).gross_amount).toBe(300); // paid
    // every sync with the daily-budget store saw the reduced amount
    const lastSeen = syncWithExpenses.mock.calls[syncWithExpenses.mock.calls.length - 1][0];
    expect(lastSeen.find((e: any) => e.id === DINNER).amount).toBe(100);
  });

  it('an expense with money back cannot be deleted; deleting the money-back row restores the full amount', async () => {
    await addDinner();
    await get().addExpense(200, null, 'Prithvish paid back', 'upi', '2026-10-18', 'income', {
      id: '20000000-0000-4000-8000-000000000002',
      transactionClass: 'recovery',
      recovery: { kind: 'settlement', person: 'Prithvish', allocations: [{ expense_id: DINNER, amount: 200 }] },
    });
    await expect(get().deleteExpense(DINNER)).rejects.toThrow(/money-back entry first/);
    expect(row(DINNER)).toBeDefined();

    await get().deleteExpense('20000000-0000-4000-8000-000000000002');
    expect(row(DINNER).amount).toBe(300);
  });

  it('editing the amount keeps the paid amount as the base and re-applies money back', async () => {
    await addDinner();
    await get().addExpense(100, null, 'Prithvish paid back', 'upi', '2026-10-18', 'income', {
      transactionClass: 'recovery',
      recovery: { kind: 'settlement', person: 'Prithvish', allocations: [{ expense_id: DINNER, amount: 100 }] },
    });
    expect(row(DINNER).amount).toBe(200);
    await get().updateExpense(DINNER, 400, null, 'Dinner', 'upi', '2026-10-10', 'expense', {
      split: { person: 'Prithvish', amount: 250 },
    });
    expect(row(DINNER).gross_amount).toBe(400);
    expect(row(DINNER).amount).toBe(300);
    expect(row(DINNER).split_amount).toBe(250);
  });

  it('removing a split sends null for both columns', async () => {
    await addDinner();
    await get().updateExpense(DINNER, 300, null, 'Dinner', 'upi', '2026-10-10', 'expense', { split: null });
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(expect.objectContaining({ split_person: null, split_amount: null }));
    expect(row(DINNER).split_person).toBeNull();
  });

  it('works offline: the pending queue keeps the split and money-back fields', async () => {
    mockIsOffline = true;
    await addDinner();
    await get().addExpense(200, null, 'back', 'upi', '2026-10-18', 'income', {
      transactionClass: 'recovery',
      recovery: { kind: 'settlement', person: 'Prithvish', allocations: [{ expense_id: DINNER, amount: 200 }] },
    });
    const queued = JSON.parse(storageMap.get('@arthik_pending_expenses_user_test_123') as string);
    expect(queued).toHaveLength(2);
    expect(queued[0]).toMatchObject({ split_person: 'Prithvish', split_amount: 200, amount: 300 });
    expect(queued[1]).toMatchObject({ transaction_class: 'recovery', recovery_kind: 'settlement' });
    expect(row(DINNER).amount).toBe(100);
  });

  describe('recordMoneyBack / convertIncomeToMoneyBack (SPL-003, SPL-004, SPL-006)', () => {
    const addPetrol = () =>
      get().addExpense(200, null, 'Petrol', 'upi', '2026-10-14', 'expense', {
        id: '20000000-0000-4000-8000-000000000003',
        split: { person: 'prithvish', amount: 100 },
      });

    it('records ONE money-back row for the oldest expenses first, nothing else', async () => {
      await addDinner();
      await addPetrol();
      const res = await recordMoneyBack({ kind: 'settlement', who: 'Prithvish', amount: 300, date: '2026-10-18', paymentMode: 'upi' });
      expect(res.plan.excess).toBe(0);
      const backRows = get().expenses.filter((e) => e.transaction_class === 'recovery');
      expect(backRows).toHaveLength(1);
      expect(backRows[0].recovery_allocations).toEqual([
        { expense_id: DINNER, amount: 200 },
        { expense_id: '20000000-0000-4000-8000-000000000003', amount: 100 },
      ]);
      expect(row(DINNER).amount).toBe(100);
      // no extra income was created
      expect(get().expenses.filter((e) => e.type === 'income' && e.transaction_class !== 'recovery')).toHaveLength(0);
    });

    it('more than owed: the extra becomes ordinary income (SPL-004)', async () => {
      await addDinner();
      await recordMoneyBack({ kind: 'settlement', who: 'Prithvish', amount: 250, date: '2026-10-18', paymentMode: 'upi' });
      const back = get().expenses.find((e) => e.transaction_class === 'recovery')!;
      expect(back.amount).toBe(200);
      const extra = get().expenses.find((e) => e.type === 'income' && e.transaction_class === 'normal')!;
      expect(extra.amount).toBe(50);
    });

    it('refuses to record when nothing is owed or the amount is empty', async () => {
      await expect(recordMoneyBack({ kind: 'settlement', who: 'Nobody', amount: 100, date: '2026-10-18', paymentMode: 'upi' })).rejects.toThrow(/Nothing is left/);
      await expect(recordMoneyBack({ kind: 'settlement', who: 'A', amount: 0, date: '2026-10-18', paymentMode: 'upi' })).rejects.toThrow(/Enter an amount/);
    });

    it('a refund needs the expense it belongs to', async () => {
      await addDinner();
      await expect(recordMoneyBack({ kind: 'refund', who: 'Amazon', amount: 100, date: '2026-10-18', paymentMode: 'upi' })).rejects.toThrow(/Choose the expense/);
      await recordMoneyBack({ kind: 'refund', who: 'Amazon', amount: 100, date: '2026-10-18', paymentMode: 'upi', refundExpenseId: DINNER });
      expect(row(DINNER).amount).toBe(200);
    });

    it('previewMoneyBack saves nothing', async () => {
      await addDinner();
      const before = get().expenses.length;
      expect(previewMoneyBack({ kind: 'settlement', who: 'Prithvish', amount: 100 }).allocated).toBe(100);
      expect(get().expenses.length).toBe(before);
    });

    it('turns an already logged income (AutoLog credit) into money back and keeps its id', async () => {
      await addDinner();
      const CREDIT = '20000000-0000-4000-8000-000000000009';
      await get().addExpense(200, null, 'PRITHVISH KUMAR', 'upi', '2026-10-18', 'income', { id: CREDIT });
      await convertIncomeToMoneyBack({ incomeId: CREDIT, kind: 'settlement', who: 'Prithvish' });
      const back = row(CREDIT);
      expect(back.transaction_class).toBe('recovery');
      expect(back.amount).toBe(200);
      expect(back.recovery_person).toBe('Prithvish');
      expect(row(DINNER).amount).toBe(100);
    });

    it('if converting fails, the original income is put back (no money lost)', async () => {
      const CREDIT = '20000000-0000-4000-8000-000000000008';
      await get().addExpense(200, null, 'Someone', 'upi', '2026-10-18', 'income', { id: CREDIT });
      await expect(convertIncomeToMoneyBack({ incomeId: CREDIT, kind: 'settlement', who: 'Nobody' })).rejects.toThrow();
      expect(row(CREDIT).transaction_class).toBe('normal');
      expect(row(CREDIT).amount).toBe(200);
    });

    it('rejects things that are not plain income', async () => {
      await addDinner();
      await expect(convertIncomeToMoneyBack({ incomeId: DINNER, kind: 'settlement', who: 'Prithvish' })).rejects.toThrow(/not income/);
    });
  });
});
