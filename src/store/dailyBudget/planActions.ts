import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { round2 } from '../../lib/formatters';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../authStore';
import { evaluateDayStatus, computeIncomeForDate } from '../../lib/budgetCalculations';
import { upsertPendingChange } from '../../lib/budgetPeriods';
import type { BudgetPlanChange } from '../../types';
import type { DailyBudgetState } from './types';
import { savePendingSettingsOffline, clearPendingSettingsOffline, savePendingPlanChangeOffline, getLastRenewedPeriodKey } from './pendingStorage';
import { getCurrentExpenses } from './expenseBridge';
import { getTodayDateStr, isDailyOwnedDate, computeMetrics } from './metrics';
import { balancePureDeficitIfNeeded } from './pureDeficit';
export { handleSetBudgetModeEnabled } from './budgetModeActions';

export { handleSetBudgetCadence, handleSetWeeklyBudget, handleSetMonthlyBudget } from './cadenceActions';

export { resolvePendingPlanChange, resolveEffectiveFromLabel, handleCancelPendingPlanChange } from './pendingPlan';

export { balancePureDeficitIfNeeded, balancePureDeficit } from './pureDeficit';

export { uploadPendingBudgetPeriods, syncPendingPlanChanges } from './planSync';

export function handleSetDailyBudget(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  amount: number
): void {
  const cleanAmount = Math.max(0, round2(amount));
  const todayStr = getTodayDateStr();
  const records = { ...get().dailyRecords };
  const currentAutoRenew = get().isAutoRenew;
  const willAutoRenew = cleanAmount > 0 ? currentAutoRenew : false;

  if (willAutoRenew) {
    const existing = records[todayStr];
    const spent = existing?.spent || 0;
    const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr);
    const { saved } = evaluateDayStatus(cleanAmount, spent, todayIncome);
    const spendable = cleanAmount + todayIncome;
    records[todayStr] = {
      date: todayStr,
      budget: cleanAmount,
      spent,
      saved,
      isFinalized: false,
      status: spent > spendable && spendable > 0 ? 'missed' : 'active',
    };
  }

  let updatedChanges = get().planChanges;
  let newPlanChange: BudgetPlanChange | null = null;
  const currentUser = useAuthStore.getState().user;
  if (get().isBudgetModeEnabled && get().budgetCadence === 'daily') {
    newPlanChange = {
      id: Crypto.randomUUID(),
      userId: currentUser?.id || '',
      effectiveFrom: todayStr,
      isEnabled: true,
      cadence: 'daily',
      amount: cleanAmount,
      createdAt: new Date().toISOString(),
    };
    updatedChanges = upsertPendingChange(updatedChanges, newPlanChange);
  }

  const metrics = computeMetrics(
    records,
    get().gullakDeposits,
    undefined,
    get().budgetPeriods,
    get().budgetCadence
  );

  set({
    dailyBudgetAmount: cleanAmount,
    isAutoRenew: willAutoRenew,
    dailyRecords: records,
    planChanges: updatedChanges,
    scheduledNextDailyBudget: null,
    scheduledBudgetSetDate: null,
    ...metrics,
  });

  // Sync to Supabase profiles with offline queue (P0.13)
  try {
    if (currentUser) {
      savePendingSettingsOffline(currentUser.id, { daily_budget: cleanAmount, is_auto_renew: willAutoRenew });
      if (newPlanChange) {
        savePendingPlanChangeOffline(currentUser.id, newPlanChange);
      }
      supabase
        .from('profiles')
        .update({ daily_budget: cleanAmount, is_auto_renew: willAutoRenew })
        .eq('id', currentUser.id)
        .then(
          ({ error }) => {
            if (!error) {
              clearPendingSettingsOffline(currentUser.id, ['daily_budget', 'is_auto_renew']);
            } else if (__DEV__) {
              console.error('Error syncing daily_budget to Supabase:', error);
            }
          },
          () => {}
        );

      if (newPlanChange) {
        supabase
          .from('budget_plan_changes')
          .upsert(
            {
              id: newPlanChange.id,
              user_id: currentUser.id,
              effective_from: newPlanChange.effectiveFrom,
              is_enabled: newPlanChange.isEnabled,
              cadence: newPlanChange.cadence,
              amount: newPlanChange.amount,
              created_at: newPlanChange.createdAt,
            },
            { onConflict: 'user_id,effective_from' }
          )
          .then(({ error }) => {
            if (!error) {
              get().syncPendingPlanChanges();
            }
          });
      }
    }
  } catch (e) {
    // Ignore offline / auth errors
  }
}

