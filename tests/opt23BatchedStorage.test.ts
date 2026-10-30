import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const disk = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => disk.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      disk.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      disk.delete(k);
    }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createBatchedPersistStorage,
  flushBatchedStorage,
  removeBatchedItem,
  __resetBatchedStorageForTests,
  BATCH_QUIET_MS,
  BATCH_MAX_WAIT_MS,
} from '../src/lib/batchedStorage';

const setItem = AsyncStorage.setItem as unknown as ReturnType<typeof vi.fn>;
const storage = createBatchedPersistStorage<{ n: number; list?: number[] }>();
const val = (n: number, extra: Record<string, unknown> = {}) => ({ state: { n, ...extra }, version: 1 });

beforeEach(() => {
  vi.useFakeTimers();
  disk.clear();
  vi.clearAllMocks();
  __resetBatchedStorageForTests();
});
afterEach(() => vi.useRealTimers());

describe('OPT-23 batched persist storage', () => {
  it('many changes in a burst -> ONE disk write with the newest value, after the quiet time', async () => {
    storage.setItem('k', val(1));
    storage.setItem('k', val(2));
    storage.setItem('k', val(3));
    expect(setItem).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(BATCH_QUIET_MS - 1);
    expect(setItem).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(disk.get('k')!)).toEqual(val(3));
    await vi.advanceTimersByTimeAsync(5000);
    expect(setItem).toHaveBeenCalledTimes(1); // nothing left over
  });

  it('a change restarts the quiet time, but a long burst still reaches the disk within the max wait', async () => {
    for (let t = 0; t < BATCH_MAX_WAIT_MS + 100; t += 100) {
      storage.setItem('k', val(t));
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(setItem).toHaveBeenCalled();
    const first = JSON.parse(setItem.mock.calls[0][1]);
    expect(first.state.n).toBeGreaterThan(0);
  });

  it('getItem sees a pending value at once (what the disk would give: functions dropped), else the disk, else null', async () => {
    expect(await storage.getItem('k')).toBeNull();
    disk.set('k', JSON.stringify(val(7)));
    expect(await storage.getItem('k')).toEqual(val(7));
    storage.setItem('k', { state: { n: 8, fn: () => 1 } as any, version: 1 });
    expect(await storage.getItem('k')).toEqual(val(8));
    expect(disk.get('k')).toBe(JSON.stringify(val(7))); // disk untouched until the write
  });

  it('flush writes every pending key exactly once and leaves nothing pending', async () => {
    storage.setItem('a', val(1));
    storage.setItem('b', val(2));
    await flushBatchedStorage();
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(disk.get('a')!)).toEqual(val(1));
    await vi.advanceTimersByTimeAsync(5000);
    expect(setItem).toHaveBeenCalledTimes(2);
    await flushBatchedStorage();
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('remove cancels a pending write and removes the key (no late write after a reset)', async () => {
    storage.setItem('k', val(1));
    await storage.removeItem('k');
    await vi.advanceTimersByTimeAsync(5000);
    expect(setItem).not.toHaveBeenCalled();
    expect(disk.has('k')).toBe(false);
    expect(await storage.getItem('k')).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('k');
  });

  it('removeBatchedItem is the same as storage.removeItem', async () => {
    storage.setItem('k', val(1));
    await removeBatchedItem('k');
    await vi.advanceTimersByTimeAsync(5000);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('a failing disk write never throws', async () => {
    setItem.mockRejectedValueOnce(new Error('disk full'));
    storage.setItem('k', val(1));
    await expect(flushBatchedStorage()).resolves.toBeUndefined();
  });

  it('with a real zustand persist store: 20 set() calls -> one write, same content as before, rehydrates from memory/disk', async () => {
    type S = { n: number; list: number[]; bump: () => void; f?: number };
    const make = () =>
      create<S>()(
        persist(
          (set, get) => ({ n: 0, list: [], bump: () => set({ n: get().n + 1, list: [...get().list, get().n] }) }),
          { name: 'store-k', storage: createBatchedPersistStorage<S>() }
        )
      );
    const store = make();
    await vi.advanceTimersByTimeAsync(10);
    setItem.mockClear();
    for (let i = 0; i < 20; i++) store.getState().bump();
    expect(setItem).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(BATCH_QUIET_MS + 1);
    expect(setItem).toHaveBeenCalledTimes(1);
    const onDisk = JSON.parse(disk.get('store-k')!);
    expect(onDisk.state.n).toBe(20);
    expect(onDisk.state.list.length).toBe(20);
    expect(onDisk.state.bump).toBeUndefined();
    expect(onDisk.version).toBe(0);

    const second = make(); // a fresh start reads what was written
    await vi.advanceTimersByTimeAsync(10);
    expect(second.getState().n).toBe(20);
    expect(typeof second.getState().bump).toBe('function');
  });
});
