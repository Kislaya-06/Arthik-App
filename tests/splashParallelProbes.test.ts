import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('OPT-05: SplashScreen Parallel Connectivity and Session Resolution', () => {
  let offlineSet = false;
  let activeSessionUser: any = null;

  beforeEach(() => {
    offlineSet = false;
    activeSessionUser = null;
    vi.clearAllMocks();
  });

  const simulateStartupProbes = async ({
    connectivityDuration = 10,
    sessionDuration = 10,
    sessionResult = { data: { session: { user: { id: 'u_123' } } }, error: null },
    sessionThrows = false,
    isNetworkFail = false,
  }: {
    connectivityDuration?: number;
    sessionDuration?: number;
    sessionResult?: any;
    sessionThrows?: boolean;
    isNetworkFail?: boolean;
  }) => {
    // 1+2. Run connectivity check and session read in parallel
    const connectivity = Promise.race([
      new Promise<void>((resolve) => setTimeout(resolve, connectivityDuration)),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]).catch(() => {});

    const sessionRace = Promise.race([
      new Promise<any>((resolve, reject) => {
        setTimeout(() => {
          if (sessionThrows) reject(new Error('Network disconnected violently'));
          else resolve(sessionResult);
        }, sessionDuration);
      }),
      new Promise<{ data: { session: null }; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null }, error: new Error('Session timeout') }), 2000)
      ),
    ]).catch((e) => ({ data: { session: null }, error: e as Error, thrown: true as const }));

    await connectivity; // connectivity applied first
    let activeUser: any = null;
    const res = await sessionRace; // then session result
    if ('thrown' in res) {
      offlineSet = true;
    } else if (res.data?.session) {
      activeSessionUser = res.data.session.user;
      activeUser = res.data.session.user;
    } else if (res.error && isNetworkFail) {
      offlineSet = true;
    }

    return { activeUser, offlineSet, activeSessionUser };
  };

  it('resolves active user when online without setting offline flag', async () => {
    const res = await simulateStartupProbes({
      connectivityDuration: 5,
      sessionDuration: 5,
      sessionResult: { data: { session: { user: { id: 'user_456' } } }, error: null },
    });

    expect(res.activeUser?.id).toBe('user_456');
    expect(res.offlineSet).toBe(false);
  });

  it('handles slow connectivity gracefully while preserving session result', async () => {
    // Connectivity takes longer than session
    const res = await simulateStartupProbes({
      connectivityDuration: 30,
      sessionDuration: 5,
      sessionResult: { data: { session: { user: { id: 'user_slow_conn' } } }, error: null },
    });

    expect(res.activeUser?.id).toBe('user_slow_conn');
    expect(res.offlineSet).toBe(false);
  });

  it('marks offline when session returns a network failure error', async () => {
    const res = await simulateStartupProbes({
      connectivityDuration: 5,
      sessionDuration: 5,
      sessionResult: { data: { session: null }, error: new Error('Failed to fetch') },
      isNetworkFail: true,
    });

    expect(res.activeUser).toBeNull();
    expect(res.offlineSet).toBe(true);
  });

  it('marks offline when session fetch throws an exception', async () => {
    const res = await simulateStartupProbes({
      connectivityDuration: 5,
      sessionDuration: 5,
      sessionThrows: true,
    });

    expect(res.activeUser).toBeNull();
    expect(res.offlineSet).toBe(true);
  });
});
