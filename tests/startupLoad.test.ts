import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runLocalFirstStartup } from '../src/lib/startupLoad';

/**
 * Offline-first start-up (splash screen): the app opens as soon as the data saved on the phone is loaded. The server
 * refresh runs in the background and never holds the splash, EXCEPT on a phone with no saved expenses yet (nothing to
 * show), where it may hold it for a short, fixed time.
 */

const FIRST_RUN_WAIT_MS = 5000;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const never = () => new Promise<void>(() => {});

describe('runLocalFirstStartup', () => {
  it('opens right after the saved data loads, even if the server refresh never answers', async () => {
    const refresh = vi.fn(never);
    let opened = false;
    const run = runLocalFirstStartup({ loadLocalData: async () => ({ hasCachedExpenses: true }), refreshFromServer: refresh }).then(
      () => {
        opened = true;
      }
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(opened).toBe(true);
    await run;
    expect(refresh).toHaveBeenCalledTimes(1); // the refresh still starts, in the background
  });

  it('starts the server refresh only after the saved data is loaded (categories before budget / expenses)', async () => {
    const order: string[] = [];
    await runLocalFirstStartup({
      loadLocalData: async () => {
        order.push('local:start');
        await Promise.resolve();
        order.push('local:end');
        return { hasCachedExpenses: true };
      },
      refreshFromServer: async () => {
        order.push('refresh');
      },
    });
    expect(order).toEqual(['local:start', 'local:end', 'refresh']);
  });

  it('with no saved expenses it waits for the server refresh when it answers quickly', async () => {
    let resolveRefresh: () => void = () => {};
    const refresh = () => new Promise<void>((resolve) => (resolveRefresh = resolve));
    let opened = false;
    const run = runLocalFirstStartup({ loadLocalData: async () => ({ hasCachedExpenses: false }), refreshFromServer: refresh }).then(
      () => {
        opened = true;
      }
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(opened).toBe(false);
    resolveRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(opened).toBe(true);
    await run;
  });

  it('with no saved expenses and a hanging server it still opens after the fixed wait', async () => {
    let opened = false;
    const run = runLocalFirstStartup({ loadLocalData: async () => ({ hasCachedExpenses: false }), refreshFromServer: never }).then(
      () => {
        opened = true;
      }
    );
    await vi.advanceTimersByTimeAsync(FIRST_RUN_WAIT_MS - 1);
    expect(opened).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(opened).toBe(true);
    await run;
  });

  it('a failing server refresh never stops the app from opening', async () => {
    await expect(
      runLocalFirstStartup({
        loadLocalData: async () => ({ hasCachedExpenses: true }),
        refreshFromServer: async () => {
          throw new Error('Network request failed');
        },
      })
    ).resolves.toBeUndefined();
    await expect(
      runLocalFirstStartup({
        loadLocalData: async () => ({ hasCachedExpenses: false }),
        refreshFromServer: async () => {
          throw new Error('Network request failed');
        },
      })
    ).resolves.toBeUndefined();
  });

  it('a failing local load still opens the app and still tries the server refresh', async () => {
    const refresh = vi.fn(async () => {});
    await expect(
      runLocalFirstStartup({
        loadLocalData: async () => {
          throw new Error('storage unavailable');
        },
        refreshFromServer: refresh,
      })
    ).resolves.toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not leave the wait timer running when the refresh finishes first', async () => {
    await runLocalFirstStartup({
      loadLocalData: async () => ({ hasCachedExpenses: false }),
      refreshFromServer: async () => {},
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
