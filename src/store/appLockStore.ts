import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { registerStoreResetCallback } from './authStore';

interface AppLockState {
  isAppLockEnabled: boolean;
  isLocked: boolean;
  isSupported: boolean;
  isEnrolled: boolean;
  isAuthenticating: boolean;
  authError: string | null;

  init: (userId?: string) => Promise<void>;
  authenticate: (force?: boolean) => Promise<boolean>;
  cancelAuthentication: () => Promise<void>;
  setAppLockEnabled: (enabled: boolean, userId?: string) => Promise<boolean>;
  lock: () => void;
  unlock: () => void;
  reset: () => void;
}

const GLOBAL_STORAGE_KEY = '@arthik_app_lock_enabled';
const getUserStorageKey = (userId?: string) =>
  userId ? `@arthik_app_lock_enabled_${userId}` : null;

export const useAppLockStore = create<AppLockState>((set, get) => ({
  isAppLockEnabled: false,
  isLocked: false,
  isSupported: false,
  isEnrolled: false,
  isAuthenticating: false,
  authError: null,

  init: async (userId?: string) => {
    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      const isBiometricSupported = hasHardware || isEnrolled;

      // 1. Check direct global device flag
      let isEnabled = false;
      const globalStored = await AsyncStorage.getItem(GLOBAL_STORAGE_KEY);

      if (globalStored !== null) {
        isEnabled = globalStored === 'true';
      } else {
        // 2. Check user-specific key if provided
        const userKey = getUserStorageKey(userId);
        if (userKey) {
          const userStored = await AsyncStorage.getItem(userKey);
          if (userStored !== null) {
            isEnabled = userStored === 'true';
          }
        }

        // 3. Fallback: scan any existing keys starting with @arthik_app_lock_enabled
        if (!isEnabled) {
          const allKeys = await AsyncStorage.getAllKeys();
          const lockKeys = allKeys.filter((k) => k.startsWith('@arthik_app_lock_enabled'));
          if (lockKeys.length > 0) {
            const pairs = await AsyncStorage.multiGet(lockKeys);
            isEnabled = pairs.some(([_, val]) => val === 'true');
          }
        }

        // Cache global flag if found true
        if (isEnabled) {
          await AsyncStorage.setItem(GLOBAL_STORAGE_KEY, 'true');
        }
      }

      const active = isEnabled && isBiometricSupported;

      set({
        isSupported: hasHardware,
        isEnrolled,
        isAppLockEnabled: active,
        // If app lock is enabled, start locked!
        isLocked: active,
        authError: null,
      });
    } catch (e) {
      if (__DEV__) console.error('Failed to init app lock:', e);
    }
  },

  cancelAuthentication: async () => {
    try {
      if (typeof LocalAuthentication.cancelAuthenticate === 'function') {
        await LocalAuthentication.cancelAuthenticate();
      }
    } catch (_) {}
    set({ isAuthenticating: false });
  },

  authenticate: async (force = false) => {
    const { isAuthenticating, isAppLockEnabled } = get();

    if (force) {
      try {
        if (typeof LocalAuthentication.cancelAuthenticate === 'function') {
          await LocalAuthentication.cancelAuthenticate();
        }
      } catch (_) {}
      set({ isAuthenticating: false });
    } else if (isAuthenticating) {
      return false;
    }

    if (!isAppLockEnabled) {
      set({ isLocked: false, isAuthenticating: false });
      return true;
    }

    // Never attempt authentication if app is in background or inactive
    if (AppState.currentState && AppState.currentState !== 'active') {
      return false;
    }

    set({ isAuthenticating: true, authError: null });

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Arthik',
        promptSubtitle: 'Use Fingerprint, Face or Device PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        set({ isLocked: false, isAuthenticating: false, authError: null });
        return true;
      } else {
        set({
          isLocked: isAppLockEnabled,
          isAuthenticating: false,
          authError: result.error || 'Authentication failed',
        });
        return false;
      }
    } catch (e: any) {
      set({
        isAuthenticating: false,
        authError: e?.message || 'Authentication error',
      });
      return false;
    } finally {
      if (get().isAuthenticating) {
        set({ isAuthenticating: false });
      }
    }
  },

  setAppLockEnabled: async (enabled: boolean, userId?: string) => {
    const { isSupported, isEnrolled, authenticate } = get();

    if (enabled && !isSupported && !isEnrolled) {
      return false;
    }

    // Always require successful authentication to toggle App Lock on or off
    const verified = await authenticate(true);
    if (!verified) {
      return false;
    }

    // Persist to both global device key and user-specific key
    await AsyncStorage.setItem(GLOBAL_STORAGE_KEY, enabled ? 'true' : 'false');
    const userKey = getUserStorageKey(userId);
    if (userKey) {
      await AsyncStorage.setItem(userKey, enabled ? 'true' : 'false');
    }

    set({
      isAppLockEnabled: enabled,
      isLocked: false,
      authError: null,
    });

    return true;
  },

  lock: () => {
    if (get().isAppLockEnabled) {
      try {
        if (typeof LocalAuthentication.cancelAuthenticate === 'function') {
          LocalAuthentication.cancelAuthenticate().catch(() => {});
        }
      } catch (_) {}
      set({ isLocked: true, isAuthenticating: false });
    }
  },

  unlock: () => {
    set({ isLocked: false, isAuthenticating: false, authError: null });
  },

  reset: () => {
    AsyncStorage.removeItem(GLOBAL_STORAGE_KEY).catch(() => {});
    set({
      isAppLockEnabled: false,
      isLocked: false,
      isAuthenticating: false,
      authError: null,
    });
  },
}));

// Register multi-user store reset callback (Section 6.1 & 7)
registerStoreResetCallback(() => {
  useAppLockStore.getState().reset();
});
