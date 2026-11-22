import { describe, it, expect } from 'vitest';
import { isSameUserIdentity } from '../src/lib/deepLinkGuard';

describe('deepLinkGuard', () => {
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
});
