import { describe, it, expect } from 'vitest';
import { shouldShowHomeNetworkPill } from '../src/lib/homeNetworkPill';

describe('shouldShowHomeNetworkPill (one offline message at a time on Home)', () => {
  it('hidden while the top offline / syncing banner is on screen', () => {
    expect(shouldShowHomeNetworkPill({ isOffline: true, isSyncing: false, bannerVisible: true })).toBe(false);
    expect(shouldShowHomeNetworkPill({ isOffline: false, isSyncing: true, bannerVisible: true })).toBe(false);
  });

  it('shown once the banner is gone, so being offline is never hidden', () => {
    expect(shouldShowHomeNetworkPill({ isOffline: true, isSyncing: false, bannerVisible: false })).toBe(true);
    expect(shouldShowHomeNetworkPill({ isOffline: false, isSyncing: true, bannerVisible: false })).toBe(true);
  });

  it('never shown when online and not syncing', () => {
    expect(shouldShowHomeNetworkPill({ isOffline: false, isSyncing: false, bannerVisible: false })).toBe(false);
    expect(shouldShowHomeNetworkPill({ isOffline: false, isSyncing: false, bannerVisible: true })).toBe(false);
  });
});
