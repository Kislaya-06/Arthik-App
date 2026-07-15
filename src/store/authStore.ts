import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isMockMode } from '../config/supabase';

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
  mockLogin: (email: string, firstName: string) => void;
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

    // TODO: Supabase Integration - Check isMockMode for environment-specific logic
    if (isMockMode) {
      // TODO: Supabase Integration - Fetch user profile from Supabase database when ready
      // Mock mode profile
      set({
        profile: {
          id: user.id,
          first_name: user.user_metadata?.first_name || 'User',
          last_name: user.user_metadata?.last_name || '',
          email: user.email || '',
        },
        loading: false,
        initialized: true,
      });
      return;
    }

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
    // TODO: Supabase Integration - Check isMockMode for environment-specific logic
    if (!isMockMode) {
      await supabase.auth.signOut();
    }
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

    // TODO: Supabase Integration - Check isMockMode for environment-specific logic
    if (isMockMode) {
      set({ profile: updatedProfile, loading: false });
      return;
    }

    try {
      // TODO: Supabase Integration - Update user profile in Supabase database when ready
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

  mockLogin: (email, firstName) => {
    // TODO: Supabase Integration - Remove this mock login once real authentication is implemented
    const mockSession = {
      user: {
        id: 'mock-user-123',
        email,
        user_metadata: { first_name: firstName },
      },
    };
    get().setSession(mockSession as any);
  },
}));
