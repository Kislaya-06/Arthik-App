import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these with actual Supabase project credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mock-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to determine if we are running in mock mode (when real keys are not supplied)
export const isMockMode =
  SUPABASE_URL.includes('mock-project') || SUPABASE_ANON_KEY === 'mock-anon-key';
