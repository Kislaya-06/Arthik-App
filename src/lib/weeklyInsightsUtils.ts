import { parseISO, format, differenceInCalendarDays, getDay, addDays } from 'date-fns';
import { sumSpendingBetweenDateKeys, buildLedgerEntries } from '../money/ledger';
import { addDaysToDateKey, isDateKeyWithin } from '../money/dateKeys';
import { budgetAllowedBetweenDates } from '../money/budgetAllowance';
import { calculateBudgetStatus } from '../money/budgetStatus';
import { formatCurrency, formatAmountWithCommas, round2 } from './formatters';
import { ExpenseLike, toDateStr, isDateInBounds } from './insightsCommon';
import type { DailyRecord, GullakDeposit } from '../store/dailyBudgetStore';
import type { Category } from '../store/categoryStore';
import type { BudgetCadence, BudgetPeriodRecord } from '../types';

export { ExpenseLike };

export interface WeekInterval {
  start: Date;
  end: Date;
}

export interface DaySpendingData {
  day: string;
  dateStr: string;
  amount: number;
}

// ─── Group 1: Analytics / Data Calculations ───────────────────────────────────

/**
 * Calculates total weekly outflow for non-income transactions within the given week interval.
 */
export function computeWeeklySpend(
  expenses: ExpenseLike[],
  categories: Category[],
  weekInterval: WeekInterval
): number {
  return sumSpendingBetweenDateKeys(expenses, categories, toDateStr(weekInterval.start), toDateStr(weekInterval.end));
}

/**
 * Derives the user's active weekly budget, correctly handling mid-week joiners.
 * If user registered mid-week during this interval, budget is capped to active days.
 */
export function computeEffectiveWeekBudget(
  cadence: 'daily' | 'weekly' | 'monthly',
  dailyAmount: number,
  weeklyAmount: number,
  userCreatedAtStr: string | undefined | null,
  weekInterval: WeekInterval,
  monthlyAmount?: number
): { effectiveBudget: number; activeDays: number; isPartialFirstWeek: boolean } {
  const startStr = toDateStr(weekInterval.start);
  const endStr = toDateStr(weekInterval.end);

  let activeDays = 7;
  let isPartialFirstWeek = false;

  if (userCreatedAtStr) {
    const cleanCreated = toDateStr(userCreatedAtStr);
    if (cleanCreated && isDateInBounds(cleanCreated, startStr, endStr)) {
      const remainingDays = differenceInCalendarDays(parseISO(endStr), parseISO(cleanCreated)) + 1;
      if (remainingDays > 0 && remainingDays < 7) {
        activeDays = remainingDays;
        isPartialFirstWeek = true;
      }
    }
  }

  let effectiveBudget = 0;
  if (cadence === 'weekly') {
    effectiveBudget = isPartialFirstWeek
      ? round2((weeklyAmount / 7) * activeDays)
      : weeklyAmount;
  } else if (cadence === 'monthly') {
    // One rule for every screen (BUD-009): each day is worth monthly / the days of ITS OWN calendar month.
    // The active days are the LAST `activeDays` days of the week (the user joined mid-week).
    const monthlyBudgetPlan = { cadence: 'monthly' as const, monthlyBudgetAmount: Number(monthlyAmount) || 0 };
    const firstActiveDateKey = addDaysToDateKey(endStr, -(activeDays - 1));
    effectiveBudget = round2(budgetAllowedBetweenDates(monthlyBudgetPlan, firstActiveDateKey, endStr));
  } else {
    // daily cadence
    effectiveBudget = round2(dailyAmount * activeDays);
  }

  return { effectiveBudget, activeDays, isPartialFirstWeek };
}

/**
 * Computes remaining budget and overspend amounts.
 */
export function computeBudgetHealth(
  weekBudget: number,
  weekSpent: number
): { remaining: number; overAmount: number; isOverBudget: boolean; ratio: number } {
  const status = calculateBudgetStatus(weekBudget, weekSpent);
  return {
    remaining: status.budgetLeftUnspent,
    overAmount: status.amountSpentOverBudget,
    isOverBudget: status.isOverBudget,
    ratio: round2(status.budgetUsedRatio),
  };
}

/**
 * Calculates safe daily spending pace for remaining days of the current week.
 *
 * @param remaining Remaining budget cushion.
 * @param elapsedDays Number of days that have elapsed in the week so far (1 for Monday, 7 for Sunday).
 */
export function computeSafeDailyPace(remaining: number, elapsedDays: number): number {
  const safeElapsed = Math.min(7, Math.max(1, elapsedDays));
  const daysLeft = Math.max(1, 7 - safeElapsed);
  return Math.round(remaining / daysLeft);
}

