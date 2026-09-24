import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock react-native and lucide-react-native to avoid Flow parse errors in node
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
  randomUUID: vi.fn(() => '10000000-0000-4000-8000-000000000001'),
}));

vi.mock('../src/lib/notificationService', () => ({
  triggerDeviceNotification: vi.fn(),
}));
vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
}));

// 1. Mock AsyncStorage
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

// 2. Mock Supabase
const mockSupabaseSelect = vi.fn().mockImplementation(() => {
  throw new Error('Supabase network should not be called when offline!');
});

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
      upsert: vi.fn().mockRejectedValue(new Error('Network should not be called offline')),
      delete: vi.fn().mockRejectedValue(new Error('Network should not be called offline')),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { name: 'AuthRetryableFetchError', message: 'Network request failed' },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// 3. Mock NetworkStore
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: true,
      checkConnectivity: vi.fn().mockResolvedValue(false),
      setOffline: vi.fn(),
    })),
  },
  registerSyncCallback: vi.fn(),
}));

import { useAuthStore } from '../src/store/authStore';
import { useCategoryStore } from '../src/store/categoryStore';
import { useExpenseStore } from '../src/store/expenseStore';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Offline Startup Resilience (Seam: offline launch path)', () => {
  const TEST_USER_ID = 'user_offline_launch_123';
  const mockUser: any = { id: TEST_USER_ID, email: 'offline@arthik.app' };

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      profile: null,
      session: null,
      loading: false,
      initialized: false,
    });
    useCategoryStore.setState({ categories: [], isFetched: false, loading: false });
    useExpenseStore.setState({ expenses: [], isExpensesLoaded: false, loading: false });
  });

  it('successfully recovers user and hydrates stores offline without calling Supabase network', async () => {
    // 1. Setup pre-existing local storage data
    await AsyncStorage.setItem('@arthik_cached_user', JSON.stringify(mockUser));
    await AsyncStorage.setItem(`@arthik_cached_profile_${TEST_USER_ID}`, JSON.stringify({
      id: TEST_USER_ID,
      first_name: 'OfflineTester',
    }));
    await AsyncStorage.setItem(`@arthik_cached_categories_${TEST_USER_ID}`, JSON.stringify([
      { id: 'cat_1', user_id: TEST_USER_ID, name: 'Food', icon: 'Utensils', color: '#F4B8AE', is_default: false },
    ]));
    await AsyncStorage.setItem(`@arthik_cached_expenses_${TEST_USER_ID}`, JSON.stringify([
      { id: 'exp_1', user_id: TEST_USER_ID, amount: 250, payment_mode: 'upi', expense_date: '2026-09-24' },
    ]));

    // 2. Offline restoration step
    const restoredUser = await useAuthStore.getState().restoreOfflineSession();
    expect(restoredUser).not.toBeNull();
    expect(restoredUser?.id).toBe(TEST_USER_ID);
    expect(useAuthStore.getState().profile?.first_name).toBe('OfflineTester');

    // 3. Hydration step (category + expense + daily budget)
    await useCategoryStore.getState().fetchCategories();
    expect(useCategoryStore.getState().isFetched).toBe(true);
    expect(useCategoryStore.getState().categories[0].name).toBe('Food');

    await useExpenseStore.getState().fetchExpenses();
    expect(useExpenseStore.getState().isExpensesLoaded).toBe(true);
    expect(useExpenseStore.getState().expenses[0].id).toBe('exp_1');

    await useDailyBudgetStore.getState().hydrateFromSupabase(TEST_USER_ID);
    expect(useDailyBudgetStore.getState().hydratedForUserId).toBe(TEST_USER_ID);

    // 4. Assert that NO Supabase network requests were made!
    expect(mockSupabaseSelect).not.toHaveBeenCalled();
  });
});
