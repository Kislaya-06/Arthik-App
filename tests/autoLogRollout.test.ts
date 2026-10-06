import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

import {
  parseRollout, cohortFromInstallTimes, isExistingUser, isAutoLogAvailable, shouldShowIntro, DEFAULT_ROLLOUT,
} from '../src/features/autoLog/rollout';

const T = Date.parse('2026-10-07T00:00:00Z');

describe('parseRollout', () => {
  it('reads the app_config shape', () => {
    expect(parseRollout({ autolog: { audience: 'all', existing_before: '2026-10-07T00:00:00Z' } })).toEqual({ audience: 'all', existingBefore: '2026-10-07T00:00:00Z' });
  });
  it('falls back to "existing" (Beta paused for new users) on junk', () => {
    expect(parseRollout(null)).toEqual(DEFAULT_ROLLOUT);
    expect(parseRollout({ autolog: { audience: 'everyone', existing_before: 'not a date' } })).toEqual({ audience: 'existing', existingBefore: null });
  });
});

describe('install cohort', () => {
  it('upgraded install (update time later than install time) → existing', () => {
    expect(cohortFromInstallTimes(T - 30 * 86400_000, T)).toBe('existing');
  });
  it('fresh install → new', () => {
    expect(cohortFromInstallTimes(T, T)).toBe('new');
    expect(cohortFromInstallTimes(T, T + 30_000)).toBe('new');
    expect(cohortFromInstallTimes(null, null)).toBe('new');
  });
});

describe('who is an existing user', () => {
  const rollout = { audience: 'existing' as const, existingBefore: '2026-10-07T00:00:00Z' };
  it('upgraded phone', () => expect(isExistingUser({ cohort: 'existing', accountCreatedAt: null, rollout })).toBe(true));
  it('old account on a fresh install (reinstall / new phone)', () =>
    expect(isExistingUser({ cohort: 'new', accountCreatedAt: '2026-05-01T10:00:00Z', rollout })).toBe(true));
  it('brand-new account on a fresh install', () =>
    expect(isExistingUser({ cohort: 'new', accountCreatedAt: '2026-10-08T10:00:00Z', rollout })).toBe(false));
  it('no cutoff configured → only the phone decides', () =>
    expect(isExistingUser({ cohort: 'new', accountCreatedAt: '2020-01-01T00:00:00Z', rollout: { audience: 'existing', existingBefore: null } })).toBe(false));
});

describe('availability + intro', () => {
  it('Beta paused for new users', () => {
    expect(isAutoLogAvailable({ rollout: { audience: 'existing', existingBefore: null }, existingUser: false, alreadyUsing: false })).toBe(false);
    expect(isAutoLogAvailable({ rollout: { audience: 'existing', existingBefore: null }, existingUser: true, alreadyUsing: false })).toBe(true);
  });
  it('"all" opens it for everyone; "none" hides it — but never from someone already using it', () => {
    expect(isAutoLogAvailable({ rollout: { audience: 'all', existingBefore: null }, existingUser: false, alreadyUsing: false })).toBe(true);
    expect(isAutoLogAvailable({ rollout: { audience: 'none', existingBefore: null }, existingUser: true, alreadyUsing: false })).toBe(false);
    expect(isAutoLogAvailable({ rollout: { audience: 'none', existingBefore: null }, existingUser: false, alreadyUsing: true })).toBe(true);
  });
  it('intro only for existing users, once, and not if already set up', () => {
    expect(shouldShowIntro({ available: true, existingUser: true, alreadyUsing: false, introSeen: false })).toBe(true);
    expect(shouldShowIntro({ available: true, existingUser: false, alreadyUsing: false, introSeen: false })).toBe(false); // new user, even with audience 'all'
    expect(shouldShowIntro({ available: true, existingUser: true, alreadyUsing: false, introSeen: true })).toBe(false);
    expect(shouldShowIntro({ available: true, existingUser: true, alreadyUsing: true, introSeen: false })).toBe(false);
    expect(shouldShowIntro({ available: false, existingUser: true, alreadyUsing: false, introSeen: false })).toBe(false);
  });
});
