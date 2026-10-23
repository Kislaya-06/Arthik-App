import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { Expense } from './expense/types';

import {
  registerExpenseGetter,
  getCurrentExpenses,
  registerExpensesLoadedGetter,
  areExpensesLoaded,
  registerAddExpense,
  addExpenseFromBridge,
} from './dailyBudget/expenseBridge';
export {
  registerExpenseGetter,
  getCurrentExpenses,
  registerExpensesLoadedGetter,
  areExpensesLoaded,
  registerAddExpense,
  addExpenseFromBridge,
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
import { calculateBudgetStatus } from '../money/budgetStatus';
import { overspendFundingBetweenDates } from '../money/overspendFunding';
import { getStoredDismissedGapDates, storeDismissedGapDates } from '../lib/gapFiller';

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
      dismissedGapDates: [],

      saveGapDaysToGullak: async (gapDates: string[]) => {
        if (!gapDates || gapDates.length === 0) return;
        const records = { ...get().dailyRecords };
        const baseBudget = get().dailyBudgetAmount;
        let updated = false;

        for (const d of gapDates) {
          const extraCarry = dailyCarryExtraFor(d, get());
          const budget = round2(baseBudget + extraCarry);
          records[d] = {
            date: d,
            budget,
            spent: 0,
            saved: budget,
            isFinalized: true,
            status: 'saved',
            needsUpload: true,
          };
          updated = true;
        }

        if (updated) {
          const deposits = get().gullakDeposits;
          const userCreatedAt = getUserCreatedAtStr();
          const budgetPeriods = get().budgetPeriods;
          const metrics = computeMetrics(
            records,
            deposits,
            userCreatedAt,
            budgetPeriods,
            get().budgetCadence,
            get().bestStreakByCadence
          );
          set({
            dailyRecords: records,
            ...metrics,
          });

          await get().uploadPendingDailyRecords();
        }
      },

      dismissGapDays: async (gapDates: string[]) => {
        if (!gapDates || gapDates.length === 0) return;
        const current = get().dismissedGapDates || [];
        const merged = Array.from(new Set([...current, ...gapDates]));
        set({ dismissedGapDates: merged });

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          await storeDismissedGapDates(currentUser.id, gapDates);
        }
      },

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

      updateGullakDepositAmount: (id: string, newAmount: number) => {
        const roundedAmount = round2(newAmount);
        if (roundedAmount <= 0) {
          get().removeGullakDeposit(id);
          return;
        }
        const deposits = (get().gullakDeposits || []).map((d) =>
          d.id === id ? { ...d, amount: roundedAmount } : d
        );
        const metrics = computeMetrics(get().dailyRecords, deposits);
        set({ gullakDeposits: deposits, ...metrics });

        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        if (useNetworkStore.getState().isOffline) {
          return;
        }

        supabase
          .from('gullak_deposits')
          .update({ amount: roundedAmount })
          .eq('id', id)
          .eq('user_id', userId)
          .then(({ error }) => {
            if (error && __DEV__) {
              console.error('[dailyBudgetStore] Error updating gullak_deposit:', error);
            }
          });
      },

      adjustGullakIncomeDeposits: async (dateStr: string, deficit: number) => {
        let remainingDeficit = round2(deficit);
        if (remainingDeficit <= 0) return;

        const allDeposits = [...(get().gullakDeposits || [])];
        const dateDeposits = allDeposits
          .filter((d) => d.source === 'income' && d.date?.split('T')[0]?.trim() === dateStr)
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

        for (const dep of dateDeposits) {
          if (remainingDeficit <= 0) break;
          if (dep.amount <= remainingDeficit) {
            remainingDeficit = round2(remainingDeficit - dep.amount);
            get().removeGullakDeposit(dep.id);
          } else {
            const updated = round2(dep.amount - remainingDeficit);
            remainingDeficit = 0;
            get().updateGullakDepositAmount(dep.id, updated);
          }
        }
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

        let todayRecord = records[todayStr];
        let hasTodayChanged = false;

        const isBudgetOn = get().isBudgetModeEnabled;

        if (!todayRecord) {
          const budget = isBudgetOn && get().isAutoRenew && get().dailyBudgetAmount > 0 && isDailyOwnedDate(get().planChanges, todayStr) ? get().dailyBudgetAmount + dailyCarryExtraFor(todayStr) : 0;
          const { saved } = evaluateDayStatus(budget, todaySpent, todayEligibleIncome);
          const effectiveSpendable = budget; // income is a separate pool, not allowance
          todayRecord = {
            date: todayStr,
            budget,
            spent: todaySpent,
            saved: isBudgetOn ? saved : 0,
            isFinalized: false,
            status: isBudgetOn ? (todaySpent > effectiveSpendable && effectiveSpendable > 0 ? 'missed' : 'active') : 'unknown',
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
          const { saved: newSaved } = evaluateDayStatus(todayRecord.budget, todaySpent, todayEligibleIncome);
          const effectiveSpendable = todayRecord.budget; // income is a separate pool, not allowance
          const newStatus =
            todaySpent > effectiveSpendable && effectiveSpendable > 0
              ? 'missed'
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
        if (get().isBudgetModeEnabled && get().budgetCadence === 'daily' && todayRecord.budget > 0) {
          const spendable = todayRecord.budget;
          const todayBudgetStatus = calculateBudgetStatus(spendable, todaySpent);
          const ratio = todayBudgetStatus.budgetUsedRatio;
          const remaining = todayBudgetStatus.budgetLeftUnspent;
          if (ratio >= 1) {
            if (get().lastExceededNotifiedDate !== todayStr) {
              // Who paid the overspend comes from the money waterfall (WAT-001), never from a separate guess.
              const { coveredByIncome: incomeCovered, coveredByGullak: gullakCovered } = overspendFundingBetweenDates(
                runWaterfall({ records, expenses }),
                todayStr,
                todayStr
              );
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
          const summary = getCurrentPeriodSummary(get().planChanges, spentByDate, todayStr, incomeByDate);
          if (summary && summary.budget > 0) {
            const ratio = summary.spent / summary.budget;
            const periodKey = `${summary.cadence}_${summary.periodStart}`;

            if (ratio >= 1) {
              if (get().lastPeriodExceededKey !== periodKey) {
                // Who paid the overspend comes from the money waterfall (WAT-001), never from a separate guess.
                const { coveredByIncome: incomeCovered, coveredByGullak: gullakCovered } = overspendFundingBetweenDates(
                  runWaterfall({ records, expenses }),
                  summary.periodStart,
                  summary.periodEnd
                );
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

      checkAndRollover: (expenses?: Expense[], skipRolloverNotification = false) => {
        const currentUser = useAuthStore.getState().user;
        // P0.1: Must not run or finalize before hydrateFromSupabase has completed for this user!
        if (!currentUser || get().hydratedForUserId !== currentUser.id) {
          return;
        }

        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        let updated = false;

        applyScheduledNextDayBudget(get, set, todayStr);
        if (applyScheduledPlanChanges(get, set, todayStr)) {
          updated = true;
        }

        const isIncomeFn = buildCategoryClassifier();
        const isEligibleIncomeFn = buildEligibleIncomeClassifier();
        const resolvedExpenses = Array.isArray(expenses) ? expenses : getCurrentExpenses();

        const { spentByDate, incomeByDate } = groupSpentByDate(
          resolvedExpenses,
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

registerStoreResetCallback(() => {
  useDailyBudgetStore.getState().resetDailyBudget();
});
