import { format, subDays } from 'date-fns';
import { round2 } from '../../lib/formatters';
import { supabase } from '../../config/supabase';
import {
  notifyRollover,
  notifyBudgetUpdated,
} from '../../lib/budgetAlerts';
import { resolveRolloverBudget } from '../../lib/budgetUtils';
import {
  buildPeriodsToFinalize,
  isDailyGovernedDate,
  resolvePlanForDate,
} from '../../lib/budgetPeriods';
import {
  evaluateDayStatus,
  computeSpentByDate,
  computeIncomeByDate,
  shouldIgnoreDuplicates,
  shouldSendRolloverNotification,
} from '../../lib/budgetCalculations';
import type { DailyRecord } from '../../lib/budgetCalculations';
import type { BudgetPeriodRecord } from '../../types';
import type { Expense } from '../expense/types';
import type { DailyBudgetState } from './types';
import {
  savePendingBudgetPeriodOffline,
  savePendingSettingsOffline,
  clearPendingSettingsOffline,
} from './pendingStorage';
import { useAuthStore } from '../authStore';
import { areExpensesLoaded } from './expenseBridge';
import {
  getUserCreatedAtLocalDate,
  isDailyOwnedDate,
  dailyCarryExtraFor,
} from './metrics';
import { balancePureDeficitIfNeeded } from './planActions';

export interface FinalizeDailyRecordsContext {
  get: () => DailyBudgetState;
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void;
  currentUser: { id: string; created_at?: string };
  records: Record<string, DailyRecord>;
  pastDates: Set<string>;
  spentByDate: Record<string, number>;
  incomeByDate: Record<string, number>;
  skipRolloverNotification: boolean;
}

export interface FinalizePeriodsContext {
  get: () => DailyBudgetState;
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void;
  currentUser: { id: string };
  todayStr: string;
  userCreatedAtStr?: string;
  spentByDate: Record<string, number>;
  incomeByDate: Record<string, number>;
  skipRolloverNotification: boolean;
}

export function applyScheduledNextDayBudget(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  todayStr: string
): void {
  // Apply scheduled next-day daily budget if date has advanced past scheduled day
  const scheduled = get().scheduledNextDailyBudget;
  const scheduledDate = get().scheduledBudgetSetDate;
  if (scheduled && scheduledDate && todayStr > scheduledDate) {
    get().setDailyBudget(scheduled);
    set({ scheduledNextDailyBudget: null, scheduledBudgetSetDate: null });

    if (get().isBudgetModeEnabled) {
      notifyBudgetUpdated(`scheduled_budget_${todayStr}`, scheduled, todayStr);
    }
  }
}

