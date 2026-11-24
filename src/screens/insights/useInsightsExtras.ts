/**
 * Data for the Insights sections added on 2026-11-25 ("Where you're heading", "Your habits",
 * "Money with others & Gullak", the year story). Kept apart from useInsightsData so that hook does not grow.
 * Every number comes from the pure helpers in src/lib/insights/ (rules INS-007..INS-011).
 */
import { useMemo } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { useDailyBudgetStore } from '../../store/dailyBudgetStore';
import { useAuthStore } from '../../store/authStore';
import { AllowanceHistory } from '../../money/budgetAllowance';
import { addDaysToDateKey, toDateKey } from '../../money/dateKeys';
import { buildLedgerEntries, spendingTotalsByDateKey } from '../../money/ledger';
import { computeWaterfallFromState, summarizeScope } from '../../lib/moneyWaterfall';
import { computeMonthlyGullakSavings } from '../../lib/monthlyInsightsUtils';
import {
  computeNoSpendDays, computeSmallLeaks, computeCategoryVsAverage, computeTimeOfDay, computeTopPlaces, DateRange,
} from '../../lib/insights/habits';
import { computeSpendingProjection, computeRunway, computeGullakEta, GULLAK_PACE_DAYS } from '../../lib/insights/forecast';
import { computeSplitSummary, computeGullakSources, computeBestWorstMonth } from '../../lib/insights/moneyFlows';
import { buildYearStory } from '../../lib/insights/yearStory';
import { buildInterval, Period } from './periodUtils';

interface Params {
  period: Period;
  offset: number;
  currentInterval: { start: Date; end: Date };
  /** Budget pool the hero shows (Budget Mode, Weekly / Monthly), the projection target (INS-007). */
  budgetPool: number | null;
  allowanceHistory: AllowanceHistory;
  yearlyInflow: number;
  /** Money added to Gullak in the viewed year (Yearly tab). */
  yearlyGullakAdded: number;
  /** Changes when the day changes, so "today" stays right. */
  focusTime: number;
}

const rangeOf = (i: { start: Date; end: Date }): DateRange => ({ start: toDateKey(i.start), end: toDateKey(i.end) });

