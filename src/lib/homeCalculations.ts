/**
 * homeCalculations.ts
 *
 * Pure financial aggregation engine for the HomeScreen Hero Summary Card.
 *
 * ARCHITECTURAL NOTE ON DISPLAY STRINGS:
 * This module deliberately returns both calculated financial metrics AND formatted user-facing
 * copy (primaryLabel, primarySubtext).
 *
 * While src/lib calculation files typically return only domain primitives, bundling the copy
 * here is an intentional design decision: the user-facing text is a direct deterministic projection
 * of the period dates, budget pools, income, and overage state (~60 lines of complex branching).
 * Leaving string resolution to callers would force every consumer/view to re-implement or duplicate
 * identical branch logic across all four time filters, creating a wide, brittle interface.
 *
 * By returning a complete PeriodSummary descriptor, the entire financial summary state machine
 * remains pure, deterministic, and 100% unit-testable in isolation without React or UI dependencies.
 */

import { format, parseISO, startOfWeek, startOfMonth, eachDayOfInterval } from 'date-fns';
import { formatCurrency, round2 } from './formatters';
import { DailyRecord, calculateCycleFinancials } from './budgetCalculations';
import { isDateInPeriod, FilterPeriod } from './dateFilters';
import { isCountedExpense, isCountedIncome, isEligibleReimbursement } from './transactionUtils';
import { resolvePlanForDate, getPeriodBounds, carryForPeriod, dailyCarryForDate } from './budgetPeriods';
import { BudgetPlanChange } from '../types';

export type HomeFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly';

export interface ExpenseDateItem {
  expense_date?: string;
}

export interface DepositDateItem {
  date: string;
  amount: number;
  source?: 'income' | 'external';
}

export const getExternalDepositsInPeriod = (
  deposits: DepositDateItem[],
  filter: HomeFilter,
  referenceDate: Date,
  userCreatedAtStr?: string
): number => {
  const period: FilterPeriod = filter === 'All' ? 'all' : (filter === 'Daily' ? 'day' : (filter === 'Weekly' ? 'week' : 'month'));
  let sum = 0;
  for (let i = 0; i < deposits.length; i++) {
    const dep = deposits[i];
    if (dep.source === 'external' && isDateInPeriod(dep.date, period, referenceDate, userCreatedAtStr)) {
      sum += Number(dep.amount) || 0;
    }
  }
  return round2(sum);
};

export interface PeriodCalculationParams {
  activeFilter: HomeFilter;
  dailyBudgetAmount: number;
  isAutoRenew: boolean;
  todayBudget: number;
  dailyRecords: Record<string, DailyRecord>;
  totalIncome: number;
  totalSpent: number;
  /** Confirmed friend reimbursements in the period. Real cash, NOT income. */
  totalReimbursements?: number;
  filtered: ExpenseDateItem[];
  userCreatedAtStr?: string;
  referenceDate: Date;
  externalDepositsInPeriod?: number;
  planChanges?: BudgetPlanChange[];
  /** Optional live today spent for zero-lag reactivity */
  todaySpent?: number;
  /** Optional map of date -> spent for accurate per-day overspend calculation */
  spentByDate?: Record<string, number>;
  /** Optional overall available income balance (e.g. from getAvailableIncomeBalance) for the 'All' filter */
  availableIncomeBalance?: number;
  /**
   * Result of the money waterfall for THIS pill (budget -> income -> Gullak), see moneyWaterfall.ts.
   * When given, the income chip and the Gullak badge come from it (real, chronological numbers).
   * - incomeRemaining: income of this pill that is still unspent (All: real lifetime remaining)
   * - gullakDrawn: overspend of this pill that had to be paid from Gullak
   */
  funding?: { incomeRemaining: number; gullakDrawn: number };
  /**
   * date -> part of that day's daily budget that is carried-over money from an earlier weekly / monthly budget.
   * That money is already inside the old budget, so the "All" total must not count it a second time.
   */
  carryCoveredByDate?: Record<string, number>;
}

/** Carried-over money inside each daily budget (see `PeriodCalculationParams.carryCoveredByDate`). */
export const getCarryCoveredByDate = (
  planChanges: BudgetPlanChange[] | undefined,
  dailyRecords: Record<string, DailyRecord>,
  dailyBudgetAmount: number,
  todayStr: string
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!planChanges || planChanges.length === 0) return out;
  const dates = new Set<string>([...Object.keys(dailyRecords || {}), todayStr]);
  dates.forEach((d) => {
    const c = dailyCarryForDate(planChanges, (x) => dailyRecords[x]?.budget, dailyBudgetAmount, d);
    if (c && c.funded > 0) out[d] = c.funded;
  });
  return out;
};

