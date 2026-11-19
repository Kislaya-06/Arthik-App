import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Start-up must not show a false "You are offline".
 * On a cold launch NetInfo often knows the phone is connected before it has finished its internet reachability
 * test (`isInternetReachable === null`). That is "not known yet", not "offline": treating it as offline made the
 * start-up skip the server download and flash the offline banner, then flip back online and run a sync.
 */

const netInfo = vi.hoisted(() => ({
  state: { isConnected: true, isInternetReachable: true } as { isConnected: boolean | null; isInternetReachable: boolean | null },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(async () => netInfo.state),
    addEventListener: vi.fn(() => () => {}),
  },
}));

import { useNetworkStore, registerSyncCallback } from '../src/store/networkStore';

beforeEach(() => {
  useNetworkStore.setState({ isOffline: false, bannerVisible: false, isSyncing: false });
  registerSyncCallback(async () => {});
});

describe('checkConnectivity', () => {
  it('connected and reachable -> online', async () => {
    netInfo.state = { isConnected: true, isInternetReachable: true };
    expect(await useNetworkStore.getState().checkConnectivity()).toBe(true);
    expect(useNetworkStore.getState().isOffline).toBe(false);
  });

  it('connected but reachability not known yet -> still online, no offline banner', async () => {
    netInfo.state = { isConnected: true, isInternetReachable: null };
    expect(await useNetworkStore.getState().checkConnectivity()).toBe(true);
    expect(useNetworkStore.getState().isOffline).toBe(false);
    expect(useNetworkStore.getState().bannerVisible).toBe(false);
  });

  it('connected but the internet test failed -> offline', async () => {
    netInfo.state = { isConnected: true, isInternetReachable: false };
    expect(await useNetworkStore.getState().checkConnectivity()).toBe(false);
    expect(useNetworkStore.getState().isOffline).toBe(true);
  });

  it('not connected -> offline', async () => {
    netInfo.state = { isConnected: false, isInternetReachable: false };
    expect(await useNetworkStore.getState().checkConnectivity()).toBe(false);
    expect(useNetworkStore.getState().isOffline).toBe(true);
  });

  it('connection state unknown (null) -> offline (nothing proves a connection)', async () => {
    netInfo.state = { isConnected: null, isInternetReachable: null };
    expect(await useNetworkStore.getState().checkConnectivity()).toBe(false);
    expect(useNetworkStore.getState().isOffline).toBe(true);
  });

  it('a real offline -> online change still runs the sync callback', async () => {
    const sync = vi.fn(async () => {});
    registerSyncCallback(sync);
    useNetworkStore.getState().setOffline(true);
    netInfo.state = { isConnected: true, isInternetReachable: true };
    await useNetworkStore.getState().checkConnectivity();
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
