import AsyncStorage from '@react-native-async-storage/async-storage';
import { runExclusive } from './queueLock';
import { forgetExpenseCache } from './expenseCacheMemo';
import { getCachedStorageKey } from '../store/expense/pendingQueues';

/**
 * SEC-01: removes the signed-out user's on-phone COPIES of server data.
 *
 * Only data that is downloaded again at the next sign-in is removed:
 * - the confirmed expense list (`@arthik_cached_expenses_<userId>`)
 * - the category list (`@arthik_cached_categories_<userId>`)
 * - the profile (`@arthik_cached_profile_<userId>`)
 *
 * NEVER removed here (they hold changes the server has not confirmed yet, so removing them would lose data):
 * every `@arthik_pending_*` queue and `@arthik_failed_sync_*`.
 *
 * The category and profile key names are written inline in `categoryStore.ts` and `authStore.ts`;
 * `tests/signOutCleanup.test.ts` fails if they ever stop matching the names used here.
 */
export const getCachedCategoriesKey = (userId: string) => `@arthik_cached_categories_${userId}`;
export const getCachedProfileKey = (userId: string) => `@arthik_cached_profile_${userId}`;

export async function clearUserCachesOnSignOut(userId: string | null | undefined): Promise<void> {
  if (!userId) return;

  const expenseKey = getCachedStorageKey(userId);
  try {
    // Same lock as every expense cache writer, so a write that is in flight cannot land after the removal.
    await runExclusive(expenseKey, async () => {
      await AsyncStorage.removeItem(expenseKey);
      forgetExpenseCache(expenseKey);
    });
  } catch (e) {
    if (__DEV__) console.log('Error removing cached expenses on sign out:', e);
  }

  for (const key of [getCachedCategoriesKey(userId), getCachedProfileKey(userId)]) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      if (__DEV__) console.log('Error removing cached data on sign out:', e);
    }
  }
}
