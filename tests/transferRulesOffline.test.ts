import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Remembered self-transfer notes must work without internet (TXN-003, offline-first):
 *  - the rule list is kept on the phone, so a transfer is still recognised offline (otherwise it would be counted as
 *    a normal expense / income);
 *  - "Always remember this" while offline is saved locally and sent later, never lost;
 *  - an expense that points to a rule is only sent after that rule reached the server (foreign key), so the queued
 *    rules are flushed first.
 */

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

let uuid = 1;
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => `90000000-0000-4000-8000-${String(uuid++).padStart(12, '0')}`),
}));

const USER_ID = 'user_rules_1';
let serverRules: any[] = [];
let failWith: unknown = null; // network error for every request when set
const requests: { op: string; payload?: any }[] = [];

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => {
          requests.push({ op: 'select' });
          return failWith ? { data: null, error: failWith } : { data: serverRules, error: null };
        }),
      })),
      insert: vi.fn((row: any) => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => {
            requests.push({ op: 'insert', payload: row });
            return failWith ? { data: null, error: failWith } : { data: { ...row, created_at: 'now' }, error: null };
          }),
        })),
      })),
      upsert: vi.fn(async (row: any) => {
        requests.push({ op: 'upsert', payload: row });
        return failWith ? { error: failWith } : { error: null };
      }),
      delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  },
}));

vi.mock('../src/store/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'user_rules_1' } })) },
  registerStoreResetCallback: vi.fn(),
}));

let offline = false;
vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: { getState: vi.fn(() => ({ isOffline: offline })) },
}));

import { useTransferRulesStore, syncPendingTransferRules } from '../src/store/transferRulesStore';

const cacheKey = `@arthik_cached_transfer_rules_${USER_ID}`;
const pendingKey = `@arthik_pending_transfer_rules_${USER_ID}`;
const readJson = (key: string) => {
  const raw = storageMap.get(key);
  return raw ? JSON.parse(raw) : null;
};
const serverRule = { id: 'r-server', user_id: USER_ID, descriptor: 'hdfc 1234 sbi 5678', label: 'HDFC to SBI' };

beforeEach(() => {
  storageMap.clear();
  serverRules = [];
  failWith = null;
  offline = false;
  requests.length = 0;
  uuid = 1;
  useTransferRulesStore.getState().reset();
});

describe('rule list on the phone', () => {
  it('saves the list after a successful download', async () => {
    serverRules = [serverRule];
    await useTransferRulesStore.getState().fetchAll();
    expect(useTransferRulesStore.getState().rules).toEqual([serverRule]);
    expect(readJson(cacheKey)).toEqual([serverRule]);
  });

  it('offline: loads the saved list and marks it loaded, without any request', async () => {
    storageMap.set(cacheKey, JSON.stringify([serverRule]));
    offline = true;
    await useTransferRulesStore.getState().fetchAll();
    expect(useTransferRulesStore.getState().rules).toEqual([serverRule]);
    expect(useTransferRulesStore.getState().isLoaded).toBe(true);
    expect(requests).toEqual([]);
  });

  it('a failed download keeps the saved list (never empties it)', async () => {
    storageMap.set(cacheKey, JSON.stringify([serverRule]));
    failWith = new Error('Network request failed');
    await useTransferRulesStore.getState().fetchAll();
    expect(useTransferRulesStore.getState().rules).toEqual([serverRule]);
    expect(readJson(cacheKey)).toEqual([serverRule]);
  });

  it('shows the saved list first, then replaces it with the server list', async () => {
    storageMap.set(cacheKey, JSON.stringify([serverRule]));
    serverRules = [serverRule, { ...serverRule, id: 'r-other', descriptor: 'axis 1111 icici 2222' }];
    await useTransferRulesStore.getState().fetchAll();
    expect(useTransferRulesStore.getState().rules.map((r) => r.id)).toEqual(['r-server', 'r-other']);
  });
});

describe('addRule', () => {
  it('online: saves on the server and returns the server row (unchanged behaviour)', async () => {
    const rule = await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'My accounts');
    expect(rule?.id).toBeTruthy();
    expect(requests.some((r) => r.op === 'insert')).toBe(true);
    expect(readJson(pendingKey)).toBeNull();
    expect(readJson(cacheKey)?.map((r: any) => r.id)).toEqual([rule?.id]);
  });

  it('offline: keeps the rule on the phone, usable at once, and queues it for later', async () => {
    offline = true;
    const rule = await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'My accounts');

    expect(rule?.id).toBeTruthy();
    expect(useTransferRulesStore.getState().rules.map((r) => r.id)).toEqual([rule?.id]);
    expect(readJson(pendingKey).map((r: any) => r.id)).toEqual([rule?.id]);
    expect(readJson(cacheKey).map((r: any) => r.id)).toEqual([rule?.id]);
    expect(requests).toEqual([]); // nothing was sent
  });

  it('online but the request fails on the network: same as offline (queued, not lost)', async () => {
    failWith = new Error('Network request failed');
    const rule = await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'My accounts');
    expect(rule?.id).toBeTruthy();
    expect(readJson(pendingKey).map((r: any) => r.id)).toEqual([rule?.id]);
  });

  it('a server rejection that is not a network problem still throws (nothing is queued)', async () => {
    failWith = { message: 'new row violates row-level security policy', code: '42501' };
    await expect(useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'x')).rejects.toBeTruthy();
    expect(readJson(pendingKey)).toBeNull();
  });

  it('returns the existing rule for the same note instead of adding a second one', async () => {
    offline = true;
    const first = await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'a');
    const second = await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'b');
    expect(second?.id).toBe(first?.id);
    expect(readJson(pendingKey)).toHaveLength(1);
  });

  it('a rule queued offline survives a download that does not know it yet', async () => {
    offline = true;
    const rule = await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'a');
    offline = false;
    serverRules = [serverRule]; // the server has no knowledge of the queued rule yet
    await useTransferRulesStore.getState().fetchAll();
    expect(useTransferRulesStore.getState().rules.map((r) => r.id).sort()).toEqual([rule?.id, 'r-server'].sort());
  });
});

describe('syncPendingTransferRules', () => {
  it('sends queued rules and removes them from the queue', async () => {
    offline = true;
    const rule = await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'a');
    offline = false;

    await syncPendingTransferRules(USER_ID);

    expect(requests.filter((r) => r.op === 'upsert').map((r) => r.payload.id)).toEqual([rule?.id]);
    expect(readJson(pendingKey)).toEqual([]);
  });

  it('keeps a rule that could not be sent (still offline)', async () => {
    offline = true;
    await useTransferRulesStore.getState().addRule('HDFC 1234 to SBI 5678', 'a');
    failWith = new Error('Network request failed');

    await syncPendingTransferRules(USER_ID);

    expect(readJson(pendingKey)).toHaveLength(1);
  });

  it('does nothing when the queue is empty', async () => {
    await syncPendingTransferRules(USER_ID);
    expect(requests).toEqual([]);
  });
});
