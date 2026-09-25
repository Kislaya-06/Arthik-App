import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';
import { useNetworkStore } from './networkStore';
import { isNetworkFailure } from '../lib/networkUtils';

export interface Profile {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  daily_budget?: number;
  is_auto_renew?: boolean;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  setSession: (session: Session | null) => Promise<void>;
  restoreOfflineSession: () => Promise<User | null>;
  signOut: () => Promise<void>;
  updateProfile: (
    firstName?: string,
    lastName?: string,
    settings?: { daily_budget?: number; is_auto_renew?: boolean }
  ) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

type ResetCallback = () => void;
const resetCallbacks = new Set<ResetCallback>();

export const registerStoreResetCallback = (callback: ResetCallback) => {
  resetCallbacks.add(callback);
  return () => resetCallbacks.delete(callback);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  initialized: false,

  setSession: async (session) => {
    if (!session) {
      if (get().user) {
        resetCallbacks.forEach((cb) => {
          try {
            cb();
          } catch (err) {
            if (__DEV__) console.error('Error running store reset callback:', err);
          }
        });
      }
      set({ session: null, user: null, profile: null, loading: false, initialized: true });
      return;
    }

    const user = session.user;
    set({ session, user, loading: true });

    // Cache user for offline cold launch
    try {
      await AsyncStorage.setItem('@arthik_cached_user', JSON.stringify(user));
    } catch (_) {}

    // Load cached profile immediately if available
    const cacheKey = `@arthik_cached_profile_${user.id}`;
    let cachedProfile: Profile | null = null;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        cachedProfile = JSON.parse(cached);
        set({ profile: cachedProfile });
      }
    } catch (_) {}

    // If offline, complete immediately without network call
    if (useNetworkStore.getState().isOffline) {
      set({ loading: false, initialized: true });
      return;
    }

    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Profile fetch timeout') }), 3000)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (error) {
        if (!cachedProfile && !get().profile) {
          // Profile might not exist yet (first sign up setup)
          set({ profile: null });
        }
      } else if (data) {
        set({ profile: data });
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (_) {}
      }
    } catch (e) {
      if (__DEV__) console.error('Error fetching profile:', e);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  restoreOfflineSession: async () => {
    try {
      const cachedUserStr = await AsyncStorage.getItem('@arthik_cached_user');
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser?.id) {
          const cacheKey = `@arthik_cached_profile_${cachedUser.id}`;
          const cachedProfileStr = await AsyncStorage.getItem(cacheKey);
          const cachedProfile = cachedProfileStr ? JSON.parse(cachedProfileStr) : null;
          set({
            user: cachedUser,
            profile: cachedProfile,
            session: null,
            loading: false,
            initialized: true,
          });
          return cachedUser;
        }
      }
    } catch (e) {
      if (__DEV__) console.error('Error restoring offline user:', e);
    }
    return null;
  },

  signOut: async () => {
    set({ loading: true });
    try {
      resetCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          if (__DEV__) console.error('Error running store reset callback:', err);
        }
      });
    } catch (e) {
      if (__DEV__) console.error('Error resetting stores on sign out:', e);
    }
    try {
      await AsyncStorage.removeItem('@arthik_cached_user');
    } catch (_) {}
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, loading: false });
  },

  updateProfile: async (firstName?: string, lastName?: string, settings?: { daily_budget?: number; is_auto_renew?: boolean }) => {
    const { user, profile } = get();
    if (!user) return;

    const updatedProfile: Profile = {
      id: user.id,
      first_name: firstName ?? profile?.first_name ?? '',
      last_name: lastName !== undefined ? lastName : (profile?.last_name || ''),
      email: user.email || profile?.email || '',
      daily_budget: settings?.daily_budget !== undefined ? settings.daily_budget : profile?.daily_budget,
      is_auto_renew: settings?.is_auto_renew !== undefined ? settings.is_auto_renew : profile?.is_auto_renew,
    };

    // Optimistic: update local state + cache immediately so UI reflects change without waiting for network
    set({ profile: updatedProfile });
    try {
      await AsyncStorage.setItem(`@arthik_cached_profile_${user.id}`, JSON.stringify(updatedProfile));
    } catch (_) {}

    // Build patch (only changed scalar fields) for pending queue
    const patch: Record<string, any> = {};
    if (firstName !== undefined) patch.first_name = firstName;
    if (lastName !== undefined) patch.last_name = lastName;
    if (settings?.daily_budget !== undefined) patch.daily_budget = settings.daily_budget;
    if (settings?.is_auto_renew !== undefined) patch.is_auto_renew = settings.is_auto_renew;

    const pendingKey = `@arthik_pending_profile_${user.id}`;
    const queuePatch = async () => {
      try {
        const existing = await AsyncStorage.getItem(pendingKey);
        await AsyncStorage.setItem(pendingKey, JSON.stringify({ ...(existing ? JSON.parse(existing) : {}), ...patch }));
      } catch {}
    };

    if (useNetworkStore.getState().isOffline) return queuePatch();

    set({ loading: true });
    try {
      const { error } = await supabase.from('profiles').upsert(updatedProfile);
      if (error) throw error;
      try { await AsyncStorage.removeItem(pendingKey); } catch {}
    } catch (e: any) {
      if (isNetworkFailure(e)) return queuePatch();
      if (__DEV__) console.error('Error updating profile:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteAccount: async () => {
    const user = get().user;
    if (!user) throw new Error('No authenticated user session found');
    const userId = user.id;

    set({ loading: true });
    try {
      // 1. Invoke server-side Edge Function to delete user data & auth.users record securely
      const { data, error } = await supabase.functions.invoke('delete-user-account');

      if (error) {
        let errorMsg = error.message;
        if (data && typeof data === 'object' && (data as any).error) {
          errorMsg = (data as any).error;
        }
        throw new Error(errorMsg || 'Failed to delete account on server');
      }

      if (data && (data as any).success === false) {
        throw new Error((data as any).error || 'Failed to delete user account');
      }

      // 2. Account permanently deleted on server.
      // Cancel all scheduled notifications
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch (err) {
        if (__DEV__) console.error('Error cancelling notifications on delete:', err);
      }

      // Clean up all AsyncStorage keys for this user (pending, cache, failed, etc.)
      try {
        await AsyncStorage.removeItem('@arthik_cached_user');
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter((k) => k.includes(userId));
        if (userKeys.length > 0) {
          await AsyncStorage.multiRemove(userKeys);
        }
      } catch (err) {
        if (__DEV__) console.error('Error removing user AsyncStorage keys:', err);
      }

      // Trigger local store cleanup and sign out locally
      try {
        resetCallbacks.forEach((cb) => {
          try {
            cb();
          } catch (err) {
            if (__DEV__) console.error('Error running store reset callback:', err);
          }
        });
      } catch (e) {
        if (__DEV__) console.error('Error resetting stores on delete account:', e);
      }
      await supabase.auth.signOut({ scope: 'local' });
      set({ session: null, user: null, profile: null, loading: false });
    } catch (e) {
      if (__DEV__) console.error('Error deleting user account:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));
