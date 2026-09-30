import {
  format,
  parseISO,
  differenceInCalendarDays,
  subWeeks,
  eachDayOfInterval,
} from 'date-fns';
import { BudgetCadence, BudgetPlanChange, BudgetPeriodRecord } from '../types';
import { formatCurrency, formatAmountWithCommas, round2 } from './formatters';
import {
  getPeriodBounds,
  getDateOwner,
  resolvePlanForDate,
  PeriodSummaryInfo,
} from './budgetPeriods';

export type TabName = 'Home' | 'History' | 'Savings' | 'Insights';

/**
 * Returns the visible bottom tab names depending on whether Smart Budget & Gullak mode is active.
 * When OFF: 4-tab layout ['Home', 'History', 'Insights'] (plus the center Add button).
 * When ON: 5-tab layout ['Home', 'History', 'Savings', 'Insights'] (plus the center Add button).
 */
export function getVisibleTabs(isBudgetModeEnabled: boolean): TabName[] {
  if (!isBudgetModeEnabled) {
    return ['Home', 'History', 'Insights'];
  }
  return ['Home', 'History', 'Savings', 'Insights'];
}

/**
 * Route guard (D11): determines where a navigation intent intended for Savings should land.
 * - 'daily_reminder' notifications always route to 'Home'.
 * - Any navigation to 'Savings' while mode is OFF routes to 'Home'.
 * - Otherwise routes to 'Savings'.
 */
export function resolveSavingsRoute(
  isBudgetModeEnabled: boolean,
  notifType?: string
): 'Home' | 'Savings' {
  if (notifType === 'daily_reminder') {
    return 'Home';
  }
  if (!isBudgetModeEnabled) {
    return 'Home';
  }
  return 'Savings';
}

/**
 * Formats the cadence + budget subtitle for the Profile card when mode is ON.
 * e.g. "Weekly · ₹7,000" or "Daily · ₹500" or "Monthly · ₹30,000"
 */
export function formatCadenceBudgetSubtitle(
  isBudgetModeEnabled: boolean,
  cadence: BudgetCadence,
  amount: number
): string {
  if (!isBudgetModeEnabled) {
    return 'Track expenses with no limits';
  }
  const cadenceLabel = cadence.charAt(0).toUpperCase() + cadence.slice(1);
  if (!amount || amount <= 0) {
    return `${cadenceLabel} · Set budget`;
  }
  return `${cadenceLabel} · ${formatCurrency(amount)}`;
}

/**
 * Formats "effective from" copy for UI:
 * e.g. "Aaj se lagu hoga", "Kal (Thu, 2 Oct) se lagu hoga", "Agle Monday (6 Oct) se lagu hoga", "1 Nov se lagu hoga".
 */
export function formatEffectiveFrom(
  effectiveFromStr: string,
  todayStr: string,
  cadence: BudgetCadence,
  isFirstEnable: boolean = false
): string {
  if (isFirstEnable || effectiveFromStr === todayStr) {
    return 'Aaj se lagu hoga';
  }
  const d = parseISO(effectiveFromStr);
  const today = parseISO(todayStr);
  const diffDays = differenceInCalendarDays(d, today);

  if (diffDays === 1) {
    return `Kal (${format(d, 'EEE, d MMM')}) se lagu hoga`;
  }
  if (cadence === 'weekly') {
    return `Agle Monday (${format(d, 'd MMM')}) se lagu hoga`;
  }
  if (cadence === 'monthly') {
    return `${format(d, 'd MMM')} se lagu hoga`;
  }
  return `${format(d, 'd MMM')} se lagu hoga`;
}

/**
 * Returns proration preview info if the change creates a partial period.
 * e.g. "Is hafte ke bache 3 din ka budget: ₹3,000"
 */
export interface ProrationPreview {
  isProrated: boolean;
  remainingDays: number;
  totalDays: number;
  proratedAmount: number;
  previewText: string;
}