export interface PeriodSummary {
  primaryAmount: number;
  primaryLabel: string;
  primarySubtext: string | null;
  displaySpent: number;
  totalAvailable: number;
  isOverBudgetPeriod: boolean;
  periodIncome: number;
  periodSpent: number;
  periodBudgetPool: number;
  isBudgetConfigured: boolean;
  remainingIncome?: number;
  remainingDeposits?: number;
  isSpendingFromGullak?: boolean;
  gullakDrawnAmount?: number;
}

/**
 * Computes period financial metrics and formatted display descriptors for the Hero Summary Card.
 *
 * PRESERVED LOGIC:
 * - Phantom-500 skip on zero-spend days (cross-reference: .scratch/daily-budget/issues/01).
 * - Registration boundary clipping on past elapsed days.
 * - Exact branching for all four time filters and singular/plural day strings.
 */
export const calculatePeriodSummary = (params: PeriodCalculationParams): PeriodSummary => {
  const {
    activeFilter,
    dailyBudgetAmount,
    isAutoRenew,
    todayBudget,
    dailyRecords,
    totalIncome,
    totalSpent,
    totalReimbursements = 0,
    filtered,
    userCreatedAtStr,
    referenceDate,
    externalDepositsInPeriod = 0,
    planChanges,
  } = params;

  let isBudgetConfigured = isAutoRenew && dailyBudgetAmount > 0;
  const activeDailyBudget = isBudgetConfigured ? (todayBudget > 0 ? todayBudget : dailyBudgetAmount) : 0;
  const todayStr = format(referenceDate, 'yyyy-MM-dd');

  // Determine the calendar days belonging to the active period up to today
  const periodDates: string[] = [];

  if (activeFilter === 'Daily') {
    periodDates.push(todayStr);
  } else if (activeFilter === 'Weekly') {
    // Week starts Monday, counts days elapsed so far this week up to TODAY
    const monday = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const mondayStr = format(monday, 'yyyy-MM-dd');
    // If user joined after Monday (e.g. Wednesday), start from registration day
    const startDateStr = (userCreatedAtStr && userCreatedAtStr > mondayStr) ? userCreatedAtStr : mondayStr;
    const startDate = parseISO(startDateStr);
    const days = eachDayOfInterval({ start: startDate <= referenceDate ? startDate : referenceDate, end: referenceDate });
    days.forEach((d) => {
      periodDates.push(format(d, 'yyyy-MM-dd'));
    });
  } else if (activeFilter === 'Monthly') {
    // Month starts 1st of month, counts days elapsed so far this month up to TODAY
    const firstOfMonth = startOfMonth(referenceDate);
    const firstOfMonthStr = format(firstOfMonth, 'yyyy-MM-dd');
    // If user joined after 1st of month, start from registration day
    const startDateStr = (userCreatedAtStr && userCreatedAtStr > firstOfMonthStr) ? userCreatedAtStr : firstOfMonthStr;
    const startDate = parseISO(startDateStr);
    const days = eachDayOfInterval({ start: startDate <= referenceDate ? startDate : referenceDate, end: referenceDate });
    days.forEach((d) => {
      periodDates.push(format(d, 'yyyy-MM-dd'));
    });
  } else {
    // 'All': from user registration date (or earliest record date) up to today
    const candidateDates: string[] = [todayStr];
    if (userCreatedAtStr) candidateDates.push(userCreatedAtStr);
    for (let i = 0; i < filtered.length; i++) {
      const d = filtered[i].expense_date?.split('T')[0]?.trim();
      if (d) candidateDates.push(d);
    }
    Object.keys(dailyRecords).forEach((d) => {
      const cleanD = d.split('T')[0]?.trim();
      if (cleanD) candidateDates.push(cleanD);
    });
    if (planChanges && planChanges.length > 0) {
      planChanges.forEach((c) => {
        if (c.effectiveFrom) candidateDates.push(c.effectiveFrom);
      });
    }
    candidateDates.sort();
    const earliestDateStr = candidateDates[0];
    const startDate = parseISO(earliestDateStr);
    const days = eachDayOfInterval({ start: startDate <= referenceDate ? startDate : referenceDate, end: referenceDate });
    days.forEach((d) => {
      periodDates.push(format(d, 'yyyy-MM-dd'));
    });
  }

  let periodBudget = 0;
  // Weekly / monthly cadence: the budget belongs to the WHOLE week / month, not to a day. Add it once per period.
  const countedCadencePools = new Set<string>();
  periodDates.forEach((d) => {
    if (activeFilter === 'All' && planChanges && planChanges.length > 0) {
      const cadencePlan = resolvePlanForDate(planChanges, d);
      if (cadencePlan && cadencePlan.isEnabled && (cadencePlan.cadence === 'weekly' || cadencePlan.cadence === 'monthly')) {
        const key = `${cadencePlan.cadence}_${getPeriodBounds(cadencePlan.cadence, d).start}`;
        if (!countedCadencePools.has(key)) {
          countedCadencePools.add(key);
          const b = getPeriodBounds(cadencePlan.cadence, d);
          periodBudget += (Number(cadencePlan.amount) || 0) + carryForPeriod(cadencePlan, b.start);
        }
        return;
      }
    }
    const carryPart = activeFilter === 'All' ? params.carryCoveredByDate?.[d] || 0 : 0;
    if (d === todayStr) {
      // Today: include today's allowance
      periodBudget += Math.max(0, (todayBudget > 0 ? todayBudget : (isBudgetConfigured ? dailyBudgetAmount : 0)) - carryPart);
    } else if (dailyRecords[d]) {
      if (dailyRecords[d].status !== 'unknown') {
        periodBudget += Math.max(0, (Number(dailyRecords[d].budget) || 0) - carryPart);
      }
    } else if (activeFilter === 'All') {
      // "All" counts only days the app really tracked (they have a record) and today.
      // A day nobody opened the app has no record and no Gullak entry, so it must not add a budget either
      // (it used to: 5 untouched days = ₹2,500 of budget that never existed in any other number).
    } else if (planChanges && planChanges.length > 0) {
      // Past day in the period governed by plan changes
      const plan = resolvePlanForDate(planChanges, d);
      if (plan && plan.isEnabled && plan.cadence === 'daily') {
        periodBudget += Number(plan.amount) || 0;
      }
    } else {
      // Past day in the period where no record was stored
      periodBudget += isBudgetConfigured ? dailyBudgetAmount : 0;
    }
  });

  // A weekly / monthly user may have no daily budget at all, yet a budget IS configured.
  if (activeFilter === 'All' && periodBudget > 0 && planChanges && planChanges.length > 0) {
    const nowPlan = resolvePlanForDate(planChanges, todayStr);
    if (nowPlan && nowPlan.isEnabled && nowPlan.cadence !== 'daily') isBudgetConfigured = true;
  }

  const daysCount = periodDates.length;
  const income = round2(totalIncome);
  const spent = round2(totalSpent);

  const budgetPool = round2(activeFilter === 'Daily' ? activeDailyBudget : periodBudget);
  const cycle = calculateCycleFinancials({
    scheduledBudget: budgetPool,
    eligibleIncome: income,
    eligibleReimbursements: round2(totalReimbursements),
    carriedOverAmount: externalDepositsInPeriod,
    spent,
  });

  const available = cycle.spendable;
  let isOver = cycle.isOverBudget;
  let remaining = cycle.remaining;
  const overAmount = cycle.overAmount;
  // A DEFICIT means the budget AND the income are both used up. The totals above add up all the income of the
  // period, but money moves day by day: an overspend that happened before an income arrived was paid from Gullak
  // (shown as "Drawn ... from Gullak"), and that later income is still unspent. While income is left there is no
  // deficit: the budget is used up and what remains to spend is that income.
  let budgetUsedUpIncomeLeft = false;
  if (params.funding && isOver && isBudgetConfigured && params.funding.incomeRemaining > 0) {
    isOver = false;
    remaining = round2(params.funding.incomeRemaining);
    budgetUsedUpIncomeLeft = true;
  }

  const isPeriodFilter = activeFilter === 'Weekly' || activeFilter === 'Monthly';
  const prefix = activeFilter === 'Daily' ? 'Daily' : (activeFilter === 'All' ? 'Total' : activeFilter);

  let label: string;
  let subtext: string | null = null;
  let remainingPeriodIncome = income;
  let remainingPeriodDeposits = externalDepositsInPeriod;

  // Real-time absorption: Overspending beyond budget is absorbed first from Income, then Gullak deposits.
  // Past finalized days were already settled on those days and must NEVER penalize current/new income.
  let todayLiveOverspent = 0;
  if (isBudgetConfigured) {
    const dayBudget = todayBudget > 0 ? todayBudget : dailyBudgetAmount;
    const daySpent = params.todaySpent !== undefined
      ? params.todaySpent
      : (params.spentByDate && params.spentByDate[todayStr] !== undefined
        ? params.spentByDate[todayStr]
        : (dailyRecords[todayStr]?.spent !== undefined ? dailyRecords[todayStr].spent : (activeFilter === 'Daily' ? spent : 0)));
    if (dayBudget > 0 && daySpent > dayBudget) {
      todayLiveOverspent = round2(daySpent - dayBudget);
    }
  }

  const periodOverspent = budgetPool > 0 ? Math.max(0, round2(spent - budgetPool)) : 0;
  const overspentBeyondBudget = isBudgetConfigured
    ? Math.max(todayLiveOverspent, periodOverspent)
    : 0;

  let isSpendingFromGullak: boolean;
  let gullakDrawnAmount: number;

  if (params.funding) {
    // Real, time-ordered numbers: budget first, then income, then Gullak.
    remainingPeriodIncome = round2(Math.max(0, params.funding.incomeRemaining));
    gullakDrawnAmount = round2(Math.max(0, params.funding.gullakDrawn));
    const depositsUsed = Math.min(externalDepositsInPeriod, gullakDrawnAmount);
    remainingPeriodDeposits = round2(externalDepositsInPeriod - depositsUsed);
    isSpendingFromGullak = gullakDrawnAmount > 0;
  } else {
    // Legacy estimate (kept for callers that do not pass `funding`).
    if (activeFilter === 'All' && params.availableIncomeBalance !== undefined) {
      remainingPeriodIncome = round2(Math.max(0, params.availableIncomeBalance));
    } else {
      const overspentFromIncome = Math.min(income, overspentBeyondBudget);
      remainingPeriodIncome = round2(income - overspentFromIncome);
    }

    const effectiveIncomeUsed = round2(Math.max(0, income - remainingPeriodIncome));
    const overspentBeyondIncome = round2(Math.max(0, overspentBeyondBudget - effectiveIncomeUsed));
    const overspentFromGullak = Math.min(externalDepositsInPeriod, overspentBeyondIncome);
    remainingPeriodDeposits = round2(externalDepositsInPeriod - overspentFromGullak);

    isSpendingFromGullak = isBudgetConfigured && (
      (income > 0 && remainingPeriodIncome === 0 && (overspentBeyondBudget >= income || effectiveIncomeUsed >= income)) ||
      overspentBeyondIncome > 0
    );
    gullakDrawnAmount = isBudgetConfigured ? overspentBeyondIncome : 0;
  }

  if (!isBudgetConfigured && income === 0 && externalDepositsInPeriod === 0) {
    label = activeFilter === 'Daily' ? 'Spent Today' : `${prefix} Spent`;
  } else if (isOver) {
    label = `${prefix} Budget Exceeded`;
    subtext = `Exceeded ${prefix.toLowerCase()} limit by ${formatCurrency(overAmount)}`;
    // Show the real income left (0 when it is used up), so the card never hides it.
    if (income > 0 && params.funding) subtext += ` + ${formatCurrency(remainingPeriodIncome)} income`;
  } else {
    label = activeFilter === 'Daily' ? 'Remaining to Spend' : `${prefix} Remaining`;

    if (isBudgetConfigured && budgetPool > 0) {
      const daysSuffix = isPeriodFilter ? ` (${daysCount} ${daysCount === 1 ? 'day' : 'days'})` : '';
      const parts: string[] = [];
      parts.push(budgetUsedUpIncomeLeft ? 'Budget used up' : `${formatCurrency(budgetPool)} budget${daysSuffix}`);
      if (income > 0) parts.push(`${formatCurrency(remainingPeriodIncome)} income`);
      if (totalReimbursements > 0 && activeFilter !== 'All') {
        parts.push(`${formatCurrency(round2(totalReimbursements))} reimbursed`);
      }
      if (externalDepositsInPeriod > 0) parts.push(`${formatCurrency(remainingPeriodDeposits)} deposits to Gullak`);
      if (parts.length > 1) {
        subtext = parts.join(' + ');
      } else {
        const poolDesc = activeFilter === 'Daily' ? 'daily allowance' : (activeFilter === 'All' ? 'total budget' : `budget${daysSuffix}`);
        subtext = `of ${formatCurrency(budgetPool)} ${poolDesc}`;
      }
    } else if (externalDepositsInPeriod > 0) {
      if (income > 0) {
        subtext = `${formatCurrency(remainingPeriodIncome)} income + ${formatCurrency(remainingPeriodDeposits)} deposits to Gullak`;
      } else {
        subtext = `${formatCurrency(remainingPeriodDeposits)} deposits to Gullak`;
      }
    } else if (income > 0 && params.funding) {
      subtext = `${formatCurrency(remainingPeriodIncome)} income`;
    }
  }

  const primaryAmount = round2((!isBudgetConfigured && income === 0 && externalDepositsInPeriod === 0) ? spent : (isOver ? overAmount : remaining));

  return {
    primaryAmount,
    primaryLabel: label,
    primarySubtext: subtext,
    displaySpent: spent,
    totalAvailable: available,
    isOverBudgetPeriod: isOver,
    periodIncome: income,
    periodSpent: spent,
    periodBudgetPool: budgetPool,
    isBudgetConfigured,
    remainingIncome: remainingPeriodIncome,
    remainingDeposits: remainingPeriodDeposits,
    isSpendingFromGullak,
    gullakDrawnAmount,
  };
};