export function handleToggleAutoRenew(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  enabled: boolean
): void {
  const todayStr = getTodayDateStr();
  if (enabled && !get().isBudgetModeEnabled) {
    balancePureDeficitIfNeeded(get, todayStr);
  }
  const records = { ...get().dailyRecords };
  const currentToday = records[todayStr];

  if (enabled && get().dailyBudgetAmount > 0 && isDailyOwnedDate(get().planChanges, todayStr) && (!currentToday || currentToday.budget === 0)) {
    const budget = get().dailyBudgetAmount;
    const spent = currentToday?.spent || 0;
    const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr);
    const { saved } = evaluateDayStatus(budget, spent, todayIncome);
    const spendable = budget + todayIncome;
    records[todayStr] = {
      date: todayStr,
      budget,
      spent,
      saved,
      isFinalized: false,
      status: spent > spendable && spendable > 0 ? 'missed' : 'active',
    };
  } else if (!enabled && currentToday && !currentToday.isFinalized) {
    records[todayStr] = {
      ...currentToday,
      budget: 0,
      saved: 0,
      status: 'unknown',
    };
  }

  const metrics = computeMetrics(
    records,
    get().gullakDeposits,
    undefined,
    get().budgetPeriods,
    get().budgetCadence
  );

  set({
    isAutoRenew: enabled,
    isBudgetModeEnabled: enabled ? true : get().isBudgetModeEnabled,
    dailyRecords: records,
    ...metrics,
  });

  // Sync to Supabase profiles with offline queue (P0.13)
  try {
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      savePendingSettingsOffline(currentUser.id, {
        is_auto_renew: enabled,
        ...(enabled ? { is_budget_mode_enabled: true } : {}),
      });
      supabase
        .from('profiles')
        .update({
          is_auto_renew: enabled,
          ...(enabled ? { is_budget_mode_enabled: true } : {}),
        })
        .eq('id', currentUser.id)
        .then(
          ({ error }) => {
            if (!error) {
              clearPendingSettingsOffline(currentUser.id, ['is_auto_renew', ...(enabled ? ['is_budget_mode_enabled' as const] : [])]);
            } else if (__DEV__) {
              console.error('Error syncing is_auto_renew to Supabase:', error);
            }
          },
          () => {}
        );
    }
  } catch (e) {
    // Ignore offline / auth errors
  }
}

export function handleScheduleNextDailyBudget(
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  amount: number
): void {
  const cleanAmount = Math.max(0, round2(amount));
  const todayStr = getTodayDateStr();
  set({
    scheduledNextDailyBudget: cleanAmount > 0 ? cleanAmount : null,
    scheduledBudgetSetDate: cleanAmount > 0 ? todayStr : null,
  });
}

export function handleCancelScheduledNextDailyBudget(
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void
): void {
  set({
    scheduledNextDailyBudget: null,
    scheduledBudgetSetDate: null,
  });
}

export async function handleSetLastRenewedPeriodKey(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  key: string
): Promise<void> {
  set({ lastRenewedPeriodKey: key });
  const currentUser = useAuthStore.getState().user;
  const uid = currentUser?.id || get().ownerUserId;
  if (uid) {
    try {
      await AsyncStorage.setItem(getLastRenewedPeriodKey(uid), key);
    } catch {}
  }
}
