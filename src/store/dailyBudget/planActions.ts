import * as Crypto from 'expo-crypto';
import { format } from 'date-fns/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { round2 } from '../../lib/formatters';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../authStore';
import { useNotificationStore } from '../notificationStore';
import { useCategoryStore } from '../categoryStore';
import { notifyBudgetResumed } from '../../lib/budgetAlerts';
import {
  evaluateDayStatus,
  computeIncomeForDate,
  computeSpentByDate,
} from '../../lib/budgetCalculations';
import {
  buildBudgetPools,
  poolSpentBefore,
  poolKeyFor,
  computeEffectiveFrom,
  getPeriodBounds,
  upsertPendingChange,
  getDateOwner,
  resolvePlanForDate,
  BUDGET_RULES_V2_FROM,
} from '../../lib/budgetPeriods';
import { formatEffectiveFrom } from '../../lib/budgetModeUtils';
import type { BudgetCadence, BudgetPlanChange, BudgetPeriodRecord } from '../../types';
import type { DailyBudgetState } from './types';
import {
  savePendingSettingsOffline,
  clearPendingSettingsOffline,
  savePendingPlanChangeOffline,
  getPendingPlanChangesKey,
  getPendingBudgetPeriodsKey,
  getLastRenewedPeriodKey,
  getStoredList,
  setStoredList,
} from './pendingStorage';
import { getCurrentExpenses, addExpenseFromBridge } from './expenseBridge';
import {
  buildCategoryClassifier,
  buildEligibleIncomeClassifier,
} from './classifiers';
import {
  getTodayDateStr,
  getUserCreatedAtLocalDate,
  isDailyOwnedDate,
  computeMetrics,
  computeTotalAccountRemaining,
  runWaterfall,
} from './metrics';
import { PURE_DEFICIT_NOTE, isCountedExpense } from '../../lib/transactionUtils';

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
    const isEligibleIncomeFn = buildEligibleIncomeClassifier();
    const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr, isEligibleIncomeFn);
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
    get().budgetCadence,
    get().bestStreakByCadence
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
    const isEligibleIncomeFn = buildEligibleIncomeClassifier();
    const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr, isEligibleIncomeFn);
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
    get().budgetCadence,
    get().bestStreakByCadence
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

export function balancePureDeficitIfNeeded(get: () => DailyBudgetState, todayStr: string): void {
  if (get().isBudgetModeEnabled) return;
  const currentExpenses = getCurrentExpenses();
  const R = computeTotalAccountRemaining(get(), currentExpenses);
  if (R >= 0) return;
  const D = round2(-R);
  if (D <= 0) return;

  const catMap = new Map(useCategoryStore.getState().categories.map((c) => [c.id, c]));
  const countedExpenses = currentExpenses
    .filter((e) => isCountedExpense(e, e.category_id ? catMap.get(e.category_id) : undefined))
    .sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '') || (b.created_at || '').localeCompare(a.created_at || ''));

  const waterfall = runWaterfall();
  let runningSum = 0;
  let dateStr = todayStr;
  for (const e of countedExpenses) {
    const gDrawn = waterfall.byExpense[e.id]?.fromGullak || 0;
    runningSum = round2(runningSum + gDrawn);
    if (runningSum >= D) {
      dateStr = e.expense_date?.split('T')[0]?.trim() || todayStr;
      break;
    }
  }

  addExpenseFromBridge(
    D,
    null,
    PURE_DEFICIT_NOTE,
    'upi',
    dateStr,
    'income',
    { id: Crypto.randomUUID(), transactionClass: 'normal' }
  );

  get().syncWithExpenses(getCurrentExpenses());

  useNotificationStore.getState().addNotification({
    id: `pure_deficit_${dateStr}_${D}`,
    title: 'Pure Mode deficit balanced',
    message: `You spent ₹${D} more than you had in Pure Mode. We added ₹${D} to Total Income so everything is balanced.`,
    type: 'pure_deficit_balanced',
    data: { date: dateStr, amount: D, screen: 'Home' },
  });
}

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

  // ADR 0012: switching Budget Mode back on inside the same week / month continues the SAME budget.
  // Say so ("Welcome back: ₹4,600 left of this month's ₹9,000").
  if (enabled && (cadence === 'weekly' || cadence === 'monthly') && todayStr >= BUDGET_RULES_V2_FROM) {
    try {
      const pools = buildBudgetPools(updatedChanges, effectiveFrom > todayStr ? effectiveFrom : todayStr);
      const pool = pools[poolKeyFor(cadence, todayStr)];
      if (pool && pool.startedOn < todayStr && !pool.closedOn) {
        const spentByDate = computeSpentByDate(getCurrentExpenses(), buildCategoryClassifier());
        const tomorrowStr = format(new Date(new Date(`${todayStr}T12:00:00`).getTime() + 86400000), 'yyyy-MM-dd');
        const left = Math.max(0, round2(pool.budget - poolSpentBefore(pools, updatedChanges, pool, tomorrowStr, spentByDate)));
        notifyBudgetResumed(`resumed_${pool.key}_${todayStr}`, cadence, left, pool.budget, todayStr);
      }
    } catch {}
  }

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
    const isEligibleIncomeFn = buildEligibleIncomeClassifier();
    const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr, isEligibleIncomeFn);
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
    cadence,
    get().bestStreakByCadence
  );

  const autoRenew = options?.autoRenew !== undefined
    ? options.autoRenew
    : (enabled ? (get().isBudgetModeEnabled ? get().isAutoRenew : true) : false);

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

