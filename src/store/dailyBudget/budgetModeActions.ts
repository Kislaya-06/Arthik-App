import * as Crypto from 'expo-crypto';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../authStore';
import { useNotificationStore } from '../notificationStore';
import { evaluateDayStatus, computeIncomeForDate } from '../../lib/budgetCalculations';
import { computeEffectiveFrom, upsertPendingChange, resolvePlanForDate } from '../../lib/budgetPeriods';
import type { BudgetCadence, BudgetPlanChange } from '../../types';
import type { DailyBudgetState } from './types';
import { savePendingSettingsOffline, clearPendingSettingsOffline, savePendingPlanChangeOffline } from './pendingStorage';
import { getCurrentExpenses } from './expenseBridge';
import { getTodayDateStr, getUserCreatedAtLocalDate, isDailyOwnedDate, computeMetrics } from './metrics';
import { isCountedExpense } from '../../lib/transactionUtils';
import { balancePureDeficitIfNeeded } from './pureDeficit';
import { resolvePendingPlanChange, handleCancelPendingPlanChange } from './pendingPlan';

export function handleSetBudgetModeEnabled(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  enabled: boolean,
  options?: { cadence?: BudgetCadence; amount?: number; immediate?: boolean; autoRenew?: boolean }
): void {
  const todayStr = getTodayDateStr();
  const currentUser = useAuthStore.getState().user;
  const activePlanToday = resolvePlanForDate(get().planChanges, todayStr);
  const currentMode = activePlanToday ? activePlanToday.isEnabled : get().isBudgetModeEnabled;
  const pendingChange = resolvePendingPlanChange(get().planChanges, todayStr);

  // 1. Same-Day Reversal (Flip-Back) Check:
  // If user had scheduled a future change for tomorrow that contradicts current active mode,
  // and now toggles back to currentMode (e.g. Pure -> scheduled Budget -> back to Pure, or vice versa):
  if (
    pendingChange &&
    pendingChange.effectiveFrom > todayStr &&
    pendingChange.isEnabled !== currentMode &&
    enabled === currentMode
  ) {
    handleCancelPendingPlanChange(get, set);
    useNotificationStore.getState().removeNotification?.(`scheduled_budget_mode_${pendingChange.effectiveFrom}`);
    useNotificationStore.getState().removeNotification?.(`scheduled_pure_mode_${pendingChange.effectiveFrom}`);
    return;
  }

  // 2. Already in requested state with no pending contradiction:
  if (enabled === currentMode && (!pendingChange || pendingChange.isEnabled === enabled)) {
    return;
  }

  if (enabled && !currentMode) {
    balancePureDeficitIfNeeded(get, todayStr);
  }

  const totalExpenseCount = getCurrentExpenses().filter((e) => isCountedExpense(e)).length;
  const effectiveFrom = options?.immediate
    ? todayStr
    : computeEffectiveFrom(enabled ? 'enable' : 'disable', todayStr, {
        changes: get().planChanges,
        userCreatedAtStr: getUserCreatedAtLocalDate(currentUser?.created_at),
        totalExpenseCount,
      });

  const cadence = options?.cadence || get().budgetCadence || 'daily';
  const amount = options?.amount !== undefined ? options.amount : (
    cadence === 'weekly'
      ? get().weeklyBudgetAmount
      : cadence === 'monthly'
      ? get().monthlyBudgetAmount
      : get().dailyBudgetAmount
  );

  const newChange: BudgetPlanChange = {
    id: Crypto.randomUUID(),
    userId: currentUser?.id || '',
    effectiveFrom,
    isEnabled: enabled,
    cadence,
    amount,
    createdAt: new Date().toISOString(),
  };

  const updatedChanges = upsertPendingChange(get().planChanges, newChange);

  // If effectiveFrom > todayStr (scheduled for tomorrow):
  // TODAY'S RUNNING STATE MUST NOT BE WIPED OR ALTERED!
  if (effectiveFrom > todayStr) {
    set({
      planChanges: updatedChanges,
    });

    if (enabled) {
      useNotificationStore.getState().addNotification({
        id: `scheduled_budget_mode_${effectiveFrom}`,
        title: 'Smart Budget & Gullak scheduled',
        message: 'Smart Budget & Gullak will activate tomorrow at 12:00 AM. Today continues in Pure Mode.',
        type: 'general',
        data: { date: effectiveFrom, screen: 'Profile' },
      });
    } else {
      useNotificationStore.getState().addNotification({
        id: `scheduled_pure_mode_${effectiveFrom}`,
        title: 'Pure Mode scheduled',
        message: "Pure Mode will activate tomorrow at 12:00 AM. Today's budget and savings will finish normally.",
        type: 'general',
        data: { date: effectiveFrom, screen: 'Profile' },
      });
    }

    if (currentUser) {
      savePendingPlanChangeOffline(currentUser.id, newChange);
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
    return;
  }

  const records = { ...get().dailyRecords };
  const targetBudgetAmount = options?.amount !== undefined && options.amount > 0 ? options.amount : (amount || get().dailyBudgetAmount);

  if (!enabled && records[todayStr] && !records[todayStr].isFinalized) {
    records[todayStr] = {
      ...records[todayStr],
      budget: 0,
      saved: 0,
      status: 'unknown',
    };
  } else if (enabled && targetBudgetAmount > 0 && isDailyOwnedDate(updatedChanges, todayStr) && (!records[todayStr] || records[todayStr].budget === 0 || !records[todayStr].isFinalized)) {
    const budget = targetBudgetAmount;
    const spent = records[todayStr]?.spent || 0;
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
  }

  const metrics = computeMetrics(
    records,
    get().gullakDeposits,
    undefined,
    get().budgetPeriods,
    cadence
  );

  const autoRenew = options?.autoRenew !== undefined
    ? options.autoRenew
    : enabled;

  set({
    isBudgetModeEnabled: enabled,
    isAutoRenew: autoRenew,
    budgetCadence: cadence,
    dailyBudgetAmount: cadence === 'daily' ? targetBudgetAmount : get().dailyBudgetAmount,
    weeklyBudgetAmount: cadence === 'weekly' ? targetBudgetAmount : get().weeklyBudgetAmount,
    monthlyBudgetAmount: cadence === 'monthly' ? targetBudgetAmount : get().monthlyBudgetAmount,
    planChanges: updatedChanges,
    dailyRecords: records,
    ...metrics,
  });

  if (currentUser) {
    savePendingSettingsOffline(currentUser.id, {
      is_budget_mode_enabled: enabled,
      is_auto_renew: autoRenew,
      ...(cadence === 'daily' && targetBudgetAmount > 0 ? { daily_budget: targetBudgetAmount } : {}),
    });
    savePendingPlanChangeOffline(currentUser.id, newChange);

    supabase
      .from('profiles')
      .update({
        is_budget_mode_enabled: enabled,
        is_auto_renew: autoRenew,
        ...(cadence === 'daily' && targetBudgetAmount > 0 ? { daily_budget: targetBudgetAmount } : {}),
      })
      .eq('id', currentUser.id)
      .then(({ error }) => {
        if (!error) {
          clearPendingSettingsOffline(currentUser.id, [
            'is_budget_mode_enabled',
            'is_auto_renew',
            ...(cadence === 'daily' && targetBudgetAmount > 0 ? ['daily_budget' as const] : []),
          ]);
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
