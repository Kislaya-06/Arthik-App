import { round2 } from '../../lib/formatters';
import { resolveHydratedDayBudget } from '../../lib/budgetUtils';
import { evaluateDayStatus } from '../../lib/budgetCalculations';
import type { DailyRecord } from '../../lib/budgetCalculations';
import type { BudgetPlanChange } from '../../types';
import { isDailyOwnedDate } from './metrics';
import { supabase } from '../../config/supabase';

export interface RemoteSavingsLogEntry {
  date: string;
  amount_saved?: number | string | null;
  spent_amount?: number | string | null;
  status?: string | null;
  budget_amount?: number | string | null;
}

export function selfHealDefaultBudget(params: {
  resolvedBudget: number;
  remoteBudgetWasMigrationDefault: boolean;
  logsData: RemoteSavingsLogEntry[] | null | undefined;
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
      const logEntry: RemoteSavingsLogEntry = logsData[i];
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
  logsData: RemoteSavingsLogEntry[] | null | undefined;
  userCreatedAtStr: string | null | undefined;
  spentByDate: Record<string, number>;
  resolvedPlanChanges: BudgetPlanChange[];
  resolvedBudget: number;
  records: Record<string, DailyRecord>;
  incomeByDate: Record<string, number>;
  hydrateReimbByDate: Record<string, number>;
  userId: string;
}): void {
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
      const log = logsData[i];
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
