import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { Expense } from './expense/types';

import {
  registerExpenseGetter,
  getCurrentExpenses,
  registerSharesGetter,
  getCurrentShares,
  registerExpensesLoadedGetter,
  areExpensesLoaded,
} from './dailyBudget/expenseBridge';
export {
  registerExpenseGetter,
  getCurrentExpenses,
  registerSharesGetter,
  getCurrentShares,
  registerExpensesLoadedGetter,
  areExpensesLoaded,
};

import {
  getTodayDateStr,
  getUserCreatedAtLocalDate,
  getUserCreatedAtStr,
  isDailyOwnedDate,
  dailyCarryExtraFor,
  runWaterfall,
  computeAllTimeBudget,
  computeMetrics,
  registerMetricsStoreGetter,
  computeAvailableIncomeBalance,
  computePriorAvailableIncomeBalance,
  computeCarryableAmount,
  computeTotalAccountRemaining,
  computeGrossIncomeBalance,
} from './dailyBudget/metrics';
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
import { notifyLimit } from '../lib/budgetAlerts';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useNetworkStore } from './networkStore';
import { isNetworkFailure } from '../lib/networkUtils';
import { round2 } from '../lib/formatters';

import {
  buildCategoryClassifier,
  buildEligibleIncomeClassifier,
} from './dailyBudget/classifiers';


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
  computeReimbursementsByDate,
  computeReimbursementsForDate,
  calculateCycleFinancials,
  buildDefaultTodayRecord,
  filterPastRecords,
  shouldIgnoreDuplicates,
  shouldSendRolloverNotification,
} from '../lib/budgetCalculations';
export type { DailyRecord, SavingsMetrics, DayStatus, DayEvaluation };
export {
  computeReimbursementsByDate,
  computeReimbursementsForDate,
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
import {
  getCurrentPeriodSummary,
} from '../lib/budgetPeriods';

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

import {
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
} from './dailyBudget/pendingStorage';
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
export type { DailyBudgetState };

import {
  applyScheduledNextDayBudget,
  groupSpentByDate,
  collectPastDates,
  finalizeDailyRecords,
  finalizePeriods,
} from './dailyBudget/rollover';
export {
  applyScheduledNextDayBudget,
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
  selfHealDefaultBudget,
  selfHealCorruptedRows,
  hydrateGullakDeposits,
  runHydrateFromSupabase,
} from './dailyBudget/hydrate';
export {
  waitForPersistHydration,
  readPendingSettings,
  buildOfflineHydrationPatch,
  fetchRemoteBudgetData,
  mergePendingPlanChanges,
  mergePendingPeriods,
  selfHealDefaultBudget,
  selfHealCorruptedRows,
  hydrateGullakDeposits,
  runHydrateFromSupabase,
};

import {
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
} from './dailyBudget/planActions';
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

      getTodayRecord: () => {
        const todayStr = getTodayDateStr();
        const records = get().dailyRecords;
        if (records[todayStr]) {
          if ((!get().isAutoRenew || !get().isBudgetModeEnabled) && !records[todayStr].isFinalized) {
            return {
              ...records[todayStr],
              budget: 0,
              saved: 0,
              status: 'unknown',
            };
          }
          return records[todayStr];
        }

        const def = buildDefaultTodayRecord(
          todayStr,
          get().isAutoRenew && get().isBudgetModeEnabled && isDailyOwnedDate(get().planChanges, todayStr),
          get().dailyBudgetAmount + dailyCarryExtraFor(todayStr)
        );
        if (!get().isAutoRenew || !get().isBudgetModeEnabled) {
          return {
            ...def,
            status: 'unknown',
          };
        }
        return def;
      },

      getPastRecordsList: () => {
        const todayStr = getTodayDateStr();
        const records = get().dailyRecords;
        return filterPastRecords(records, todayStr);
      },

      setDailyBudget: (amount: number) => handleSetDailyBudget(get, set, amount),

      toggleAutoRenew: (enabled: boolean) => handleToggleAutoRenew(get, set, enabled),

      scheduleNextDailyBudget: (amount: number) => handleScheduleNextDailyBudget(set, amount),

      cancelScheduledNextDailyBudget: () => handleCancelScheduledNextDailyBudget(set),

      setBudgetModeEnabled: (enabled: boolean) => handleSetBudgetModeEnabled(get, set, enabled),

      setBudgetCadence: (
        cadence: BudgetCadence,
        options?: {
          amount?: number;
          carryMode?: 'additive' | 'allocation';
          carriedOverAmount?: number;
        }
      ) => handleSetBudgetCadence(get, set, cadence, options),

      setWeeklyBudget: (amount: number) => handleSetWeeklyBudget(get, set, amount),

      setMonthlyBudget: (amount: number) => handleSetMonthlyBudget(get, set, amount),

      getPendingPlanChange: () => resolvePendingPlanChange(get().planChanges, getTodayDateStr()),

      getEffectiveFromLabel: (change?: BudgetPlanChange | null) =>
        resolveEffectiveFromLabel(change || get().getPendingPlanChange(), getTodayDateStr()),

      cancelPendingPlanChange: () => handleCancelPendingPlanChange(get, set),

      uploadPendingBudgetPeriods: () => uploadPendingBudgetPeriods(get),

      syncPendingPlanChanges: () => syncPendingPlanChanges(get),

      setLastRenewedPeriodKey: (key: string) => handleSetLastRenewedPeriodKey(get, set, key),

      addGullakDeposit: (amount: number, note?: string, source: GullakDepositSource = 'external') => {
        if (!amount || amount <= 0) return;
        const newDeposit: GullakDeposit = {
          id: Crypto.randomUUID(),
          amount: round2(amount),
          date: getTodayDateStr(),
          note: note?.trim() || undefined,
          source,
          created_at: new Date().toISOString(),
        };
        const deposits = [newDeposit, ...(get().gullakDeposits || [])];
        const metrics = computeMetrics(get().dailyRecords, deposits);
        set({ gullakDeposits: deposits, ...metrics });

        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        const insertPayload = {
          id: newDeposit.id,
          user_id: userId,
          amount: newDeposit.amount,
          date: newDeposit.date,
          note: newDeposit.note || null,
          source: newDeposit.source,
          created_at: newDeposit.created_at,
        };

        if (useNetworkStore.getState().isOffline) {
          savePendingGullakAdd(userId, newDeposit);
          return;
        }

        supabase
          .from('gullak_deposits')
          .insert(insertPayload)
          .then(({ error }) => {
            if (error) {
              if (isNetworkFailure(error)) {
                savePendingGullakAdd(userId, newDeposit);
              } else if (__DEV__) {
                console.error('[dailyBudgetStore] Error inserting gullak_deposit:', error);
              }
            }
          });
      },

      removeGullakDeposit: (id: string) => {
        const deposits = (get().gullakDeposits || []).filter((d) => d.id !== id);
        const metrics = computeMetrics(get().dailyRecords, deposits);
        set({ gullakDeposits: deposits, ...metrics });

        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        // If the deposit was never synced (still in pending-add queue), just remove it there.
        // Otherwise queue a server delete for when we reconnect.
        tryRemovePendingGullakAdd(userId, id).then((wasPending) => {
          if (wasPending) return;

          if (useNetworkStore.getState().isOffline) {
            savePendingGullakDelete(userId, id);
            return;
          }

          supabase
            .from('gullak_deposits')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
            .then(({ error }) => {
              if (error) {
                if (isNetworkFailure(error)) {
                  savePendingGullakDelete(userId, id);
                } else if (__DEV__) {
                  console.error('[dailyBudgetStore] Error deleting gullak_deposit:', error);
                }
              }
            });
        });
      },

      getAvailableIncomeBalance: () => computeAvailableIncomeBalance(),

      getCarryableAmount: () => computeCarryableAmount(get()),

      getTotalAccountRemaining: () => computeTotalAccountRemaining(get()),

      getGrossIncomeBalance: () => computeGrossIncomeBalance(get().gullakDeposits),

      getPriorAvailableIncomeBalance: () => computePriorAvailableIncomeBalance(getTodayDateStr()),

      syncWithExpenses: (expenses: Expense[]) => {
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const isIncomeFn = buildCategoryClassifier();
        const isEligibleIncomeFn = buildEligibleIncomeClassifier();

        const todaySpent = computeSpentForDate(expenses, todayStr, isIncomeFn);
        const todayEligibleIncome = computeIncomeForDate(expenses, todayStr, isEligibleIncomeFn);
        // Only the BUDGET part of a split repayment adds to unspent budget; the income / Gullak parts go back
        // to the income pool / Gullak (see moneyWaterfall.ts), so nothing is counted twice.
        const reimbByDate = runWaterfall({ expenses }).reimbBudgetByDate;
        const todayReimb = reimbByDate[todayStr] || 0;

        let todayRecord = records[todayStr];
        let hasTodayChanged = false;

        const isBudgetOn = get().isBudgetModeEnabled;

        if (!todayRecord) {
          const budget = isBudgetOn && get().isAutoRenew && get().dailyBudgetAmount > 0 && isDailyOwnedDate(get().planChanges, todayStr) ? get().dailyBudgetAmount + dailyCarryExtraFor(todayStr) : 0;
          const { saved } = evaluateDayStatus(budget, todaySpent, todayEligibleIncome, undefined, todayReimb);
          const effectiveSpendable = budget + todayReimb; // income is a separate pool, not allowance
          todayRecord = {
            date: todayStr,
            budget,
            spent: todaySpent,
            saved: isBudgetOn ? saved : 0,
            isFinalized: false,
            status: isBudgetOn ? (todaySpent > effectiveSpendable && effectiveSpendable > 0 ? 'exceeded' : 'active') : 'unknown',
          };
          hasTodayChanged = true;
        } else if (!isBudgetOn) {
          if (todayRecord.budget !== 0 || todayRecord.spent !== todaySpent || todayRecord.saved !== 0 || todayRecord.status !== 'unknown') {
            todayRecord = {
              ...todayRecord,
              budget: 0,
              spent: todaySpent,
              saved: 0,
              status: 'unknown',
            };
            hasTodayChanged = true;
          }
        } else if (todayRecord.budget > 0 && !todayRecord.isFinalized && !isDailyOwnedDate(get().planChanges, todayStr)) {
          // A weekly / monthly plan (or Pure Mode) owns today: no daily budget on this day.
          todayRecord = { ...todayRecord, budget: 0, spent: todaySpent, saved: 0, status: 'unknown' };
          hasTodayChanged = true;
        } else {
          const { saved: newSaved } = evaluateDayStatus(todayRecord.budget, todaySpent, todayEligibleIncome, undefined, todayReimb);
          const effectiveSpendable = todayRecord.budget + todayReimb; // income is a separate pool, not allowance
          const newStatus =
            todaySpent > effectiveSpendable && effectiveSpendable > 0
              ? 'exceeded'
              : 'active';

          if (todayRecord.spent !== todaySpent || todayRecord.status !== newStatus || todayRecord.saved !== newSaved) {
            todayRecord = {
              ...todayRecord,
              spent: todaySpent,
              saved: newSaved,
              status: newStatus,
            };
            hasTodayChanged = true;
          }
        }
        records[todayStr] = todayRecord;

        // Check for smart alerts & trigger native phone notifications
        // Alerts follow the BUDGET (same as the Home card and the weekly / monthly alerts). Income is a separate
        // pool that only pays after the budget is used up, so it must not delay the "limit exceeded" alert.
        if (get().isBudgetModeEnabled && get().budgetCadence === 'daily' && (todayRecord.budget > 0 || todayReimb > 0)) {
          const spendable = todayRecord.budget + todayReimb;
          const ratio = spendable > 0 ? todaySpent / spendable : (todaySpent > 0 ? 1 : 0);
          const remaining = Math.max(0, spendable - todaySpent);
          if (ratio >= 1) {
            if (get().lastExceededNotifiedDate !== todayStr) {
              const over = Math.max(0, todaySpent - spendable);
              const availIncome = get().getAvailableIncomeBalance();
              const incomeCovered = Math.min(over, Math.max(0, availIncome));
              const gullakCovered = Math.max(0, over - incomeCovered);
              notifyLimit({
                id: `alert_exceeded_${todayStr}`,
                kind: 'exceeded',
                cadence: 'daily',
                spent: todaySpent,
                budget: spendable,
                remaining: 0,
                incomeCovered,
                gullakCovered,
                date: todayStr,
              });
              set({ lastExceededNotifiedDate: todayStr });
            }
          } else if (ratio >= 0.8) {
            if (get().lastWarningNotifiedDate !== todayStr) {
              notifyLimit({
                id: `alert_warning_80_${todayStr}`,
                kind: 'warning',
                cadence: 'daily',
                spent: todaySpent,
                budget: spendable,
                remaining,
                date: todayStr,
              });
              set({ lastWarningNotifiedDate: todayStr });
            }
          }
        } else if (get().isBudgetModeEnabled && (get().budgetCadence === 'weekly' || get().budgetCadence === 'monthly')) {
          const spentByDate = computeSpentByDate(expenses, isIncomeFn);
          const incomeByDate = computeIncomeByDate(expenses, isEligibleIncomeFn);
          const summary = getCurrentPeriodSummary(get().planChanges, spentByDate, todayStr, incomeByDate, reimbByDate);
          if (summary && summary.budget > 0) {
            const ratio = summary.spent / summary.budget;
            const periodKey = `${summary.cadence}_${summary.periodStart}`;

            if (ratio >= 1) {
              if (get().lastPeriodExceededKey !== periodKey) {
                const over = Math.max(0, summary.spent - summary.budget);
                const availIncome = get().getAvailableIncomeBalance();
                const incomeCovered = Math.min(over, Math.max(0, availIncome));
                const gullakCovered = Math.max(0, over - incomeCovered);
                notifyLimit({
                  id: `alert_exceeded_${periodKey}`,
                  kind: 'exceeded',
                  cadence: summary.cadence,
                  spent: summary.spent,
                  budget: summary.budget,
                  remaining: 0,
                  incomeCovered,
                  gullakCovered,
                  date: todayStr,
                  periodKey,
                });
                set({ lastPeriodExceededKey: periodKey });
              }
            } else if (ratio >= 0.8) {
              if (get().lastPeriodWarningKey !== periodKey) {
                notifyLimit({
                  id: `alert_warning_80_${periodKey}`,
                  kind: 'warning',
                  cadence: summary.cadence,
                  spent: summary.spent,
                  budget: summary.budget,
                  remaining: summary.remaining,
                  remainingDays: summary.remainingDays,
                  date: todayStr,
                  periodKey,
                });
                set({ lastPeriodWarningKey: periodKey });
              }
            }
          }
        }

        if (hasTodayChanged) {
          const metrics = computeMetrics(
            records,
            get().gullakDeposits,
            undefined,
            get().budgetPeriods,
            get().budgetCadence,
            get().bestStreakByCadence
          );
          set({ dailyRecords: records, ...metrics });
        }

        // Trigger rollover check
        get().checkAndRollover(expenses);
      },

      checkAndRollover: (expenses: Expense[], skipRolloverNotification = false) => {
        const currentUser = useAuthStore.getState().user;
        // P0.1: Must not run or finalize before hydrateFromSupabase has completed for this user!
        if (!currentUser || get().hydratedForUserId !== currentUser.id) {
          return;
        }

        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        let updated = false;

        applyScheduledNextDayBudget(get, set, todayStr);

        const isIncomeFn = buildCategoryClassifier();
        const isEligibleIncomeFn = buildEligibleIncomeClassifier();

        const { spentByDate, incomeByDate, reimbByDateAll } = groupSpentByDate(
          expenses,
          isIncomeFn,
          isEligibleIncomeFn
        );

        const pastDates = collectPastDates(records, spentByDate, todayStr);

        const dailyResult = finalizeDailyRecords({
          get,
          set,
          currentUser,
          records,
          pastDates,
          spentByDate,
          incomeByDate,
          reimbByDateAll,
          skipRolloverNotification,
        });
        if (dailyResult.updated) {
          updated = true;
        }

        const userCreatedAtStr = getUserCreatedAtLocalDate(currentUser?.created_at);

        const periodsResult = finalizePeriods({
          get,
          set,
          currentUser,
          todayStr,
          userCreatedAtStr,
          spentByDate,
          incomeByDate,
          reimbByDateAll,
          skipRolloverNotification,
        });
        if (periodsResult.updated) {
          updated = true;
        }

        // Compute savings metrics using shared helper
        const metrics = computeMetrics(
          records,
          get().gullakDeposits,
          userCreatedAtStr,
          get().budgetPeriods,
          get().budgetCadence,
          get().bestStreakByCadence
        );

        if (
          updated ||
          get().totalAccumulatedSavings !== metrics.totalAccumulatedSavings ||
          get().savingsStreak !== metrics.savingsStreak ||
          get().bestStreak !== metrics.bestStreak
        ) {
          set({
            dailyRecords: records,
            ...metrics,
          });
        }
      },

      uploadPendingDailyRecords: async () => {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) return;
        if (get().hydratedForUserId !== currentUser.id) return;

        const records = { ...get().dailyRecords };
        const dates = Object.keys(records);
        let hasUpdates = false;

        for (const d of dates) {
          const rec = records[d];
          if (rec && rec.isFinalized && rec.needsUpload) {
            const supabaseStatus =
              rec.status === 'unknown'
                ? 'unknown'
                : rec.saved > 0
                ? 'saved'
                : rec.status === 'even'
                ? 'even'
                : 'missed';

            const isInsertOnly = shouldIgnoreDuplicates(rec.status) && !rec.forceOverwrite;
            try {
              const { error } = await supabase
                .from('daily_savings_log')
                .upsert(
                  {
                    user_id: currentUser.id,
                    date: d,
                    amount_saved: rec.saved,
                    spent_amount: rec.spent,
                    status: supabaseStatus,
                    budget_amount: rec.budget,
                  },
                  { onConflict: 'user_id,date', ignoreDuplicates: isInsertOnly }
                );

              if (!error) {
                records[d] = { ...rec, needsUpload: false, forceOverwrite: undefined };
                hasUpdates = true;
              }
            } catch {
              // Still offline
            }
          }
        }

        if (hasUpdates) {
          set({ dailyRecords: records });
        }

        // Also upload pending budget periods and pending plan changes
        await get().uploadPendingBudgetPeriods();
        await get().syncPendingPlanChanges();
      },

      syncPendingGullakDeposits: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        // 1. Flush pending adds (upsert is idempotent if sync runs twice)
        const addsKey = getPendingGullakAddsKey(userId);
        const adds = await getStoredList<GullakDeposit>(addsKey);
        if (adds.length) {
          const synced: string[] = [];
          for (const d of adds) {
            try {
              const { error } = await supabase.from('gullak_deposits').upsert(
                {
                  id: d.id,
                  user_id: userId,
                  amount: d.amount,
                  date: d.date,
                  note: d.note || null,
                  source: d.source,
                  created_at: d.created_at,
                },
                { onConflict: 'id', ignoreDuplicates: true }
              );
              if (!error) synced.push(d.id);
            } catch {}
          }
          if (synced.length) await setStoredList(addsKey, adds.filter((d) => !synced.includes(d.id)));
        }

        // 2. Flush pending deletes
        const delsKey = getPendingGullakDeletesKey(userId);
        const dels = await getStoredList<string>(delsKey);
        if (dels.length) {
          const synced: string[] = [];
          for (const id of dels) {
            try {
              const { error } = await supabase.from('gullak_deposits').delete().eq('id', id).eq('user_id', userId);
              if (!error) synced.push(id);
            } catch {}
          }
          if (synced.length) await setStoredList(delsKey, dels.filter((id) => !synced.includes(id)));
        }
      },

      hydrateFromSupabase: async (userId: string) => {
        await runHydrateFromSupabase({
          get,
          set,
          userId,
          store: useDailyBudgetStore,
        });
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
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as DailyBudgetState;
        const state = persistedState as Record<string, unknown>;
        if (version < 3) {
          const isAutoRenew = Boolean(state.isAutoRenew);
          const deposits = (state.gullakDeposits as GullakDeposit[]) || [];
          const records = (state.dailyRecords as Record<string, DailyRecord>) || {};
          const hasSavedRecord = Object.values(records).some(
            (r) => r && (r.status === 'saved' || (r.saved !== undefined && r.saved > 0))
          );
          const inferredModeEnabled = isAutoRenew || deposits.length > 0 || hasSavedRecord;

          return {
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
          } as unknown as DailyBudgetState;
        }
        return state as unknown as DailyBudgetState;
      },
    }
  )
);

registerMetricsStoreGetter(useDailyBudgetStore.getState);

registerStoreResetCallback(() => {
  useDailyBudgetStore.getState().resetDailyBudget();
});