/**
 * Option 2 Helper: Evaluates a Monthly budget user's spend share during a single week.
 * Benchmark: A standard week is ~23-25% of a full month.
 */
export interface WeeklyMonthlyBudgetShare {
  percentage: number;
  status: 'on_track' | 'heavy' | 'critical';
  pillText: string;
  subtext: string;
}

export function computeWeeklyShareOfMonthlyBudget(
  weekSpent: number,
  monthlyBudgetAmount: number
): WeeklyMonthlyBudgetShare {
  const mBudget = Number(monthlyBudgetAmount) || 0;
  if (mBudget <= 0) {
    return {
      percentage: 0,
      status: 'on_track',
      pillText: '🟢 On Track',
      subtext: `₹${formatAmountWithCommas(String(weekSpent))} spent`,
    };
  }

  const percentage = Math.round((weekSpent / mBudget) * 100);
  const status: 'on_track' | 'heavy' | 'critical' =
    percentage > 50 ? 'critical' : percentage > 25 ? 'heavy' : 'on_track';
  const pillText = percentage > 25 ? '⚠️ High Burn' : '🟢 On Track';
  const subtext = `₹${formatAmountWithCommas(String(weekSpent))} of ₹${formatAmountWithCommas(String(mBudget))} pool`;

  return {
    percentage,
    status,
    pillText,
    subtext,
  };
}

/**
 * Aggregates Gullak savings for the week: finalized daily budget rollovers + finalized weekly periods + manual deposits.
 * Seamlessly handles cadence switches (Daily + Weekly slices) without double counting.
 */
export function computeWeeklyGullakSavings(
  dailyRecords: Record<string, DailyRecord>,
  gullakDeposits: GullakDeposit[],
  weekInterval: WeekInterval,
  budgetPeriods?: Record<string, BudgetPeriodRecord> | BudgetPeriodRecord[],
  cadence?: BudgetCadence
): {
  totalSaved: number;
  autoSaved: number;
  manualDeposits: number;
  savedDaysCount: number;
  savedWeeksCount: number;
  pillLabel: string;
} {
  const startStr = toDateStr(weekInterval.start);
  const endStr = toDateStr(weekInterval.end);

  let autoSaved = 0;
  let savedDaysCount = 0;
  let savedWeeksCount = 0;

  // 1. Finalized daily records
  Object.values(dailyRecords || {}).forEach((r) => {
    if (!r.date) return;
    const cleanDate = toDateStr(r.date);
    if (isDateInBounds(cleanDate, startStr, endStr) && r.isFinalized) {
      if (r.status === 'saved' && (r.saved || 0) > 0) {
        autoSaved += r.saved;
        savedDaysCount++;
      }
    }
  });

  // 2. Finalized budget periods (Weekly cadence)
  const periodsList = Array.isArray(budgetPeriods)
    ? budgetPeriods
    : Object.values(budgetPeriods || {});

  for (const p of periodsList) {
    if (!p) continue;
    if (p.cadence === 'weekly' && p.status === 'saved' && (p.amountSaved || 0) > 0) {
      if (
        (p.activeStart && isDateInBounds(p.activeStart, startStr, endStr)) ||
        (p.activeEnd && isDateInBounds(p.activeEnd, startStr, endStr))
      ) {
        autoSaved += Number(p.amountSaved) || 0;
        savedWeeksCount++;
        if (p.activeStart && p.activeEnd) {
          const span = differenceInCalendarDays(parseISO(p.activeEnd), parseISO(p.activeStart)) + 1;
          savedDaysCount += Math.max(1, span);
        } else {
          savedDaysCount += 7;
        }
      }
    }
  }

  // 3. Manual deposits
  let manualDeposits = 0;
  (gullakDeposits || []).forEach((dep) => {
    if (!dep.date) return;
    const cleanDate = toDateStr(dep.date);
    if (cleanDate && isDateInBounds(cleanDate, startStr, endStr)) {
      manualDeposits += Number(dep.amount) || 0;
    }
  });

  const totalSaved = round2(autoSaved + manualDeposits);

  let pillLabel = `🐷 ${savedDaysCount} ${savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}`;
  if (cadence === 'weekly') {
    pillLabel = `🐷 ${savedWeeksCount} ${savedWeeksCount === 1 ? 'Saved Week' : 'Saved Weeks'}`;
  }

  return {
    totalSaved,
    autoSaved: round2(autoSaved),
    manualDeposits: round2(manualDeposits),
    savedDaysCount,
    savedWeeksCount,
    pillLabel,
  };
}

