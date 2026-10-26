import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long the refresh circle stays on screen at least. The native Android circle needs about 300 ms to settle at its
 * "refreshing" spot after the finger lets go. If the data is ready sooner than that, telling the circle to stop while it
 * is still settling makes it vanish and pop back at the same spot (the "blink"). Holding it a little longer lets it come
 * down once, spin, and go back up once.
 */
export const MIN_REFRESH_VISIBLE_MS = 700;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * ONE pull-to-refresh handler for every screen (Home, History, Savings, Insights).
 *
 * What it guarantees:
 *  1. `refreshing` is set to true FIRST, before any work starts, so the circle's state is never behind the data.
 *  2. `refreshing` stays true for at least MIN_REFRESH_VISIBLE_MS, so a fast reload never flips true -> false mid-animation.
 *  3. A second pull while one is running is ignored.
 *  4. Errors in `work` never leave the circle spinning forever.
 *
 * It does not change WHAT is refreshed. The screen passes its own work.
 */
export function usePullRefresh(work: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const latestWork = useRef(work);
  latestWork.current = work;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const startedAt = Date.now();
    setRefreshing(true);
    try {
      await latestWork.current();
    } catch {
      // The screens' own loaders already handle their errors; the circle must still go away.
    } finally {
      const left = MIN_REFRESH_VISIBLE_MS - (Date.now() - startedAt);
      if (left > 0) await sleep(left);
      busy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
