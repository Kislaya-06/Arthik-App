import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

export interface Profile {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  setSession: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (firstName: string, lastName?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  initialized: false,

  setSession: async (session) => {
    if (!session) {
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
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, loading: false });
  },

  updateProfile: async (firstName: string, lastName?: string) => {
    const { user, profile } = get();
    if (!user) return;

    set({ loading: true });

    const updatedProfile: Profile = {
      id: user.id,
      first_name: firstName,
      last_name: lastName || '',
      email: user.email || profile?.email || '',
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
