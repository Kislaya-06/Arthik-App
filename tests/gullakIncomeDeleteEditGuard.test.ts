import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Appearance: {
    getColorScheme: vi.fn(() => 'light'),
    addChangeListener: vi.fn(),
  },
}));

vi.mock('lucide-react-native', () => ({
  Wallet: () => null,
  CheckSquare: () => null,
  CreditCard: () => null,
  HelpCircle: () => null,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

const createQueryBuilder = () => {
  const builder: any = {
    insert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return builder;
};

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => createQueryBuilder()),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_budget_test_1', created_at: '2026-09-01T00:00:00Z' } } },
      }),
    },
  },
}));

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

vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { id: 'user_budget_test_1', created_at: '2026-09-01T00:00:00Z' },
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: vi.fn(() => ({
      categories: [],
    })),
  },
}));

vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: vi.fn(),
}));

vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      addNotification: vi.fn(),
      setOwnerUserId: vi.fn(),
    })),
  },
}));

import { calculateGullakIncomeDeficit } from '../src/lib/gullakReconciliation';
import { Expense } from '../src/store/expense/types';
import { GullakDeposit } from '../src/store/dailyBudget/types';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';

describe('FIN-06: Gullak Income Delete and Edit Reconciliation', () => {
  const baseExpenses: Expense[] = [
    {
      id: 'inc-1',
      user_id: 'u1',
      amount: 10000,
      gross_amount: 10000,
      type: 'income',
      expense_date: '2026-10-19',
      payment_mode: 'upi',
      created_at: '2026-10-19T10:00:00Z',
    },
  ];

  const baseDeposits: GullakDeposit[] = [
    {
      id: 'dep-1',
      amount: 4000,
      date: '2026-10-19',
      source: 'income',
      created_at: '2026-10-19T11:00:00Z',
    },
  ];

  it('calculates full deficit (₹4,000) when user deletes an income of ₹10,000 that backed ₹4,000 in Gullak', () => {
    const deficit = calculateGullakIncomeDeficit({
      dateStr: '2026-10-19',
      expenseId: 'inc-1',
      newAmount: 0,
      expenses: baseExpenses,
      gullakDeposits: baseDeposits,
    });
    expect(deficit).toBe(4000);
  });

  it('calculates zero deficit when user reduces income to ₹6,000 (which still covers ₹4,000 in Gullak)', () => {
    const deficit = calculateGullakIncomeDeficit({
      dateStr: '2026-10-19',
      expenseId: 'inc-1',
      newAmount: 6000,
      expenses: baseExpenses,
      gullakDeposits: baseDeposits,
    });
    expect(deficit).toBe(0);
  });

  it('calculates exact deficit (₹1,000) when user reduces income from ₹10,000 to ₹3,000', () => {
    const deficit = calculateGullakIncomeDeficit({
      dateStr: '2026-10-19',
      expenseId: 'inc-1',
      newAmount: 3000,
      expenses: baseExpenses,
      gullakDeposits: baseDeposits,
    });
    expect(deficit).toBe(1000);
  });

  it('accounts for other income on the same date before flagging a deficit', () => {
    const multiIncomeExpenses: Expense[] = [
      ...baseExpenses,
      {
        id: 'inc-2',
        user_id: 'u1',
        amount: 2000,
        gross_amount: 2000,
        type: 'income',
        expense_date: '2026-10-19',
        payment_mode: 'upi',
        created_at: '2026-10-19T10:30:00Z',
      },
    ];
    // Reducing inc-1 to 3000 gives total income 3000 + 2000 = 5000 >= 4000
    const deficit = calculateGullakIncomeDeficit({
      dateStr: '2026-10-19',
      expenseId: 'inc-1',
      newAmount: 3000,
      expenses: multiIncomeExpenses,
      gullakDeposits: baseDeposits,
    });
    expect(deficit).toBe(0);
  });

  it('adjustGullakIncomeDeposits correctly adjusts deposit amount in dailyBudgetStore', async () => {
    useDailyBudgetStore.setState({
      gullakDeposits: [
        {
          id: 'dep-1',
          amount: 4000,
          date: '2026-10-19',
          source: 'income',
          created_at: '2026-10-19T11:00:00Z',
        },
      ],
    });

    await useDailyBudgetStore.getState().adjustGullakIncomeDeposits('2026-10-19', 1000);

    const deposits = useDailyBudgetStore.getState().gullakDeposits;
    expect(deposits.length).toBe(1);
    expect(deposits[0].amount).toBe(3000);
  });

  it('adjustGullakIncomeDeposits deletes deposit if deficit covers the entire amount', async () => {
    useDailyBudgetStore.setState({
      gullakDeposits: [
        {
          id: 'dep-1',
          amount: 4000,
          date: '2026-10-19',
          source: 'income',
          created_at: '2026-10-19T11:00:00Z',
        },
      ],
    });

    await useDailyBudgetStore.getState().adjustGullakIncomeDeposits('2026-10-19', 4000);

    const deposits = useDailyBudgetStore.getState().gullakDeposits;
    expect(deposits.length).toBe(0);
  });
});
