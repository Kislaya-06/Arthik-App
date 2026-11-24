import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { registerExpenseGetter, getCurrentExpenses, registerExpensesLoadedGetter, areExpensesLoaded, registerAddExpense, addExpenseFromBridge } from './dailyBudget/expenseBridge';
export {
  registerExpenseGetter,
  getCurrentExpenses,
  registerExpensesLoadedGetter,
  areExpensesLoaded,
  registerAddExpense,
  addExpenseFromBridge,
};

import { getTodayDateStr, getUserCreatedAtLocalDate, getUserCreatedAtStr, isDailyOwnedDate, dailyCarryExtraFor, runWaterfall, computeAllTimeBudget, computeMetrics, registerMetricsStoreGetter, computeAvailableIncomeBalance, computePriorAvailableIncomeBalance, computeCarryableAmount, computeTotalAccountRemaining, computeGrossIncomeBalance } from './dailyBudget/metrics';
export {
  getTodayDateStr,
  getUserCreatedAtLocalDate,
  getUserCreatedAtStr,
  isDailyOwnedDate,
  dailyCarryExtraFor,
  runWaterfall,
  computeAllTimeBudget,
  computeMetrics,
  computeAvailableIncomeBalance,
  computePriorAvailableIncomeBalance,
  computeCarryableAmount,
  computeTotalAccountRemaining,
  computeGrossIncomeBalance,
};
import { registerStoreResetCallback } from './authStore';
import { getStoredDismissedGapDates } from '../lib/gapFiller';

import {
  DailyRecord,
  SavingsMetrics,
  calculateSavingsMetrics,
  DayStatus,
  DayEvaluation,
  evaluateDayStatus,
  computeSpentByDate,
  computeSpentForDate,
  computeIncomeByDate,
  computeIncomeForDate,
  calculateCycleFinancials,
  buildDefaultTodayRecord,
  filterPastRecords,
  shouldIgnoreDuplicates,
  shouldSendRolloverNotification,
} from '../lib/budgetCalculations';
export type { DailyRecord, SavingsMetrics, DayStatus, DayEvaluation };
export {
  calculateSavingsMetrics,
  evaluateDayStatus,
  computeSpentByDate,
  computeSpentForDate,
  computeIncomeByDate,
  computeIncomeForDate,
  calculateCycleFinancials,
  buildDefaultTodayRecord,
  filterPastRecords,
  shouldIgnoreDuplicates,
  shouldSendRolloverNotification,
};

import {
  BudgetCadence,
  BudgetPlanChange,
  BudgetPeriodRecord,
  BudgetPeriodStatus,
} from '../types';
export type {
  BudgetCadence,
  BudgetPlanChange,
  BudgetPeriodRecord,
  BudgetPeriodStatus,
};

import type {
  ProfileSettingsPatch,
  GullakDepositSource,
  GullakDeposit,
} from './dailyBudget/types';
export type {
  ProfileSettingsPatch,
  GullakDepositSource,
  GullakDeposit,
};

import { getPendingSettingsKey, getPendingGullakAddsKey, getPendingGullakDeletesKey, getPendingPlanChangesKey, getPendingBudgetPeriodsKey, getLastRenewedPeriodKey, savePendingSettingsOffline, clearPendingSettingsOffline, savePendingPlanChangeOffline, savePendingBudgetPeriodOffline, getStoredList, setStoredList, savePendingGullakAdd, tryRemovePendingGullakAdd, savePendingGullakDelete } from './dailyBudget/pendingStorage';
export {
  getPendingSettingsKey,
  getPendingGullakAddsKey,
  getPendingGullakDeletesKey,
  getPendingPlanChangesKey,
  getPendingBudgetPeriodsKey,
  getLastRenewedPeriodKey,
  savePendingSettingsOffline,
  clearPendingSettingsOffline,
  savePendingPlanChangeOffline,
  savePendingBudgetPeriodOffline,
  getStoredList,
  setStoredList,
  savePendingGullakAdd,
  tryRemovePendingGullakAdd,
  savePendingGullakDelete,
};

