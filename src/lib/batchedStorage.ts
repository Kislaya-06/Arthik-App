/**
 * OPT-23: batched disk writes for the two zustand `persist` stores (daily budget, notifications).
 *
 * Problem: every `set()` made zustand serialise the WHOLE store (`JSON.stringify`) and write it to disk. One expense
 * save does several `set()` calls in a row (optimistic add, sync, server confirm, sync again), so the JS thread
 * serialised the same big state several times within a second.
 *
 * This is a `PersistStorage` (not a string storage like `createJSONStorage`), so it receives the state OBJECT and can
 * skip the serialisation too: it keeps the newest object in memory and serialises + writes it ONCE, after
 * `QUIET_MS` without a new change (or `MAX_WAIT_MS` after the first unwritten change, so a long burst of changes can
 * never keep the disk copy old for long). What ends up on disk is exactly what the last `set()` produced.
 *
 * Safety:
 *  - `getItem` returns the pending object (as a JSON round trip, i.e. exactly what disk would return) before reading
 *    disk, so nothing can ever read an older copy than the newest one.
 *  - `flushBatchedStorage()` writes everything at once. It is called when the app goes to the background / inactive
 *    (`App.tsx`), which is the last moment the OS guarantees to run our code.
 *  - `removeBatchedItem(name)` cancels a pending write and removes the key, so a store reset (sign-out) can never be
 *    followed by a late write that brings the old data back.
 *  - Trade-off accepted by the owner (24 Oct 2026, approved 30 Oct 2026): if the OS kills the app inside the short
 *    window WITHOUT a background event (crash, force-stop), the very last local change is not on disk. The server copy
 *    and the offline queues (separate keys, not batched) still have it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

export const BATCH_QUIET_MS = 250;
export const BATCH_MAX_WAIT_MS = 1500;

interface PendingWrite<S> {
  value: StorageValue<S>;
  quietTimer: ReturnType<typeof setTimeout> | null;
  maxTimer: ReturnType<typeof setTimeout> | null;
}

const pending = new Map<string, PendingWrite<unknown>>();

function clearTimers(entry: PendingWrite<unknown>): void {
  if (entry.quietTimer) clearTimeout(entry.quietTimer);
  if (entry.maxTimer) clearTimeout(entry.maxTimer);
  entry.quietTimer = null;
  entry.maxTimer = null;
}

/** Serialises and writes one pending value now. Never throws. */
async function writePending(name: string): Promise<void> {
  const entry = pending.get(name);
  if (!entry) return;
  clearTimers(entry);
  pending.delete(name);
  try {
    await AsyncStorage.setItem(name, JSON.stringify(entry.value));
  } catch {
    // Same as before: a failed cache write must never crash the app (the server copy is the source of truth).
  }
}

/** Writes every pending value now (app going to background, tests). */
export async function flushBatchedStorage(): Promise<void> {
  await Promise.all(Array.from(pending.keys()).map((name) => writePending(name)));
}

/** Removes a key and cancels its pending write, so a late write can never bring old data back. */
export async function removeBatchedItem(name: string): Promise<void> {
  const entry = pending.get(name);
  if (entry) {
    clearTimers(entry);
    pending.delete(name);
  }
  await AsyncStorage.removeItem(name);
}

/** Test helper: forget pending writes without writing them. */
export function __resetBatchedStorageForTests(): void {
  pending.forEach((entry) => clearTimers(entry));
  pending.clear();
}

export function createBatchedPersistStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      const entry = pending.get(name);
      if (entry) {
        // Exactly what the disk copy would give (functions and undefined dropped), never the live object.
        return JSON.parse(JSON.stringify(entry.value)) as StorageValue<S>;
      }
      const raw = await AsyncStorage.getItem(name);
      if (raw === null) return null;
      return JSON.parse(raw) as StorageValue<S>;
    },
    setItem: (name, value) => {
      let entry = pending.get(name) as PendingWrite<S> | undefined;
      if (!entry) {
        entry = { value, quietTimer: null, maxTimer: null };
        pending.set(name, entry as PendingWrite<unknown>);
        entry.maxTimer = setTimeout(() => {
          void writePending(name);
        }, BATCH_MAX_WAIT_MS);
      } else {
        entry.value = value;
        if (entry.quietTimer) clearTimeout(entry.quietTimer);
      }
      entry.quietTimer = setTimeout(() => {
        void writePending(name);
      }, BATCH_QUIET_MS);
    },
    removeItem: (name) => removeBatchedItem(name),
  };
}
