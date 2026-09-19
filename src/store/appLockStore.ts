import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerStoreResetCallback } from './authStore';

interface AppLockState {
  isAppLockEnabled: boolean;
  isLocked: boolean;
  isSupported: boolean;
  isEnrolled: boolean;
  isAuthenticating: boolean;
  authError: string | null;

  init: (userId?: string) => Promise<void>;
  authenticate: () => Promise<boolean>;
  setAppLockEnabled: (enabled: boolean, userId?: string) => Promise<boolean>;
  lock: () => void;
  unlock: () => void;
  reset: () => void;
}

const getStorageKey = (userId?: string) =>
  userId ? `@arthik_app_lock_enabled_${userId}` : '@arthik_app_lock_enabled_default';

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

      const key = getStorageKey(userId);
      const stored = await AsyncStorage.getItem(key);
      const isEnabled = stored === 'true' && (hasHardware || isEnrolled);

      set({
        isSupported: hasHardware,
        isEnrolled,
        isAppLockEnabled: isEnabled,
        // If app lock is enabled, start locked
        isLocked: isEnabled,
        authError: null,
      });
    } catch (e) {
      if (__DEV__) console.error('Failed to init app lock:', e);
    }
  },

  authenticate: async () => {
    const { isAuthenticating, isAppLockEnabled } = get();
    if (isAuthenticating) return false;

    set({ isAuthenticating: true, authError: null });

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Arthik',
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
    }
  },

  setAppLockEnabled: async (enabled: boolean, userId?: string) => {
    const { isSupported, isEnrolled, authenticate } = get();

    if (enabled && !isSupported && !isEnrolled) {
      return false;
    }

    // Always require successful authentication to toggle App Lock on or off
    const verified = await authenticate();
    if (!verified) {
      return false;
    }

    const key = getStorageKey(userId);
    await AsyncStorage.setItem(key, enabled ? 'true' : 'false');

    set({
      isAppLockEnabled: enabled,
      isLocked: false,
      authError: null,
    });

    return true;
  },

  lock: () => {
    if (get().isAppLockEnabled) {
      set({ isLocked: true });
    }
  },

  unlock: () => {
    set({ isLocked: false, authError: null });
  },

  reset: () => {
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
