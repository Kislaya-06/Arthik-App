import { useMemo } from 'react';
import {
  startOfWeek, endOfWeek, subWeeks, addDays, differenceInCalendarDays,
  isWithinInterval, parseISO, format,
} from 'date-fns';
import { isIncomeTransaction, isExcludedFromTotals, isCountedIncome } from '../../lib/transactionUtils';
import { formatAmountWithCommas, round2 } from '../../lib/formatters';
import { computeMonthlyCashFlowData, computeYearlyGullakMilestones } from '../../lib/chartUtils';
import {
  computeEffectiveWeekBudget,
  computeBudgetHealth,
  computeSafeDailyPace,
  computeWeeklyGullakSavings,
  computeWeeklyShareOfMonthlyBudget,
  computeSmartWeeklyTakeaway,
  computeLargestSingleOutflow,
  computeWeekdayVsWeekendDynamics,
  computeDayMatchedPreviousComparison,
  computePeakDaysSubtitle,
} from '../../lib/weeklyInsightsUtils';
import {
  computeMonthlyComparison,
  computeEffectiveMonthBudget,
  computeMonthlyBudgetHealth,
  computeMonthlySafeDailyPace,
  computeMonthlyGullakSavings,
  computeMonthlyLargestOutflow,
  computeMonthlyCategoryShift,
  computeMonthlyPeakWeek,
  computeSmartMonthlyTakeaway,
} from '../../lib/monthlyInsightsUtils';
import {
  computeActiveDaysInYear,
  computeAnnualDailyBurn,
  computeYearlyComparison,
  computeYearlyInflow,
  computeAnnualNetCashFlow,
  computeAnnualSavingsRate,
  computeSmartYearlyTakeaway,
  compute12MonthCashFlow,
  computeAnnualBudgetDiscipline,
  computeAnnualCapitalOutlier,
  computeAnnualCategoryTrajectory,
} from '../../lib/yearlyInsightsUtils';
import { BudgetCadence, BudgetPeriodRecord } from '../../types';
import { Expense } from '../../store/expenseStore';
import { Category } from '../../store/categoryStore';
import { DailyRecord, GullakDeposit } from '../../store/dailyBudgetStore';
import {
  Period,
  CHART_COLORS,
  MAX_NAV_DOTS,
  buildInterval,
  buildDateLabel,
  computeMinOffset,
} from './periodUtils';

export interface UseInsightsDataParams {
  period: Period;
  offset: number;
  expenses: Expense[];
  categories: Category[];
  dailyRecords: Record<string, DailyRecord>;
  gullakDeposits: GullakDeposit[];
  isBudgetModeEnabled: boolean;
  budgetPeriods: Record<string, BudgetPeriodRecord>;
  budgetCadence: BudgetCadence;
  dailyBudgetAmount: number;
  weeklyBudgetAmount: number;
  monthlyBudgetAmount: number;
  totalAccumulatedSavings: number;
  selectedCategoryId?: string | null;
  focusTime?: number;
  user?: { created_at?: string } | null;
}

/**
 * Builds an O(1) Map from category ID to Category object.
 * Preserves the first encountered entry per ID in case of duplicate IDs.
 */
export function buildCategoryMap(categories: Category[]): Map<string, Category> {
  const map = new Map<string, Category>();
  for (const cat of categories) {
    if (cat && cat.id && !map.has(cat.id)) {
      map.set(cat.id, cat);
    }
  }
  return map;
}

