import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    getAllKeys: vi.fn(async () => [...storageMap.keys()]),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((k) => storageMap.delete(k));
    }),
  },
}));

// 2. Mock Supabase
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    single: mockSingle,
  })),
}));

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn((_table: string) => ({
      select: mockSelect,
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

// 3. Mock NetworkStore
let mockIsOffline = false;
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({
      isOffline: mockIsOffline,
      setOffline: vi.fn((val: boolean) => {
        mockIsOffline = val;
      }),
    })),
  },
}));

// 4. Mock expo-notifications
const mockDismissAll = vi.fn().mockResolvedValue(undefined);
vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
  dismissAllNotificationsAsync: (...a: unknown[]) => mockDismissAll(...a),
}));

import { useAuthStore, registerStoreResetCallback } from '../src/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('authStore (Seam: useAuthStore)', () => {
  const TEST_USER_ID = 'test_user_offline_1';
  const mockUser: any = { id: TEST_USER_ID, email: 'offline@arthik.app' };
  const mockSession: any = { user: mockUser, access_token: 'fake_jwt' };

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockIsOffline = false;
    useAuthStore.setState({
      user: null,
      profile: null,
      session: null,
      loading: false,
      initialized: false,
    });
  });

  it('caches user and profile to AsyncStorage when session is set online', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: TEST_USER_ID, first_name: 'ArthikUser', email: 'offline@arthik.app' },
      error: null,
    });

    await useAuthStore.getState().setSession(mockSession);

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe(TEST_USER_ID);
    expect(state.profile?.first_name).toBe('ArthikUser');

    // Verify cached in AsyncStorage
    const cachedUser = await AsyncStorage.getItem('@arthik_cached_user');
    expect(cachedUser).not.toBeNull();
    expect(JSON.parse(cachedUser!).id).toBe(TEST_USER_ID);

    const cachedProfile = await AsyncStorage.getItem(`@arthik_cached_profile_${TEST_USER_ID}`);
    expect(cachedProfile).not.toBeNull();
    expect(JSON.parse(cachedProfile!).first_name).toBe('ArthikUser');
  });

  it('loads cached profile and skips network when offline in setSession', async () => {
    mockIsOffline = true;
    const preCachedProfile = { id: TEST_USER_ID, first_name: 'CachedOfflineName', email: 'offline@arthik.app' };
    await AsyncStorage.setItem(`@arthik_cached_profile_${TEST_USER_ID}`, JSON.stringify(preCachedProfile));

    await useAuthStore.getState().setSession(mockSession);

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe(TEST_USER_ID);
    expect(state.profile?.first_name).toBe('CachedOfflineName');
    // Supabase select should NOT be called when offline
    expect(mockSingle).not.toHaveBeenCalled();
  });

  it('restores offline user and profile via restoreOfflineSession', async () => {
    const preCachedProfile = { id: TEST_USER_ID, first_name: 'RestoredName', email: 'offline@arthik.app' };
    await AsyncStorage.setItem('@arthik_cached_user', JSON.stringify(mockUser));
    await AsyncStorage.setItem(`@arthik_cached_profile_${TEST_USER_ID}`, JSON.stringify(preCachedProfile));

    const restoredUser = await useAuthStore.getState().restoreOfflineSession();

    expect(restoredUser?.id).toBe(TEST_USER_ID);
    const state = useAuthStore.getState();
    expect(state.user?.id).toBe(TEST_USER_ID);
    expect(state.profile?.first_name).toBe('RestoredName');
    expect(state.initialized).toBe(true);
  });

  it('removes cached user from AsyncStorage on signOut', async () => {
    await AsyncStorage.setItem('@arthik_cached_user', JSON.stringify(mockUser));

    await useAuthStore.getState().signOut();

    const cachedUser = await AsyncStorage.getItem('@arthik_cached_user');
    expect(cachedUser).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('SEC-01: signOut removes this user\'s cached server data but keeps unsynced queues', async () => {
    useAuthStore.setState({ user: mockUser, session: mockSession });
    await AsyncStorage.setItem(`@arthik_cached_expenses_${TEST_USER_ID}`, '[{"id":"e1"}]');
    await AsyncStorage.setItem(`@arthik_cached_categories_${TEST_USER_ID}`, '[{"id":"c1"}]');
    await AsyncStorage.setItem(`@arthik_cached_profile_${TEST_USER_ID}`, '{"first_name":"A"}');
    await AsyncStorage.setItem(`@arthik_pending_expenses_${TEST_USER_ID}`, '[{"id":"p1"}]');
    await AsyncStorage.setItem('@arthik_cached_expenses_someone_else', '[{"id":"x"}]');

    await useAuthStore.getState().signOut();

    expect(await AsyncStorage.getItem(`@arthik_cached_expenses_${TEST_USER_ID}`)).toBeNull();
    expect(await AsyncStorage.getItem(`@arthik_cached_categories_${TEST_USER_ID}`)).toBeNull();
    expect(await AsyncStorage.getItem(`@arthik_cached_profile_${TEST_USER_ID}`)).toBeNull();
    expect(await AsyncStorage.getItem(`@arthik_pending_expenses_${TEST_USER_ID}`)).toBe('[{"id":"p1"}]');
    expect(await AsyncStorage.getItem('@arthik_cached_expenses_someone_else')).toBe('[{"id":"x"}]');
  });

  it('SEC-01: a session that ends without the Log Out button (setSession(null)) keeps the caches', async () => {
    useAuthStore.setState({ user: mockUser, session: mockSession });
    await AsyncStorage.setItem(`@arthik_cached_expenses_${TEST_USER_ID}`, '[{"id":"e1"}]');

    await useAuthStore.getState().setSession(null);

    expect(await AsyncStorage.getItem(`@arthik_cached_expenses_${TEST_USER_ID}`)).toBe('[{"id":"e1"}]');
  });

  it('SEC-01: signOut clears this user\'s notifications from the tray (they could reach the next account\'s bell)', async () => {
    useAuthStore.setState({ user: mockUser, session: mockSession } as any);
    await useAuthStore.getState().signOut();
    expect(mockDismissAll).toHaveBeenCalled();
  });

  it('deleteAccount removes this phone\'s data but keeps OTHER accounts\' unsynced changes', async () => {
    useAuthStore.setState({ user: mockUser, session: mockSession } as any);
    storageMap.set(`@arthik_pending_expenses_${TEST_USER_ID}`, '[1]');
    storageMap.set(`@arthik_cached_expenses_${TEST_USER_ID}`, '[1]');
    storageMap.set('@arthik_pending_expenses_other_user', '[2]');
    storageMap.set('@arthik_failed_sync_other_user', '[3]');
    storageMap.set('@arthik_cached_expenses_other_user', '[4]');
    storageMap.set('@arthik_app_lock_enabled', 'true');

    await useAuthStore.getState().deleteAccount();

    expect([...storageMap.keys()].sort()).toEqual(['@arthik_failed_sync_other_user', '@arthik_pending_expenses_other_user']);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('resets every per-user store when a session for a DIFFERENT user is installed (no sign-out switch)', async () => {
    mockIsOffline = true;
    const reset = vi.fn();
    const unregister = registerStoreResetCallback(reset);
    try {
      await useAuthStore.getState().setSession(mockSession);
      await useAuthStore.getState().setSession({ ...mockSession, access_token: 'refreshed' }); // same user refresh
      expect(reset).not.toHaveBeenCalled();

      await useAuthStore.getState().setSession({ user: { id: 'other_user', email: 'b@arthik.app' }, access_token: 'b' } as any);
      expect(reset).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user?.id).toBe('other_user');
    } finally {
      unregister();
    }
  });

  it('optimistically updates profile and user metadata on updateProfile', async () => {
    useAuthStore.setState({
      user: { ...mockUser, user_metadata: { first_name: 'Kislaya' } },
      profile: { id: TEST_USER_ID, first_name: 'Kislaya', last_name: '', email: 'kislaya@arthik.app' },
    });

    await useAuthStore.getState().updateProfile('Kislaya', 'Agarwal');

    const state = useAuthStore.getState();
    expect(state.profile?.first_name).toBe('Kislaya');
    expect(state.profile?.last_name).toBe('Agarwal');
    expect(state.user?.user_metadata?.full_name).toBe('Kislaya Agarwal');

    // Cached to AsyncStorage immediately
    const cachedProfile = await AsyncStorage.getItem(`@arthik_cached_profile_${TEST_USER_ID}`);
    expect(JSON.parse(cachedProfile!).last_name).toBe('Agarwal');
  });
});