export function applyScheduledPlanChanges(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void,
  todayStr: string
): boolean {
  // A scheduled plan change takes effect on its effectiveFrom date, or on subsequent dates if the app was inactive (FIN-02)
  const activePlanForToday = resolvePlanForDate(get().planChanges || [], todayStr);
  if (activePlanForToday) {
    const isModeDiff = get().isBudgetModeEnabled !== activePlanForToday.isEnabled;
    const isCadenceDiff = activePlanForToday.isEnabled && get().budgetCadence !== activePlanForToday.cadence;
    const isAmountDiff =
      activePlanForToday.isEnabled &&
      activePlanForToday.amount > 0 &&
      (activePlanForToday.cadence === 'daily'
        ? get().dailyBudgetAmount !== activePlanForToday.amount
        : activePlanForToday.cadence === 'weekly'
        ? get().weeklyBudgetAmount !== activePlanForToday.amount
        : get().monthlyBudgetAmount !== activePlanForToday.amount);

    if (isModeDiff || isCadenceDiff || isAmountDiff) {
      if (activePlanForToday.isEnabled && !get().isBudgetModeEnabled) {
        balancePureDeficitIfNeeded(get, todayStr);
      }
      const amountPatch =
        activePlanForToday.isEnabled && activePlanForToday.amount > 0
          ? activePlanForToday.cadence === 'daily'
            ? { dailyBudgetAmount: activePlanForToday.amount }
            : activePlanForToday.cadence === 'weekly'
            ? { weeklyBudgetAmount: activePlanForToday.amount }
            : { monthlyBudgetAmount: activePlanForToday.amount }
          : {};

      const autoRenew = activePlanForToday.isEnabled
        ? (get().isBudgetModeEnabled ? get().isAutoRenew : true)
        : false;

      set({
        isBudgetModeEnabled: activePlanForToday.isEnabled,
        isAutoRenew: autoRenew,
        budgetCadence: activePlanForToday.isEnabled ? activePlanForToday.cadence : get().budgetCadence,
        ...amountPatch,
      });

      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        savePendingSettingsOffline(currentUser.id, {
          is_budget_mode_enabled: activePlanForToday.isEnabled,
          is_auto_renew: autoRenew,
          ...(activePlanForToday.isEnabled && activePlanForToday.cadence === 'daily' && activePlanForToday.amount > 0
            ? { daily_budget: activePlanForToday.amount }
            : {}),
        });
        supabase
          .from('profiles')
          .update({
            is_budget_mode_enabled: activePlanForToday.isEnabled,
            is_auto_renew: autoRenew,
            ...(activePlanForToday.isEnabled && activePlanForToday.cadence === 'daily' && activePlanForToday.amount > 0
              ? { daily_budget: activePlanForToday.amount }
              : {}),
          })
          .eq('id', currentUser.id)
          .then(({ error }) => {
            if (!error) {
              clearPendingSettingsOffline(currentUser.id, ['is_budget_mode_enabled', 'is_auto_renew']);
            }
          });
      }
      return true;
    }
  }
  return false;
}

export function groupSpentByDate(
  expenses: Expense[],
  isIncomeFn: (expense: Expense) => boolean,
  isEligibleIncomeFn: (expense: Expense) => boolean
): {
  spentByDate: Record<string, number>;
  incomeByDate: Record<string, number>;
} {
  // 1. Group all non-income expenses by date in a single O(N) pass
  const spentByDate = computeSpentByDate(expenses, isIncomeFn);
  const incomeByDate = computeIncomeByDate(expenses, isEligibleIncomeFn);
  return { spentByDate, incomeByDate };
}

export function collectPastDates(
  records: Record<string, DailyRecord>,
  spentByDate: Record<string, number>,
  todayStr: string
): Set<string> {
  // 2. Identify all past dates (< todayStr) from existing records and expenses
  const pastDates = new Set<string>();
  const recordKeys = Object.keys(records);
  for (let i = 0; i < recordKeys.length; i++) {
    if (recordKeys[i] < todayStr) {
      pastDates.add(recordKeys[i]);
    }
  }
  const expenseDates = Object.keys(spentByDate);
  for (let i = 0; i < expenseDates.length; i++) {
    if (expenseDates[i] < todayStr) {
      pastDates.add(expenseDates[i]);
    }
  }
  return pastDates;
}

