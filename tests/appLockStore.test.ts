import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Mock react-native
let currentAppState = 'active';
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return currentAppState;
    },
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// 2. Mock AsyncStorage
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
    getAllKeys: vi.fn(async () => Array.from(storageMap.keys())),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, storageMap.get(k) ?? null] as [string, string | null])),
  },
}));

// 3. Mock expo-local-authentication
let mockHasHardware = true;
let mockIsEnrolled = true;
let mockAuthSuccess = true;
let mockAuthError: string | undefined = undefined;

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(async () => mockHasHardware),
  isEnrolledAsync: vi.fn(async () => mockIsEnrolled),
  authenticateAsync: vi.fn(async () => {
    if (mockAuthSuccess) {
      return { success: true };
    }
    return { success: false, error: mockAuthError || 'user_cancel' };
  }),
  cancelAuthenticate: vi.fn(async () => {}),
}));

// 4. Mock AuthStore
vi.mock('../src/store/authStore', () => ({
  registerStoreResetCallback: vi.fn(),
}));

import { useAppLockStore } from '../src/store/appLockStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('appLockStore (Seam: useAppLockStore)', () => {
  const GLOBAL_KEY = '@arthik_app_lock_enabled';
  const TEST_USER_ID = 'user_lock_123';
  const USER_KEY = `@arthik_app_lock_enabled_${TEST_USER_ID}`;

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    mockHasHardware = true;
    mockIsEnrolled = true;
    mockAuthSuccess = true;
    mockAuthError = undefined;
    currentAppState = 'active';
    useAppLockStore.getState().reset();
  });

  describe('Slice 1: Store Initialization (init)', () => {
    it('initializes as locked if app lock is enabled in storage and biometrics are supported', async () => {
      await AsyncStorage.setItem(GLOBAL_KEY, 'true');

      await useAppLockStore.getState().init(TEST_USER_ID);

      const state = useAppLockStore.getState();
      expect(state.isSupported).toBe(true);
      expect(state.isEnrolled).toBe(true);
      expect(state.isAppLockEnabled).toBe(true);
      expect(state.isLocked).toBe(true); // Must start locked on app launch!
    });

    it('remains disabled if hardware does not support biometrics', async () => {
      mockHasHardware = false;
      mockIsEnrolled = false;
      await AsyncStorage.setItem(GLOBAL_KEY, 'true');

      await useAppLockStore.getState().init(TEST_USER_ID);

      const state = useAppLockStore.getState();
      expect(state.isAppLockEnabled).toBe(false);
      expect(state.isLocked).toBe(false);
    });
  });

  describe('Slice 2: Authentication Flow', () => {
    it('unlocks the app on successful biometric authentication', async () => {
      useAppLockStore.setState({ isAppLockEnabled: true, isLocked: true });
      mockAuthSuccess = true;

      const result = await useAppLockStore.getState().authenticate();

      expect(result).toBe(true);
      const state = useAppLockStore.getState();
      expect(state.isLocked).toBe(false);
      expect(state.authError).toBeNull();
    });

    it('keeps app locked and sets authError on failed authentication', async () => {
      useAppLockStore.setState({ isAppLockEnabled: true, isLocked: true });
      mockAuthSuccess = false;
      mockAuthError = 'Authentication failed';

      const result = await useAppLockStore.getState().authenticate();

      expect(result).toBe(false);
      const state = useAppLockStore.getState();
      expect(state.isLocked).toBe(true);
      expect(state.authError).toBe('Authentication failed');
    });

    it('rejects authentication when app is backgrounded (AppState !== active)', async () => {
      useAppLockStore.setState({ isAppLockEnabled: true, isLocked: true });
      currentAppState = 'background';

      const result = await useAppLockStore.getState().authenticate();

      expect(result).toBe(false);
      expect(useAppLockStore.getState().isLocked).toBe(true);
    });
  });

  describe('Slice 3: Toggling App Lock (setAppLockEnabled)', () => {
    it('authenticates before enabling app lock and saves to storage', async () => {
      useAppLockStore.setState({ isSupported: true, isEnrolled: true });
      mockAuthSuccess = true;

      const enabled = await useAppLockStore.getState().setAppLockEnabled(true, TEST_USER_ID);

      expect(enabled).toBe(true);
      expect(useAppLockStore.getState().isAppLockEnabled).toBe(true);

      const globalStored = await AsyncStorage.getItem(GLOBAL_KEY);
      expect(globalStored).toBe('true');
      const userStored = await AsyncStorage.getItem(USER_KEY);
      expect(userStored).toBe('true');
    });

    it('refuses to toggle if user biometric verification fails', async () => {
      useAppLockStore.setState({ isSupported: true, isEnrolled: true });
      mockAuthSuccess = false;

      const enabled = await useAppLockStore.getState().setAppLockEnabled(true, TEST_USER_ID);

      expect(enabled).toBe(false);
      expect(useAppLockStore.getState().isAppLockEnabled).toBe(false);
    });
  });

  describe('Slice 4: Lock, Unlock & Reset', () => {
    it('locks the app only if isAppLockEnabled is true', () => {
      useAppLockStore.setState({ isAppLockEnabled: true, isLocked: false });
      useAppLockStore.getState().lock();
      expect(useAppLockStore.getState().isLocked).toBe(true);

      useAppLockStore.setState({ isAppLockEnabled: false, isLocked: false });
      useAppLockStore.getState().lock();
      expect(useAppLockStore.getState().isLocked).toBe(false);
    });

    it('clears lock state and removes global storage key on reset', async () => {
      await AsyncStorage.setItem(GLOBAL_KEY, 'true');
      useAppLockStore.setState({ isAppLockEnabled: true, isLocked: true });

      useAppLockStore.getState().reset();

      expect(useAppLockStore.getState().isAppLockEnabled).toBe(false);
      expect(useAppLockStore.getState().isLocked).toBe(false);
    });
  });
});
