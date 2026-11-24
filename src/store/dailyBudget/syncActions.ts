import type { StoreApi } from 'zustand';
import { syncAllowancePauses } from './allowancePauseSync';
import type { Expense } from '../expense/types';
import { getTodayDateStr, getUserCreatedAtLocalDate, isDailyOwnedDate, dailyCarryExtraFor, healZeroTodayAllowance, runWaterfall, computeMetrics } from './metrics';
import { evaluateDayStatus, computeSpentByDate, computeSpentForDate, computeIncomeByDate, computeIncomeForDate, shouldIgnoreDuplicates } from '../../lib/budgetCalculations';
import { calculateBudgetStatus } from '../../money/budgetStatus';
import { overspendFundingBetweenDates } from '../../money/overspendFunding';
import { notifyLimit } from '../../lib/budgetAlerts';
import { getCurrentPeriodSummary } from '../../lib/budgetPeriods';
import { useAuthStore } from '../authStore';
import { hasDeficitCheckPending, clearDeficitCheckPending } from './deficitCheck';
import { getCurrentExpenses, areExpensesFreshFromServer } from './expenseBridge';
import { balancePureDeficit } from './planActions';
import { applyScheduledNextDayBudget, applyScheduledPlanChanges, groupSpentByDate, collectPastDates, finalizeDailyRecords, finalizePeriods } from './rollover';
import { supabase } from '../../config/supabase';
import type { DailyBudgetState } from './types';

/**
 * createSyncActions: actions of useDailyBudgetStore moved here verbatim (facade split, AGENTS.md 6.1).
 * They receive the store's own set / get, so they never import the store (no circular import).
 */
export const createSyncActions = (
  set: StoreApi<DailyBudgetState>['setState'],
  get: StoreApi<DailyBudgetState>['getState']
): Pick<DailyBudgetState, 'syncWithExpenses' | 'checkAndRollover' | 'uploadPendingDailyRecords'> => ({
  syncWithExpenses: (expenses: Expense[]) => {
    const todayStr = getTodayDateStr();
    const records = { ...get().dailyRecords };

    const todaySpent = computeSpentForDate(expenses, todayStr);
    const todayEligibleIncome = computeIncomeForDate(expenses, todayStr);

    let todayRecord = records[todayStr];
    let hasTodayChanged = false;

    const isBudgetOn = get().isBudgetModeEnabled;
    const healedToday = healZeroTodayAllowance(get(), todayRecord, todayStr, todaySpent, todayEligibleIncome);

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
    } else if (healedToday) {
      // FIN-16: Budget Mode + auto-save + a daily plan are on, but today's unfinalized record still says 0
      // (it was written while the day was in Pure Mode). Give the day its allowance. A paused allowance
      // (auto-save OFF) never gets here.
      todayRecord = healedToday;
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
      const spentByDate = computeSpentByDate(expenses);
      const incomeByDate = computeIncomeByDate(expenses);
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
        get().budgetCadence
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

    // PUR-001 on a cold start: the deficit check left by the start-up hydration runs ONCE, as soon as the expense
    // list comes from the server. The marker is cleared first, so it can never run twice. It runs before the
    // records are copied below, because adding the income re-enters this function.
    if (hasDeficitCheckPending(currentUser.id) && areExpensesFreshFromServer()) {
      void clearDeficitCheckPending(currentUser.id);
      if (get().isBudgetModeEnabled) {
        balancePureDeficit(get, todayStr, { excludeTodayAllowance: true });
      }
    }

    const records = { ...get().dailyRecords };
    let updated = false;

    applyScheduledNextDayBudget(get, set, todayStr);
    const planApplied = applyScheduledPlanChanges(get, set, todayStr);
    if (planApplied) {
      updated = true;
    }

    const resolvedExpenses = Array.isArray(expenses) ? expenses : getCurrentExpenses();

    // FIN-16: a scheduled switch to Budget Mode just matured. Today's record (written while the day was still in
    // Pure Mode) has budget 0, so give it the allowance here, on this pass's copy of the records, or the write at
    // the end of this function would put the zero back.
    if (planApplied) {
      const healed = healZeroTodayAllowance(
        get(),
        records[todayStr],
        todayStr,
        computeSpentForDate(resolvedExpenses, todayStr),
        computeIncomeForDate(resolvedExpenses, todayStr)
      );
      if (healed) {
        records[todayStr] = healed;
      }
    }

    const { spentByDate, incomeByDate } = groupSpentByDate(
      resolvedExpenses
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
      get().budgetCadence
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
    await syncAllowancePauses(currentUser.id);
  },
});