// ─── Group 2: Insight Engine ──────────────────────────────────────────────────

export interface SmartTakeawayResult {
  text: string;
  status: 'mint' | 'coral' | 'neutral';
}

export interface TakeawayEngineParams {
  currentTotal: number;
  isBudgetMode: boolean;
  isOverBudget: boolean;
  overAmount: number;
  peakDayName?: string | null;
  savedDaysCount: number;
  weekSavings: number;
  topCategory?: { name: string; percentage: number } | null;
  isCurrentWeek: boolean;
  safeDailyPace: number;
  transactionCount: number;
  dailyAverageBurn: number;
  cadence?: BudgetCadence;
  savedWeeksCount?: number;
  monthlyBudgetShare?: WeeklyMonthlyBudgetShare | null;
  monthlyBudgetAmount?: number;
}

/**
 * Evaluates the Smart Weekly Takeaway using a strict priority engine.
 */
export function computeSmartWeeklyTakeaway(params: TakeawayEngineParams): SmartTakeawayResult {
  const {
    currentTotal,
    isBudgetMode,
    isOverBudget,
    overAmount,
    peakDayName,
    savedDaysCount,
    weekSavings,
    topCategory,
    isCurrentWeek,
    safeDailyPace,
    transactionCount,
    dailyAverageBurn,
    cadence,
    savedWeeksCount,
    monthlyBudgetShare,
    monthlyBudgetAmount,
  } = params;

  // 1. Zero Spend
  if (currentTotal === 0) {
    return {
      text: 'No expenses logged this week.',
      status: 'neutral',
    };
  }

  // Monthly Cadence Burn / Share Insight (Option 2)
  if (isBudgetMode && cadence === 'monthly' && monthlyBudgetShare) {
    if (monthlyBudgetShare.status === 'heavy' || monthlyBudgetShare.status === 'critical') {
      return {
        text: `High burn week: spent ${monthlyBudgetShare.percentage}% of monthly budget in 1 week. Pace daily spend through month-end.`,
        status: 'coral',
      };
    }
    if (monthlyBudgetShare.status === 'on_track') {
      const mAmt = monthlyBudgetAmount || 0;
      return {
        text: `Healthy pacing: spent ${monthlyBudgetShare.percentage}% of monthly budget this week (₹${formatAmountWithCommas(String(currentTotal))} of ₹${formatAmountWithCommas(String(mAmt))}).`,
        status: 'mint',
      };
    }
  }

  // 2. Over-budget
  if (isBudgetMode && isOverBudget) {
    const peakText = peakDayName ? ` ${peakDayName} had the highest outflow.` : '';
    return {
      text: `Weekly spend exceeded budget by ₹${formatAmountWithCommas(String(overAmount))}.${peakText}`,
      status: 'coral',
    };
  }

  // 3. High Savings Discipline (weekly budget under budget OR 5+ saved daily records)
  if (isBudgetMode && weekSavings > 0) {
    if (cadence === 'weekly' && (savedWeeksCount || 0) >= 1) {
      return {
        text: `Great discipline! Stayed under weekly budget · +₹${formatAmountWithCommas(String(weekSavings))} saved to Gullak.`,
        status: 'mint',
      };
    }
    if (savedDaysCount >= 5) {
      return {
        text: `Great discipline! Stayed under budget on ${savedDaysCount} of 7 days · +₹${formatAmountWithCommas(String(weekSavings))} saved to Gullak.`,
        status: 'mint',
      };
    }
  }

  // 4. Dominant Category (Taking 50%+ of week)
  if (topCategory && topCategory.percentage >= 50) {
    return {
      text: `${topCategory.name} took ${topCategory.percentage}% of this week's money.`,
      status: 'neutral',
    };
  }

  // 5. In-progress Safe Pace
  if (isBudgetMode && isCurrentWeek && safeDailyPace > 0) {
    return {
      text: `On track: ₹${formatAmountWithCommas(String(safeDailyPace))}/day remaining daily cushion through Sunday.`,
      status: 'mint',
    };
  }

  // 6. Default balanced summary
  if (transactionCount > 0) {
    return {
      text: `Completed ${transactionCount} transactions this week with ₹${formatAmountWithCommas(String(Math.round(dailyAverageBurn)))}/day average burn.`,
      status: 'neutral',
    };
  }

  return {
    text: 'Balanced weekly spending flow.',
    status: 'neutral',
  };
}

export interface LargestOutflowResult {
  expense: ExpenseLike;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  outflowPercent: number;
  shouldShowPill: boolean;
}

