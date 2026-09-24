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
    from: vi.fn((table: string) => ({
      select: mockSelect,
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
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
vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from '../src/store/authStore';
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
});