export interface ParsedChipNumber {
  prefix: string;
  numericValue: number;
  suffix: string;
  hasDecimals: boolean;
}

/**
 * Parses numeric currency components from a chip string for ticker animation.
 * e.g. "₹19,750 budget" -> prefix: "₹", numericValue: 19750, suffix: " budget", hasDecimals: false
 * e.g. "+₹2,823.8 income" -> prefix: "+₹", numericValue: 2823.8, suffix: " income", hasDecimals: true
 */
export function parseChipNumber(chipStr: string): ParsedChipNumber | null {
  if (!chipStr) return null;
  const match = chipStr.match(/^(.*?₹\s?)([0-9,]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) return null;
  const prefix = match[1];
  const rawNum = match[2].replace(/,/g, '');
  const suffix = match[3];
  const numericValue = parseFloat(rawNum);
  if (isNaN(numericValue)) return null;
  const hasDecimals = match[2].includes('.');
  return { prefix, numericValue, suffix, hasDecimals };
}

/**
 * Returns the filter-specific header title for Pure Mode (budget mode disabled).
 * Projects "Remaining" when user has a positive balance, "Deficit" when overspent, or "Spent" when zero inflow.
 * - Daily: "Daily Remaining" / "Daily Deficit" / "Spent Today"
 * - Weekly: "Weekly Remaining" / "Weekly Deficit" / "Weekly Spent"
 * - Monthly: "Monthly Remaining" / "Monthly Deficit" / "Monthly Spent"
 * - All: "Total Remaining" / "Total Deficit" / "Total Spent"
 */
export const getPureHeroTitle = (activeFilter: string, isDeficit = false, hasInflow = true): string => {
  const prefix = activeFilter === 'Daily' ? 'Daily' : (activeFilter === 'All' ? 'Total' : activeFilter);
  if (!hasInflow) {
    return activeFilter === 'Daily' ? 'Spent Today' : `${prefix} Spent`;
  }
  if (isDeficit) {
    return `${prefix} Deficit`;
  }
  return `${prefix} Remaining`;
};

export interface PureHeroMetrics {
  title: string;
  totalRemaining: number;
  totalExpense: number;
  inflow: number;
  outflow: number;
  net: number;
  isDeficit: boolean;
}

/**
 * Calculates pure mode hero metrics: total remaining (big number), inflow, outflow, and net cashflow.
 */
export const calculatePureHeroMetrics = (
  activeFilter: string,
  totalInflow: number,
  totalSpent: number
): PureHeroMetrics => {
  const inflow = round2(Math.max(0, totalInflow));
  const outflow = round2(Math.max(0, totalSpent));
  const net = round2(inflow - outflow);
  const isDeficit = outflow > inflow && inflow > 0;
  const hasInflow = inflow > 0;

  let totalRemaining: number;
  if (!hasInflow) {
    totalRemaining = outflow;
  } else if (isDeficit) {
    totalRemaining = round2(outflow - inflow);
  } else {
    totalRemaining = net;
  }

  const title = getPureHeroTitle(activeFilter, isDeficit, hasInflow);

  return {
    title,
    totalRemaining,
    totalExpense: outflow,
    inflow,
    outflow,
    net,
    isDeficit,
  };
};

export interface ExpenseTotals {
  totalIncome: number;
  totalSpent: number;
  /** Confirmed friend reimbursements (not income). */
  totalReimbursements: number;
}

/**
 * Aggregates a list of expenses into totalIncome and totalSpent.
 * Extracted from HomeScreen to resolve accumulation logic leakage (.scratch/home/issues/05).
 */
export const calculateExpenseTotals = (
  expenses: Array<{ amount: number | string; category_id?: string | null; type?: string; transaction_class?: string | null }>,
  catMap: Record<string, { name?: string; is_income?: boolean } | undefined>
): ExpenseTotals => {
  let income = 0;
  let spent = 0;
  let reimbursements = 0;
  for (let i = 0; i < expenses.length; i++) {
    const e = expenses[i];
    const cat = e.category_id ? catMap[e.category_id] : undefined;
    const amt = Number(e.amount) || 0;
    if (isEligibleReimbursement(e)) reimbursements += amt;
    else if (isCountedIncome(e, cat)) income += amt;
    else if (isCountedExpense(e, cat)) spent += amt;
    // self-transfers fall through: neither income nor expense
  }
  return {
    totalIncome: round2(income),
    totalSpent: round2(spent),
    totalReimbursements: round2(reimbursements),
  };
};


export interface HeroSubtextChip {
  id: string;
  text: string;
  badgeText: string | null;
  approxSize: number;
}

/** "Drawn ₹136 from Gullak": it already happened, so it is past tense (not "using"). */
export const drawnFromGullakText = (amount: number): string =>
  amount > 0 ? `drawn ₹${formatCurrency(amount).replace('₹', '')} from Gullak` : 'drawn from Gullak';

/**
 * The small chips under the big hero number. The Gullak badge sits on the income chip. When there is no income
 * chip to carry it, Gullak gets its own chip: it never invents an income number (it used to say "₹0 income").
 */
export function buildHeroSubtextChips(input: {
  effectiveSubtext: string | null | undefined;
  isBudgetModeEnabled: boolean;
  isSpendingFromGullak: boolean;
  gullakDrawnAmount: number;
  periodIncome: number;
}): HeroSubtextChip[] {
  const { effectiveSubtext, isBudgetModeEnabled, isSpendingFromGullak, gullakDrawnAmount, periodIncome } = input;
  const standalone = (): HeroSubtextChip => {
    const drawn = drawnFromGullakText(gullakDrawnAmount);
    const text = drawn.charAt(0).toUpperCase() + drawn.slice(1);
    return { id: 'gullak_only', text, badgeText: null, approxSize: text.length };
  };

  if (!effectiveSubtext) {
    return isBudgetModeEnabled && isSpendingFromGullak && gullakDrawnAmount > 0 ? [standalone()] : [];
  }

  const rawParts = effectiveSubtext.includes(' + ') ? effectiveSubtext.split(' + ') : [effectiveSubtext];
  const items: HeroSubtextChip[] = rawParts.map((rawPart, index) => {
    const trimmed = rawPart.trim();
    const text = index > 0 && !trimmed.startsWith('+') ? `+${trimmed}` : trimmed;
    const lower = text.toLowerCase();
    const isIncomeChip = lower.includes('income');
    const isGullakChip = lower.includes('gullak');

    const showGullakSpending =
      (isIncomeChip && isSpendingFromGullak) || (!periodIncome && isGullakChip && isSpendingFromGullak);

    const badgeText = showGullakSpending ? drawnFromGullakText(gullakDrawnAmount) : null;
    return { id: `${index}_${text}`, text, badgeText, approxSize: text.length + (badgeText ? badgeText.length + 6 : 0) };
  });

  if (isSpendingFromGullak && gullakDrawnAmount > 0 && !items.some((i) => i.badgeText)) items.push(standalone());

  items.sort((a, b) => a.approxSize - b.approxSize);
  return items;
}