export function getProrationPreview(
  targetCadence: BudgetCadence,
  amount: number,
  effectiveFromStr: string,
  todayStr: string
): ProrationPreview | null {
  if (!amount || amount <= 0 || targetCadence === 'daily') {
    return null;
  }

  const bounds = getPeriodBounds(targetCadence, effectiveFromStr);
  if (effectiveFromStr === bounds.start) {
    // Full period starting from boundary day, no proration
    return null;
  }

  const effectiveDate = parseISO(effectiveFromStr);
  const endDate = parseISO(bounds.end);
  const remainingDays = differenceInCalendarDays(endDate, effectiveDate) + 1;

  if (remainingDays <= 0 || remainingDays >= bounds.totalDays) {
    return null;
  }

  const proratedAmount = Math.round((amount * remainingDays) / bounds.totalDays);
  const periodWord = targetCadence === 'weekly' ? 'week' : 'month';
  const dayWord = remainingDays === 1 ? 'day' : 'days';
  const previewText = `Budget for remaining ${remainingDays} ${dayWord} this ${periodWord}: ₹${formatAmountWithCommas(String(proratedAmount))}`;

  return {
    isProrated: true,
    remainingDays,
    totalDays: bounds.totalDays,
    proratedAmount,
    previewText,
  };
}

/**
 * Formats streak unit label per D6 ("5 days" / "3 weeks" / "2 months").
 */
export function formatCadenceStreakLabel(streak: number, cadence: BudgetCadence): string {
  if (cadence === 'weekly') {
    return `${streak} ${streak === 1 ? 'week' : 'weeks'}`;
  }
  if (cadence === 'monthly') {
    return `${streak} ${streak === 1 ? 'month' : 'months'}`;
  }
  return `${streak} ${streak === 1 ? 'day' : 'days'}`;
}

/**
 * Formats the rollover strip text for the Hero Card in weekly/monthly budget mode.
 * e.g. "₹2,300 Sunday ke baad Gullak mein" or "Over by ₹400 this week"
 */
export function formatCadenceRolloverStrip(
  summary: PeriodSummaryInfo | null,
  cadence: BudgetCadence
): string {
  if (!summary || cadence === 'daily') {
    return '';
  }
  if (cadence === 'weekly') {
    if (summary.isOver) {
      return `Over by ${formatCurrency(summary.overBy)} this week`;
    }
    return `${formatCurrency(summary.remaining)} Sunday ke baad Gullak mein`;
  }
  if (cadence === 'monthly') {
    if (summary.isOver) {
      return `Over by ${formatCurrency(summary.overBy)} this month`;
    }
    return `${formatCurrency(summary.remaining)} month-end ke baad Gullak mein`;
  }
  return '';
}

/**
 * Builds weekly cards for the Adaptive Streak Modal (spec 4B).
 * Last `count` weeks + current week.
 */
export interface WeeklyStreakCard {
  key: string;
  weekLabel: string;
  dateRange: string;
  isCurrentWeek: boolean;
  status: 'on_track' | 'over' | 'saved' | 'missed' | 'even' | 'paused' | 'untracked';
  amount: number;
  budget: number;
  spent: number;
  badgeText: string;
  progressRatio: number;
}

