import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { upsertPendingChange } from '../../lib/budgetPeriods';
import type { BudgetCadence, BudgetPlanChange, BudgetPeriodRecord } from '../../types';
import type { DailyBudgetState, ProfileSettingsPatch } from './types';
import { computeMetrics } from './metrics';
import { getPendingSettingsKey, getPendingPlanChangesKey, getPendingBudgetPeriodsKey, getStoredList, savePendingSettingsOffline, clearPendingSettingsOffline } from './pendingStorage';

// ---------------------------------------------------------------------------
// Hydration Helpers (Step 7e)
// ---------------------------------------------------------------------------

export interface PersistStoreLike {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

export async function waitForPersistHydration(store: PersistStoreLike): Promise<void> {
  if (!store.persist.hasHydrated()) {
    await Promise.race([
      new Promise<void>((resolve) => {
        const unsub = store.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 500)),
    ]);
  }
}

export async function readPendingSettings(userId: string): Promise<ProfileSettingsPatch> {
  let pendingSettings: ProfileSettingsPatch = {};
  try {
    const stored = await AsyncStorage.getItem(getPendingSettingsKey(userId));
    if (stored) pendingSettings = JSON.parse(stored);
  } catch {}
  return pendingSettings;
}

export function buildOfflineHydrationPatch(
  get: () => DailyBudgetState,
  pendingSettings: ProfileSettingsPatch,
  todayStr: string,
  userId: string
): Partial<DailyBudgetState> {
  const records = { ...get().dailyRecords };
  let resolvedBudget = get().dailyBudgetAmount;
  let resolvedAutoRenew = get().isAutoRenew;
  let resolvedBudgetModeEnabled = get().isBudgetModeEnabled;
  let resolvedCadence: BudgetCadence = get().budgetCadence;
  let resolvedWeeklyBudget = get().weeklyBudgetAmount;
  let resolvedMonthlyBudget = get().monthlyBudgetAmount;

  if (pendingSettings.daily_budget !== undefined) {
    resolvedBudget = pendingSettings.daily_budget;
  }
  if (pendingSettings.is_auto_renew !== undefined) {
    resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew);
  }
  if (pendingSettings.is_budget_mode_enabled !== undefined) {
    resolvedBudgetModeEnabled = Boolean(pendingSettings.is_budget_mode_enabled);
  }
  if (pendingSettings.budget_cadence !== undefined) {
    resolvedCadence = pendingSettings.budget_cadence as BudgetCadence;
  }
  if (pendingSettings.weekly_budget !== undefined) {
    resolvedWeeklyBudget = pendingSettings.weekly_budget;
  }
  if (pendingSettings.monthly_budget !== undefined) {
    resolvedMonthlyBudget = pendingSettings.monthly_budget;
  }

  if (!records[todayStr]) {
    const todayBudget = resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 ? resolvedBudget : 0;
    records[todayStr] = {
      date: todayStr,
      budget: todayBudget,
      spent: 0,
      saved: todayBudget,
      isFinalized: false,
      status: resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 ? 'active' : 'unknown',
    };
  } else if (resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
    if (resolvedAutoRenew && resolvedBudget > 0) {
      if (records[todayStr].budget === 0) {
        records[todayStr].budget = resolvedBudget;
        records[todayStr].saved = Math.max(0, resolvedBudget - records[todayStr].spent);
        records[todayStr].status = records[todayStr].spent > resolvedBudget ? 'missed' : 'active';
      }
    } else {
      records[todayStr] = {
        ...records[todayStr],
        budget: 0,
        saved: 0,
        status: 'unknown',
      };
    }
  } else if (!resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
    records[todayStr] = {
      ...records[todayStr],
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
    resolvedCadence,
    get().bestStreakByCadence
  );
  return {
    dailyRecords: records,
    dailyBudgetAmount: resolvedBudget,
    isAutoRenew: resolvedAutoRenew,
    isBudgetModeEnabled: resolvedBudgetModeEnabled,
    budgetCadence: resolvedCadence,
    weeklyBudgetAmount: resolvedWeeklyBudget,
    monthlyBudgetAmount: resolvedMonthlyBudget,
    ...metrics,
    hydratedForUserId: userId,
  };
}

/**
 * Saves the mode a matured scheduled plan change just switched to (same fields the rollover saves), queue first,
 * then the profile. Without it the profile would keep saying "Pure Mode" and every later cold start would treat the
 * switch as brand new.
 */
export async function persistActivatedPlanSettings(
  userId: string,
  plan: BudgetPlanChange,
  autoRenew: boolean
): Promise<void> {
  const patch: ProfileSettingsPatch = {
    is_budget_mode_enabled: plan.isEnabled,
    is_auto_renew: autoRenew,
    ...(plan.isEnabled && plan.cadence === 'daily' && plan.amount > 0 ? { daily_budget: plan.amount } : {}),
  };
  await savePendingSettingsOffline(userId, patch);
  try {
    supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .then(
        ({ error }) => {
          if (!error) {
            clearPendingSettingsOffline(userId, ['is_budget_mode_enabled', 'is_auto_renew']);
          }
        },
        () => {}
      );
  } catch {
    // Offline / auth errors: the queued copy above is retried on the next sync.
  }
}

export async function mergePendingPlanChanges(
  userId: string,
  initialChanges: BudgetPlanChange[]
): Promise<BudgetPlanChange[]> {
  let resolvedPlanChanges = [...initialChanges];
  const pendingChangesKey = getPendingPlanChangesKey(userId);
  const pendingChanges = await getStoredList<BudgetPlanChange>(pendingChangesKey);
  if (pendingChanges.length > 0) {
    for (const pc of pendingChanges) {
      resolvedPlanChanges = upsertPendingChange(resolvedPlanChanges, pc);
    }
  }
  return resolvedPlanChanges;
}

export async function mergePendingPeriods(
  userId: string,
  initialPeriods: Record<string, BudgetPeriodRecord>
): Promise<Record<string, BudgetPeriodRecord>> {
  const resolvedPeriods = { ...initialPeriods };
  const pendingPeriodsKey = getPendingBudgetPeriodsKey(userId);
  const pendingPeriods = await getStoredList<BudgetPeriodRecord>(pendingPeriodsKey);
  if (pendingPeriods.length > 0) {
    for (const bp of pendingPeriods) {
      resolvedPeriods[bp.id] = bp;
    }
  }
  return resolvedPeriods;
}
