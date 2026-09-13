import { supabase } from '../config/supabase';
import { navigateTo } from '../navigation/navigationRef';
import { useAuthStore } from '../store/authStore';

let lastHandledUrl = '';
let lastHandledTime = 0;

/**
 * Robustly parses query parameters and hash fragments from a URL.
 * Handles both:
 * 1. Query strings: ?access_token=...&type=recovery
 * 2. Hash fragments: #access_token=...&type=recovery
 * 3. Supabase error redirects: #error=access_denied&error_code=otp_expired&error_description=...
 */
function parseDeepLink(url: string) {
  const params: Record<string, string> = {};

  // Parse query string (?...)
  if (url.includes('?')) {
    const qs = url.split('?')[1].split('#')[0];
    new URLSearchParams(qs).forEach((value, key) => {
      params[key] = value;
    });
  }

  // Parse hash fragment (#...)
  if (url.includes('#')) {
    const hs = url.split('#')[1];
    new URLSearchParams(hs).forEach((value, key) => {
      params[key] = value;
    });
  }

  // Extract path without scheme, query, or hash
  const noScheme = url.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  const path = noScheme.split('?')[0].split('#')[0].toLowerCase();

  return { path, params };
}

/**
 * Parses and processes any deep link coming into the app,
 * specifically handling Supabase OAuth and Password Recovery redirects.
 */
export async function handleAuthDeepLink(url: string | null): Promise<boolean> {
  if (!url) return false;

  // Debounce duplicate invocations within 1.5s
  const now = Date.now();
  if (url === lastHandledUrl && now - lastHandledTime < 1500) {
    return true;
  }
  lastHandledUrl = url;
  lastHandledTime = now;

  try {
    const { path, params } = parseDeepLink(url);

    const type = (params.type || '').toLowerCase();
    const accessToken = params.access_token;
    const refreshToken = params.refresh_token;
    const code = params.code;
    const errorCode = params.error_code || params.error;
    const errorDescription = params.error_description || '';

    const isRecovery =
      path.includes('reset-password') ||
      type === 'recovery' ||
      errorCode === 'otp_expired' ||
      errorDescription.toLowerCase().includes('email link');

    // Case 1: Password Recovery Link
    if (isRecovery) {
      // Check if Supabase returned an error (e.g. otp_expired, access_denied)
      if (errorCode || errorDescription) {
        console.warn('[AuthDeepLink] Recovery link error:', errorCode, errorDescription);
        let friendlyMessage = 'Your password reset link is invalid or has expired. Please request a new link from the login screen.';
        if (errorCode === 'otp_expired' || errorDescription.toLowerCase().includes('expired')) {
          friendlyMessage = 'This password reset link has expired or has already been used. Please request a fresh link.';
        }
        // Always navigate to ResetPassword so the user sees clear feedback instead of being stuck
        navigateTo('ResetPassword', { initialError: friendlyMessage });
        return true;
      }

      // Valid recovery session tokens
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('[AuthDeepLink] Failed to set recovery session:', error.message);
          navigateTo('ResetPassword', {
            initialError: 'Could not restore password reset session. Please request a new link.',
          });
          return true;
        } else if (data?.session) {
          await useAuthStore.getState().setSession(data.session);
        }
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[AuthDeepLink] Failed to exchange recovery code:', error.message);
          navigateTo('ResetPassword', {
            initialError: 'Password reset code is invalid or expired. Please request a new link.',
          });
          return true;
        } else if (data?.session) {
          await useAuthStore.getState().setSession(data.session);
        }
      }

      // Navigate to the ResetPassword screen
      navigateTo('ResetPassword');
      return true;
    }

    // Case 2: OAuth or General Errors
    if (errorCode || errorDescription) {
      console.warn('[AuthDeepLink] Auth deep link returned error:', errorCode, errorDescription);
      return false;
    }

    // Case 3: Email Confirmation or OAuth Callbacks
    if (path.includes('callback') || type === 'signup' || type === 'invite') {
      if (accessToken && refreshToken) {
        const { data } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (data?.session) {
          await useAuthStore.getState().setSession(data.session);
        }
      } else if (code) {
        const { data } = await supabase.auth.exchangeCodeForSession(code);
        if (data?.session) {
          await useAuthStore.getState().setSession(data.session);
        }
      }
      return true;
    }

    return false;
  } catch (err) {
    console.error('[AuthDeepLink] Unexpected error handling deep link:', err);
    return false;
  }
}
