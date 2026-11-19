import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createSecureSessionStorage } from '../lib/secureSessionStorage';
import { expoSessionCipher } from '../lib/expoSessionCipher';

// In dev, reads from .env (EXPO_PUBLIC_*).
// In APK builds, reads from app.json -> extra (bundled at build time).
const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  '';

const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  '';

// SEC-02: the login session is stored encrypted (AES-256-GCM, key in the phone's secure storage).
// A session saved as plain text by an older version is still read and then encrypted. See secureSessionStorage.ts.
const sessionStorage = createSecureSessionStorage({
  storage: AsyncStorage,
  vault: SecureStore,
  cipher: expoSessionCipher,
  // The stored session cannot be read on this phone anymore: forget the "offline user" too, so the app opens
  // on the login screen instead of opening half signed in. (Not for the short-lived PKCE code verifier.)
  onUnreadable: (key) => (key.endsWith('-code-verifier') ? undefined : AsyncStorage.removeItem('@arthik_cached_user')),
});

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Auto refresh token when app is foregrounded, pause when backgrounded (P0.9)
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

