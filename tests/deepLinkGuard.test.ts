import { describe, it, expect } from 'vitest';
import {
  parseJwtPayload,
  isSameUserIdentity,
  evaluateDeepLinkSessionAction,
} from '../src/lib/deepLinkGuard';

describe('deepLinkGuard', () => {
  // Helper to create a dummy JWT with given payload object
  const makeToken = (payloadObj: Record<string, any>): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    return `${header}.${payload}.mockSignature`;
  };

  describe('isSameUserIdentity', () => {
    it('returns false if either user is null or undefined', () => {
      expect(isSameUserIdentity(null, { id: 'u1' })).toBe(false);
      expect(isSameUserIdentity({ id: 'u1' }, null)).toBe(false);
      expect(isSameUserIdentity(undefined, undefined)).toBe(false);
    });

    it('returns true when user IDs match', () => {
      expect(isSameUserIdentity({ id: 'u1', email: 'a@test.com' }, { id: 'u1', email: 'diff@test.com' })).toBe(true);
    });

    it('returns true when emails match case-insensitively even if IDs differ or missing', () => {
      expect(isSameUserIdentity({ email: 'alice@example.com' }, { email: 'ALICE@EXAMPLE.COM' })).toBe(true);
      expect(isSameUserIdentity({ id: 'u1', email: 'user@test.com' }, { id: 'u2', email: 'User@Test.com' })).toBe(true);
    });

    it('returns false when both ID and email differ', () => {
      expect(isSameUserIdentity({ id: 'u1', email: 'alice@test.com' }, { id: 'u2', email: 'bob@test.com' })).toBe(false);
    });
  });

  describe('parseJwtPayload', () => {
    it('returns null for null, undefined, empty, or non-string inputs', () => {
      expect(parseJwtPayload(null)).toBeNull();
      expect(parseJwtPayload(undefined)).toBeNull();
      expect(parseJwtPayload('')).toBeNull();
      expect(parseJwtPayload('random-string-no-dot')).toBeNull();
    });

    it('correctly parses valid JWT payload', () => {
      const token = makeToken({ sub: 'user-123', email: 'alice@example.com', role: 'authenticated' });
      const parsed = parseJwtPayload(token);
      expect(parsed).toEqual({
        sub: 'user-123',
        email: 'alice@example.com',
        role: 'authenticated',
      });
    });

    it('returns null if payload is not valid JSON', () => {
      const corruptToken = 'header.bm90LWpzb24.signature'; // "not-json"
      expect(parseJwtPayload(corruptToken)).toBeNull();
    });
  });

  describe('evaluateDeepLinkSessionAction', () => {
    const userAlice = { id: 'alice-id', email: 'alice@example.com' };
    const aliceToken = makeToken({ sub: 'alice-id', email: 'alice@example.com' });
    const bobToken = makeToken({ sub: 'bob-id', email: 'bob@example.com' });

    describe('when no credentials exist in link', () => {
      it('returns IGNORE when both accessToken and code are missing', () => {
        const result = evaluateDeepLinkSessionAction({
          currentUser: userAlice,
          isRecovery: false,
          accessToken: null,
          code: null,
        });
        expect(result).toEqual({ type: 'IGNORE' });
      });
    });

    describe('when user is logged out (currentUser = null)', () => {
      it('returns APPLY_IMMEDIATELY for password recovery', () => {
        const result = evaluateDeepLinkSessionAction({
          currentUser: null,
          isRecovery: true,
          accessToken: aliceToken,
        });
        expect(result).toEqual({ type: 'APPLY_IMMEDIATELY' });
      });

      it('returns APPLY_IMMEDIATELY for OAuth/callback tokens', () => {
        const result = evaluateDeepLinkSessionAction({
          currentUser: null,
          isRecovery: false,
          accessToken: bobToken,
        });
        expect(result).toEqual({ type: 'APPLY_IMMEDIATELY' });
      });

      it('returns APPLY_IMMEDIATELY for PKCE code', () => {
        const result = evaluateDeepLinkSessionAction({
          currentUser: null,
          isRecovery: false,
          code: 'valid-pkce-code',
        });
        expect(result).toEqual({ type: 'APPLY_IMMEDIATELY' });
      });
    });

    describe('when user is already logged in (currentUser exists)', () => {
      describe('same user identity in token', () => {
        it('returns APPLY_IMMEDIATELY if incoming token matches currentUser.id', () => {
          const result = evaluateDeepLinkSessionAction({
            currentUser: userAlice,
            isRecovery: true,
            accessToken: aliceToken,
          });
          expect(result).toEqual({ type: 'APPLY_IMMEDIATELY' });
        });

        it('returns APPLY_IMMEDIATELY if incoming token matches currentUser.email (case insensitive)', () => {
          const tokenWithOnlyEmail = makeToken({ email: 'ALICE@EXAMPLE.COM' });
          const result = evaluateDeepLinkSessionAction({
            currentUser: userAlice,
            isRecovery: false,
            accessToken: tokenWithOnlyEmail,
          });
          expect(result).toEqual({ type: 'APPLY_IMMEDIATELY' });
        });
      });

      describe('different user identity in token (Login CSRF / Account Switch attempt)', () => {
        it('returns PROMPT_SWITCH with incoming user details for different account', () => {
          const result = evaluateDeepLinkSessionAction({
            currentUser: userAlice,
            isRecovery: false,
            accessToken: bobToken,
          });
          expect(result).toEqual({
            type: 'PROMPT_SWITCH',
            incomingEmail: 'bob@example.com',
            incomingUserId: 'bob-id',
          });
        });

        it('returns PROMPT_SWITCH for password recovery link belonging to a different user', () => {
          const result = evaluateDeepLinkSessionAction({
            currentUser: userAlice,
            isRecovery: true,
            accessToken: bobToken,
          });
          expect(result).toEqual({
            type: 'PROMPT_SWITCH',
            incomingEmail: 'bob@example.com',
            incomingUserId: 'bob-id',
          });
        });

        it('returns PROMPT_SWITCH if accessToken is corrupt/unparseable', () => {
          const result = evaluateDeepLinkSessionAction({
            currentUser: userAlice,
            isRecovery: false,
            accessToken: 'corrupt.token',
          });
          expect(result).toEqual({
            type: 'PROMPT_SWITCH',
            incomingEmail: undefined,
            incomingUserId: undefined,
          });
        });
      });

      describe('when link carries only PKCE code while logged in', () => {
        it('returns EXCHANGE_AND_VERIFY so code can be verified post-exchange before prompting', () => {
          const result = evaluateDeepLinkSessionAction({
            currentUser: userAlice,
            isRecovery: false,
            code: 'pkce-auth-code',
          });
          expect(result).toEqual({
            type: 'EXCHANGE_AND_VERIFY',
          });
        });
      });
    });
  });
});
