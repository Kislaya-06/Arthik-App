import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { withTimeout } from '../../lib/networkUtils';
import { round2 } from '../../lib/formatters';
import { resolveHydratedDayBudget } from '../../lib/budgetUtils';
import { upsertPendingChange } from '../../lib/budgetPeriods';
import { evaluateDayStatus } from '../../lib/budgetCalculations';
import type { DailyRecord } from '../../lib/budgetCalculations';
import type { BudgetCadence, BudgetPlanChange, BudgetPeriodRecord } from '../../types';
import type { DailyBudgetState, ProfileSettingsPatch, GullakDeposit } from './types';
import { computeMetrics, isDailyOwnedDate } from './metrics';
import {
  getPendingSettingsKey,
  getPendingPlanChangesKey,
  getPendingBudgetPeriodsKey,
  getStoredList,
} from './pendingStorage';

// ---------------------------------------------------------------------------
// Hydration Helpers (Step 7e)
// ---------------------------------------------------------------------------

export async function waitForPersistHydration(store: any): Promise<void> {
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
        records[todayStr].status = records[todayStr].spent > resolvedBudget ? 'exceeded' : 'active';
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

export async function fetchRemoteBudgetData(userId: string) {
  const [profileRes, logsRes, plansRes, periodsRes] = await Promise.race([
    Promise.all([
      supabase
        .from('profiles')
        .select('daily_budget, is_auto_renew, is_budget_mode_enabled, budget_cadence, weekly_budget, monthly_budget')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('daily_savings_log')
        .select('date, amount_saved, spent_amount, status, budget_amount')
        .eq('user_id', userId)
        .order('date', { ascending: true }),
      supabase
        .from('budget_plan_changes')
        .select('id, effective_from, is_enabled, cadence, amount, carry_mode, carried_over_amount, created_at')
        .eq('user_id', userId)
        .order('effective_from', { ascending: true }),
      supabase
        .from('budget_periods')
        .select('id, cadence, period_start, period_end, active_start, active_end, budget_amount, spent_amount, amount_saved, status, is_prorated, carry_mode, carried_over_amount, created_at')
        .eq('user_id', userId)
        .order('active_start', { ascending: true }),
    ]),
    new Promise<[any, any, any, any]>((r) =>
      setTimeout(() => r([{ data: null }, { data: null }, { data: null }, { data: null }]), 3500)
    ),
  ]);

  return {
    profileData: profileRes?.data,
    logsData: logsRes?.data,
    plansData: plansRes?.data,
    periodsData: periodsRes?.data,
  };
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

export function selfHealDefaultBudget(params: {
  resolvedBudget: number;
  remoteBudgetWasMigrationDefault: boolean;
  logsData: any[] | null | undefined;
  userCreatedAtStr: string | null | undefined;
  spentByDate: Record<string, number>;
  records: Record<string, DailyRecord>;
  userId: string;
}): number {
  let { resolvedBudget } = params;
  const { remoteBudgetWasMigrationDefault, logsData, userCreatedAtStr, spentByDate, records, userId } = params;
  const budgetLooksWrong = remoteBudgetWasMigrationDefault || resolvedBudget === 500;
  if (budgetLooksWrong && logsData && logsData.length > 0) {
    const budgetCandidates: Record<number, number> = {};
    for (let i = 0; i < logsData.length; i++) {
      const logEntry = logsData[i] as {
        date: string;
        amount_saved?: number | string | null;
        budget_amount?: number | string | null;
        spent_amount?: number | string | null;
        status?: string | null;
      };
      const d = logEntry.date;
      if (userCreatedAtStr && d < userCreatedAtStr) continue;
      const amountSaved = Number(logEntry.amount_saved) || 0;
      const spent = spentByDate[d] || 0;

      // Check if past log had an explicit non-500 budget_amount saved
      if (logEntry.budget_amount !== null && logEntry.budget_amount !== undefined) {
        const b = round2(Number(logEntry.budget_amount));
        if (b > 0 && b !== 500) {
          budgetCandidates[b] = (budgetCandidates[b] || 0) + 2;
        }
      }

      // Check if local record for that day has a non-500 budget
      if (records[d]?.budget && records[d].budget > 0 && records[d].budget !== 500) {
        const b = round2(records[d].budget);
        budgetCandidates[b] = (budgetCandidates[b] || 0) + 2;
      }

      // On confirmed saved days, amount_saved + spent reveals the original day budget
      if (logEntry.status === 'saved' && amountSaved > 0) {
        const inferred = round2(amountSaved + spent);
        if (inferred > 0 && inferred !== 500) {
          budgetCandidates[inferred] = (budgetCandidates[inferred] || 0) + 1;
        }
      }
    }

    let bestCandidate = 0;
    let maxCount = 0;
    for (const [candidateStr, count] of Object.entries(budgetCandidates)) {
      const candidate = Number(candidateStr);
      if (count > maxCount) {
        maxCount = count;
        bestCandidate = candidate;
      }
    }

    // If we detected a consistent original non-500 budget, restore it!
    if (bestCandidate > 0 && bestCandidate !== 500) {
      resolvedBudget = bestCandidate;
      supabase.from('profiles').update({ daily_budget: resolvedBudget }).eq('id', userId).then(() => {});
    }
  }

  // If remote was 500 and no non-500 candidate was found, restore 500
  if (remoteBudgetWasMigrationDefault && resolvedBudget === 0) {
    resolvedBudget = 500;
  }

  return resolvedBudget;
}

export function selfHealCorruptedRows(params: {
  logsData: any[] | null | undefined;
  userCreatedAtStr: string | null | undefined;
  spentByDate: Record<string, number>;
  resolvedPlanChanges: BudgetPlanChange[];
  resolvedBudget: number;
  records: Record<string, DailyRecord>;
  incomeByDate: Record<string, number>;
  hydrateReimbByDate: Record<string, number>;
  userId: string;
}) {
  const {
    logsData,
    userCreatedAtStr,
    spentByDate,
    resolvedPlanChanges,
    resolvedBudget,
    records,
    incomeByDate,
    hydrateReimbByDate,
    userId,
  } = params;

  if (logsData && logsData.length > 0) {
    for (let i = 0; i < logsData.length; i++) {
      const log = logsData[i] as {
        date: string;
        amount_saved?: number | string | null;
        budget_amount?: number | string | null;
        spent_amount?: number | string | null;
        status?: string | null;
      };
      const d = log.date;
      if (userCreatedAtStr && d < userCreatedAtStr) {
        continue; // Ignore any erroneous pre-registration logs
      }

      const rawLogBudget = log.budget_amount !== null && log.budget_amount !== undefined ? Number(log.budget_amount) : null;
      const rawLogSaved = Number(log.amount_saved) || 0;
      const daySpent =
        log.spent_amount !== null && log.spent_amount !== undefined
          ? Number(log.spent_amount)
          : spentByDate[d] !== undefined
          ? spentByDate[d]
          : 0;

      // --- 1. DETERMINE TRUE DAY BUDGET ---
      const dayIsDailyOwned = isDailyOwnedDate(resolvedPlanChanges, d);
      const dayBudget = dayIsDailyOwned
        ? resolveHydratedDayBudget({
            rawLogBudget,
            localRecordBudget: records[d]?.budget,
            resolvedBudget,
          })
        : 0;

      // --- 2. RECALCULATE SAVED & STATUS ---
      const dayIncome = incomeByDate[d] || 0;
      const dayReimb = hydrateReimbByDate[d] || 0;
      const { saved: daySaved, status: evaluatedStatus } = evaluateDayStatus(dayBudget, daySpent, dayIncome, undefined, dayReimb);

      records[d] = {
        date: d,
        budget: dayBudget,
        spent: daySpent,
        saved: daySaved,
        isFinalized: true,
        status: evaluatedStatus,
        needsUpload: false,
      };

      // --- 3. SELF-HEAL SUPABASE CORRUPTED ROW ---
      const wasCorrupted =
        (rawLogBudget === 500 && dayBudget !== 500) ||
        rawLogSaved !== daySaved ||
        (rawLogBudget !== null && rawLogBudget !== dayBudget) ||
        log.status !== (evaluatedStatus === 'even' ? 'even' : daySaved > 0 ? 'saved' : evaluatedStatus === 'unknown' ? 'unknown' : 'missed');

      if (!dayIsDailyOwned && (rawLogBudget || 0) > 0) {
        // Wrong daily row for a weekly / monthly / Pure day: overwrite the server row too.
        supabase
          .from('daily_savings_log')
          .upsert(
            { user_id: userId, date: d, amount_saved: 0, spent_amount: daySpent, budget_amount: 0, status: 'unknown' },
            { onConflict: 'user_id,date' }
          )
          .then(() => {});
      } else if (wasCorrupted && dayBudget > 0) {
        supabase
          .from('daily_savings_log')
          .upsert(
            {
              user_id: userId,
              date: d,
              amount_saved: daySaved,
              spent_amount: daySpent,
              budget_amount: dayBudget,
              status: evaluatedStatus === 'even' ? 'even' : daySaved > 0 ? 'saved' : evaluatedStatus === 'unknown' ? 'unknown' : 'missed',
            },
            { onConflict: 'user_id,date' }
          )
          .then(() => {});
      }
    }
  }
}

export async function hydrateGullakDeposits(
  userId: string,
  localDeposits: GullakDeposit[]
): Promise<GullakDeposit[]> {
  let resolvedDeposits = localDeposits || [];
  try {
    const { data: depData, error: depError } = await withTimeout(
      supabase
        .from('gullak_deposits')
        .select('id, amount, date, note, source, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      3500,
      { data: null, error: new Error('timeout') }
    );

    if (!depError && depData) {
      const serverDeposits: GullakDeposit[] = (depData as Array<{
        id: string;
        amount: number | string;
        date: string;
        note?: string | null;
        source?: string | null;
        created_at?: string;
      }>).map((d) => ({
        id: d.id,
        amount: Number(d.amount) || 0,
        date: d.date,
        note: d.note || undefined,
        source: (d.source === 'income' || d.source === 'external') ? d.source : 'external',
        created_at: d.created_at || new Date().toISOString(),
      }));

      const serverIdSet = new Set(serverDeposits.map((d) => d.id));
      const missingOnServer = localDeposits.filter((d) => !serverIdSet.has(d.id));

      if (missingOnServer.length > 0) {
        missingOnServer.forEach((m) => {
          supabase
            .from('gullak_deposits')
            .insert({
              id: m.id,
              user_id: userId,
              amount: m.amount,
              date: m.date,
              note: m.note || null,
              source: m.source || 'external',
              created_at: m.created_at,
            })
            .then(() => {});
        });
      }

      resolvedDeposits = [...serverDeposits, ...missingOnServer].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    }
  } catch (depErr) {
    if (__DEV__) console.log('Error hydrating gullak_deposits from Supabase:', depErr);
  }
  return resolvedDeposits;
}
