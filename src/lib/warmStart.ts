/**
 * OPT-07: can Home be shown from the cached stores while the server refresh runs behind it?
 *
 * Only when ALL of these are true (otherwise Splash waits for the full hydration, exactly as before):
 *  - the saved daily-budget state belongs to this user and was fully hydrated from the server in an earlier session;
 *  - it already has TODAY's daily record, i.e. the app was already opened today. The first open of a day is where
 *    rollover, finalization, scheduled plans, auto-renew and the Welcome Back sheet happen, so it always waits;
 *  - the expense cache and the category cache for this user exist (a first login or a wiped cache has nothing to show).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { waitForPersistHydration, runHeldBackMoneyWork } from '../store/dailyBudget/hydrate';
import { holdMoneyWrites, releaseMoneyWrites } from '../store/dailyBudget/hydrationHold';
import { useCategoryStore } from '../store/categoryStore';
import { useAppLockStore } from '../store/appLockStore';
import { useExpenseStore, getCachedStorageKey, preloadCachedExpenses } from '../store/expenseStore';
import { markExpensesFetchStarted } from '../store/expense/serverSync';
import { getTodayDateStr } from '../store/dailyBudget/metrics';

export const getCachedCategoriesKey = (userId: string): string => `@arthik_cached_categories_${userId}`;

export async function canShowHomeFromCache(userId: string): Promise<boolean> {
  try {
    await waitForPersistHydration(useDailyBudgetStore);
    const state = useDailyBudgetStore.getState();
    if (state.ownerUserId !== userId || state.hydratedForUserId !== userId) return false;
    if (!state.dailyRecords || !state.dailyRecords[getTodayDateStr()]) return false;
    const keys = await AsyncStorage.getAllKeys();
    return keys.includes(getCachedStorageKey(userId)) && keys.includes(getCachedCategoriesKey(userId));
  } catch {
    return false;
  }
}

// ─── Show Home from cache, refresh behind it ─────────────────────────────────────────────────────────────

/** If the server copy has not arrived after this long, the hold is released anyway (the work then runs on local data, as offline). */
export const HOLD_WATCHDOG_MS = 12_000;
const CATEGORY_CACHE_WAIT_MS = 1500;

/** Resolves when `isTrue(state)` is true, or after `ms`. Never rejects. */
export function waitForStoreState<S>(
  store: { getState: () => S; subscribe: (listener: () => void) => () => void },
  isTrue: (state: S) => boolean,
  ms: number
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (isTrue(store.getState())) return resolve();
    let unsubscribe: () => void = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, ms);
    unsubscribe = store.subscribe(() => {
      if (isTrue(store.getState())) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

const releaseHeldMoneyWork = (userId: string): void => {
  if (releaseMoneyWrites(userId)) runHeldBackMoneyWork(useDailyBudgetStore.getState);
};

/**
 * Fills the stores from the caches (pending expenses, categories, expenses, app lock) and returns, so Splash can
 * open Home right away. The server refresh runs behind it in the SAME order as the blocking start (categories, then
 * expenses + budget hydration). Until the budget hydration has finished, money writes are held (`ROL-005`).
 * App lock is initialised BEFORE returning: Home must never be visible before the lock state is known.
 */
export async function startHomeFromCache(userId: string): Promise<void> {
  holdMoneyWrites(userId);
  markExpensesFetchStarted(); // Home's own focus load stays out of the way; the refresh below starts it
  const watchdog = setTimeout(() => releaseHeldMoneyWork(userId), HOLD_WATCHDOG_MS);

  let categoriesDone: Promise<void> = Promise.resolve();
  try {
    await useExpenseStore.getState().loadPendingExpenses();
    categoriesDone = useCategoryStore
      .getState()
      .fetchCategories()
      .catch(() => {});
    await Promise.race([waitForStoreState(useCategoryStore, (s) => s.isFetched, CATEGORY_CACHE_WAIT_MS), categoriesDone]);
    await preloadCachedExpenses();
    await useAppLockStore.getState().init(userId);
  } catch {
    // Whatever is already in the stores is shown; the refresh below still runs.
  }

  void (async () => {
    try {
      await categoriesDone;
      await Promise.all([useExpenseStore.getState().fetchExpenses(), useDailyBudgetStore.getState().hydrateFromSupabase(userId)]);
    } catch {
      // the stores keep the cached data (same as a failed refresh at any other time)
    } finally {
      clearTimeout(watchdog);
      releaseHeldMoneyWork(userId);
    }
  })();
}
