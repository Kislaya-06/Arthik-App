import { describe, it, expect, vi } from 'vitest';
import { createReduceMotionStore, type MotionSettingSource } from '../src/lib/reduceMotionStore';

function fakeOs(initial: boolean) {
  let handler: ((v: boolean) => void) | null = null;
  const source: MotionSettingSource & { emit: (v: boolean) => void; calls: { query: number; listen: number } } = {
    calls: { query: 0, listen: 0 },
    isReduceMotionEnabled: () => {
      source.calls.query += 1;
      return Promise.resolve(initial);
    },
    addEventListener: (_name, h) => {
      source.calls.listen += 1;
      handler = h;
      return { remove: () => { handler = null; } };
    },
    emit: (v: boolean) => handler?.(v),
  };
  return source;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('OPT-43: reduceMotionStore', () => {
  it('uses the startup value until the OS has answered', () => {
    const store = createReduceMotionStore(fakeOs(true));
    expect(store.getSnapshot(false)).toBe(false);
    expect(store.getSnapshot(true)).toBe(true);
  });

  it('switches to the OS answer once it arrives and tells listeners', async () => {
    const store = createReduceMotionStore(fakeOs(true));
    const listener = vi.fn();
    store.subscribe(listener);
    await flush();
    expect(store.getSnapshot(false)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('follows the setting live while the app is open', async () => {
    const os = fakeOs(false);
    const store = createReduceMotionStore(os);
    const listener = vi.fn();
    store.subscribe(listener);
    await flush();
    expect(store.getSnapshot(false)).toBe(false);
    os.emit(true);
    expect(store.getSnapshot(false)).toBe(true);
    os.emit(false);
    expect(store.getSnapshot(true)).toBe(false);
  });

  it('does not notify when the value did not change', async () => {
    const os = fakeOs(false);
    const store = createReduceMotionStore(os);
    const listener = vi.fn();
    store.subscribe(listener);
    await flush();
    listener.mockClear();
    os.emit(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('talks to the OS only once, however many components subscribe', async () => {
    const os = fakeOs(false);
    const store = createReduceMotionStore(os);
    store.subscribe(() => {});
    store.subscribe(() => {});
    store.subscribe(() => {});
    await flush();
    expect(os.calls.query).toBe(1);
    expect(os.calls.listen).toBe(1);
  });

  it('an unsubscribed listener is no longer called', async () => {
    const os = fakeOs(false);
    const store = createReduceMotionStore(os);
    const listener = vi.fn();
    const off = store.subscribe(listener);
    await flush();
    listener.mockClear();
    off();
    os.emit(true);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot(false)).toBe(true);
  });

  it('survives an OS that fails to answer: keeps the startup value', async () => {
    const source: MotionSettingSource = {
      isReduceMotionEnabled: () => Promise.reject(new Error('no')),
      addEventListener: () => undefined,
    };
    const store = createReduceMotionStore(source);
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot(true)).toBe(true);
    expect(store.getSnapshot(false)).toBe(false);
  });

  it('survives an OS that throws synchronously', () => {
    const source: MotionSettingSource = {
      isReduceMotionEnabled: () => { throw new Error('boom'); },
      addEventListener: () => undefined,
    };
    const store = createReduceMotionStore(source);
    expect(() => store.subscribe(() => {})).not.toThrow();
    expect(store.getSnapshot(false)).toBe(false);
  });
});