export function useInsightsExtras(p: Params) {
  const expenses = useExpenseStore((s) => s.expenses);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const gullak = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
  const getTotalAccountRemaining = useDailyBudgetStore((s) => s.getTotalAccountRemaining);
  const userCreatedAt = useAuthStore((s) => s.user?.created_at);

  const { period, offset, currentInterval, budgetPool, allowanceHistory, yearlyInflow, yearlyGullakAdded, focusTime } = p;
  const todayKey = toDateKey(new Date(focusTime));
  const userCreatedKey = userCreatedAt ? toDateKey(new Date(userCreatedAt)) : null;
  const range = useMemo(() => rangeOf(currentInterval), [currentInterval]);

  const spentByDate = useMemo(() => spendingTotalsByDateKey(buildLedgerEntries(expenses)), [expenses]);

  // Same waterfall the Home hero and the Gullak total run (GUL-008): where Gullak money was drawn for overspending.
  const waterfall = useMemo(
    () =>
      computeWaterfallFromState({
        expenses,
        deposits: gullakDeposits,
        isBudgetModeEnabled,
        isAutoRenew,
        todayStr: todayKey,
        todayBudget: dailyRecords[todayKey]?.budget,
        dailyBudgetAmount,
        records: dailyRecords,
        planChanges,
      }),
    [expenses, gullakDeposits, isBudgetModeEnabled, isAutoRenew, todayKey, dailyRecords, dailyBudgetAmount, planChanges]
  );
  const gullakDrawnBetween = (start: string, end: string) =>
    summarizeScope(waterfall, (d) => d >= start && d <= end).gullakDrawn;
  const gullakInBetween = (start: string, end: string) =>
    computeMonthlyGullakSavings(dailyRecords, gullakDeposits, { start: new Date(`${start}T00:00:00`), end: new Date(`${end}T00:00:00`) }, budgetPeriods);

  // ─── Where you're heading ───────────────────────────────────────────────
  const heading = useMemo(() => {
    const isCurrent = offset === 0 && period !== 'Yearly';
    let projection = null;
    if (isCurrent) {
      // Pure Mode compares with the previous full period's spending (INS-007).
      const prev = rangeOf(buildInterval(period, -1));
      const prevSpent = Object.entries(spentByDate).reduce((s, [d, v]) => (d >= prev.start && d <= prev.end ? s + v : s), 0);
      const target = isBudgetModeEnabled ? budgetPool : prevSpent;
      projection = computeSpendingProjection(expenses, range, todayKey, period === 'Weekly' ? 3 : 4, target);
    }
    const runway =
      offset === 0 && period === 'Monthly'
        ? computeRunway(getTotalAccountRemaining(), gullak, spentByDate, todayKey, userCreatedKey)
        : null;
    let gullakEta = null;
    if (isBudgetModeEnabled && period !== 'Weekly' && offset === 0) {
      const from = addDaysToDateKey(todayKey, -GULLAK_PACE_DAYS);
      const to = addDaysToDateKey(todayKey, -1);
      gullakEta = computeGullakEta(gullak, gullakInBetween(from, to).totalSaved, gullakDrawnBetween(from, to));
    }
    return { projection, runway, gullakEta, isPureMode: !isBudgetModeEnabled };
  }, [period, offset, range, todayKey, expenses, spentByDate, budgetPool, isBudgetModeEnabled, gullak, getTotalAccountRemaining, userCreatedKey, waterfall, dailyRecords, gullakDeposits, budgetPeriods]);

  // ─── Your habits ────────────────────────────────────────────────────────
  const habits = useMemo(() => {
    const noSpend = computeNoSpendDays(spentByDate, range, todayKey, userCreatedKey);
    const timeOfDay = computeTimeOfDay(expenses, range);
    const showMonthYear = period !== 'Weekly';
    const smallLeaks = showMonthYear ? computeSmallLeaks(expenses, range) : null;
    const topPlaces = showMonthYear ? computeTopPlaces(expenses, range) : [];
    let categoryShifts: ReturnType<typeof computeCategoryVsAverage> = [];
    if (period !== 'Yearly') {
      const n = period === 'Weekly' ? 4 : 3;
      const baselines = Array.from({ length: n }, (_, i) => rangeOf(buildInterval(period, offset - 1 - i)));
      categoryShifts = computeCategoryVsAverage(expenses, range, baselines);
      // An unfinished period is still filling up: a "drop" there only means the days have not come yet.
      if (range.end >= todayKey) categoryShifts = categoryShifts.filter((s) => s.ratio > 1);
    }
    return { noSpend, timeOfDay, smallLeaks, topPlaces, categoryShifts };
  }, [period, offset, range, todayKey, userCreatedKey, expenses, spentByDate]);

  // ─── Money with others & Gullak ─────────────────────────────────────────
  const others = useMemo(() => {
    if (period === 'Weekly') return { split: null, gullakSources: null, bestWorst: null };
    const split = computeSplitSummary(expenses, range, todayKey);
    const gullakSources = isBudgetModeEnabled
      ? computeGullakSources(gullakInBetween(range.start, range.end).autoSaved, gullakDeposits, gullakDrawnBetween(range.start, range.end), range)
      : null;
    const bestWorst =
      period === 'Yearly'
        ? computeBestWorstMonth(expenses, gullakDeposits, allowanceHistory, currentInterval.start.getFullYear(), todayKey, userCreatedKey)
        : null;
    return { split, gullakSources, bestWorst };
  }, [period, range, todayKey, expenses, isBudgetModeEnabled, gullakDeposits, waterfall, dailyRecords, budgetPeriods, allowanceHistory, currentInterval, userCreatedKey]);

  const yearStory = useMemo(() => {
    if (period !== 'Yearly') return null;
    return buildYearStory({
      year: currentInterval.start.getFullYear(),
      rows: expenses,
      todayKey,
      userCreatedKey,
      inflow: yearlyInflow,
      bestWorst: others.bestWorst,
      gullakAdded: isBudgetModeEnabled ? yearlyGullakAdded : null,
    });
  }, [period, currentInterval, expenses, todayKey, userCreatedKey, yearlyInflow, others.bestWorst, isBudgetModeEnabled, yearlyGullakAdded]);

  return { heading, habits, others, yearStory };
}

export type InsightsExtras = ReturnType<typeof useInsightsExtras>;
