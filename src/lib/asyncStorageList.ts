import AsyncStorage from '@react-native-async-storage/async-storage';
import { runExclusive } from './queueLock';

export const getStoredList = async <T>(key: string): Promise<T[]> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const setStoredList = async <T>(key: string, list: T[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {}
};

/**
 * Locked "read -> change -> write" of one queue list (OPT-61). `change` receives the CURRENT list and returns the new
 * one (or `null` to leave it as it is). No network call inside `change`.
 */
export const changeStoredList = <T, R = void>(
  key: string,
  change: (current: T[]) => { next: T[] | null; result: R }
): Promise<R> =>
  runExclusive(key, async () => {
    const current = await getStoredList<T>(key);
    const { next, result } = change(current);
    if (next) await setStoredList(key, next);
    return result;
  });

/**
 * Removes the items the server just confirmed. The list is re-read inside the lock, so an item added while the sync
 * request was in flight is kept (writing back the copy read BEFORE the request would erase it).
 */
export const removeFromStoredList = <T>(key: string, isSynced: (item: T) => boolean): Promise<void> =>
  changeStoredList<T>(key, (current) => {
    const remaining = current.filter((item) => !isSynced(item));
    return { next: remaining.length !== current.length ? remaining : null, result: undefined };
  });