export function finalizeDailyRecords(ctx: FinalizeDailyRecordsContext): { updated: boolean } {
  const {
    get,
    set,
    currentUser,
    records,
    pastDates,
    spentByDate,
    incomeByDate,
    skipRolloverNotification,
  } = ctx;

  let updated = false;
  const userCreatedAtStr = getUserCreatedAtLocalDate(currentUser?.created_at);
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Only add gap-fill for days that already have an existing record OR have real expenses.
  // Do NOT fabricate days the user never interacted with — that creates phantom history entries.
  // ponytail: deliberately skipping zero-activity days; upgrade = track "app open" events per day

  // 3. For every past date, verify if spent or saved or status changed (e.g. after edit/delete)
  for (const d of pastDates) {
    // D2: Daily loop only processes dates governed by 'daily'
    if (!isDailyGovernedDate(get().planChanges, d)) {
      // If a daily record does NOT already exist, do NOT create one for dates owned by weekly/monthly/paused!
      if (!records[d]) {
        continue;
      }
    }

    const isPreAccount = Boolean(userCreatedAtStr && d < userCreatedAtStr);
    if (isPreAccount) {
      // Backdated entry from before user account creation: do not create auto-renew daily record
      if (records[d]) {
        delete records[d];
        updated = true;
      }
      continue;
    }

    const existing = records[d];
    const spent = spentByDate[d] || 0;
    const dayIncome = incomeByDate[d] || 0;

    let budget = 0;
    let saved = 0;
    let status: 'saved' | 'missed' | 'even' | 'unknown' = 'unknown';

    // HEAL: a day owned by a weekly / monthly plan (or Pure Mode) must not carry a daily budget.
    // Old versions made one anyway, which put a second budget (and its leftover) into Gullak.
    const wrongDailyRecord =
      !!existing &&
      existing.status !== 'unknown' &&
      (existing.budget > 0 || (existing.saved || 0) > 0) &&
      !isDailyOwnedDate(get().planChanges, d);

    if (wrongDailyRecord) {
      status = 'unknown';
      budget = 0;
      saved = 0;
    } else if (existing && existing.status === 'unknown') {
      // Preserved untracked historical day
      status = 'unknown';
      budget = 0;
      saved = 0;
    } else if (existing && (existing.budget > 0 || existing.isFinalized)) {
      // Lock to budget-at-the-time persisted in existing record (resolved via pure helper)
      budget = resolveRolloverBudget(existing.budget, get().dailyBudgetAmount);
      const evaluated = evaluateDayStatus(budget, spent, dayIncome);
      saved = evaluated.saved;
      status = evaluated.status;
    } else if (!existing) {
      // Past date being finalized for the very first time with no prior record:
      // P1.3 (Option A): If auto-renew is active and budget > 0, use daily budget so streak & savings are preserved
      if (get().isAutoRenew && get().dailyBudgetAmount > 0) {
        budget = get().dailyBudgetAmount + dailyCarryExtraFor(d);
      } else if (spent > 0) {
        budget = 0;
      } else {
        // No prior record, 0 budget, 0 spent: skip
        continue;
      }
      const evaluated = evaluateDayStatus(budget, spent, dayIncome);
      saved = evaluated.saved;
      status = evaluated.status;
    } else {
      // Existing record with 0 budget (e.g. manual mode)
      if (get().isAutoRenew && get().dailyBudgetAmount > 0 && existing.budget === 0) {
        budget = get().dailyBudgetAmount + dailyCarryExtraFor(d);
      } else {
        budget = 0;
      }
      const evaluated = evaluateDayStatus(budget, spent, dayIncome);
      saved = evaluated.saved;
      status = evaluated.status;
    }

    const hasChanged =
      !existing ||
      !existing.isFinalized ||
      existing.spent !== spent ||
      existing.saved !== saved ||
      existing.status !== status ||
      existing.budget !== budget;

    if (hasChanged) {
      records[d] = {
        date: d,
        budget,
        spent,
        saved,
        isFinalized: true,
        status,
        needsUpload: true,
        ...(wrongDailyRecord ? { forceOverwrite: true } : {}),
      };
      updated = true;
      // Sync updated past day to Supabase daily_savings_log (async fire-and-forget with offline fallback)
      try {
        const supabaseStatus =
          status === 'unknown'
            ? 'unknown'
            : saved > 0
            ? 'saved'
            : status === 'even'
            ? 'even'
            : 'missed';

        const isInsertOnly = shouldIgnoreDuplicates(status) && !wrongDailyRecord;

        supabase
          .from('daily_savings_log')
          .upsert(
            {
              user_id: currentUser.id,
              date: d,
              amount_saved: saved,
              spent_amount: spent,
              status: supabaseStatus,
              budget_amount: budget,
            },
            { onConflict: 'user_id,date', ignoreDuplicates: isInsertOnly }
          )
          .then(
            ({ error }) => {
              if (!error) {
                const cur = get().dailyRecords;
                if (cur[d]) {
                  set({
                    dailyRecords: {
                      ...cur,
                      [d]: { ...cur[d], needsUpload: false, forceOverwrite: undefined },
                    },
                  });
                }
              } else if (__DEV__) {
                console.error('Error syncing updated daily_savings_log to Supabase:', error);
              }
            },
            () => {}
          );
      } catch {
        // Ignore offline/auth errors; needsUpload remains true
      }

      // Trigger notification for yesterday's savings rollover once confirmed expenses are loaded.
      const shouldNotify = shouldSendRolloverNotification({
        date: d,
        yesterdayStr,
        saved,
        isExpensesLoaded: areExpensesLoaded(),
        skipRolloverNotification,
        lastRolloverNotifiedDate: get().lastRolloverNotifiedDate,
      });

      if (get().isBudgetModeEnabled && shouldNotify) {
        notifyRollover({ id: `rollover_${d}`, cadence: 'daily', amount: saved, date: d });

        set({ lastRolloverNotifiedDate: d });
      }
    }
  }

  return { updated };
}

