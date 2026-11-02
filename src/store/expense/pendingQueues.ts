import AsyncStorage from '@react-native-async-storage/async-storage';
import { runExclusive } from '../../lib/queueLock';
import type {
  Expense,
  FailedSyncItem,
  ExpenseUpdatePayload,
  PendingUpdate,
  PendingDelete,
} from './types';

export type { FailedSyncItem, ExpenseUpdatePayload, PendingUpdate, PendingDelete };

export const getPendingStorageKey = (userId: string) => `@arthik_pending_expenses_${userId}`;
export const getPendingUpdatesKey = (userId: string) => `@arthik_pending_updates_${userId}`;
export const getPendingDeletesKey = (userId: string) => `@arthik_pending_deletes_${userId}`;
export const getCachedStorageKey = (userId: string) => `@arthik_cached_expenses_${userId}`;
export const getFailedSyncStorageKey = (userId: string) => `@arthik_failed_sync_${userId}`;

export const MAX_SYNC_RETRIES = 5;

// Exponential backoff schedule (P0.7)
export const getBackoffDelay = (retries: number) => {
  const delays = [2000, 5000, 15000, 30000, 60000];
  return delays[Math.min(retries, delays.length - 1)];
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUUID = (id?: string | null): boolean => {
  if (!id) return true;
  return UUID_REGEX.test(id);
};

export const saveFailedSyncItem = async (
  userId: string,
  item: FailedSyncItem,
  onSaved?: (items: FailedSyncItem[]) => void
) => {
  try {
    const key = getFailedSyncStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    const list: FailedSyncItem[] = stored ? JSON.parse(stored) : [];
    const filtered = list.filter((f) => f.id !== item.id);
    filtered.unshift(item);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
    if (onSaved) {
      onSaved(filtered);
    }
  } catch (e) {
    if (__DEV__) console.log('Error saving failed sync item:', e);
  }
};

export const savePendingUpdateOffline = async (userId: string, id: string, payload: ExpenseUpdatePayload) => {
  const key = getPendingUpdatesKey(userId);
  await runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      const list: PendingUpdate[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex((u) => u.id === id);
      if (idx >= 0) {
        list[idx] = { id, payload: { ...list[idx].payload, ...payload } };
      } else {
        list.push({ id, payload });
      }
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      if (__DEV__) console.log('Error saving pending update to storage:', e);
    }
  });
};

export const savePendingDeleteOffline = async (userId: string, id: string) => {
  try {
    const updateKey = getPendingUpdatesKey(userId);
    await runExclusive(updateKey, async () => {
      const storedUpdates = await AsyncStorage.getItem(updateKey);
      if (storedUpdates) {
        const updates: PendingUpdate[] = JSON.parse(storedUpdates);
        const filtered = updates.filter((u) => u.id !== id);
        await AsyncStorage.setItem(updateKey, JSON.stringify(filtered));
      }
    });

    await enqueuePendingDelete(userId, id);
  } catch (e) {
    if (__DEV__) console.log('Error saving pending delete to storage:', e);
  }
};

/**
 * Adds `id` to the pending-deletes queue only (pending updates are left alone).
 * Returns true when this call added it, false when it was already queued.
 */
export const enqueuePendingDelete = async (userId: string, id: string): Promise<boolean> => {
  const key = getPendingDeletesKey(userId);
  return runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      const list: (string | PendingDelete)[] = stored ? JSON.parse(stored) : [];
      const exists = list.some((item) => (typeof item === 'string' ? item === id : item.id === id));
      if (exists) return false;
      list.push({ id, retryCount: 0, lastRetryAt: 0 });
      await AsyncStorage.setItem(key, JSON.stringify(list));
      return true;
    } catch (e) {
      if (__DEV__) console.log('Error queueing pending delete:', e);
      return false;
    }
  });
};

/** Removes `id` from the pending-deletes queue (used when the server already confirmed or refused the delete). */
export const removePendingDelete = async (userId: string, id: string): Promise<void> => {
  const key = getPendingDeletesKey(userId);
  await runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return;
      const list: (string | PendingDelete)[] = JSON.parse(stored);
      const filtered = list.filter((item) => (typeof item === 'string' ? item !== id : item.id !== id));
      if (filtered.length !== list.length) await AsyncStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      if (__DEV__) console.log('Error removing pending delete:', e);
    }
  });
};

/** Reads the queued update for `id` (or null). Used to remember what was there before a write-ahead. */
export const readPendingUpdate = async (userId: string, id: string): Promise<PendingUpdate | null> => {
  const key = getPendingUpdatesKey(userId);
  return runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      const list: PendingUpdate[] = stored ? JSON.parse(stored) : [];
      return list.find((u) => u.id === id) ?? null;
    } catch {
      return null;
    }
  });
};

/**
 * After the server answered an update that was written ahead to the queue:
 * if the queued entry for `id` is still exactly `{ id, payload: written }` (nobody changed it meanwhile),
 * put back `restoreTo` (the entry that was there before) or remove it when there was none.
 * If someone changed the entry meanwhile, it is left as it is (it will be sent again; updates are idempotent).
 */
export const settlePendingUpdate = async (
  userId: string,
  id: string,
  written: ExpenseUpdatePayload,
  restoreTo: PendingUpdate | null
): Promise<void> => {
  const key = getPendingUpdatesKey(userId);
  await runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return;
      const list: PendingUpdate[] = JSON.parse(stored);
      const idx = list.findIndex((u) => u.id === id);
      if (idx < 0) return;
      if (stableStringify(list[idx].payload) !== stableStringify(written)) return;
      if (restoreTo) list[idx] = restoreTo;
      else list.splice(idx, 1);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      if (__DEV__) console.log('Error settling pending update:', e);
    }
  });
};

export const updatePendingItemOffline = async (userId: string, id: string, patch: Partial<Expense>) => {
  const key = getPendingStorageKey(userId);
  await runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return;
      const list: Expense[] = JSON.parse(stored);
      const updated = list.map((item) => (item.id === id ? { ...item, ...patch } : item));
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      if (__DEV__) console.log('Error updating pending item offline:', e);
    }
  });
};

export const removePendingItemOffline = async (userId: string, id: string) => {
  const key = getPendingStorageKey(userId);
  await runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return;
      const list: Expense[] = JSON.parse(stored);
      const filtered = list.filter((item) => item.id !== id);
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    } catch (e) {
      if (__DEV__) console.log('Error removing pending item offline:', e);
    }
  });
};

/**
 * Removes the queued add for `id` only if it is still exactly `expected` (what the write-ahead stored).
 * If it was changed meanwhile (for example edited while the save was in flight), it stays queued and is
 * sent again later (adds are idempotent: same id, upsert with ignoreDuplicates).
 */
export const removePendingAddIfUnchanged = async (userId: string, expected: Expense): Promise<void> => {
  const key = getPendingStorageKey(userId);
  await runExclusive(key, async () => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return;
      const list: Expense[] = JSON.parse(stored);
      const idx = list.findIndex((item) => item.id === expected.id);
      if (idx < 0) return;
      if (stableStringify(list[idx]) !== stableStringify({ ...expected, pending: true })) return;
      list.splice(idx, 1);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      if (__DEV__) console.log('Error removing confirmed pending add:', e);
    }
  });
};

/** JSON with object keys sorted, so two equal objects always compare equal whatever their key order. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) sorted[k] = (v as Record<string, unknown>)[k];
      return sorted;
    }
    return v;
  });
}

export const sanitizeNote = (n?: string) => {
  if (!n) return '';
  const words = n.trim().split(/\s+/).slice(0, 50).join(' ');
  return words.slice(0, 250);
};
