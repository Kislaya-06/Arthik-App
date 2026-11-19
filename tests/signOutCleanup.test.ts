import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearUserCachesOnSignOut,
  getCachedCategoriesKey,
  getCachedProfileKey,
  getCachedTransferRulesKeyForCleanup,
} from '../src/lib/signOutCleanup';
import { runExclusive } from '../src/lib/queueLock';
import { isExpenseCacheUnchanged, rememberExpenseCache } from '../src/lib/expenseCacheMemo';
import {
  getCachedStorageKey,
  getPendingStorageKey,
  getPendingUpdatesKey,
  getPendingDeletesKey,
  getFailedSyncStorageKey,
} from '../src/store/expense/pendingQueues';

const USER = 'user-a';
const OTHER = 'user-b';

describe('SEC-01 clearUserCachesOnSignOut', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
  });

  it('removes the signed-out user copies of server data', async () => {
    storageMap.set(getCachedStorageKey(USER), '[{"id":"e1"}]');
    storageMap.set(getCachedCategoriesKey(USER), '[{"id":"c1"}]');
    storageMap.set(getCachedProfileKey(USER), '{"first_name":"A"}');

    await clearUserCachesOnSignOut(USER);

    expect(storageMap.has(getCachedStorageKey(USER))).toBe(false);
    expect(storageMap.has(getCachedCategoriesKey(USER))).toBe(false);
    expect(storageMap.has(getCachedProfileKey(USER))).toBe(false);
  });

  it('never removes unsynced queues, failed-sync items or settings', async () => {
    const keep: Record<string, string> = {
      [getPendingStorageKey(USER)]: '[{"id":"p1"}]',
      [getPendingUpdatesKey(USER)]: '[{"id":"e1","payload":{}}]',
      [getPendingDeletesKey(USER)]: '["e2"]',
      [getFailedSyncStorageKey(USER)]: '[{"id":"f1"}]',
      [`@arthik_pending_cat_adds_${USER}`]: '[{"id":"c9"}]',
      [`@arthik_pending_gullak_adds_${USER}`]: '[{"id":"g1"}]',
      [`@arthik_pending_plan_changes_${USER}`]: '[{"id":"pc1"}]',
      [`@arthik_pending_budget_periods_${USER}`]: '[{"id":"bp1"}]',
      [`@arthik_pending_profile_${USER}`]: '{"first_name":"A"}',
      [`@arthik_pending_settings_${USER}`]: '{"daily_budget":100}',
      [`@arthik_pending_transfer_rules_${USER}`]: '[{"id":"tr1"}]',
      '@arthik_has_seen_onboarding': 'true',
      '@arthik_app_lock_enabled': 'true',
    };
    for (const [k, v] of Object.entries(keep)) storageMap.set(k, v);
    storageMap.set(getCachedStorageKey(USER), '[]');

    await clearUserCachesOnSignOut(USER);

    for (const [k, v] of Object.entries(keep)) expect(storageMap.get(k)).toBe(v);
  });

  it('leaves another user data on the same phone untouched', async () => {
    storageMap.set(getCachedStorageKey(OTHER), '[{"id":"x"}]');
    storageMap.set(getCachedCategoriesKey(OTHER), '[{"id":"y"}]');
    storageMap.set(getCachedProfileKey(OTHER), '{"first_name":"B"}');
    storageMap.set(getCachedStorageKey(USER), '[]');

    await clearUserCachesOnSignOut(USER);

    expect(storageMap.get(getCachedStorageKey(OTHER))).toBe('[{"id":"x"}]');
    expect(storageMap.get(getCachedCategoriesKey(OTHER))).toBe('[{"id":"y"}]');
    expect(storageMap.get(getCachedProfileKey(OTHER))).toBe('{"first_name":"B"}');
  });

  it('does nothing without a user id', async () => {
    storageMap.set(getCachedStorageKey(USER), '[]');
    await clearUserCachesOnSignOut(undefined);
    await clearUserCachesOnSignOut(null);
    await clearUserCachesOnSignOut('');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(storageMap.has(getCachedStorageKey(USER))).toBe(true);
  });

  it('forgets the "already written" memo, so the next sign-in writes the cache again', async () => {
    const key = getCachedStorageKey(USER);
    const json = '[{"id":"e1"}]';
    storageMap.set(key, json);
    rememberExpenseCache(key, json);
    expect(isExpenseCacheUnchanged(key, json)).toBe(true);

    await clearUserCachesOnSignOut(USER);

    expect(isExpenseCacheUnchanged(key, json)).toBe(false);
  });

  it('waits for a cache write that is already running, then removes its result', async () => {
    const key = getCachedStorageKey(USER);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer = runExclusive(key, async () => {
      await gate;
      await AsyncStorage.setItem(key, '[{"id":"late"}]');
    });

    const cleanup = clearUserCachesOnSignOut(USER);
    release();
    await Promise.all([writer, cleanup]);

    expect(storageMap.has(key)).toBe(false);
  });

  it('one failing removal does not stop the others and never throws', async () => {
    storageMap.set(getCachedStorageKey(USER), '[]');
    storageMap.set(getCachedCategoriesKey(USER), '[]');
    storageMap.set(getCachedProfileKey(USER), '{}');
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk'));

    await expect(clearUserCachesOnSignOut(USER)).resolves.toBeUndefined();

    expect(storageMap.has(getCachedCategoriesKey(USER))).toBe(false);
    expect(storageMap.has(getCachedProfileKey(USER))).toBe(false);
  });

  it('uses the same key names as the stores that write these caches', () => {
    const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    expect(getCachedCategoriesKey('X')).toBe('@arthik_cached_categories_X');
    expect(getCachedProfileKey('X')).toBe('@arthik_cached_profile_X');
    expect(read('src/store/categoryStore.ts')).toContain('`@arthik_cached_categories_${user.id}`');
    expect(read('src/store/authStore.ts')).toContain('`@arthik_cached_profile_${user.id}`');
    expect(getCachedTransferRulesKeyForCleanup('X')).toBe('@arthik_cached_transfer_rules_X');
    expect(read('src/store/transferRulesStore.ts')).toContain('`@arthik_cached_transfer_rules_${userId}`');
  });

  it('removes the saved self-transfer rules of the signed-out user but keeps the unsent ones', async () => {
    storageMap.set(`@arthik_cached_transfer_rules_${USER}`, '[{"id":"r1"}]');
    storageMap.set(`@arthik_pending_transfer_rules_${USER}`, '[{"id":"r2"}]');

    await clearUserCachesOnSignOut(USER);

    expect(storageMap.has(`@arthik_cached_transfer_rules_${USER}`)).toBe(false);
    expect(storageMap.get(`@arthik_pending_transfer_rules_${USER}`)).toBe('[{"id":"r2"}]');
  });
});
