import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';

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

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // Profile might not exist yet (first sign up setup)
        set({ profile: null });
      } else {
        set({ profile: data });
      }
    } catch (e) {
      if (__DEV__) console.error('Error fetching profile:', e);
    } finally {
      set({ loading: false, initialized: true });
    }
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
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, loading: false });
  },

  updateProfile: async (firstName?: string, lastName?: string, settings?: { daily_budget?: number; is_auto_renew?: boolean }) => {
    const { user, profile } = get();
    if (!user) return;

    set({ loading: true });

    const updatedProfile: Profile = {
      id: user.id,
      first_name: firstName ?? profile?.first_name ?? '',
      last_name: lastName !== undefined ? lastName : (profile?.last_name || ''),
      email: user.email || profile?.email || '',
      daily_budget: settings?.daily_budget !== undefined ? settings.daily_budget : profile?.daily_budget,
      is_auto_renew: settings?.is_auto_renew !== undefined ? settings.is_auto_renew : profile?.is_auto_renew,
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert(updatedProfile);

      if (error) throw error;
      set({ profile: updatedProfile });
    } catch (e) {
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