import type { DailyBudgetState } from './dailyBudget/types';
import { normalizeLegacyRecordStatuses } from './dailyBudget/legacyStatus';
export type { DailyBudgetState };

import {
  applyScheduledNextDayBudget,
  applyScheduledPlanChanges,
  groupSpentByDate,
  collectPastDates,
  finalizeDailyRecords,
  finalizePeriods,
} from './dailyBudget/rollover';
export {
  applyScheduledNextDayBudget,
  applyScheduledPlanChanges,
  groupSpentByDate,
  collectPastDates,
  finalizeDailyRecords,
  finalizePeriods,
};

import {
  waitForPersistHydration,
  readPendingSettings,
  buildOfflineHydrationPatch,
  fetchRemoteBudgetData,
  mergePendingPlanChanges,
  mergePendingPeriods,
  fetchGullakDepositsRaw,
  mergeGullakDeposits,
  hydrateGullakDeposits,
  runHydrateFromSupabase,
} from './dailyBudget/hydrate';
import {
  selfHealDefaultBudget,
  selfHealCorruptedRows,
} from './dailyBudget/selfHealing';
export {
  waitForPersistHydration,
  readPendingSettings,
  buildOfflineHydrationPatch,
  fetchRemoteBudgetData,
  mergePendingPlanChanges,
  mergePendingPeriods,
  selfHealDefaultBudget,
  selfHealCorruptedRows,
  fetchGullakDepositsRaw,
  mergeGullakDeposits,
  hydrateGullakDeposits,
  runHydrateFromSupabase,
};

import { handleSetDailyBudget, handleToggleAutoRenew, handleScheduleNextDailyBudget, handleCancelScheduledNextDailyBudget, handleSetBudgetModeEnabled, handleSetBudgetCadence, handleSetWeeklyBudget, handleSetMonthlyBudget, resolvePendingPlanChange, resolveEffectiveFromLabel, handleCancelPendingPlanChange, uploadPendingBudgetPeriods, syncPendingPlanChanges, handleSetLastRenewedPeriodKey } from './dailyBudget/planActions';
import { createGullakActions } from './dailyBudget/gullakActions';
import { createSyncActions } from './dailyBudget/syncActions';
import { createRecordActions } from './dailyBudget/recordActions';
import { recordAutoRenewChange } from '../lib/allowancePauses';
import { queueAllowancePauses, syncAllowancePauses } from './dailyBudget/allowancePauseSync';
export {
  handleSetDailyBudget,
  handleToggleAutoRenew,
  handleScheduleNextDailyBudget,
  handleCancelScheduledNextDailyBudget,
  handleSetBudgetModeEnabled,
  handleSetBudgetCadence,
  handleSetWeeklyBudget,
  handleSetMonthlyBudget,
  resolvePendingPlanChange,
  resolveEffectiveFromLabel,
  handleCancelPendingPlanChange,
  uploadPendingBudgetPeriods,
  syncPendingPlanChanges,
  handleSetLastRenewedPeriodKey,
};

let hydrationInFlight: { userId: string; promise: Promise<void> } | null = null;