export function finalizePeriods(ctx: FinalizePeriodsContext): { updated: boolean } {
  const {
    get,
    set,
    currentUser,
    todayStr,
    userCreatedAtStr,
    spentByDate,
    incomeByDate,
    skipRolloverNotification,
  } = ctx;

  let updated = false;

  // 4. Multi-cadence period finalization (weekly / monthly)
  // Self-heal: once expenses are really loaded, re-evaluate every weekly/monthly period (not only
  // brand new ones). Older app versions added INCOME into the period budget and into Gullak savings,
  // so already-finalized periods may hold wrong numbers. Recomputing from budget + spending fixes
  // them for existing users. Never done before expenses are loaded (spent would look like 0).
  // PUR-002: a period that ended while the user was in Pure Mode does not send a notification.


  const existingPeriods = get().budgetPeriods;
  const canHealPeriods = areExpensesLoaded();
  const recomputedPeriods = buildPeriodsToFinalize(
    get().planChanges,
    spentByDate,
    todayStr,
    canHealPeriods ? [] : Object.keys(existingPeriods),
    userCreatedAtStr,
    incomeByDate
  );
  // Match old rows by cadence + activeStart (same as the DB unique key), not only by id,
  // so a healed period can never become a duplicate (which would double the Gullak savings).
  const prevByKey = new Map<string, BudgetPeriodRecord>();
  for (const ex of Object.values(existingPeriods)) {
    prevByKey.set(`${ex.cadence}_${ex.activeStart}`, ex);
  }
  const periodsToFinalize = recomputedPeriods
    .map((p) => {
      const prev = prevByKey.get(`${p.cadence}_${p.activeStart}`);
      return prev ? { ...p, id: prev.id, userId: prev.userId, createdAt: prev.createdAt || p.createdAt } : p;
    })
    .filter((p) => {
      const prev = prevByKey.get(`${p.cadence}_${p.activeStart}`);
      if (!prev) return true;
      return (
        round2(prev.budgetAmount) !== round2(p.budgetAmount) ||
        round2(prev.spentAmount) !== round2(p.spentAmount) ||
        round2(prev.amountSaved) !== round2(p.amountSaved) ||
        prev.status !== p.status
      );
    });

  if (periodsToFinalize.length > 0) {
    const periods = { ...get().budgetPeriods };
    for (const p of periodsToFinalize) {
      periods[p.id] = p;
      updated = true;

      // Sync to Supabase budget_periods with offline queue
      if (currentUser) {
        savePendingBudgetPeriodOffline(currentUser.id, p);
        supabase
          .from('budget_periods')
          .upsert(
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
          )
          .then(({ error }) => {
            if (!error) {
              // Synced successfully
            }
          });
      }

      // Rollover notification (D10)
      if (
        get().isBudgetModeEnabled &&
        !prevByKey.has(`${p.cadence}_${p.activeStart}`) &&
        p.amountSaved > 0 &&
        !skipRolloverNotification &&
        areExpensesLoaded() &&
        get().lastPeriodRolloverKey !== p.id
      ) {
        notifyRollover({
          id: `rollover_${p.id}`,
          cadence: p.cadence,
          amount: p.amountSaved,
          date: p.activeEnd,
          periodId: p.id,
        });

        set({ lastPeriodRolloverKey: p.id });
      }
    }
    set({ budgetPeriods: periods });
  }

  return { updated };
}