/**
 * Identifies the single largest non-income transaction and applies the relevance threshold.
 */
export function computeLargestSingleOutflow(
  expenses: ExpenseLike[],
  categories: Category[],
  weekInterval: WeekInterval,
  currentTotal: number
): LargestOutflowResult | null {
  const startStr = toDateStr(weekInterval.start);
  const endStr = toDateStr(weekInterval.end);

  const weekExpenses: ExpenseLike[] = [];
  const entries = buildLedgerEntries(expenses, categories);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.kind === 'spending' && entry.dateKey && isDateKeyWithin(entry.dateKey, startStr, endStr)) {
      weekExpenses.push(expenses[i]);
    }
  }

  if (weekExpenses.length === 0) {
    return null;
  }

  const maxExpense = weekExpenses.reduce((max, e) => (e.amount > max.amount ? e : max), weekExpenses[0]);
  const cat = maxExpense.category_id ? categories.find((c) => c.id === maxExpense.category_id) : undefined;
  const categoryName = cat?.name || (maxExpense.category_id === 'others' ? 'Others' : 'General');
  const categoryColor = cat?.color || '#F07167';
  const categoryIcon = cat?.icon;

  const outflowPercent = currentTotal > 0 ? Math.round((maxExpense.amount / currentTotal) * 100) : 0;
  // Threshold rule: only show percentage pill if amount >= 100 AND percentage >= 15%
  const shouldShowPill = maxExpense.amount >= 100 && outflowPercent >= 15;

  return {
    expense: maxExpense,
    categoryName,
    categoryColor,
    categoryIcon,
    outflowPercent,
    shouldShowPill,
  };
}

export interface WeekdayVsWeekendResult {
  mode: 'weekend_split' | 'daily_burn';
  title: string;
  headline: string;
  detail: string;
  pillText: string;
  weekendSharePercent: number;
}

/**
 * Calculates Weekday vs Weekend spending dynamics with adaptive mid-week fallback.
 */
export function computeWeekdayVsWeekendDynamics(
  weeklyData: DaySpendingData[],
  currentTotal: number,
  offset: number,
  referenceNow: Date = new Date()
): WeekdayVsWeekendResult {
  const currentDay = getDay(referenceNow); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const isWeekendNow = currentDay === 0 || currentDay === 6;
  const isPastWeek = offset < 0;

  // Mode: Weekend Split if past week OR Saturday/Sunday of current week
  if (isPastWeek || isWeekendNow) {
    let weekdayTotal = 0;
    let weekendTotal = 0;

    weeklyData.forEach((d, i) => {
      // Index 0..4 = Mon..Fri; Index 5..6 = Sat..Sun
      if (i < 5) {
        weekdayTotal += d.amount;
      } else {
        weekendTotal += d.amount;
      }
    });

    const weekdayAvg = Math.round(weekdayTotal / 5);
    const weekendAvg = Math.round(weekendTotal / 2);
    const weekendSharePercent = currentTotal > 0 ? Math.round((weekendTotal / currentTotal) * 100) : 0;

    let headline = 'Evenly balanced spending';
    if (weekendAvg > weekdayAvg && weekdayAvg > 0) {
      const ratio = (weekendAvg / weekdayAvg).toFixed(1);
      headline = `${ratio}x higher on weekends`;
    } else if (weekdayAvg > weekendAvg && weekendAvg > 0) {
      headline = 'Disciplined weekend spending';
    } else if (weekendTotal > 0 && weekdayTotal === 0) {
      headline = 'Weekend-only spending';
    }

    return {
      mode: 'weekend_split',
      title: 'WEEKEND VS WEEKDAY',
      headline,
      detail: `Sat–Sun ₹${formatAmountWithCommas(String(weekendAvg))}/day vs Mon–Fri ₹${formatAmountWithCommas(String(weekdayAvg))}/day`,
      pillText: `${weekendSharePercent}% on Sat-Sun`,
      weekendSharePercent,
    };
  }

  // Fallback Mode (Mon–Fri of current week): Daily Average Burn Rate
  const elapsedDays = Math.max(1, currentDay === 0 ? 7 : currentDay);
  const dailyAvg = Math.round(currentTotal / elapsedDays);
  const daysRemaining = 7 - elapsedDays;

  return {
    mode: 'daily_burn',
    title: 'DAILY AVERAGE BURN',
    headline: `₹${formatAmountWithCommas(String(dailyAvg))} / day so far`,
    detail: `Based on ${elapsedDays} active days this week`,
    pillText: `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`,
    weekendSharePercent: 0,
  };
}

// ─── Group 3: Comparison Logic ────────────────────────────────────────────────