export function resolvePendingPlanChange(
  planChanges: BudgetPlanChange[] | undefined,
  todayStr: string
): BudgetPlanChange | null {
  const future = (planChanges || []).filter((c) => c.effectiveFrom > todayStr);
  if (future.length === 0) return null;
  future.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return future[0];
}

export function resolveEffectiveFromLabel(
  target: BudgetPlanChange | null,
  todayStr: string
): string {
  if (!target) return '';
  return formatEffectiveFrom(target.effectiveFrom, todayStr, target.cadence);
}

export function handleCancelPendingPlanChange(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void
): void {
  const todayStr = getTodayDateStr();
  const pending = resolvePendingPlanChange(get().planChanges, todayStr);
  if (!pending) return;

  const remainingChanges = (get().planChanges || []).filter(
    (c) => c.effectiveFrom <= todayStr
  );
  set({
    planChanges: remainingChanges,
    scheduledNextDailyBudget: null,
    scheduledBudgetSetDate: null,
  });

  useNotificationStore.getState().removeNotification?.(`scheduled_budget_mode_${pending.effectiveFrom}`);
  useNotificationStore.getState().removeNotification?.(`scheduled_pure_mode_${pending.effectiveFrom}`);

  const currentUser = useAuthStore.getState().user;
  if (currentUser) {
    const key = getPendingPlanChangesKey(currentUser.id);
    getStoredList<BudgetPlanChange>(key).then((list) => {
      const updated = list.filter((c) => c.effectiveFrom <= todayStr);
      setStoredList(key, updated);
    });

    supabase
      .from('budget_plan_changes')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('effective_from', pending.effectiveFrom)
      .then(() => {});
  }
}

export async function uploadPendingBudgetPeriods(
  _get?: () => DailyBudgetState
): Promise<void> {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser) return;
  const key = getPendingBudgetPeriodsKey(currentUser.id);
  const list = await getStoredList<BudgetPeriodRecord>(key);
  if (list.length === 0) return;

  const syncedIds: string[] = [];
  for (const p of list) {
    try {
      const { error } = await supabase.from('budget_periods').upsert(
        {
          id: p.id,
          user_id: currentUser.id,
          cadence: p.cadence,
          period_start: p.periodStart,
          period_end: p.periodEnd,
          active_start: p.activeStart,
          active_end: p.activeEnd,
          budget_amount: p.budgetAmount,
          spent_amount: p.spentAmount,
          amount_saved: p.amountSaved,
          status: p.status,
          is_prorated: p.isProrated,
          carry_mode: p.carryMode || null,
          carried_over_amount: p.carriedOverAmount || 0,
          created_at: p.createdAt || new Date().toISOString(),
        },
        { onConflict: 'user_id,cadence,active_start' }
      );
      if (!error) syncedIds.push(p.id);
    } catch {}
  }
  if (syncedIds.length > 0) {
    await setStoredList(key, list.filter((p) => !syncedIds.includes(p.id)));
  }
}

export async function syncPendingPlanChanges(
  _get?: () => DailyBudgetState
): Promise<void> {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser) return;
  const key = getPendingPlanChangesKey(currentUser.id);
  const list = await getStoredList<BudgetPlanChange>(key);
  if (list.length === 0) return;

  const syncedIds: string[] = [];
  for (const c of list) {
    try {
      const { error } = await supabase.from('budget_plan_changes').upsert(
        {
          id: c.id,
          user_id: currentUser.id,
          effective_from: c.effectiveFrom,
          is_enabled: c.isEnabled,
          cadence: c.cadence,
          amount: c.amount,
          carry_mode: c.carryMode || null,
          carried_over_amount: c.carriedOverAmount || 0,
          created_at: c.createdAt || new Date().toISOString(),
        },
        { onConflict: 'user_id,effective_from' }
      );
      if (!error) syncedIds.push(c.id);
    } catch {}
  }
  if (syncedIds.length > 0) {
    await setStoredList(key, list.filter((c) => !syncedIds.includes(c.id)));
  }
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
