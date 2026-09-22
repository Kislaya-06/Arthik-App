import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Mock react-native Alert
const mockAlert = vi.fn();
vi.mock('react-native', () => ({
  Alert: {
    alert: (...args: any[]) => mockAlert(...args),
  },
  Platform: { OS: 'android' },
}));

// 2. Mock navigationRef
const mockNavigateTo = vi.fn();
vi.mock('../src/navigation/navigationRef', () => ({
  navigateTo: (...args: any[]) => mockNavigateTo(...args),
}));

// 3. Mock Supabase
const mockSetSession = vi.fn();
const mockExchangeCode = vi.fn();
vi.mock('../src/config/supabase', () => ({
  supabase: {
    auth: {
      setSession: (...args: any[]) => mockSetSession(...args),
      exchangeCodeForSession: (...args: any[]) => mockExchangeCode(...args),
    },
  },
}));

// 4. Mock AuthStore
let mockCurrentUser: any = null;
let mockCurrentSession: any = null;
const mockSetSessionStore = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../src/store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockCurrentUser,
      session: mockCurrentSession,
      setSession: mockSetSessionStore,
      signOut: mockSignOut,
    })),
  },
}));

// Helper to create mock JWT token
const makeToken = (payloadObj: Record<string, any>): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  return `${header}.${payload}.signature`;
};

import { handleAuthDeepLink } from '../src/lib/authLinkHandler';

describe('authLinkHandler (Seam: handleAuthDeepLink)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    mockCurrentSession = null;
    mockSetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    mockExchangeCode.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
  });

  describe('Slice 1: Input Validation & Debouncing', () => {
    it('returns false for null or empty url', async () => {
      expect(await handleAuthDeepLink(null)).toBe(false);
      expect(await handleAuthDeepLink('')).toBe(false);
    });

    it('debounces identical URLs clicked in rapid succession (< 1.5s)', async () => {
      const url = 'arthik://callback?code=some-code-123';
      const first = await handleAuthDeepLink(url);
      const second = await handleAuthDeepLink(url);

      expect(first).toBe(true);
      expect(second).toBe(true);
      // exchangeCodeForSession should only be called once due to debouncing
      expect(mockExchangeCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('Slice 2: Password Recovery Deep Links', () => {
    it('handles expired recovery links by routing to ResetPassword with user-friendly error', async () => {
      const expiredUrl = 'arthik://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

      const handled = await handleAuthDeepLink(expiredUrl);

      expect(handled).toBe(true);
      expect(mockNavigateTo).toHaveBeenCalledWith('ResetPassword', {
        initialError: 'This password reset link has expired or has already been used. Please request a fresh link.',
      });
    });

    it('sets session and routes to ResetPassword for valid recovery tokens', async () => {
      const token = makeToken({ sub: 'user_rec_1', email: 'user@example.com' });
      const validUrl = `arthik://reset-password#access_token=${token}&refresh_token=mock_refresh_123&type=recovery`;

      const handled = await handleAuthDeepLink(validUrl);

      expect(handled).toBe(true);
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: token,
        refresh_token: 'mock_refresh_123',
      });
      expect(mockNavigateTo).toHaveBeenCalledWith('ResetPassword');
    });
  });

  describe('Slice 3: OAuth & Callback Session Handling', () => {
    it('restores session from OAuth callback code exchange', async () => {
      const callbackUrl = 'arthik://callback?code=oauth-valid-code-456';
      mockExchangeCode.mockResolvedValueOnce({
        data: { session: { user: { id: 'oauth_user', email: 'oauth@example.com' } } },
        error: null,
      });

      const handled = await handleAuthDeepLink(callbackUrl);

      expect(handled).toBe(true);
      expect(mockExchangeCode).toHaveBeenCalledWith('oauth-valid-code-456');
      expect(mockSetSessionStore).toHaveBeenCalled();
    });

    it('returns false for unrelated deep link paths', async () => {
      const unrelatedUrl = 'arthik://unknown-path?foo=bar';

      const handled = await handleAuthDeepLink(unrelatedUrl);

      expect(handled).toBe(false);
    });
  });
});
