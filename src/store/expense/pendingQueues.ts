import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Expense } from '../expenseStore';

export interface FailedSyncItem {
  id: string;
  type: 'add' | 'update' | 'delete';
  expense?: Partial<Expense>;
  errorReason: string;
  failedAt: string;
}

export interface ExpenseUpdatePayload {
  amount?: number;
  category_id?: string | null;
  note?: string;
  payment_mode?: 'cash' | 'upi' | 'card';
  expense_date?: string;
  type?: 'expense' | 'income';
}

export interface PendingUpdate {
  id: string;
  payload: ExpenseUpdatePayload;
  retryCount?: number;
  lastRetryAt?: number;
}

export interface PendingDelete {
  id: string;
  retryCount?: number;
  lastRetryAt?: number;
}

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
  try {
    const key = getPendingUpdatesKey(userId);
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
};

export const savePendingDeleteOffline = async (userId: string, id: string) => {
  try {
    const updateKey = getPendingUpdatesKey(userId);
    const storedUpdates = await AsyncStorage.getItem(updateKey);
    if (storedUpdates) {
      const updates: PendingUpdate[] = JSON.parse(storedUpdates);
      const filtered = updates.filter((u) => u.id !== id);
      await AsyncStorage.setItem(updateKey, JSON.stringify(filtered));
    }

    const key = getPendingDeletesKey(userId);
    const stored = await AsyncStorage.getItem(key);
    const list: (string | PendingDelete)[] = stored ? JSON.parse(stored) : [];
    const exists = list.some((item) => (typeof item === 'string' ? item === id : item.id === id));
    if (!exists) {
      list.push({ id, retryCount: 0, lastRetryAt: 0 });
      await AsyncStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {
    if (__DEV__) console.log('Error saving pending delete to storage:', e);
  }
};

export const updatePendingItemOffline = async (userId: string, id: string, patch: Partial<Expense>) => {
  try {
    const key = getPendingStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return;
    const list: Expense[] = JSON.parse(stored);
    const updated = list.map((item) => (item.id === id ? { ...item, ...patch } : item));
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    if (__DEV__) console.log('Error updating pending item offline:', e);
  }
};

export const removePendingItemOffline = async (userId: string, id: string) => {
  try {
    const key = getPendingStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return;
    const list: Expense[] = JSON.parse(stored);
    const filtered = list.filter((item) => item.id !== id);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    if (__DEV__) console.log('Error removing pending item offline:', e);
  }
};

export const sanitizeNote = (n?: string) => {
  if (!n) return '';
  const words = n.trim().split(/\s+/).slice(0, 50).join(' ');
  return words.slice(0, 250);
};
