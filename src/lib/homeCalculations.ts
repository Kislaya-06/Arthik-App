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
import { resolvePlanForDate, getPeriodBounds, carryForPeriod, dailyCarryForDate, periodCarryForPeriod } from './budgetPeriods';
import { isCountedIncome, isCountedExpense, PURE_DEFICIT_NOTE } from './transactionUtils';
import { BudgetPlanChange } from '../types';
import type { Expense } from '../store/expenseStore';
import type { GullakDeposit } from '../store/dailyBudgetStore';

export type HomeFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly';

export interface ExpenseDateItem {
  expense_date?: string;
  note?: string | null;
  amount?: number | string;
  type?: string;
  category_id?: string | null;
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
          const pc = periodCarryForPeriod(planChanges, b.start);
          // Only the part paid from carried money is left out; the part the user still has to add (gap) counts like any budget.
          const carryCover = pc ? pc.funded : 0;
          periodBudget += Math.max(0, (Number(cadencePlan.amount) || 0) + carryForPeriod(cadencePlan, b.start) - carryCover);
        }
        return;
      }
    }
    const carryPart = activeFilter === 'All' ? params.carryCoveredByDate?.[d] || 0 : 0;
    let dayBudget = 0;

    if (d === todayStr) {
      // Today: include today's allowance
      dayBudget = todayBudget > 0 ? todayBudget : (isBudgetConfigured ? dailyBudgetAmount : 0);
    } else if (dailyRecords[d] && Number(dailyRecords[d].budget) > 0) {
      dayBudget = Number(dailyRecords[d].budget);
    } else if (planChanges && planChanges.length > 0) {
      const plan = resolvePlanForDate(planChanges, d);
      if (plan) {
        if (!plan.isEnabled) {
          dayBudget = 0;
        } else if (plan.cadence === 'daily') {
          dayBudget = Number(plan.amount) || dailyBudgetAmount;
        }
      } else {
        dayBudget = isBudgetConfigured ? dailyBudgetAmount : 0;
      }
    } else {
      dayBudget = isBudgetConfigured ? dailyBudgetAmount : 0;
    }

    periodBudget += Math.max(0, dayBudget - carryPart);
  });

  // A weekly / monthly user may have no daily budget at all, yet a budget IS configured.
  if (activeFilter === 'All' && periodBudget > 0 && planChanges && planChanges.length > 0) {
    const nowPlan = resolvePlanForDate(planChanges, todayStr);
    if (nowPlan && nowPlan.isEnabled && nowPlan.cadence !== 'daily') isBudgetConfigured = true;
  }

  const daysCount = periodDates.length;
  const income = round2(totalIncome);
  const autoDeficitSum = (filtered || []).reduce((sum, e: any) => {
    if (typeof e?.note === 'string' && e.note.startsWith(PURE_DEFICIT_NOTE)) {
      return sum + (Number(e.amount) || 0);
    }
    return sum;
  }, 0);
  const periodIncome = Math.max(0, round2(income - autoDeficitSum));
  const spent = round2(totalSpent);

  const budgetPool = round2(activeFilter === 'Daily' ? activeDailyBudget : periodBudget);
  const cycle = calculateCycleFinancials({
    scheduledBudget: budgetPool,
    eligibleIncome: income,
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
    if (periodIncome > 0 && params.funding) subtext += ` + ${formatCurrency(remainingPeriodIncome)} income`;
  } else {
    label = activeFilter === 'Daily' ? 'Remaining to Spend' : `${prefix} Remaining`;

    if (isBudgetConfigured && budgetPool > 0) {
      const daysSuffix = isPeriodFilter ? ` (${daysCount} ${daysCount === 1 ? 'day' : 'days'})` : '';
      const parts: string[] = [];
      parts.push(budgetUsedUpIncomeLeft ? 'Budget used up' : `${formatCurrency(budgetPool)} budget${daysSuffix}`);
      if (periodIncome > 0) parts.push(`${formatCurrency(remainingPeriodIncome)} income`);
      if (externalDepositsInPeriod > 0) parts.push(`${formatCurrency(remainingPeriodDeposits)} deposits to Gullak`);
      if (parts.length > 1) {
        subtext = parts.join(' + ');
      } else {
        const poolDesc = activeFilter === 'Daily' ? 'daily allowance' : (activeFilter === 'All' ? 'total budget' : `budget${daysSuffix}`);
        subtext = `of ${formatCurrency(budgetPool)} ${poolDesc}`;
      }
    } else if (externalDepositsInPeriod > 0) {
      if (periodIncome > 0) {
        subtext = `${formatCurrency(remainingPeriodIncome)} income + ${formatCurrency(remainingPeriodDeposits)} deposits to Gullak`;
      } else {
        subtext = `${formatCurrency(remainingPeriodDeposits)} deposits to Gullak`;
      }
    } else if (periodIncome > 0 && params.funding) {
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
    periodIncome,
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
  for (let i = 0; i < expenses.length; i++) {
    const e = expenses[i];
    const cat = e.category_id ? catMap[e.category_id] : undefined;
    const amt = Number(e.amount) || 0;
    if (isCountedIncome(e, cat)) income += amt;
    else if (isCountedExpense(e, cat)) spent += amt;
    // self-transfers fall through: neither income nor expense
  }
  return {
    totalIncome: round2(income),
    totalSpent: round2(spent),
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

    // When income is exhausted (e.g. "+₹0 income") and money was drawn from Gullak,
    // do NOT display an invented "+₹0 income" chip — promote Gullak spending to its own standalone chip.
    if (lower.includes('₹0 income') && isSpendingFromGullak && gullakDrawnAmount > 0) {
      return standalone();
    }

    const showGullakSpending =
      (isIncomeChip && isSpendingFromGullak) || (!periodIncome && isGullakChip && isSpendingFromGullak);

    const badgeText = showGullakSpending ? drawnFromGullakText(gullakDrawnAmount) : null;
    return { id: `${index}_${text}`, text, badgeText, approxSize: text.length + (badgeText ? badgeText.length + 6 : 0) };
  });

  if (isSpendingFromGullak && gullakDrawnAmount > 0 && !items.some((i) => i.badgeText || i.id === 'gullak_only')) items.push(standalone());

  items.sort((a, b) => a.approxSize - b.approxSize);
  return items;
}

export type UnifiedTxItem =
  | { kind: 'expense'; data: Expense; date: string; created_at: string }
  | { kind: 'gullak'; data: GullakDeposit; date: string; created_at: string };

/**
 * Selects the top `limit` most recent transactions across expenses and Gullak deposits
 * in a single-pass O(N) bounded collection, eliminating full-array allocations and O(N log N) sorting.
 *
 * Sorting semantics strictly preserved:
 * 1. Primary: date descending (latest first).
 * 2. Tie-breaker: created_at descending (latest first).
 * 3. Equal timestamps: stable encounter order (expenses before deposits, earlier array items first).
 */
export function selectRecentTransactions(
  expenses: readonly Expense[],
  gullakDeposits: readonly GullakDeposit[],
  limit = 5
): UnifiedTxItem[] {
  if (limit <= 0) return [];
  const top: UnifiedTxItem[] = [];

  const consider = (
    kind: 'expense' | 'gullak',
    data: any,
    date: string,
    createdAt: string
  ) => {
    // If the top buffer is already full, check if candidate can strictly beat the current worst item.
    // In our stable order, ties go to earlier-seen items, so candidate must strictly beat worst.
    if (top.length === limit) {
      const worst = top[limit - 1];
      const cmpWorst = worst.date.localeCompare(date) || worst.created_at.localeCompare(createdAt);
      if (cmpWorst >= 0) {
        return;
      }
    }

    const item: UnifiedTxItem =
      kind === 'expense'
        ? { kind: 'expense', data, date, created_at: createdAt }
        : { kind: 'gullak', data, date, created_at: createdAt };

    let insertIdx = top.length;
    for (let i = 0; i < top.length; i++) {
      const cur = top[i];
      const cmp = cur.date.localeCompare(date) || cur.created_at.localeCompare(createdAt);
      if (cmp < 0) {
        insertIdx = i;
        break;
      }
    }

    top.splice(insertIdx, 0, item);
    if (top.length > limit) {
      top.pop();
    }
  };

  for (let i = 0; i < expenses.length; i++) {
    const e = expenses[i];
    consider('expense', e, e.expense_date || '', e.created_at || '');
  }

  for (let i = 0; i < gullakDeposits.length; i++) {
    const d = gullakDeposits[i];
    consider('gullak', d, d.date || '', d.created_at || '');
  }

  return top;
}
