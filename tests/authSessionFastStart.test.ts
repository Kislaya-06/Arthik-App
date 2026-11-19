import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Start-up must not wait for the network when the profile is already saved on the phone.
 * `setSession` is awaited by the splash screen. It used to wait up to 3 seconds for the profile request even when the
 * cached profile was already loaded, so a slow connection made the splash feel frozen. With a cached profile the
 * session is ready at once and the profile is refreshed quietly in the background.
 */

const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
  },
}));

// The profile request stays pending until the test releases it (a slow network).
let releaseProfile: ((value: { data: any; error: any }) => void) | null = null;
const profileRequest = () =>
  new Promise<{ data: any; error: any }>((resolve) => {
    releaseProfile = resolve;
  });

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => profileRequest()) })) })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

vi.mock('../src/store/networkStore', () => ({
  useNetworkStore: { getState: vi.fn(() => ({ isOffline: false, setOffline: vi.fn() })) },
}));
vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from '../src/store/authStore';

const USER_ID = 'user_fast_start_1';
const session: any = { user: { id: USER_ID, email: 'fast@arthik.app' }, access_token: 'jwt' };
const profileKey = `@arthik_cached_profile_${USER_ID}`;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  storageMap.clear();
  releaseProfile = null;
  useAuthStore.setState({ user: null, profile: null, session: null, loading: false, initialized: false });
});

describe('setSession start-up speed', () => {
  it('with a cached profile it finishes at once, without waiting for the slow profile request', async () => {
    storageMap.set(profileKey, JSON.stringify({ id: USER_ID, first_name: 'Cached' }));

    // The request is still pending, so a start-up that waits for it would not be done after 300 ms.
    const outcome = await Promise.race([
      useAuthStore.getState().setSession(session).then(() => 'ready'),
      new Promise<string>((resolve) => setTimeout(() => resolve('still waiting for the network'), 300)),
    ]);
    expect(outcome).toBe('ready');

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe(USER_ID);
    expect(state.profile?.first_name).toBe('Cached');
    expect(state.loading).toBe(false);
    expect(state.initialized).toBe(true);
  });

  it('then refreshes the profile and the saved copy when the request finally answers', async () => {
    storageMap.set(profileKey, JSON.stringify({ id: USER_ID, first_name: 'Cached' }));
    await useAuthStore.getState().setSession(session);
    await flush();

    releaseProfile?.({ data: { id: USER_ID, first_name: 'Fresh' }, error: null });
    await flush();
    await flush();

    expect(useAuthStore.getState().profile?.first_name).toBe('Fresh');
    expect(JSON.parse(storageMap.get(profileKey) as string).first_name).toBe('Fresh');
  });

  it('keeps the cached profile when the background request fails', async () => {
    storageMap.set(profileKey, JSON.stringify({ id: USER_ID, first_name: 'Cached' }));
    await useAuthStore.getState().setSession(session);
    await flush();

    releaseProfile?.({ data: null, error: new Error('network down') });
    await flush();
    await flush();

    expect(useAuthStore.getState().profile?.first_name).toBe('Cached');
  });

  it('a late answer never brings a profile back after the user signed out', async () => {
    storageMap.set(profileKey, JSON.stringify({ id: USER_ID, first_name: 'Cached' }));
    await useAuthStore.getState().setSession(session);
    await flush();

    await useAuthStore.getState().setSession(null); // signed out while the request was in flight
    releaseProfile?.({ data: { id: USER_ID, first_name: 'Late' }, error: null });
    await flush();
    await flush();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('without a cached profile it still waits for the profile (nothing to show yet)', async () => {
    let done = false;
    const pending = useAuthStore.getState().setSession(session).then(() => {
      done = true;
    });
    await flush();
    await flush();
    expect(done).toBe(false);

    releaseProfile?.({ data: { id: USER_ID, first_name: 'First' }, error: null });
    await pending;
    expect(useAuthStore.getState().profile?.first_name).toBe('First');
    expect(useAuthStore.getState().initialized).toBe(true);
  });
});
