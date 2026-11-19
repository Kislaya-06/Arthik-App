import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Category offline queues (adds / updates / deletes): same data-loss guards as tests/offlineQueueSafety.test.ts.
 * A category created while a sync request is in flight must stay queued, and two writers on one key must not overlap.
 */

const storageMap = new Map<string, string>();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      const value = storageMap.get(key) ?? null;
      await tick();
      return value;
    }),
    setItem: vi.fn(async (key: string, val: string) => {
      await tick();
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      await tick();
      storageMap.delete(key);
    }),
  },
}));

let uuid = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `80000000-0000-4000-8000-${String(uuid++).padStart(12, '0')}`),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('lucide-react-native', () => ({}));

const USER_ID = 'user_cat_queue_1';
const hooks: { onRequest: (() => Promise<void>) | null } = { onRequest: null };

vi.mock('../src/config/supabase', () => {
  const request = async () => {
    if (hooks.onRequest) {
      const run = hooks.onRequest;
      hooks.onRequest = null;
      await run();
    }
    return { error: null };
  };
  return {
    supabase: {
      from: vi.fn(() => ({
        upsert: vi.fn(() => request()),
        update: vi.fn(() => ({ eq: vi.fn(() => request()) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => request()) })),
      })),
    },
  };
});
vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'user_cat_queue_1' } })) },
  registerStoreResetCallback: vi.fn(),
}));
// Offline, so syncPendingCategories does not try to re-download categories at the end.
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: { getState: vi.fn(() => ({ isOffline: true })) },
}));

import { useCategoryStore } from '../src/store/categoryStore';

const addsKey = `@arthik_pending_cat_adds_${USER_ID}`;
const updsKey = `@arthik_pending_cat_updates_${USER_ID}`;
const delsKey = `@arthik_pending_cat_deletes_${USER_ID}`;
const readJson = (key: string) => {
  const raw = storageMap.get(key);
  return raw ? JSON.parse(raw) : null;
};
const seed = (key: string, value: unknown) => storageMap.set(key, JSON.stringify(value));
const cat = (id: string) => ({ id, user_id: USER_ID, name: `Cat ${id}`, icon: 'tag', color: '#111111', kind: 'expense' });

beforeEach(() => {
  storageMap.clear();
  hooks.onRequest = null;
});

describe('category offline queues', () => {
  it('a category created while the add queue is syncing stays queued', async () => {
    seed(addsKey, [cat('c1')]);
    hooks.onRequest = async () => {
      // The user creates another category while the first one is being sent.
      const raw = storageMap.get(addsKey);
      await tick();
      const current = raw ? JSON.parse(raw) : [];
      storageMap.set(addsKey, JSON.stringify([...current, cat('c2')]));
    };
    await useCategoryStore.getState().syncPendingCategories();
    expect(readJson(addsKey).map((c: any) => c.id)).toEqual(['c2']);
  });

  it('an update queued while the update queue is syncing stays queued', async () => {
    seed(updsKey, [{ id: 'u1', name: 'A', icon: 'tag', color: '#111111' }]);
    hooks.onRequest = async () => {
      const current = JSON.parse(storageMap.get(updsKey) as string);
      storageMap.set(updsKey, JSON.stringify([...current, { id: 'u2', name: 'B', icon: 'tag', color: '#222222' }]));
    };
    await useCategoryStore.getState().syncPendingCategories();
    expect(readJson(updsKey).map((u: any) => u.id)).toEqual(['u2']);
  });

  it('a delete queued while the delete queue is syncing stays queued', async () => {
    seed(delsKey, ['d1']);
    hooks.onRequest = async () => {
      const current = JSON.parse(storageMap.get(delsKey) as string);
      storageMap.set(delsKey, JSON.stringify([...current, 'd2']));
    };
    await useCategoryStore.getState().syncPendingCategories();
    expect(readJson(delsKey)).toEqual(['d2']);
  });

  it('an item that did sync is removed and nothing else is touched', async () => {
    seed(addsKey, [cat('c1'), cat('c2')]);
    await useCategoryStore.getState().syncPendingCategories();
    expect(readJson(addsKey)).toEqual([]);
  });
});