export function buildWeeklyStreakCards(
  changes: BudgetPlanChange[],
  budgetPeriods: Record<string, BudgetPeriodRecord>,
  spentByDate: Record<string, number>,
  todayStr: string,
  count: number = 8
): WeeklyStreakCard[] {
  const today = parseISO(todayStr);
  const currentWeekBounds = getPeriodBounds('weekly', todayStr);
  const currentWeekStart = parseISO(currentWeekBounds.start);

  const cards: WeeklyStreakCard[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const wStart = subWeeks(currentWeekStart, i);
    const wStartStr = format(wStart, 'yyyy-MM-dd');
    const wBounds = getPeriodBounds('weekly', wStartStr);
    const isCurrent = i === 0;

    const startD = parseISO(wBounds.start);
    const endD = parseISO(wBounds.end);
    const dateRange = `${format(startD, 'd MMM')} \u2013 ${format(endD, 'd MMM')}`;

    if (isCurrent) {
      const owner = getDateOwner(changes, todayStr);
      if (owner === 'paused') {
        cards.push({
          key: `week_${wBounds.start}`,
          weekLabel: 'This Week',
          dateRange,
          isCurrentWeek: true,
          status: 'paused',
          amount: 0,
          budget: 0,
          spent: 0,
          badgeText: 'Paused',
          progressRatio: 0,
        });
        continue;
      }

      // Calculate spend so far in this week
      let spent = 0;
      const days = eachDayOfInterval({ start: startD, end: today });
      for (const d of days) {
        const ds = format(d, 'yyyy-MM-dd');
        spent += Number(spentByDate[ds]) || 0;
      }
      spent = round2(spent);

      const plan = resolvePlanForDate(changes, todayStr);
      const budget = plan ? plan.amount : 0;
      const isOver = spent > budget && budget > 0;
      const progressRatio = budget > 0 ? Math.min(1, spent / budget) : 0;

      cards.push({
        key: `week_${wBounds.start}`,
        weekLabel: 'This Week',
        dateRange,
        isCurrentWeek: true,
        status: isOver ? 'over' : 'on_track',
        amount: isOver ? round2(spent - budget) : round2(Math.max(0, budget - spent)),
        budget,
        spent,
        badgeText: isOver ? '● Over' : '● On Track',
        progressRatio,
      });
    } else {
      // Past week
      const periodRecord = Object.values(budgetPeriods).find(
        (p) => p.cadence === 'weekly' && (p.periodStart === wBounds.start || p.activeStart === wBounds.start)
      );

      const ownerAtStart = getDateOwner(changes, wBounds.start);

      if (periodRecord) {
        let badgeText = '';
        if (periodRecord.status === 'saved') {
          badgeText = `+₹${formatAmountWithCommas(String(periodRecord.amountSaved))} to Gullak`;
        } else if (periodRecord.status === 'missed') {
          const over = round2(periodRecord.spentAmount - periodRecord.budgetAmount);
          badgeText = `Over by ₹${formatAmountWithCommas(String(over))}`;
        } else if (periodRecord.status === 'even') {
          badgeText = 'Budget Met';
        } else {
          badgeText = 'Untracked';
        }

        const prog = periodRecord.budgetAmount > 0
          ? Math.min(1, periodRecord.spentAmount / periodRecord.budgetAmount)
          : 0;

        cards.push({
          key: `week_${wBounds.start}`,
          weekLabel: `Week of ${format(startD, 'd MMM')}`,
          dateRange,
          isCurrentWeek: false,
          status: periodRecord.status === 'unknown' ? 'untracked' : periodRecord.status,
          amount: periodRecord.amountSaved,
          budget: periodRecord.budgetAmount,
          spent: periodRecord.spentAmount,
          badgeText,
          progressRatio: prog,
        });
      } else if (ownerAtStart === 'paused') {
        cards.push({
          key: `week_${wBounds.start}`,
          weekLabel: `Week of ${format(startD, 'd MMM')}`,
          dateRange,
          isCurrentWeek: false,
          status: 'paused',
          amount: 0,
          budget: 0,
          spent: 0,
          badgeText: 'Paused',
          progressRatio: 0,
        });
      } else {
        cards.push({
          key: `week_${wBounds.start}`,
          weekLabel: `Week of ${format(startD, 'd MMM')}`,
          dateRange,
          isCurrentWeek: false,
          status: 'untracked',
          amount: 0,
          budget: 0,
          spent: 0,
          badgeText: 'Untracked',
          progressRatio: 0,
        });
      }
    }
  }

  return cards;
}

/**
 * Builds 12-month matrix for the Adaptive Streak Modal (spec 4B).
 */
