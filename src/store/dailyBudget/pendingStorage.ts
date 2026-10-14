import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BudgetPlanChange, BudgetPeriodRecord } from '../../types';
import type { ProfileSettingsPatch, GullakDeposit } from './types';

export const getPendingSettingsKey = (userId: string) => `@arthik_pending_settings_${userId}`;
export const getPendingGullakAddsKey = (userId: string) => `@arthik_pending_gullak_adds_${userId}`;
export const getPendingGullakDeletesKey = (userId: string) => `@arthik_pending_gullak_deletes_${userId}`;
export const getPendingPlanChangesKey = (userId: string) => `@arthik_pending_plan_changes_${userId}`;
export const getPendingBudgetPeriodsKey = (userId: string) => `@arthik_pending_budget_periods_${userId}`;
export const getLastRenewedPeriodKey = (userId: string) => `@arthik_last_renewed_period_${userId}`;

export const savePendingSettingsOffline = async (
  userId: string,
  patch: ProfileSettingsPatch
) => {
  try {
    const key = getPendingSettingsKey(userId);
    const existing = await AsyncStorage.getItem(key);
    const data = existing ? JSON.parse(existing) : {};
    const updated = { ...data, ...patch };
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    if (__DEV__) console.log('Error saving pending settings offline:', e);
  }
};

export const clearPendingSettingsOffline = async (
  userId: string,
  keysToClear?: (keyof ProfileSettingsPatch)[]
) => {
  try {
    const key = getPendingSettingsKey(userId);
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
};

export const savePendingPlanChangeOffline = async (
  userId: string,
  change: BudgetPlanChange
): Promise<void> => {
  const key = getPendingPlanChangesKey(userId);
  const list = await getStoredList<BudgetPlanChange>(key);
  const filtered = list.filter((c) => c.effectiveFrom !== change.effectiveFrom);
  await setStoredList(key, [...filtered, change]);
};

export const savePendingBudgetPeriodOffline = async (
  userId: string,
  period: BudgetPeriodRecord
): Promise<void> => {
  const key = getPendingBudgetPeriodsKey(userId);
  const list = await getStoredList<BudgetPeriodRecord>(key);
  const filtered = list.filter((p) => p.id !== period.id);
  await setStoredList(key, [...filtered, period]);
};

export const getStoredList = async <T>(key: string): Promise<T[]> => {
  try {
    const s = await AsyncStorage.getItem(key);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
};

export const setStoredList = async <T>(key: string, list: T[]) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(list)); } catch {}
};

export const savePendingGullakAdd = async (userId: string, deposit: GullakDeposit): Promise<void> => {
  const key = getPendingGullakAddsKey(userId);
  const list = await getStoredList<GullakDeposit>(key);
  if (!list.some((d) => d.id === deposit.id)) await setStoredList(key, [...list, deposit]);
};

// Returns true if the deposit was in the pending-add queue (never reached Supabase).
export const tryRemovePendingGullakAdd = async (userId: string, depositId: string): Promise<boolean> => {
  const key = getPendingGullakAddsKey(userId);
  const list = await getStoredList<GullakDeposit>(key);
  const filtered = list.filter((d) => d.id !== depositId);
  if (filtered.length === list.length) return false;
  await setStoredList(key, filtered);
  return true;
};

export const savePendingGullakDelete = async (userId: string, depositId: string): Promise<void> => {
  const key = getPendingGullakDeletesKey(userId);
  const list = await getStoredList<string>(key);
  if (!list.includes(depositId)) await setStoredList(key, [...list, depositId]);
};
