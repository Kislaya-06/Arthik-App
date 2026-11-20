import * as Crypto from 'expo-crypto';
import { round2 } from '../../lib/formatters';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../authStore';
import { computeEffectiveFrom, getPeriodBounds, upsertPendingChange, getDateOwner, resolvePlanForDate } from '../../lib/budgetPeriods';
import type { BudgetCadence, BudgetPlanChange } from '../../types';
import type { DailyBudgetState } from './types';
import { savePendingSettingsOffline, clearPendingSettingsOffline, savePendingPlanChangeOffline } from './pendingStorage';
import { getTodayDateStr, computeMetrics } from './metrics';

export function handleSetBudgetCadence(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  cadence: BudgetCadence,
  options?: {
    amount?: number;
    carryMode?: 'additive' | 'allocation';
    carriedOverAmount?: number;
  }
): void {
  const todayStr = getTodayDateStr();
  const currentUser = useAuthStore.getState().user;
  const currentOwner = getDateOwner(get().planChanges, todayStr);
  const effectiveFrom = computeEffectiveFrom('cadence_switch', todayStr, { currentOwner });

  const amount =
    options?.amount !== undefined
      ? Math.max(0, round2(options.amount))
      : cadence === 'weekly'
      ? get().weeklyBudgetAmount
      : cadence === 'monthly'
      ? get().monthlyBudgetAmount
      : get().dailyBudgetAmount;

  // Only money that REALLY exists in the running budget can be carried. A daily day (or Pure Mode) has none:
  // today's unused daily money goes to Gullak tonight, so carrying it as well would count it twice.
  const carryable = get().getCarryableAmount();
  const wantedCarry = Number(options?.carriedOverAmount) || 0;
  const carriedOverAmount = carryable > 0 && wantedCarry > 0 ? round2(Math.min(wantedCarry, carryable)) : 0;
  const carryMode = carriedOverAmount > 0 ? options?.carryMode : undefined;

  const newChange: BudgetPlanChange = {
    id: Crypto.randomUUID(),
    userId: currentUser?.id || '',
    effectiveFrom,
    isEnabled: get().isBudgetModeEnabled,
    cadence,
    amount,
    carryMode,
    carriedOverAmount: carriedOverAmount > 0 ? carriedOverAmount : undefined,
    createdAt: new Date().toISOString(),
  };

  const updatedChanges = upsertPendingChange(get().planChanges, newChange);
  const metrics = computeMetrics(
    get().dailyRecords,
    get().gullakDeposits,
    undefined,
    get().budgetPeriods,
    cadence,
    get().bestStreakByCadence
  );

  set({
    budgetCadence: cadence,
    ...(cadence === 'weekly' && options?.amount !== undefined ? { weeklyBudgetAmount: options.amount } : {}),
    ...(cadence === 'monthly' && options?.amount !== undefined ? { monthlyBudgetAmount: options.amount } : {}),
    ...(cadence === 'daily' && options?.amount !== undefined ? { dailyBudgetAmount: options.amount } : {}),
    planChanges: updatedChanges,
    ...metrics,
  });

  if (currentUser) {
    savePendingSettingsOffline(currentUser.id, { budget_cadence: cadence });
    savePendingPlanChangeOffline(currentUser.id, newChange);

    supabase
      .from('profiles')
      .update({ budget_cadence: cadence })
      .eq('id', currentUser.id)
      .then(({ error }) => {
        if (!error) {
          clearPendingSettingsOffline(currentUser.id, ['budget_cadence']);
        }
      });

    supabase
      .from('budget_plan_changes')
      .upsert(
        {
          id: newChange.id,
          user_id: currentUser.id,
          effective_from: newChange.effectiveFrom,
          is_enabled: newChange.isEnabled,
          cadence: newChange.cadence,
          amount: newChange.amount,
          carry_mode: newChange.carryMode || null,
          carried_over_amount: newChange.carriedOverAmount || 0,
          created_at: newChange.createdAt,
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

export function handleSetWeeklyBudget(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  amount: number,
  options?: { immediate?: boolean }
): void {
  const cleanAmount = Math.max(0, round2(amount));
  const todayStr = getTodayDateStr();
  const currentUser = useAuthStore.getState().user;
  const bounds = getPeriodBounds('weekly', todayStr);
  const currentPlan = resolvePlanForDate(get().planChanges, todayStr);

  let effectiveFrom: string;
  if (options?.immediate) {
    if (currentPlan && currentPlan.cadence === 'weekly' && currentPlan.effectiveFrom >= bounds.start) {
      effectiveFrom = currentPlan.effectiveFrom;
    } else {
      effectiveFrom = bounds.start <= todayStr ? bounds.start : todayStr;
    }
  } else {
    effectiveFrom = computeEffectiveFrom('weekly_amount', todayStr);
  }

  let updatedChanges = get().planChanges;
  let newChange: BudgetPlanChange | null = null;

  if (get().budgetCadence === 'weekly' && get().isBudgetModeEnabled) {
    newChange = {
      id: Crypto.randomUUID(),
      userId: currentUser?.id || '',
      effectiveFrom,
      isEnabled: true,
      cadence: 'weekly',
      amount: cleanAmount,
      createdAt: new Date().toISOString(),
    };
    updatedChanges = upsertPendingChange(updatedChanges, newChange);
  }

  set({
    weeklyBudgetAmount: cleanAmount,
    planChanges: updatedChanges,
  });

  if (currentUser) {
    savePendingSettingsOffline(currentUser.id, { weekly_budget: cleanAmount });
    if (newChange) {
      savePendingPlanChangeOffline(currentUser.id, newChange);
    }

    supabase
      .from('profiles')
      .update({ weekly_budget: cleanAmount })
      .eq('id', currentUser.id)
      .then(({ error }) => {
        if (!error) {
          clearPendingSettingsOffline(currentUser.id, ['weekly_budget']);
        }
      });

    if (newChange) {
      supabase
        .from('budget_plan_changes')
        .upsert(
          {
            id: newChange.id,
            user_id: currentUser.id,
            effective_from: newChange.effectiveFrom,
            is_enabled: newChange.isEnabled,
            cadence: newChange.cadence,
            amount: newChange.amount,
            created_at: newChange.createdAt,
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
}

export function handleSetMonthlyBudget(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  amount: number,
  options?: { immediate?: boolean }
): void {
  const cleanAmount = Math.max(0, round2(amount));
  const todayStr = getTodayDateStr();
  const currentUser = useAuthStore.getState().user;
  const bounds = getPeriodBounds('monthly', todayStr);
  const currentPlan = resolvePlanForDate(get().planChanges, todayStr);

  let effectiveFrom: string;
  if (options?.immediate) {
    if (currentPlan && currentPlan.cadence === 'monthly' && currentPlan.effectiveFrom >= bounds.start) {
      effectiveFrom = currentPlan.effectiveFrom;
    } else {
      effectiveFrom = bounds.start <= todayStr ? bounds.start : todayStr;
    }
  } else {
    effectiveFrom = computeEffectiveFrom('monthly_amount', todayStr);
  }

  let updatedChanges = get().planChanges;
  let newChange: BudgetPlanChange | null = null;

  if (get().budgetCadence === 'monthly' && get().isBudgetModeEnabled) {
    newChange = {
      id: Crypto.randomUUID(),
      userId: currentUser?.id || '',
      effectiveFrom,
      isEnabled: true,
      cadence: 'monthly',
      amount: cleanAmount,
      createdAt: new Date().toISOString(),
    };
    updatedChanges = upsertPendingChange(updatedChanges, newChange);
  }

  set({
    monthlyBudgetAmount: cleanAmount,
    planChanges: updatedChanges,
  });

  if (currentUser) {
    savePendingSettingsOffline(currentUser.id, { monthly_budget: cleanAmount });
    if (newChange) {
      savePendingPlanChangeOffline(currentUser.id, newChange);
    }

    supabase
      .from('profiles')
      .update({ monthly_budget: cleanAmount })
      .eq('id', currentUser.id)
      .then(({ error }) => {
        if (!error) {
          clearPendingSettingsOffline(currentUser.id, ['monthly_budget']);
        }
      });

    if (newChange) {
      supabase
        .from('budget_plan_changes')
        .upsert(
          {
            id: newChange.id,
            user_id: currentUser.id,
            effective_from: newChange.effectiveFrom,
            is_enabled: newChange.isEnabled,
            cadence: newChange.cadence,
            amount: newChange.amount,
            created_at: newChange.createdAt,
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
}
