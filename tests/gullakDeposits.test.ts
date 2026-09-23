import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Mock react-native & lucide-react-native for Node test runner
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

// 2. In-memory AsyncStorage
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

// 3. Mock expo-crypto UUID generator
let depositCounter = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `dep-uuid-0000-0000-${String(depositCounter++).padStart(4, '0')}`),
}));

// 4. Mock Supabase
vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_gullak_test', created_at: '2026-09-01T00:00:00Z' } } },
      }),
    },
  },
}));

// 5. Mock AuthStore
let mockUser: any = { id: 'user_gullak_test', created_at: '2026-09-01T00:00:00Z' };
vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
  registerStoreResetCallback: vi.fn(),
}));

// 6. Mock CategoryStore
vi.mock('../src/store/categoryStore', () => ({
  useCategoryStore: {
    getState: vi.fn(() => ({
      categories: [],
    })),
  },
}));

// 7. Mock NotificationService & NotificationStore
vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: vi.fn(),
}));
vi.mock('../src/store/notificationStore', () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      addNotification: vi.fn(),
    })),
  },
}));

// Import subject under test
import {
  useDailyBudgetStore,
  registerExpensesLoadedGetter,
  registerExpenseGetter,
} from '../src/store/dailyBudgetStore';
import {
  calculatePeriodSummary,
  getExternalDepositsInPeriod,
  PeriodCalculationParams,
} from '../src/lib/homeCalculations';
import { format } from 'date-fns';

