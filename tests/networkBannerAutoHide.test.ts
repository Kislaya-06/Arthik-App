import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The top offline banner covers the screen header (Home's greeting and its bell / profile buttons), so a
 * banner raised by the network listener closes by itself like the save-time one. Being offline is still known
 * (`isOffline` stays true) and Home's inline pill shows it once the banner is gone.
 */

// Same NetInfo mock shape as tests/networkConnectivity.test.ts
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(async () => ({ isConnected: false, isInternetReachable: false })),
    addEventListener: vi.fn(() => () => {}),
  },
}));

import { useNetworkStore, registerSyncCallback } from '../src/store/networkStore';

beforeEach(() => {
  vi.useFakeTimers();
  useNetworkStore.setState({ isOffline: false, bannerVisible: false, isSyncing: false });
  registerSyncCallback(async () => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('offline banner closes by itself', () => {
  it('going offline shows the banner, then hides it after 4 s while staying offline', () => {
    useNetworkStore.getState().setOffline(true);
    expect(useNetworkStore.getState().bannerVisible).toBe(true);
    vi.advanceTimersByTime(3999);
    expect(useNetworkStore.getState().bannerVisible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(useNetworkStore.getState().bannerVisible).toBe(false);
    expect(useNetworkStore.getState().isOffline).toBe(true);
  });

  it('an explicit message while already offline also closes by itself', () => {
    useNetworkStore.setState({ isOffline: true, bannerVisible: false });
    useNetworkStore.getState().setOffline(true, 'Still offline');
    expect(useNetworkStore.getState().bannerMessage).toBe('Still offline');
    vi.advanceTimersByTime(4000);
    expect(useNetworkStore.getState().bannerVisible).toBe(false);
  });

  it('coming back online before the timer ends is not hidden early by the old timer', async () => {
    useNetworkStore.getState().setOffline(true);
    vi.advanceTimersByTime(1000);
    useNetworkStore.getState().setOffline(false);
    expect(useNetworkStore.getState().bannerMessage).toBe('Back online! Syncing changes...');
    vi.advanceTimersByTime(3000); // the old offline timer would have fired here
    expect(useNetworkStore.getState().bannerVisible).toBe(true);
    await vi.runAllTimersAsync();
    expect(useNetworkStore.getState().bannerVisible).toBe(false);
  });
});