export const useDailyBudgetStore = create<DailyBudgetState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      hydratedForUserId: null,
      dailyBudgetAmount: 100,
      isAutoRenew: false,
      dailyRecords: {},
      gullakDeposits: [],
      totalAccumulatedSavings: 0,
      savingsStreak: 0,
      bestStreak: 0,
      lastWarningNotifiedDate: null,
      lastExceededNotifiedDate: null,
      lastRolloverNotifiedDate: null,
      scheduledNextDailyBudget: null,
      scheduledBudgetSetDate: null,

      // --- Budget Modes & Multi-Cadence (Oct 2026) ---
      isBudgetModeEnabled: false,
      budgetCadence: 'daily',
      weeklyBudgetAmount: 0,
      monthlyBudgetAmount: 0,
      planChanges: [],
      budgetPeriods: {},
      bestStreakByCadence: { daily: 0, weekly: 0, monthly: 0 },
      lastPeriodWarningKey: null,
      lastPeriodExceededKey: null,
      lastPeriodRolloverKey: null,
      lastRenewedPeriodKey: null,
      dismissedGapDates: [],
      allowancePauses: [],
      ...createGullakActions(set, get),
      ...createRecordActions(set, get),

      setDailyBudget: (amount: number) => handleSetDailyBudget(get, set, amount),

      toggleAutoRenew: (enabled: boolean) => handleToggleAutoRenew(get, set, enabled),

      scheduleNextDailyBudget: (amount: number) => handleScheduleNextDailyBudget(set, amount),

      cancelScheduledNextDailyBudget: () => handleCancelScheduledNextDailyBudget(set),

      setBudgetModeEnabled: (
        enabled: boolean,
        options?: { cadence?: BudgetCadence; amount?: number; immediate?: boolean; autoRenew?: boolean }
      ) => handleSetBudgetModeEnabled(get, set, enabled, options),

      setBudgetCadence: (
        cadence: BudgetCadence,
        options?: {
          amount?: number;
          carryMode?: 'additive' | 'allocation';
          carriedOverAmount?: number;
        }
      ) => handleSetBudgetCadence(get, set, cadence, options),

      setWeeklyBudget: (amount: number, options?: { immediate?: boolean }) => handleSetWeeklyBudget(get, set, amount, options),

      setMonthlyBudget: (amount: number, options?: { immediate?: boolean }) => handleSetMonthlyBudget(get, set, amount, options),

      getPendingPlanChange: () => resolvePendingPlanChange(get().planChanges, getTodayDateStr()),

      getEffectiveFromLabel: (change?: BudgetPlanChange | null) =>
        resolveEffectiveFromLabel(change || get().getPendingPlanChange(), getTodayDateStr()),

      cancelPendingPlanChange: () => handleCancelPendingPlanChange(get, set),

      uploadPendingBudgetPeriods: () => uploadPendingBudgetPeriods(get),

      syncPendingPlanChanges: () => syncPendingPlanChanges(get),

      setLastRenewedPeriodKey: (key: string) => handleSetLastRenewedPeriodKey(get, set, key),

      getAvailableIncomeBalance: () => computeAvailableIncomeBalance(),

      getCarryableAmount: () => computeCarryableAmount(get()),

      getTotalAccountRemaining: () => computeTotalAccountRemaining(get()),

      getGrossIncomeBalance: () => computeGrossIncomeBalance(get().gullakDeposits),

      getPriorAvailableIncomeBalance: () => computePriorAvailableIncomeBalance(getTodayDateStr()),
      ...createSyncActions(set, get),

      // One hydration per user at a time: the splash screen, the Home screen and the sign-in listener can all ask for
      // it within the same second. Later callers share the run that is already going (no duplicate server requests,
      // no two runs writing the same state).
      hydrateFromSupabase: (userId: string) => {
        if (hydrationInFlight?.userId === userId) return hydrationInFlight.promise;
        const promise = (async () => {
          const dismissed = await getStoredDismissedGapDates(userId);
          if (dismissed && dismissed.length) {
            set({ dismissedGapDates: dismissed });
          }
          await runHydrateFromSupabase({
            get,
            set,
            userId,
            store: useDailyBudgetStore,
          });
        })().finally(() => {
          if (hydrationInFlight?.promise === promise) hydrationInFlight = null;
        });
        hydrationInFlight = { userId, promise };
        return promise;
      },

      resetDailyBudget: () => {
        set({
          ownerUserId: null,
          hydratedForUserId: null,
          dailyBudgetAmount: 100,
          isAutoRenew: false,
          dailyRecords: {},
          gullakDeposits: [],
          totalAccumulatedSavings: 0,
          savingsStreak: 0,
          bestStreak: 0,
          lastWarningNotifiedDate: null,
          lastExceededNotifiedDate: null,
          lastRolloverNotifiedDate: null,
          scheduledNextDailyBudget: null,
          scheduledBudgetSetDate: null,

          // --- Budget Modes & Multi-Cadence (Oct 2026) ---
          isBudgetModeEnabled: false,
          budgetCadence: 'daily',
          weeklyBudgetAmount: 0,
          monthlyBudgetAmount: 0,
          planChanges: [],
          budgetPeriods: {},
          bestStreakByCadence: { daily: 0, weekly: 0, monthly: 0 },
          lastPeriodWarningKey: null,
          lastPeriodExceededKey: null,
          lastPeriodRolloverKey: null,
          lastRenewedPeriodKey: null,
          dismissedGapDates: [],
          allowancePauses: [],
        });
        AsyncStorage.removeItem('arthik-daily-budget-storage-v2').catch(() => {});
        const prevUid = get().ownerUserId;
        if (prevUid) {
          AsyncStorage.removeItem(getLastRenewedPeriodKey(prevUid)).catch(() => {});
        }
      },
    }),
    {
      name: 'arthik-daily-budget-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as DailyBudgetState;
        let state = persistedState as Record<string, unknown>;
        if (version < 3) {
          const isAutoRenew = Boolean(state.isAutoRenew);
          const deposits = (state.gullakDeposits as GullakDeposit[]) || [];
          const records = (state.dailyRecords as Record<string, DailyRecord>) || {};
          const hasSavedRecord = Object.values(records).some(
            (r) => r && (r.status === 'saved' || (r.saved !== undefined && r.saved > 0))
          );
          const inferredModeEnabled = isAutoRenew || deposits.length > 0 || hasSavedRecord;

          state = {
            ...state,
            isBudgetModeEnabled: (state.isBudgetModeEnabled as boolean | undefined) ?? inferredModeEnabled,
            budgetCadence: (state.budgetCadence as BudgetCadence | undefined) ?? 'daily',
            weeklyBudgetAmount: (state.weeklyBudgetAmount as number | undefined) ?? 0,
            monthlyBudgetAmount: (state.monthlyBudgetAmount as number | undefined) ?? 0,
            planChanges: (state.planChanges as BudgetPlanChange[] | undefined) ?? [],
            budgetPeriods: (state.budgetPeriods as Record<string, BudgetPeriodRecord> | undefined) ?? {},
            bestStreakByCadence: (state.bestStreakByCadence as Record<string, number> | undefined) ?? {
              daily: (state.bestStreak as number | undefined) || 0,
              weekly: 0,
              monthly: 0,
            },
            lastPeriodWarningKey: (state.lastPeriodWarningKey as string | null | undefined) ?? null,
            lastPeriodExceededKey: (state.lastPeriodExceededKey as string | null | undefined) ?? null,
            lastPeriodRolloverKey: (state.lastPeriodRolloverKey as string | null | undefined) ?? null,
            lastRenewedPeriodKey: (state.lastRenewedPeriodKey as string | null | undefined) ?? null,
          };
        }
        if (version < 4) {
          // BUD-008: 'exceeded' no longer exists; cached days become 'missed'.
          state = {
            ...state,
            dailyRecords: normalizeLegacyRecordStatuses(state.dailyRecords as Record<string, DailyRecord> | undefined),
          };
        }
        return state as unknown as DailyBudgetState;
      },
    }
  )
);

registerMetricsStoreGetter(useDailyBudgetStore.getState);

// INS-004: every real auto-save on / off of the signed-in user (any path: pause switch, mode switch, matured plan)
// is written into the pause history. The first hydration of a user is not a change and is skipped.
useDailyBudgetStore.subscribe((state, prev) => {
  if (state.isAutoRenew === prev.isAutoRenew) return;
  const userId = state.hydratedForUserId;
  if (!userId || prev.hydratedForUserId !== userId) return;
  const next = recordAutoRenewChange(state.allowancePauses || [], state.isAutoRenew, getTodayDateStr());
  if (next === state.allowancePauses) return;
  useDailyBudgetStore.setState({ allowancePauses: next });
  void queueAllowancePauses(userId, next).then(() => syncAllowancePauses(userId));
});

registerStoreResetCallback(() => {
  useDailyBudgetStore.getState().resetDailyBudget();
});