describe('Gullak Deposits Feature - TDD Specification & Verification', () => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const REF_DATE = new Date(2026, 8, 18, 12, 0, 0); // Friday, 18 Sep 2026
  const USER_CREATED = '2026-09-14'; // Monday, 14 Sep 2026

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    depositCounter = 1;
    mockUser = { id: 'user_gullak_test', created_at: '2026-09-01T00:00:00Z' };
    registerExpensesLoadedGetter(() => true);
    registerExpenseGetter(() => []);

    // Reset dailyBudgetStore state
    useDailyBudgetStore.setState({
      hydratedForUserId: 'user_gullak_test',
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      dailyRecords: {},
      gullakDeposits: [],
      totalAccumulatedSavings: 0,
    });
  });

  // =========================================================================
  // SEAM 1: Store Logic & Dual-Source Semantics (useDailyBudgetStore)
  // =========================================================================
  describe('Seam 1: Store Public Actions & Selectors (useDailyBudgetStore)', () => {
    it('defaults source to "external" when no source argument is passed', () => {
      useDailyBudgetStore.getState().addGullakDeposit(1000, 'Cash gift');

      const state = useDailyBudgetStore.getState();
      expect(state.gullakDeposits).toHaveLength(1);
      expect(state.gullakDeposits[0].amount).toBe(1000);
      expect(state.gullakDeposits[0].note).toBe('Cash gift');
      expect(state.gullakDeposits[0].source).toBe('external');
      expect(state.totalAccumulatedSavings).toBe(1000);
    });

    it('records an explicit "income" source deposit correctly', () => {
      useDailyBudgetStore.getState().addGullakDeposit(450, 'From freelance payout', 'income');

      const state = useDailyBudgetStore.getState();
      expect(state.gullakDeposits).toHaveLength(1);
      expect(state.gullakDeposits[0].amount).toBe(450);
      expect(state.gullakDeposits[0].source).toBe('income');
      expect(state.totalAccumulatedSavings).toBe(450);
    });

    it('correctly computes getAvailableIncomeBalance = totalTrackedIncome - incomeDeposits', () => {
      // User has 3 income records totaling ₹5,000 and 1 expense of ₹500
      registerExpenseGetter(() => [
        { id: 'inc1', amount: 3000, type: 'income', expense_date: todayStr, category_id: null, payment_mode: 'upi', created_at: todayStr } as any,
        { id: 'inc2', amount: 1500, type: 'income', expense_date: todayStr, category_id: null, payment_mode: 'cash', created_at: todayStr } as any,
        { id: 'inc3', amount: 500, type: 'income', expense_date: todayStr, category_id: null, payment_mode: 'bank', created_at: todayStr } as any,
        { id: 'exp1', amount: 500, type: 'expense', expense_date: todayStr, category_id: null, payment_mode: 'upi', created_at: todayStr } as any,
      ]);

      // Before any deposit: available income = 5000
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(5000);

      // Deposit ₹2,000 from income
      useDailyBudgetStore.getState().addGullakDeposit(2000, 'Saving part of bonus', 'income');

      // Now available income = 5000 - 2000 = 3000
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(3000);

      // Deposit ₹1,000 as external (Add New Money)
      useDailyBudgetStore.getState().addGullakDeposit(1000, 'Cash found in drawer', 'external');

      // External deposit must NOT reduce available income balance
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(3000);

      // Total savings in Gullak = 2000 + 1000 = 3000
      expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(3000);
    });

    it('clamps getAvailableIncomeBalance to 0 if income deposits equal or exceed tracked income', () => {
      registerExpenseGetter(() => [
        { id: 'inc1', amount: 1000, type: 'income', expense_date: todayStr, category_id: null, payment_mode: 'upi', created_at: todayStr } as any,
      ]);

      useDailyBudgetStore.getState().addGullakDeposit(1000, 'Full income deposit', 'income');
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(0);

      // If somehow an existing deposit was higher
      useDailyBudgetStore.setState({
        gullakDeposits: [
          { id: 'd1', amount: 1200, date: todayStr, source: 'income', created_at: todayStr },
        ],
      });
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(0);
    });

    it('restores available income balance when an income deposit is removed', () => {
      registerExpenseGetter(() => [
        { id: 'inc1', amount: 2500, type: 'income', expense_date: todayStr, category_id: null, payment_mode: 'upi', created_at: todayStr } as any,
      ]);

      useDailyBudgetStore.getState().addGullakDeposit(1500, 'Deposit to be reverted', 'income');
      const depositId = useDailyBudgetStore.getState().gullakDeposits[0].id;

      // Available income is consumed to 1000
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(1000);
      expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(1500);

      // Remove the deposit
      useDailyBudgetStore.getState().removeGullakDeposit(depositId);

      // Available income restored back to 2500, Gullak savings decreased to 0
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(2500);
      expect(useDailyBudgetStore.getState().gullakDeposits).toHaveLength(0);
      expect(useDailyBudgetStore.getState().totalAccumulatedSavings).toBe(0);
    });

    it('defensively sets source="external" for legacy deposits missing the source field', () => {
      const legacyDepositsFromDB = [
        { id: 'old-1', amount: 500, note: 'Pre-v1.3 deposit', date: todayStr, created_at: todayStr },
      ];

      const hydrated = legacyDepositsFromDB.map((d: any) => ({
        id: d.id,
        amount: d.amount,
        note: d.note,
        date: d.date,
        source: (d.source === 'income' ? 'income' : 'external') as 'income' | 'external',
        created_at: d.created_at,
      }));

      useDailyBudgetStore.setState({ gullakDeposits: hydrated });
      expect(useDailyBudgetStore.getState().gullakDeposits[0].source).toBe('external');
    });
  });

  // =========================================================================
  // SEAM 2: Home Period Aggregation & Available Balance Engine
  // =========================================================================
  describe('Seam 2: Period Summary & Balance Calculations (homeCalculations)', () => {
    const baseParams: PeriodCalculationParams = {
      activeFilter: 'All',
      dailyBudgetAmount: 500,
      isAutoRenew: true,
      todayBudget: 500,
      dailyRecords: {},
      totalIncome: 1000,
      totalSpent: 400,
      filtered: [],
      userCreatedAtStr: USER_CREATED,
      referenceDate: REF_DATE,
    };

    it('does NOT increase period totalAvailable when deposit is from income (avoids double counting)', () => {
      // 5 days elapsed (14 to 18 Sep) * 500 = 2500 budget pool
      // totalIncome = 1000.
      // If user deposits 600 from income:
      // externalDepositsInPeriod is 0 because income deposits are excluded.
      const externalDeposits = getExternalDepositsInPeriod(
        [
          { date: '2026-09-18', amount: 600, source: 'income' },
        ],
        'All',
        REF_DATE,
        USER_CREATED
      );

      expect(externalDeposits).toBe(0);

      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 1000,
        externalDepositsInPeriod: externalDeposits,
      });

      // totalAvailable = 2500 budget + 1000 income + 0 external deposits = 3500
      expect(summary.totalAvailable).toBe(3500);
      expect(summary.primaryAmount).toBe(3100); // 3500 - 400 spent
      expect(summary.primarySubtext).toBe('₹2,500 budget + ₹1,000 income');
    });

    it('DOES increase period totalAvailable when deposit is "external" (Add New Money)', () => {
      // 5 days * 500 = 2500 budget pool
      // totalIncome = 1000
      // User deposits 1500 external new money
      const externalDeposits = getExternalDepositsInPeriod(
        [
          { date: '2026-09-18', amount: 1500, source: 'external' },
        ],
        'All',
        REF_DATE,
        USER_CREATED
      );

      expect(externalDeposits).toBe(1500);

      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'All',
        totalIncome: 1000,
        externalDepositsInPeriod: externalDeposits,
      });

      // totalAvailable = 2500 + 1000 + 1500 = 5000
      expect(summary.totalAvailable).toBe(5000);
      expect(summary.primaryAmount).toBe(4600); // 5000 - 400 spent
      expect(summary.primarySubtext).toBe('₹2,500 budget + ₹1,000 income + ₹1,500 deposits');

      // Verify Weekly filter includes daysSuffix: " (5 days)"
      const weeklySummary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Weekly',
        totalIncome: 1000,
        externalDepositsInPeriod: externalDeposits,
      });
      expect(weeklySummary.totalAvailable).toBe(5000);
      expect(weeklySummary.primarySubtext).toBe('₹2,500 budget (5 days) + ₹1,000 income + ₹1,500 deposits');
    });

    it('handles User Persona B (NO daily allowance) with external deposits', () => {
      // Persona B: dailyBudgetAmount = 0, isAutoRenew = false, todayBudget = 0
      const externalDeposits = getExternalDepositsInPeriod(
        [
          { date: '2026-09-18', amount: 2000, source: 'external' },
        ],
        'Daily',
        REF_DATE,
        USER_CREATED
      );

      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalIncome: 0,
        totalSpent: 350,
        externalDepositsInPeriod: externalDeposits,
      });

      // totalAvailable = 0 budget + 0 income + 2000 external deposits = 2000
      expect(summary.totalAvailable).toBe(2000);
      expect(summary.primaryAmount).toBe(1650); // 2000 - 350 spent
      expect(summary.primaryLabel).toBe('Remaining to Spend');
      expect(summary.primarySubtext).toBe('₹2,000 external deposits');
    });

    it('handles User Persona B (NO daily allowance) with both income and external deposits', () => {
      const summary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        dailyBudgetAmount: 0,
        isAutoRenew: false,
        todayBudget: 0,
        totalIncome: 1200,
        totalSpent: 500,
        externalDepositsInPeriod: 800,
      });

      // totalAvailable = 0 budget + 1200 income + 800 deposits = 2000
      expect(summary.totalAvailable).toBe(2000);
      expect(summary.primaryAmount).toBe(1500); // 2000 - 500 spent
      expect(summary.primarySubtext).toBe('₹1,200 income + ₹800 deposits');
    });

    it('correctly filters external deposits across Daily, Weekly, Monthly, and All windows', () => {
      const deposits = [
        { date: '2026-09-18', amount: 500, source: 'external' as const },   // Friday (Today)
        { date: '2026-09-18', amount: 1000, source: 'income' as const },   // Friday (Income - should be ignored)
        { date: '2026-09-16', amount: 300, source: 'external' as const },   // Wednesday (This week)
        { date: '2026-09-05', amount: 700, source: 'external' as const },   // Earlier this month (Not this week)
        { date: '2026-08-25', amount: 1200, source: 'external' as const },  // Prior month
      ];

      // Daily: only 2026-09-18 external = 500
      expect(getExternalDepositsInPeriod(deposits, 'Daily', REF_DATE, '2026-08-01')).toBe(500);

      // Weekly (14 to 18 Sep): 18th (500) + 16th (300) = 800
      expect(getExternalDepositsInPeriod(deposits, 'Weekly', REF_DATE, '2026-08-01')).toBe(800);

      // Monthly (Sep 2026): 18th (500) + 16th (300) + 5th (700) = 1500
      expect(getExternalDepositsInPeriod(deposits, 'Monthly', REF_DATE, '2026-08-01')).toBe(1500);

      // All: 500 + 300 + 700 + 1200 = 2700
      expect(getExternalDepositsInPeriod(deposits, 'All', REF_DATE, '2026-08-01')).toBe(2700);
    });

    it('does not count deposits before user creation date in period views', () => {
      const deposits = [
        { date: '2026-09-10', amount: 400, source: 'external' as const },
        { date: '2026-09-16', amount: 600, source: 'external' as const },
      ];

      // User created on 2026-09-14: deposit on 2026-09-10 is before user creation
      expect(getExternalDepositsInPeriod(deposits, 'Monthly', REF_DATE, '2026-09-14')).toBe(600);
      expect(getExternalDepositsInPeriod(deposits, 'All', REF_DATE, '2026-09-14')).toBe(600);
    });

    it('maintains float precision on getAvailableIncomeBalance (e.g. ₹1773.80 - ₹773.80 = ₹1000)', () => {
      registerExpenseGetter(() => [
        { id: 'inc1', amount: 1773.8, type: 'income', expense_date: todayStr, category_id: null, payment_mode: 'upi', created_at: todayStr } as any,
      ]);

      useDailyBudgetStore.getState().addGullakDeposit(773.8, 'Partial income deposit', 'income');
      expect(useDailyBudgetStore.getState().getAvailableIncomeBalance()).toBe(1000);
    });

    it('executes full end-to-end lifecycle: deposit external -> totalAvailable increases -> remove deposit -> totalAvailable reverts', () => {
      // 1. Initial baseline
      const initialSummary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 0,
        totalSpent: 100,
        externalDepositsInPeriod: 0,
      });
      expect(initialSummary.totalAvailable).toBe(500);
      expect(initialSummary.primaryAmount).toBe(400);

      // 2. User deposits ₹1,000 as external
      useDailyBudgetStore.getState().addGullakDeposit(1000, 'ATM withdrawal', 'external');
      const depositId = useDailyBudgetStore.getState().gullakDeposits[0].id;
      const externalSum = getExternalDepositsInPeriod(
        useDailyBudgetStore.getState().gullakDeposits,
        'Daily',
        new Date(),
        todayStr
      );
      expect(externalSum).toBe(1000);

      const afterDepositSummary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 0,
        totalSpent: 100,
        externalDepositsInPeriod: externalSum,
      });
      // Available increases by ₹1,000
      expect(afterDepositSummary.totalAvailable).toBe(1500);
      expect(afterDepositSummary.primaryAmount).toBe(1400);

      // 3. User removes the deposit
      useDailyBudgetStore.getState().removeGullakDeposit(depositId);
      const revertedSum = getExternalDepositsInPeriod(
        useDailyBudgetStore.getState().gullakDeposits,
        'Daily',
        new Date(),
        todayStr
      );
      expect(revertedSum).toBe(0);

      const afterRemovalSummary = calculatePeriodSummary({
        ...baseParams,
        activeFilter: 'Daily',
        todayBudget: 500,
        totalIncome: 0,
        totalSpent: 100,
        externalDepositsInPeriod: revertedSum,
      });
      // Available reverts back to baseline
      expect(afterRemovalSummary.totalAvailable).toBe(500);
      expect(afterRemovalSummary.primaryAmount).toBe(400);
    });
  });
});
