import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredList, setStoredList, removeFromStoredList } from '../../lib/asyncStorageList';
import { runExclusive } from '../../lib/queueLock';
import type { BudgetPlanChange, BudgetPeriodRecord } from '../../types';
import type { ProfileSettingsPatch, GullakDeposit } from './types';

export const getPendingSettingsKey = (userId: string) => `@arthik_pending_settings_${userId}`;
export const getPendingGullakAddsKey = (userId: string) => `@arthik_pending_gullak_adds_${userId}`;
export const getPendingGullakDeletesKey = (userId: string) => `@arthik_pending_gullak_deletes_${userId}`;
export const getPendingPlanChangesKey = (userId: string) => `@arthik_pending_plan_changes_${userId}`;
export const getPendingBudgetPeriodsKey = (userId: string) => `@arthik_pending_budget_periods_${userId}`;
export const getLastRenewedPeriodKey = (userId: string) => `@arthik_last_renewed_period_${userId}`;

// Every change below is a read -> change -> write on one AsyncStorage key, so it runs inside `runExclusive(key, ...)`
// (OPT-61): two writers on the same key never overlap, and nothing waits on the network inside the lock.

export const savePendingSettingsOffline = async (
  userId: string,
  patch: ProfileSettingsPatch
) => {
  const key = getPendingSettingsKey(userId);
  await runExclusive(key, async () => {
    try {
      const existing = await AsyncStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      const updated = { ...data, ...patch };
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      if (__DEV__) console.log('Error saving pending settings offline:', e);
    }
  });
};

export const clearPendingSettingsOffline = async (
  userId: string,
  keysToClear?: (keyof ProfileSettingsPatch)[]
) => {
  const key = getPendingSettingsKey(userId);
  await runExclusive(key, async () => {
    try {
      if (!keysToClear) {
        await AsyncStorage.removeItem(key);
        return;
      }
      const existing = await AsyncStorage.getItem(key);
      if (!existing) return;
      const data = JSON.parse(existing);
      keysToClear.forEach((k) => delete data[k]);
      if (Object.keys(data).length === 0) {
        await AsyncStorage.removeItem(key);
      } else {
        await AsyncStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      if (__DEV__) console.log('Error clearing pending settings offline:', e);
    }
  });
};

/**
 * After the server confirmed `sent`, drop ONLY the keys whose queued value is still exactly what was sent.
 * A value the user changed while the request was in flight (or a key added meanwhile) stays queued for the next sync.
 */
export const clearSentPendingSettings = async (
  userId: string,
  sent: ProfileSettingsPatch
): Promise<void> => {
  const key = getPendingSettingsKey(userId);
  await runExclusive(key, async () => {
    try {
      const existing = await AsyncStorage.getItem(key);
      if (!existing) return;
      const data = JSON.parse(existing) as Record<string, unknown>;
      let changed = false;
      for (const k of Object.keys(sent) as (keyof ProfileSettingsPatch)[]) {
        if (k in data && data[k] === sent[k]) {
          delete data[k];
          changed = true;
        }
      }
      if (!changed) return;
      if (Object.keys(data).length === 0) {
        await AsyncStorage.removeItem(key);
      } else {
        await AsyncStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      if (__DEV__) console.log('Error clearing synced pending settings:', e);
    }
  });
};

// Locked removal of the items the server confirmed (keeps anything queued while the request was in flight).
export const removeSyncedFromQueue = removeFromStoredList;

export const savePendingPlanChangeOffline = async (
  userId: string,
  change: BudgetPlanChange
): Promise<void> => {
  const key = getPendingPlanChangesKey(userId);
  await runExclusive(key, async () => {
    const list = await getStoredList<BudgetPlanChange>(key);
    const filtered = list.filter((c) => c.effectiveFrom !== change.effectiveFrom);
    await setStoredList(key, [...filtered, change]);
  });
};

export const savePendingBudgetPeriodOffline = async (
  userId: string,
  period: BudgetPeriodRecord
): Promise<void> => {
  const key = getPendingBudgetPeriodsKey(userId);
  await runExclusive(key, async () => {
    const list = await getStoredList<BudgetPeriodRecord>(key);
    const filtered = list.filter((p) => p.id !== period.id);
    await setStoredList(key, [...filtered, period]);
  });
};

export { getStoredList, setStoredList };

export const savePendingGullakAdd = async (userId: string, deposit: GullakDeposit): Promise<void> => {
  const key = getPendingGullakAddsKey(userId);
  await runExclusive(key, async () => {
    const list = await getStoredList<GullakDeposit>(key);
    if (!list.some((d) => d.id === deposit.id)) await setStoredList(key, [...list, deposit]);
  });
};

// Returns true if the deposit was in the pending-add queue (never reached Supabase).
export const tryRemovePendingGullakAdd = async (userId: string, depositId: string): Promise<boolean> => {
  const key = getPendingGullakAddsKey(userId);
  return runExclusive(key, async () => {
    const list = await getStoredList<GullakDeposit>(key);
    const filtered = list.filter((d) => d.id !== depositId);
    if (filtered.length === list.length) return false;
    await setStoredList(key, filtered);
    return true;
  });
};

export const savePendingGullakDelete = async (userId: string, depositId: string): Promise<void> => {
  const key = getPendingGullakDeletesKey(userId);
  await runExclusive(key, async () => {
    const list = await getStoredList<string>(key);
    if (!list.includes(depositId)) await setStoredList(key, [...list, depositId]);
  });
};
