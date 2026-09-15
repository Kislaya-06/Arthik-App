import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
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
            console.error('Error running store reset callback:', err);
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
      console.error('Error fetching profile:', e);
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
          console.error('Error running store reset callback:', err);
        }
      });
    } catch (e) {
      console.error('Error resetting stores on sign out:', e);
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
      console.error('Error updating profile:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

}));