export interface DayMatchedComparisonResult {
  percentageChange: number | null;
  isIncrease: boolean;
  trendLabel: string;
}

/**
 * Calculates fair day-matched comparison for in-progress weeks and full 7-day comparison for past weeks.
 */
export function computeDayMatchedPreviousComparison(
  expenses: ExpenseLike[],
  categories: Category[],
  currentInterval: WeekInterval,
  previousInterval: WeekInterval,
  offset: number,
  referenceNow: Date = new Date()
): DayMatchedComparisonResult {
  const currentTotal = computeWeeklySpend(expenses, categories, currentInterval);

  // In-progress current week: compare Mon–today against Mon–same weekday of previous week
  if (offset === 0) {
    const currentDayOfWeek = getDay(referenceNow); // 0 = Sun, 1 = Mon ...
    const daysFromMon = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    const prevStartStr = toDateStr(previousInterval.start);
    const prevMatchedEndStr = format(addDays(parseISO(prevStartStr), daysFromMon), 'yyyy-MM-dd');

    const prevMatchedInterval = {
      start: parseISO(prevStartStr),
      end: parseISO(prevMatchedEndStr),
    };

    const prevMatchedTotal = computeWeeklySpend(expenses, categories, prevMatchedInterval);

    if (prevMatchedTotal === 0) {
      return {
        percentageChange: null,
        isIncrease: true,
        trendLabel: 'First week of tracking',
      };
    }

    const diff = currentTotal - prevMatchedTotal;
    const isIncrease = diff >= 0;

    const dayName = format(referenceNow, 'EEEE');

    // Low-base guard: if base spending was < ₹100, percentage changes become misleadingly huge (e.g. 1140%)
    if (prevMatchedTotal < 100) {
      const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
      const absDiff = Math.abs(diff);
      return {
        percentageChange: absDiff > 0 ? absDiff : null,
        isIncrease,
        trendLabel: diff === 0
          ? `Same as previous ${dayName}`
          : `${sign}₹${formatAmountWithCommas(String(absDiff))} vs previous ${dayName}`,
      };
    }

    const pct = Math.round((Math.abs(diff) / prevMatchedTotal) * 100);

    return {
      percentageChange: pct,
      isIncrease,
      trendLabel: `${pct}% vs previous ${dayName}`,
    };
  }

  // Past completed weeks: compare full 7 days vs full 7 days
  const prevFullTotal = computeWeeklySpend(expenses, categories, previousInterval);

  if (prevFullTotal === 0) {
    return {
      percentageChange: null,
      isIncrease: true,
      trendLabel: 'No prev week data',
    };
  }

  const diff = currentTotal - prevFullTotal;
  const isIncrease = diff >= 0;

  // Low-base guard: if base spending was < ₹100
  if (prevFullTotal < 100) {
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
    const absDiff = Math.abs(diff);
    return {
      percentageChange: absDiff > 0 ? absDiff : null,
      isIncrease,
      trendLabel: diff === 0
        ? 'Same as prev week'
        : `${sign}₹${formatAmountWithCommas(String(absDiff))} vs prev week`,
    };
  }

  const pct = Math.round((Math.abs(diff) / prevFullTotal) * 100);

  return {
    percentageChange: pct,
    isIncrease,
    trendLabel: `${pct}% vs prev week`,
  };
}

/**
 * Formats a clean subtitle for peak day spending in SpendingFlowChart.
 */
export function computePeakDaysSubtitle(weeklyData: DaySpendingData[]): string {
  const maxAmount = Math.max(...weeklyData.map((d) => d.amount), 0);
  if (maxAmount === 0) {
    return 'No daily expenses';
  }

  const peakDays = weeklyData.filter((d) => d.amount === maxAmount);
  if (peakDays.length === 1) {
    const fullName = getFullDayName(peakDays[0].day);
    return `Peak: ${fullName} (${formatCurrency(maxAmount)})`;
  }

  if (peakDays.length === 2) {
    return `Peak: ${peakDays[0].day} & ${peakDays[1].day} (${formatCurrency(maxAmount)})`;
  }

  return `Peak: Multiple days (${formatCurrency(maxAmount)})`;
}

function getFullDayName(abbr: string): string {
  switch (abbr.toUpperCase()) {
    case 'MON': return 'Monday';
    case 'TUE': return 'Tuesday';
    case 'WED': return 'Wednesday';
    case 'THU': return 'Thursday';
    case 'FRI': return 'Friday';
    case 'SAT': return 'Saturday';
    case 'SUN': return 'Sunday';
    default: return abbr;
  }
}
