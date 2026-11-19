/**
 * Offline-first start-up order for the splash screen.
 *
 * The app opens as soon as the data saved ON THE PHONE is loaded. Asking the server for fresh data is slow and can
 * fail, so it runs in the background and never holds the splash. One exception: a phone with no saved expenses yet has
 * nothing to show, so the splash may wait for the first download, for a short fixed time only.
 *
 * The caller passes the two steps in, so the order is testable without the app (tests/startupLoad.test.ts):
 * - `loadLocalData`: storage reads only (saved queue entries, categories, expenses, budget state, app lock).
 *   Categories load before the server refresh starts, because budget / expense maths needs the category map.
 * - `refreshFromServer`: categories, expenses and budget from Supabase.
 */
export interface StartupLoadSteps {
  loadLocalData: () => Promise<{ hasCachedExpenses: boolean }>;
  refreshFromServer: () => Promise<void>;
}

/** Longest the splash waits for the very first download on a phone with nothing saved. */
export const FIRST_RUN_WAIT_MS = 5000;

export async function runLocalFirstStartup(
  steps: StartupLoadSteps,
  firstRunWaitMs: number = FIRST_RUN_WAIT_MS
): Promise<void> {
  let hasCachedExpenses = false;
  try {
    hasCachedExpenses = (await steps.loadLocalData()).hasCachedExpenses;
  } catch {
    // Local data could not be read: carry on, the server refresh below can still fill the app.
  }

  const refresh = steps.refreshFromServer().catch(() => {});
  if (hasCachedExpenses) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    refresh,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, firstRunWaitMs);
    }),
  ]);
  if (timer !== undefined) clearTimeout(timer);
}
