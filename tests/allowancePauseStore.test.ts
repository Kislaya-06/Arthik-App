/**
 * INS-004: the store writes every real auto-save on / off into the pause history and queues it before sending
 * (OPT-60). The first hydration of a user is not a change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-11-25T12:00:00'));

const storageMap = new Map<string, string>();
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));
vi.mock('lucide-react-native', () => ({ Wallet: () => null, CheckSquare: () => null, CreditCard: () => null, HelpCircle: () => null }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => storageMap.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void storageMap.set(k, v)),
    removeItem: vi.fn(async (k: string) => void storageMap.delete(k)),
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '30000000-0000-4000-8000-000000000001') }));
const mockUpdate = vi.fn();
vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ update: vi.fn((patch: unknown) => ({ eq: vi.fn(async () => mockUpdate(patch)) })) })),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));
vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'u1', created_at: '2026-11-01T00:00:00Z' } })) },
  registerStoreResetCallback: vi.fn(),
}));

import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';



describe('allowance pause history in the store (INS-004)', () => {
  beforeEach(() => {
    storageMap.clear();
    mockUpdate.mockReset();
    useDailyBudgetStore.setState({ hydratedForUserId: null, isAutoRenew: true, allowancePauses: [] });
  });

  it('the first hydration is not recorded as a pause', () => {
    useDailyBudgetStore.setState({ hydratedForUserId: 'u1', isAutoRenew: false });
    expect(useDailyBudgetStore.getState().allowancePauses).toEqual([]);
  });

  it('rule 15: there is no paused allowance any more, so a mode change records no pause', () => {
    useDailyBudgetStore.setState({ hydratedForUserId: 'u1' });
    useDailyBudgetStore.setState({ isAutoRenew: false });
    expect(useDailyBudgetStore.getState().allowancePauses).toEqual([]);
  });
});
