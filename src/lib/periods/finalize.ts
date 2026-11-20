import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { round2 } from '../formatters';
import { calculateCycleFinancials } from '../budgetCalculations';
import { BudgetPlanChange, BudgetPeriodRecord, BudgetPeriodStatus } from '../../types';
import { getPeriodBounds, carryForPeriod, resolvePlanForDate, getDateOwner, BUDGET_RULES_V2_FROM } from './core';
import { buildBudgetPools, poolSpentBefore } from './pools';

export interface PeriodSlice {
  owner: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  activeStart: string;
  activeEnd: string;
  amount: number;
}

/**
 * 5. Builds weekly and monthly periods to finalize up to yesterday.
 * - Walks from the earliest non-daily/non-paused governed date to yesterday.
 * - Groups consecutive dates with the same owner AND same calendar period AND same amount into an active slice.
 * - Finalizable if: todayStr > periodEnd OR (slice ended early due to switch/disable AND todayStr > activeEnd).
 * - Zero-Proration Policy: budget = full user-entered amount (+ additive carry-over if any).
 * - Skips already finalized keys and dates before userCreatedAtStr.
 */
export function buildPeriodsToFinalize(
  changes: BudgetPlanChange[],
  spentByDate: Record<string, number>,
  todayStr: string,
  alreadyFinalizedKeys?: Set<string> | string[],
  userCreatedAtStr?: string,
  incomeByDate?: Record<string, number>
): BudgetPeriodRecord[] {
  const today = parseISO(todayStr);
  const yesterday = subDays(today, 1);
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
  const pools = buildBudgetPools(changes, todayStr);

  const finalizedSet = alreadyFinalizedKeys instanceof Set
    ? alreadyFinalizedKeys
    : new Set(alreadyFinalizedKeys || []);

  // Find all changes that could have enabled weekly or monthly
  const relevantChanges = (changes || []).filter(
    (c) => c.isEnabled && (c.cadence === 'weekly' || c.cadence === 'monthly')
  );
  if (relevantChanges.length === 0) return [];

  // Earliest date governed
  let earliestDateStr = relevantChanges.reduce((min, c) => {
    return c.effectiveFrom < min ? c.effectiveFrom : min;
  }, relevantChanges[0].effectiveFrom);

  if (userCreatedAtStr && userCreatedAtStr > earliestDateStr) {
    earliestDateStr = userCreatedAtStr;
  }

  if (earliestDateStr > yesterdayStr) {
    return [];
  }

  // Walk day-by-day from earliestDateStr to yesterdayStr
  const intervalDays = eachDayOfInterval({
    start: parseISO(earliestDateStr),
    end: yesterday,
  });

  const slices: PeriodSlice[] = [];
  let currentSlice: PeriodSlice | null = null;

  for (const d of intervalDays) {
    const dayStr = format(d, 'yyyy-MM-dd');
    const owner = getDateOwner(changes, dayStr);

    if (owner !== 'weekly' && owner !== 'monthly') {
      // Daily or paused: close active slice if any
      if (currentSlice) {
        slices.push(currentSlice);
        currentSlice = null;
      }
      continue;
    }

    const bounds = getPeriodBounds(owner, dayStr);
    const plan = resolvePlanForDate(changes, dayStr);
    const amount = plan ? plan.amount : 0;

    if (
      currentSlice &&
      currentSlice.owner === owner &&
      currentSlice.periodStart === bounds.start &&
      currentSlice.amount === amount
    ) {
      // Extend current slice
      currentSlice.activeEnd = dayStr;
    } else {
      // Close previous slice if exists
      if (currentSlice) {
        slices.push(currentSlice);
      }
      // Start new slice
      currentSlice = {
        owner,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        totalDays: bounds.totalDays,
        activeStart: dayStr,
        activeEnd: dayStr,
        amount,
      };
    }
  }

  if (currentSlice) {
    slices.push(currentSlice);
  }

  // Finalize eligible slices
  const recordsToFinalize: BudgetPeriodRecord[] = [];

  for (const slice of slices) {
    // A slice is finalizable if the full period has passed (todayStr > periodEnd)
    // OR if the slice ended early because ownership/amount changed (switch/disable) and todayStr > activeEnd
    const isPeriodEnded = todayStr > slice.periodEnd;

    let isEarlySliceEnded = false;
    let isCadenceSwitchEarlyEnd = false;
    if (slice.activeEnd < slice.periodEnd && todayStr > slice.activeEnd) {
      const nextDay = addDays(parseISO(slice.activeEnd), 1);
      const nextDayStr = format(nextDay, 'yyyy-MM-dd');
      const nextDayOwner = getDateOwner(changes, nextDayStr);
      const nextDayPlan = resolvePlanForDate(changes, nextDayStr);
      const nextDayAmount = nextDayPlan ? nextDayPlan.amount : 0;
      const nextDayBounds = getPeriodBounds(slice.owner, nextDayStr);

      if (
        nextDayOwner !== slice.owner ||
        nextDayAmount !== slice.amount ||
        nextDayBounds.start !== slice.periodStart
      ) {
        isEarlySliceEnded = true;
        if (nextDayOwner !== slice.owner) {
          isCadenceSwitchEarlyEnd = true;
        }
      }
    }

    if (!isPeriodEnded && !isEarlySliceEnded) {
      continue;
    }

    const key = `${slice.owner}_${slice.activeStart}`;
    if (finalizedSet.has(key)) {
      continue;
    }

    const slicePlan = resolvePlanForDate(changes, slice.activeStart);
    let baseBudget = slice.amount;
    // ADR 0012: a later slice of the SAME calendar period (after Pure Mode / a switch and back) does not get a
    // new full budget: it continues with what is left of the period's pool. Only for slices from the rule date on.
    let usePoolRemaining = false;
    const pool = pools[`${slice.owner}_${slice.periodStart}`];
    if (pool && slice.activeStart > pool.startedOn && slice.activeStart >= BUDGET_RULES_V2_FROM) {
      usePoolRemaining = true;
      baseBudget =
        pool.closedOn && slice.activeStart >= pool.closedOn
          ? 0
          : Math.max(0, round2(pool.budget - poolSpentBefore(pools, changes, pool, slice.activeStart, spentByDate)));
    }
    const carriedOver = slicePlan?.carriedOverAmount || 0;
    const carryMode = slicePlan?.carryMode;
    const isProrated = false;

    // Sum spend in active slice
    let spentAmount = 0;
    let sliceIncome = 0;
    const sliceDays = eachDayOfInterval({
      start: parseISO(slice.activeStart),
      end: parseISO(slice.activeEnd),
    });
    for (const sd of sliceDays) {
      const sdStr = format(sd, 'yyyy-MM-dd');
      spentAmount += Number(spentByDate[sdStr]) || 0;
      if (incomeByDate) {
        sliceIncome += Number(incomeByDate[sdStr]) || 0;
      }
    }
    spentAmount = round2(spentAmount);
    sliceIncome = round2(sliceIncome);

    const fin = calculateCycleFinancials({
      scheduledBudget: baseBudget,
      carriedOverAmount: usePoolRemaining ? 0 : carryForPeriod(slicePlan, slice.periodStart),
      // Income never rolls into Gullak: only unspent budget does.
      eligibleIncome: 0,
      spent: spentAmount,
    });

    const budgetAmount = fin.spendable;
    const unspentInSlice = fin.remaining;

    // GOLDEN INVARIANT (Audio Clips 1 & 3):
    // Gullak deposits ONLY happen when a period ends naturally!
    // If a period slice ends early due to a cadence switch, amountSaved = 0 (Gullak gets 0).
    const amountSaved = isCadenceSwitchEarlyEnd
      ? 0
      : budgetAmount <= 0
      ? 0
      : fin.gullakDeposit;

    let status: BudgetPeriodStatus = fin.status;

    recordsToFinalize.push({
      id: key,
      userId: '',
      cadence: slice.owner,
      periodStart: slice.periodStart,
      periodEnd: slice.periodEnd,
      activeStart: slice.activeStart,
      activeEnd: slice.activeEnd,
      budgetAmount,
      spentAmount,
      amountSaved,
      status,
      isProrated,
      carriedOverAmount: isCadenceSwitchEarlyEnd ? unspentInSlice : carriedOver,
      carryMode,
      createdAt: todayStr,
    });
  }

  return recordsToFinalize;
}