export interface MonthlyStreakCell {
  monthIndex: number;
  monthName: string;
  monthKey: string;
  status: 'saved' | 'missed' | 'even' | 'paused' | 'current' | 'future' | 'untracked';
  amountSaved: number;
  budget: number;
  spent: number;
  badgeText: string;
  progressRatio: number;
}

export function buildMonthlyStreakMatrix(
  changes: BudgetPlanChange[],
  budgetPeriods: Record<string, BudgetPeriodRecord>,
  spentByDate: Record<string, number>,
  todayStr: string,
  year: number
): MonthlyStreakCell[] {
  const today = parseISO(todayStr);
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();

  const cells: MonthlyStreakCell[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let m = 0; m < 12; m++) {
    const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
    const monthStartStr = `${monthKey}-01`;
    const monthName = monthNames[m];

    if (year > currentYear || (year === currentYear && m > currentMonthIdx)) {
      // Future month
      cells.push({
        monthIndex: m,
        monthName,
        monthKey,
        status: 'future',
        amountSaved: 0,
        budget: 0,
        spent: 0,
        badgeText: '',
        progressRatio: 0,
      });
    } else if (year === currentYear && m === currentMonthIdx) {
      // Current month
      const owner = getDateOwner(changes, todayStr);
      if (owner === 'paused') {
        cells.push({
          monthIndex: m,
          monthName,
          monthKey,
          status: 'paused',
          amountSaved: 0,
          budget: 0,
          spent: 0,
          badgeText: 'Paused',
          progressRatio: 0,
        });
      } else {
        const days = eachDayOfInterval({ start: parseISO(monthStartStr), end: today });
        let spent = 0;
        for (const d of days) {
          spent += Number(spentByDate[format(d, 'yyyy-MM-dd')]) || 0;
        }
        spent = round2(spent);
        const plan = resolvePlanForDate(changes, todayStr);
        const budget = plan ? plan.amount : 0;
        const progressRatio = budget > 0 ? Math.min(1, spent / budget) : 0;
        cells.push({
          monthIndex: m,
          monthName,
          monthKey,
          status: 'current',
          amountSaved: 0,
          budget,
          spent,
          badgeText: spent > budget && budget > 0 ? 'Over' : 'On Track',
          progressRatio,
        });
      }
    } else {
      // Past month
      const periodRecord = Object.values(budgetPeriods).find(
        (p) => p.cadence === 'monthly' && (p.periodStart === monthStartStr || p.activeStart === monthStartStr)
      );
      const ownerAtStart = getDateOwner(changes, monthStartStr);

      if (periodRecord) {
        let badgeText = '';
        if (periodRecord.status === 'saved') {
          badgeText = `+₹${formatAmountWithCommas(String(periodRecord.amountSaved))}`;
        } else if (periodRecord.status === 'missed') {
          badgeText = 'Over';
        } else if (periodRecord.status === 'even') {
          badgeText = 'Even';
        } else {
          badgeText = 'Untracked';
        }

        const prog = periodRecord.budgetAmount > 0
          ? Math.min(1, periodRecord.spentAmount / periodRecord.budgetAmount)
          : 0;

        cells.push({
          monthIndex: m,
          monthName,
          monthKey,
          status: periodRecord.status === 'unknown' ? 'untracked' : periodRecord.status,
          amountSaved: periodRecord.amountSaved,
          budget: periodRecord.budgetAmount,
          spent: periodRecord.spentAmount,
          badgeText,
          progressRatio: prog,
        });
      } else if (ownerAtStart === 'paused') {
        cells.push({
          monthIndex: m,
          monthName,
          monthKey,
          status: 'paused',
          amountSaved: 0,
          budget: 0,
          spent: 0,
          badgeText: 'Paused',
          progressRatio: 0,
        });
      } else {
        cells.push({
          monthIndex: m,
          monthName,
          monthKey,
          status: 'untracked',
          amountSaved: 0,
          budget: 0,
          spent: 0,
          badgeText: 'Untracked',
          progressRatio: 0,
        });
      }
    }
  }

  return cells;
}

