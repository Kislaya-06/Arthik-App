import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Setup in-memory AsyncStorage
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

// 2. Mock expo-crypto
let uuidCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `10000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`),
}));

// 3. Mock Supabase
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockSupabaseUpsert = vi.fn(() => ({
  select: mockSupabaseSelect.mockReturnValue({
    single: mockSupabaseSingle,
  }),
}));
const mockSupabaseUpdate = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const mockSupabaseDelete = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
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

// 4. Mock AuthStore
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { id: 'user_test_123', email: 'test@example.com' },
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// 5. Mock DailyBudgetStore
vi.mock('../src/store/dailyBudgetStore', () => ({
  useDailyBudgetStore: {
    getState: vi.fn(() => ({
      syncWithExpenses: vi.fn(),
      uploadPendingDailyRecords: vi.fn().mockResolvedValue(undefined),
    })),
  },
  registerExpenseGetter: vi.fn(),
  registerExpensesLoadedGetter: vi.fn(),
}));

// 6. Mock NetworkStore
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

// Now import the store under test
import { useExpenseStore, Expense } from '../src/store/expenseStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('expenseStore (Seam: useExpenseStore)', () => {
  const TEST_USER_ID = 'user_test_123';
  const PENDING_KEY = `@arthik_pending_expenses_${TEST_USER_ID}`;
  const UPDATES_KEY = `@arthik_pending_updates_${TEST_USER_ID}`;
  const DELETES_KEY = `@arthik_pending_deletes_${TEST_USER_ID}`;
  const FAILED_KEY = `@arthik_failed_sync_${TEST_USER_ID}`;

  beforeEach(async () => {
    storageMap.clear();
    vi.clearAllMocks();
    mockIsOffline = false;
    uuidCounter = 1;
    useExpenseStore.getState().resetExpenses();
  });

  describe('Slice 1: Optimistic Addition & Offline Queueing', () => {
    it('optimistically adds expense with pending=true and queues in AsyncStorage when offline', async () => {
      mockIsOffline = true;

      await useExpenseStore.getState().addExpense(
        250,
        null,
        'Chai and snacks',
        'cash',
        '2026-09-22',
        'expense'
      );

      const expenses = useExpenseStore.getState().expenses;
      expect(expenses.length).toBe(1);
      expect(expenses[0]).toMatchObject({
        amount: 250,
        note: 'Chai and snacks',
        payment_mode: 'cash',
        expense_date: '2026-09-22',
        type: 'expense',
        pending: true,
        user_id: TEST_USER_ID,
      });

      // Verify written to pending storage
      const stored = await AsyncStorage.getItem(PENDING_KEY);
      expect(stored).not.toBeNull();
      const pendingList: Expense[] = JSON.parse(stored!);
      expect(pendingList.length).toBe(1);
      expect(pendingList[0].id).toBe(expenses[0].id);
      expect(pendingList[0].pending).toBe(true);
    });

    it('clears pending flag when addExpense succeeds online against Supabase', async () => {
      mockIsOffline = false;
      const expectedId = `10000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
      mockSupabaseSingle.mockResolvedValueOnce({
        data: {
          id: expectedId,
          user_id: TEST_USER_ID,
          amount: 500,
          category_id: null,
          note: 'Grocery',
          payment_mode: 'upi',
          expense_date: '2026-09-22',
          type: 'expense',
        },
        error: null,
      });

      await useExpenseStore.getState().addExpense(
        500,
        null,
        'Grocery',
        'upi',
        '2026-09-22',
        'expense'
      );

      const expenses = useExpenseStore.getState().expenses;
      expect(expenses.length).toBe(1);
      expect(expenses[0].pending).toBe(false);
      expect(expenses[0].amount).toBe(500);

      // Should NOT be stored in pending storage since it succeeded online
      const stored = await AsyncStorage.getItem(PENDING_KEY);
      expect(stored).toBeNull();
    });

    it('rolls back optimistic expense if database returns a permanent validation error', async () => {
      mockIsOffline = false;
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'check constraint failed: amount must be > 0', status: 400 },
      });

      await expect(
        useExpenseStore.getState().addExpense(-50, null, 'Invalid amount', 'cash', '2026-09-22')
      ).rejects.toThrow();

      // State must be rolled back to 0 items
      expect(useExpenseStore.getState().expenses.length).toBe(0);
    });
  });

  describe('Slice 2: Loading Pending Expenses', () => {
    it('hydrates pending offline expenses from AsyncStorage into state', async () => {
      const mockPending: Expense[] = [
        {
          id: '10000000-0000-4000-8000-000000000099',
          user_id: TEST_USER_ID,
          amount: 150,
          category_id: null,
          note: 'Auto rickshaw',
          payment_mode: 'cash',
          expense_date: '2026-09-22',
          pending: true,
        },
      ];
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(mockPending));

      await useExpenseStore.getState().loadPendingExpenses();

      const expenses = useExpenseStore.getState().expenses;
      expect(expenses.length).toBe(1);
      expect(expenses[0].id).toBe('10000000-0000-4000-8000-000000000099');
      expect(expenses[0].pending).toBe(true);
    });
  });

  describe('Slice 3: Update & Delete Queueing', () => {
    it('queues offline update in pending updates storage', async () => {
      // Seed confirmed expense
      const confirmedExpense: Expense = {
        id: '10000000-0000-4000-8000-000000000010',
        user_id: TEST_USER_ID,
        amount: 300,
        payment_mode: 'card',
        expense_date: '2026-09-22',
        pending: false,
      };
      useExpenseStore.setState({ expenses: [confirmedExpense] });

      mockIsOffline = true;
      await useExpenseStore.getState().updateExpense(
        confirmedExpense.id,
        350,
        null,
        'Updated note',
        'card',
        '2026-09-22'
      );

      // Local state is updated optimistically
      const expenses = useExpenseStore.getState().expenses;
      expect(expenses[0].amount).toBe(350);
      expect(expenses[0].note).toBe('Updated note');

      // Stored in updates queue
      const updatesStored = await AsyncStorage.getItem(UPDATES_KEY);
      expect(updatesStored).not.toBeNull();
      const updates = JSON.parse(updatesStored!);
      expect(updates.length).toBe(1);
      expect(updates[0].id).toBe(confirmedExpense.id);
      expect(updates[0].payload.amount).toBe(350);
    });

    it('queues offline delete in pending deletes storage', async () => {
      const confirmedExpense: Expense = {
        id: '10000000-0000-4000-8000-000000000020',
        user_id: TEST_USER_ID,
        amount: 400,
        payment_mode: 'upi',
        expense_date: '2026-09-22',
        pending: false,
      };
      useExpenseStore.setState({ expenses: [confirmedExpense] });

      mockIsOffline = true;
      await useExpenseStore.getState().deleteExpense(confirmedExpense.id);

      // Optimistically removed from state
      expect(useExpenseStore.getState().expenses.length).toBe(0);

      // Enqueued in deletes storage
      const deletesStored = await AsyncStorage.getItem(DELETES_KEY);
      expect(deletesStored).not.toBeNull();
      const deletes = JSON.parse(deletesStored!);
      expect(deletes.some((d: any) => (typeof d === 'string' ? d === confirmedExpense.id : d.id === confirmedExpense.id))).toBe(true);
    });
  });

  describe('Slice 4: Failed Sync Queue Management', () => {
    it('discards a failed sync item and updates AsyncStorage and state', async () => {
      const failedItem = {
        id: 'failed_item_1',
        type: 'add' as const,
        errorReason: 'Test failure reason',
        failedAt: '2026-09-22T10:00:00Z',
      };
      await AsyncStorage.setItem(FAILED_KEY, JSON.stringify([failedItem]));
      useExpenseStore.setState({ failedSyncItems: [failedItem] });

      await useExpenseStore.getState().discardFailedSyncItem('failed_item_1');

      expect(useExpenseStore.getState().failedSyncItems.length).toBe(0);
      const stored = await AsyncStorage.getItem(FAILED_KEY);
      expect(JSON.parse(stored!)).toEqual([]);
    });

    it('loads failed sync items from AsyncStorage into state', async () => {
      const failedItem = {
        id: 'failed_item_2',
        type: 'update' as const,
        errorReason: 'Network timeout',
        failedAt: '2026-09-22T11:00:00Z',
      };
      await AsyncStorage.setItem(FAILED_KEY, JSON.stringify([failedItem]));

      await useExpenseStore.getState().loadFailedSyncItems();

      expect(useExpenseStore.getState().failedSyncItems).toEqual([failedItem]);
    });
  });

  describe('Slice 5: Store Reset on Sign-out', () => {
    it('resets expenses, loading, and failed sync items on resetExpenses', () => {
      useExpenseStore.setState({
        expenses: [
          {
            id: '10000000-0000-4000-8000-000000000030',
            user_id: TEST_USER_ID,
            amount: 100,
            payment_mode: 'cash',
            expense_date: '2026-09-22',
          },
        ],
        loading: true,
        isExpensesLoaded: true,
        failedSyncItems: [
          {
            id: 'item1',
            type: 'add',
            errorReason: 'Test failure',
            failedAt: '2026-09-22T00:00:00Z',
          },
        ],
      });

      useExpenseStore.getState().resetExpenses();

      const state = useExpenseStore.getState();
      expect(state.expenses).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.isExpensesLoaded).toBe(false);
      expect(state.failedSyncItems).toEqual([]);
    });
  });
});