export function useInsightsData({
  period,
  offset,
  expenses,
  categories,
  dailyRecords,
  gullakDeposits,
  isBudgetModeEnabled,
  budgetPeriods,
  budgetCadence,
  dailyBudgetAmount,
  weeklyBudgetAmount,
  monthlyBudgetAmount,
  totalAccumulatedSavings,
  focusTime = Date.now(),
  user,
}: UseInsightsDataParams) {
  // ─── Category Lookup Map ───────────────────────────────────────────────────
  // O(1) category lookup map to avoid repeated O(C) array scans per transaction
  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories]);

  // ─── Earliest expense date bound ───────────────────────────────────────────
  // Scans non-income expenses to find the earliest recorded transaction date.
  // This ensures period navigation and pagination dots only exist for periods with real user activity.
  const earliestExpenseDate = useMemo<Date | null>(() => {
    let earliest: string | null = null;
    for (const exp of expenses) {
      if (!exp.expense_date) continue;
      const cleanDate = exp.expense_date.split('T')[0]?.trim();
      if (!cleanDate) continue;
      const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat) || isExcludedFromTotals(exp)) continue;
      if (!earliest || cleanDate < earliest) {
        earliest = cleanDate;
      }
    }
    return earliest ? parseISO(earliest) : null;
  }, [expenses, categoryMap]);

  const minOff = useMemo(
    () => computeMinOffset(period, earliestExpenseDate),
    [period, earliestExpenseDate],
  );

  // ─── Navigator labels ──────────────────────────────────────────────────────
  const { currentInterval, previousInterval, periodLabel, dateLabel, subLabel } = useMemo(() => {
    const current = buildInterval(period, offset);
    const previous = buildInterval(period, offset - 1);

    // Hero card label matching HomeScreen BrandedHeroCard style (Title Case)
    const pLabel = offset === 0
      ? (period === 'Weekly' ? 'Total Spent This Week' : period === 'Monthly' ? 'Total Spent This Month' : 'Total Spent This Year')
      : offset === -1
      ? (period === 'Weekly' ? 'Total Spent Last Week' : period === 'Monthly' ? 'Total Spent Last Month' : 'Total Spent Last Year')
      : 'Total Spent';

    // Navigator main label, e.g. "This Week" / "Last Week" / "15 – 21 Sep"
    const dLabel = buildDateLabel(period, offset);

    // Sub-label date range: kept empty because dateLabel now cleanly formats the complete date range in one line
    const sLabel = '';

    return {
      currentInterval: current,
      previousInterval: previous,
      periodLabel: pLabel,
      dateLabel: dLabel,
      subLabel: sLabel,
    };
  // focusTime: included so labels stay fresh after midnight without a full refetch
  }, [period, offset, focusTime]);

  // ─── Pagination dots ───────────────────────────────────────────────────────
  const { dotCount, activeDotIndex } = useMemo(() => {
    // Total available navigable periods capped at MAX_NAV_DOTS
    const total = Math.min(-minOff + 1, MAX_NAV_DOTS);
    const count = Math.max(total, 1);
    // Rightmost dot = current period (offset=0); left dots = past periods
    const active = count - 1 + offset;
    return { dotCount: count, activeDotIndex: Math.max(0, Math.min(active, count - 1)) };
  }, [offset, minOff]);

  // ─── Expense aggregation ───────────────────────────────────────────────────
  const { currentTotal, categoryTotals } = useMemo(() => {
    let curr = 0;
    const catTotals: Record<string, number> = {};

    for (const exp of expenses) {
      const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat) || isExcludedFromTotals(exp)) continue;

      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;

      const date = parseISO(cleanDate);
      if (isWithinInterval(date, currentInterval)) {
        curr += exp.amount;
        const key = exp.category_id || 'others';
        catTotals[key] = (catTotals[key] || 0) + exp.amount;
      }
    }

    return { currentTotal: curr, categoryTotals: catTotals };
  }, [expenses, categoryMap, currentInterval]);

  const sortedCategories = useMemo(() => {
    return Object.keys(categoryTotals)
      .map((catId, index) => {
        const cat = categoryMap.get(catId);
        return {
          id: catId,
          name: cat?.name || (catId === 'others' ? 'Others' : 'Unknown'),
          amount: categoryTotals[catId],
          percentage: currentTotal > 0 ? Math.round((categoryTotals[catId] / currentTotal) * 100) : 0,
          color: cat?.color || CHART_COLORS[index % CHART_COLORS.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [categoryTotals, categoryMap, currentTotal]);

  const topCategory = sortedCategories[0] ?? null;

  // Bar chart: shows Mon–Sun data for the selected week.
  // For Monthly/Yearly views it always reflects the current calendar week (same as before).
  const { weeklyData, maxWeekDay } = useMemo(() => {
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const weekRef = period === 'Weekly' && offset < 0
      ? subWeeks(new Date(), Math.abs(offset))
      : new Date();

    const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 });
    const weekInterval = {
      start: weekStart,
      end: endOfWeek(weekRef, { weekStartsOn: 1 }),
    };

    const data = weekDays.map((day, i) => {
      const dateObj = addDays(weekStart, i);
      return {
        day,
        dateStr: format(dateObj, 'yyyy-MM-dd'),
        amount: 0,
      };
    });

    for (const exp of expenses) {
      const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat) || isExcludedFromTotals(exp)) continue;

      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;

      const date = parseISO(cleanDate);
      if (isWithinInterval(date, weekInterval)) {
        let dayIndex = date.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6; // Sunday wraps to index 6
        data[dayIndex].amount += exp.amount;
      }
    }

    const maxDay = data.reduce((max, d) => (d.amount > max.amount ? d : max), data[0]);
    return { weeklyData: data, maxWeekDay: maxDay.amount > 0 ? maxDay : null };
  }, [expenses, categoryMap, period, offset]);

  // Monthly week-by-week cash flow (Money In vs Money Out)
  const monthlyCashFlowData = useMemo(() => {
    if (period !== 'Monthly') return { weeks: [], totalIncome: 0, totalSpent: 0, maxAmount: 0 };
    return computeMonthlyCashFlowData(
      currentInterval.start,
      currentInterval.end,
      expenses,
      gullakDeposits,
      (exp) => {
        const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
        return isCountedIncome(exp, cat);
      },
      user?.created_at,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      }
    );
  }, [
    period,
    currentInterval,
    expenses,
    gullakDeposits,
    categoryMap,
    user?.created_at,
    isBudgetModeEnabled,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
  ]);

  // Yearly Gullak savings & milestone metrics
  const yearlyGullakMetrics = useMemo(() => {
    if (period !== 'Yearly') return null;
    return computeYearlyGullakMilestones(
      currentInterval.start,
      currentInterval.end,
      Object.values(dailyRecords),
      gullakDeposits,
      totalAccumulatedSavings,
      Object.values(budgetPeriods)
    );
  }, [period, currentInterval, dailyRecords, gullakDeposits, totalAccumulatedSavings, budgetPeriods]);

  const maxSideStack = period === 'Weekly' ? 4 : 5;

  const legendSegments = useMemo(() => {
    return sortedCategories.map((item) => ({
      ...item,
      color: item.color,
    }));
  }, [sortedCategories]);

  const sideCategories = useMemo(
    () => legendSegments.slice(0, maxSideStack),
    [legendSegments, maxSideStack]
  );
  const bottomCategories = useMemo(
    () => legendSegments.slice(maxSideStack),
    [legendSegments, maxSideStack]
  );

  // Day-matched comparison for Weekly & Monthly vs standard comparison for Yearly
  const weeklyDayMatchedComp = useMemo(() => {
    if (period !== 'Weekly') {
      return {
        percentageChange: null,
        isIncrease: false,
        trendLabel: '',
        matchedPrevTotal: 0,
      };
    }
    return computeDayMatchedPreviousComparison(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      new Date()
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset]);

  const monthlyComp = useMemo(() => {
    if (period !== 'Monthly') {
      return {
        percentageChange: null,
        isIncrease: false,
        trendLabel: '',
        matchedPrevTotal: 0,
        currentTotal: 0,
      };
    }
    return computeMonthlyComparison(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      new Date()
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset]);

  const yearlyActiveDays = useMemo(() => {
    if (period !== 'Yearly') return 365;
    return computeActiveDaysInYear(currentInterval.start, focusTime, user?.created_at, offset < 0);
  }, [period, currentInterval.start, focusTime, user?.created_at, offset]);

  const yearlyDailyBurn = useMemo(() => {
    if (period !== 'Yearly') return 0;
    return computeAnnualDailyBurn(currentTotal, yearlyActiveDays);
  }, [period, currentTotal, yearlyActiveDays]);

  const yearlyComparison = useMemo(() => {
    if (period !== 'Yearly') {
      return {
        percentageChange: null,
        isIncrease: false,
        trendLabel: '',
        matchedPrevTotal: 0,
        currentTotal: 0,
      };
    }
    return computeYearlyComparison(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      focusTime,
      user?.created_at
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset, focusTime, user?.created_at]);

  const heroTrend = useMemo(() => {
    if (period === 'Weekly') {
      return {
        percentageChange: weeklyDayMatchedComp.percentageChange,
        isIncrease: weeklyDayMatchedComp.isIncrease,
        trendLabel: weeklyDayMatchedComp.trendLabel,
      };
    }
    if (period === 'Monthly') {
      return {
        percentageChange: monthlyComp.percentageChange,
        isIncrease: monthlyComp.isIncrease,
        trendLabel: monthlyComp.trendLabel,
      };
    }
    return {
      percentageChange: yearlyComparison.percentageChange,
      isIncrease: yearlyComparison.isIncrease,
      trendLabel: yearlyComparison.trendLabel,
    };
  }, [period, weeklyDayMatchedComp, monthlyComp, yearlyComparison]);

  // Weekly Breathing Strip & Analytics calculations
  const effectiveBudgetResult = useMemo(() => {
    return computeEffectiveWeekBudget(
      budgetCadence,
      dailyBudgetAmount,
      weeklyBudgetAmount,
      user?.created_at,
      currentInterval,
      monthlyBudgetAmount
    );
  }, [budgetCadence, dailyBudgetAmount, weeklyBudgetAmount, monthlyBudgetAmount, user?.created_at, currentInterval]);

  const budgetHealth = useMemo(() => {
    return computeBudgetHealth(effectiveBudgetResult.effectiveBudget, currentTotal);
  }, [effectiveBudgetResult.effectiveBudget, currentTotal]);

  const elapsedDaysInWeek = useMemo(() => {
    if (offset < 0) return 7;
    const now = new Date();
    let dayIdx = now.getDay() - 1;
    if (dayIdx === -1) dayIdx = 6;
    return dayIdx + 1;
  }, [offset]);

  // ─── Monthly Insights Calculations ──────────────────────────────────────────
  const elapsedDaysInMonth = useMemo(() => {
    if (offset < 0) {
      return differenceInCalendarDays(currentInterval.end, currentInterval.start) + 1;
    }
    const now = new Date();
    return now.getDate();
  }, [offset, currentInterval]);

  const monthlyRemainingDays = useMemo(() => {
    if (offset < 0) return 0;
    const totalDays = differenceInCalendarDays(currentInterval.end, currentInterval.start) + 1;
    return Math.max(0, totalDays - elapsedDaysInMonth);
  }, [offset, currentInterval, elapsedDaysInMonth]);

  const monthlyEffectiveBudget = useMemo(() => {
    if (period !== 'Monthly') return { effectiveBudget: 0, activeDays: 0, totalDays: 0, isPartialFirstMonth: false };
    return computeEffectiveMonthBudget(
      budgetCadence,
      dailyBudgetAmount,
      weeklyBudgetAmount,
      monthlyBudgetAmount,
      user?.created_at,
      currentInterval
    );
  }, [period, budgetCadence, dailyBudgetAmount, weeklyBudgetAmount, monthlyBudgetAmount, user?.created_at, currentInterval]);

  const monthlyBudgetHealth = useMemo(() => {
    return computeMonthlyBudgetHealth(monthlyEffectiveBudget.effectiveBudget, currentTotal);
  }, [monthlyEffectiveBudget.effectiveBudget, currentTotal]);

  // ─── Direct Non-Gullak Income Added in Current Interval ───────────────────────
  const currentPeriodIncome = useMemo(() => {
    if (period === 'Yearly') return 0;
    let income = 0;
    for (const exp of expenses) {
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
        if (isCountedIncome(exp, cat)) {
          income += exp.amount;
        }
      }
    }
    return round2(income);
  }, [expenses, categoryMap, currentInterval, period]);

  // ─── Active Spending Pool (Estimated Budget + Added Inflow) ───────────────────
  const activeBudgetPool = useMemo(() => {
    if (!isBudgetModeEnabled || period === 'Yearly') {
      return null;
    }

    const baseBudget = period === 'Weekly'
      ? effectiveBudgetResult.effectiveBudget
      : monthlyEffectiveBudget.effectiveBudget;

    const totalPool = round2(baseBudget + currentPeriodIncome);
    const rawRemaining = round2(totalPool - currentTotal);
    const isOver = rawRemaining < 0;
    const overAmount = isOver ? Math.abs(rawRemaining) : 0;
    const remaining = Math.max(0, rawRemaining);
    const progressRatio = totalPool > 0 ? Math.min(1, Math.max(0, currentTotal / totalPool)) : 0;

    const amountLabel = isOver
      ? `₹${formatAmountWithCommas(String(overAmount))} over`
      : `₹${formatAmountWithCommas(String(remaining))} left of`;

    const poolLabel = currentPeriodIncome > 0
      ? `₹${formatAmountWithCommas(String(totalPool))} pool (₹${formatAmountWithCommas(String(baseBudget))} est. + ₹${formatAmountWithCommas(String(currentPeriodIncome))} income)`
      : `₹${formatAmountWithCommas(String(baseBudget))} estimated`;

    return {
      baseBudget,
      totalPool,
      remaining,
      isOver,
      overAmount,
      progressRatio,
      hasIncomeAdded: currentPeriodIncome > 0,
      addedIncome: currentPeriodIncome,
      statusText: `${amountLabel} ${poolLabel}`,
    };
  }, [
    isBudgetModeEnabled,
    period,
    effectiveBudgetResult.effectiveBudget,
    monthlyEffectiveBudget.effectiveBudget,
    currentPeriodIncome,
    currentTotal,
  ]);

  const safeDailyPace = useMemo(() => {
    const effectiveRemaining = activeBudgetPool && period === 'Weekly'
      ? activeBudgetPool.remaining
      : budgetHealth.remaining;
    return computeSafeDailyPace(effectiveRemaining, elapsedDaysInWeek);
  }, [activeBudgetPool, period, budgetHealth.remaining, elapsedDaysInWeek]);

  const monthlySafeDailyPace = useMemo(() => {
    const totalDays = differenceInCalendarDays(currentInterval.end, currentInterval.start) + 1;
    const effectiveRemaining = activeBudgetPool && period === 'Monthly'
      ? activeBudgetPool.remaining
      : monthlyBudgetHealth.remaining;
    return computeMonthlySafeDailyPace(effectiveRemaining, elapsedDaysInMonth, totalDays);
  }, [activeBudgetPool, period, monthlyBudgetHealth.remaining, elapsedDaysInMonth, currentInterval]);

  const weeklyGullak = useMemo(() => {
    return computeWeeklyGullakSavings(
      dailyRecords,
      gullakDeposits,
      currentInterval,
      budgetPeriods,
      budgetCadence
    );
  }, [dailyRecords, gullakDeposits, currentInterval, budgetPeriods, budgetCadence]);

  const weeklyMonthlyBudgetShare = useMemo(() => {
    if (period !== 'Weekly' || budgetCadence !== 'monthly') return null;
    return computeWeeklyShareOfMonthlyBudget(currentTotal, monthlyBudgetAmount);
  }, [period, budgetCadence, currentTotal, monthlyBudgetAmount]);

  const weekTransactionCount = useMemo(() => {
    let count = 0;
    for (const exp of expenses) {
      const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat) || isExcludedFromTotals(exp)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        count++;
      }
    }
    return count;
  }, [expenses, categoryMap, currentInterval]);

  const peakDayName = maxWeekDay?.day || 'Mon';

  const smartTakeaway = useMemo(() => {
    const isOver = activeBudgetPool && period === 'Weekly' ? activeBudgetPool.isOver : budgetHealth.isOverBudget;
    const overAmt = activeBudgetPool && period === 'Weekly' ? activeBudgetPool.overAmount : budgetHealth.overAmount;

    return computeSmartWeeklyTakeaway({
      currentTotal,
      isBudgetMode: isBudgetModeEnabled,
      isOverBudget: isOver,
      overAmount: overAmt,
      peakDayName,
      savedDaysCount: weeklyGullak.savedDaysCount,
      weekSavings: weeklyGullak.totalSaved,
      topCategory: topCategory ? { name: topCategory.name, percentage: topCategory.percentage } : null,
      safeDailyPace,
      isCurrentWeek: offset === 0,
      transactionCount: weekTransactionCount,
      dailyAverageBurn: Math.round(currentTotal / Math.max(1, elapsedDaysInWeek)),
      cadence: budgetCadence,
      savedWeeksCount: weeklyGullak.savedWeeksCount,
      monthlyBudgetShare: weeklyMonthlyBudgetShare,
      monthlyBudgetAmount,
    });
  }, [
    currentTotal,
    isBudgetModeEnabled,
    activeBudgetPool,
    period,
    budgetHealth,
    peakDayName,
    weeklyGullak,
    topCategory,
    safeDailyPace,
    offset,
    weekTransactionCount,
    elapsedDaysInWeek,
    budgetCadence,
    weeklyMonthlyBudgetShare,
    monthlyBudgetAmount,
  ]);

  const largestOutflow = useMemo(() => {
    if (period !== 'Weekly') return null;
    return computeLargestSingleOutflow(expenses, categories, currentInterval, currentTotal);
  }, [period, expenses, categories, currentInterval, currentTotal]);

  const weekdayWeekendDynamics = useMemo(() => {
    if (period !== 'Weekly') return null;
    return computeWeekdayVsWeekendDynamics(
      weeklyData,
      currentTotal,
      offset,
      new Date()
    );
  }, [period, weeklyData, currentTotal, offset]);

  const peakDaysSubtitle = useMemo(() => {
    if (period !== 'Weekly') return undefined;
    return computePeakDaysSubtitle(weeklyData);
  }, [period, weeklyData]);

  const monthlyDailyBurnPace = useMemo(() => {
    if (currentTotal <= 0) return 0;
    return Math.round(currentTotal / Math.max(1, elapsedDaysInMonth));
  }, [currentTotal, elapsedDaysInMonth]);

  const monthlyGullakSavings = useMemo(() => {
    if (period !== 'Monthly') {
      return {
        totalSaved: 0,
        autoSaved: 0,
        manualDeposits: 0,
        savedDaysCount: 0,
        savedWeeksCount: 0,
        savedMonthsCount: 0,
        pillLabel: '',
      };
    }
    return computeMonthlyGullakSavings(
      dailyRecords,
      gullakDeposits,
      currentInterval,
      budgetPeriods,
      budgetCadence
    );
  }, [period, dailyRecords, gullakDeposits, currentInterval, budgetPeriods, budgetCadence]);

  const monthlyLargestOutflow = useMemo(() => {
    if (period !== 'Monthly') return null;
    return computeMonthlyLargestOutflow(expenses, categories, currentInterval, currentTotal);
  }, [period, expenses, categories, currentInterval, currentTotal]);

  const monthlyCategoryShift = useMemo(() => {
    if (period !== 'Monthly') return null;
    return computeMonthlyCategoryShift(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      new Date(),
      currentTotal
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset, currentTotal]);

  const monthlyPeakWeek = useMemo(() => {
    if (period !== 'Monthly') return { status: 'empty' as const, text: '' };
    return computeMonthlyPeakWeek(monthlyCashFlowData.weeks, currentTotal);
  }, [period, monthlyCashFlowData.weeks, currentTotal]);

  const monthTransactionCount = useMemo(() => {
    if (period !== 'Monthly') return 0;
    let count = 0;
    for (const exp of expenses) {
      const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat) || isExcludedFromTotals(exp)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        count++;
      }
    }
    return count;
  }, [period, expenses, categoryMap, currentInterval]);

  const smartMonthlyTakeaway = useMemo(() => {
    const isOver = activeBudgetPool && period === 'Monthly' ? activeBudgetPool.isOver : monthlyBudgetHealth.isOverBudget;
    const overAmt = activeBudgetPool && period === 'Monthly' ? activeBudgetPool.overAmount : monthlyBudgetHealth.overAmount;
    const remBudget = activeBudgetPool && period === 'Monthly' ? activeBudgetPool.remaining : monthlyBudgetHealth.remaining;

    return computeSmartMonthlyTakeaway({
      currentTotal,
      isBudgetMode: isBudgetModeEnabled,
      isOverBudget: isOver,
      overAmount: overAmt,
      savedDaysCount: monthlyGullakSavings.savedDaysCount,
      totalMonthSavings: monthlyGullakSavings.totalSaved,
      topCategory: topCategory ? { name: topCategory.name, percentage: topCategory.percentage } : null,
      isCurrentMonth: offset === 0,
      safeDailyPace: monthlySafeDailyPace,
      remainingDays: monthlyRemainingDays,
      remainingBudget: remBudget,
      transactionCount: monthTransactionCount,
      monthlyDailyBurnPace,
      cadence: budgetCadence,
      savedWeeksCount: monthlyGullakSavings.savedWeeksCount,
      savedMonthsCount: monthlyGullakSavings.savedMonthsCount,
    });
  }, [
    currentTotal,
    isBudgetModeEnabled,
    activeBudgetPool,
    period,
    monthlyBudgetHealth,
    monthlyGullakSavings,
    topCategory,
    offset,
    monthlySafeDailyPace,
    monthlyRemainingDays,
    monthTransactionCount,
    monthlyDailyBurnPace,
    budgetCadence,
  ]);

  // ─── Yearly Insights Analytics & Engines ────────────────────────────────────
  const yearlyInflow = useMemo(() => {
    if (period !== 'Yearly') return 0;
    return computeYearlyInflow(
      expenses,
      categories,
      dailyRecords,
      gullakDeposits,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      },
      currentInterval,
      focusTime,
      user?.created_at
    );
  }, [
    period,
    expenses,
    categories,
    dailyRecords,
    gullakDeposits,
    isBudgetModeEnabled,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    currentInterval,
    focusTime,
    user?.created_at,
  ]);

  const yearlyNetCashFlow = useMemo(() => {
    return computeAnnualNetCashFlow(yearlyInflow, currentTotal);
  }, [yearlyInflow, currentTotal]);

  const yearlySavingsRate = useMemo(() => {
    const saved = yearlyGullakMetrics?.totalSavedInYear || 0;
    return computeAnnualSavingsRate(saved, yearlyInflow);
  }, [yearlyGullakMetrics, yearlyInflow]);

  const yearlyCashFlowData = useMemo(() => {
    if (period !== 'Yearly') {
      return {
        months: [],
        maxAmount: 0,
        totalIncome: 0,
        totalSpent: 0,
        peakMonthName: 'None',
        peakMonthSpent: 0,
        surplusMonthsCount: 0,
        activeMonthsCount: 0,
        chartSubtitle: '',
      };
    }
    return compute12MonthCashFlow(
      currentInterval.start,
      currentInterval.end,
      expenses,
      categories,
      gullakDeposits,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      },
      user?.created_at,
      focusTime
    );
  }, [
    period,
    currentInterval,
    expenses,
    categories,
    gullakDeposits,
    isBudgetModeEnabled,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    user?.created_at,
    focusTime,
  ]);

  const smartYearlyTakeaway = useMemo(() => {
    const saved = yearlyGullakMetrics?.totalSavedInYear || 0;
    return computeSmartYearlyTakeaway(
      yearlyNetCashFlow.netCashFlow,
      yearlySavingsRate,
      yearlyCashFlowData.activeMonthsCount,
      isBudgetModeEnabled,
      saved
    );
  }, [
    yearlyNetCashFlow.netCashFlow,
    yearlySavingsRate,
    yearlyCashFlowData.activeMonthsCount,
    isBudgetModeEnabled,
    yearlyGullakMetrics,
  ]);

  const annualBudgetDiscipline = useMemo(() => {
    if (period !== 'Yearly' || !isBudgetModeEnabled) {
      return { canDisplay: false, keptMonths: 0, totalCompletedMonths: 0, consistencyRatio: 0, disciplineText: '' };
    }
    return computeAnnualBudgetDiscipline(
      expenses,
      categories,
      currentInterval,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      },
      user?.created_at,
      focusTime
    );
  }, [
    period,
    isBudgetModeEnabled,
    expenses,
    categories,
    currentInterval,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    user?.created_at,
    focusTime,
  ]);

  const yearlyCapitalOutlier = useMemo(() => {
    if (period !== 'Yearly') return null;
    return computeAnnualCapitalOutlier(expenses, categories, currentTotal, currentInterval);
  }, [period, expenses, categories, currentTotal, currentInterval]);

  const yearlyCategoryTrajectory = useMemo(() => {
    if (period !== 'Yearly') return null;
    return computeAnnualCategoryTrajectory(
      expenses,
      categories,
      currentInterval,
      currentTotal,
      user?.created_at,
      focusTime
    );
  }, [period, expenses, categories, currentInterval, currentTotal, user?.created_at, focusTime]);

  const yearTransactionCount = useMemo(() => {
    if (period !== 'Yearly') return 0;
    let count = 0;
    for (const exp of expenses) {
      const cat = exp.category_id ? categoryMap.get(exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat) || isExcludedFromTotals(exp)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        count++;
      }
    }
    return count;
  }, [period, expenses, categoryMap, currentInterval]);

  const gullakDepositsInYearCount = useMemo(() => {
    if (period !== 'Yearly') return 0;
    const startStr = format(currentInterval.start, 'yyyy-MM-dd');
    const endStr = format(currentInterval.end, 'yyyy-MM-dd');
    return gullakDeposits.filter((d) => d.date >= startStr && d.date <= endStr).length;
  }, [period, gullakDeposits, currentInterval]);

  // Left arrow is enabled as long as there is an older period within the available history
  const hasPrevData = offset > minOff;

  return {
    earliestExpenseDate,
    minOff,
    currentInterval,
    previousInterval,
    periodLabel,
    dateLabel,
    subLabel,
    dotCount,
    activeDotIndex,
    currentTotal,
    categoryTotals,
    sortedCategories,
    topCategory,
    weeklyData,
    maxWeekDay,
    peakDayName,
    monthlyCashFlowData,
    yearlyGullakMetrics,
    maxSideStack,
    legendSegments,
    sideCategories,
    bottomCategories,
    weeklyDayMatchedComp,
    monthlyComp,
    yearlyActiveDays,
    yearlyDailyBurn,
    yearlyComparison,
    heroTrend,
    effectiveBudgetResult,
    budgetHealth,
    elapsedDaysInWeek,
    elapsedDaysInMonth,
    monthlyRemainingDays,
    monthlyEffectiveBudget,
    monthlyBudgetHealth,
    currentPeriodIncome,
    activeBudgetPool,
    safeDailyPace,
    monthlySafeDailyPace,
    weeklyGullak,
    weeklyMonthlyBudgetShare,
    weekTransactionCount,
    smartTakeaway,
    largestOutflow,
    weekdayWeekendDynamics,
    peakDaysSubtitle,
    monthlyDailyBurnPace,
    monthlyGullakSavings,
    monthlyLargestOutflow,
    monthlyCategoryShift,
    monthlyPeakWeek,
    monthTransactionCount,
    smartMonthlyTakeaway,
    yearlyInflow,
    yearlyNetCashFlow,
    yearlySavingsRate,
    yearlyCashFlowData,
    smartYearlyTakeaway,
    annualBudgetDiscipline,
    yearlyCapitalOutlier,
    yearlyCategoryTrajectory,
    yearTransactionCount,
    gullakDepositsInYearCount,
    hasPrevData,
  };
}
