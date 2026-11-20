import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { round2 } from '../formatters';
import { calculateCycleFinancials } from '../budgetCalculations';
import { monthlyAllowanceFromWeeklyBudget } from '../../money/budgetAllowance';
import { BudgetPlanChange } from '../../types';
import { getPeriodBounds, carryForPeriod, resolvePlanForDate, getDateOwner, BUDGET_RULES_V2_FROM } from './core';
import { buildBudgetPools, poolSpentBefore } from './pools';

export interface PeriodSummaryInfo {
  cadence: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  activeStart: string;
  activeEnd: string;
  budget: number;
  spent: number;
  remaining: number;
  isOver: boolean;
  overBy: number;
  rolloverLabelDate: string;
  // Dynamic Non-Binding Pace Suggestions & Calendar-Month Projections:
  remainingDays: number;
  suggestedDailyPace: number;
  suggestedWeeklyPace?: number;
  projectedMonthlyBudget?: number;
  baseBudget?: number;
  carriedOverAmount?: number;
  carryMode?: 'additive' | 'allocation';
}

/**
 * 6. Returns the live period summary for the hero card (D8).
 * Returns null if the current owner is 'paused' or 'daily'.
 */
export function getCurrentPeriodSummary(
  changes: BudgetPlanChange[],
  spentByDate: Record<string, number>,
  todayStr: string,
  incomeByDate?: Record<string, number>
): PeriodSummaryInfo | null {
  const owner = getDateOwner(changes, todayStr);
  if (owner === 'paused' || owner === 'daily') {
    return null;
  }

  const bounds = getPeriodBounds(owner, todayStr);
  const plan = resolvePlanForDate(changes, todayStr);
  const fullAmount = plan ? plan.amount : 0;

  // Walk backwards from todayStr within [bounds.start, todayStr] to find activeStart
  let activeStart = todayStr;
  const startLimit = parseISO(bounds.start);
  let cur = parseISO(todayStr);
  while (cur >= startLimit) {
    const curStr = format(cur, 'yyyy-MM-dd');
    const curOwner = getDateOwner(changes, curStr);
    const curPlan = resolvePlanForDate(changes, curStr);
    const curAmount = curPlan ? curPlan.amount : 0;
    if (curOwner === owner && curAmount === fullAmount) {
      activeStart = curStr;
      cur = subDays(cur, 1);
    } else {
      break;
    }
  }

  // Walk forward from todayStr up to bounds.end to check if a scheduled change terminates this slice early
  let activeEnd = bounds.end;
  const endLimit = parseISO(bounds.end);
  let fwd = addDays(parseISO(todayStr), 1);
  while (fwd <= endLimit) {
    const fwdStr = format(fwd, 'yyyy-MM-dd');
    const fwdOwner = getDateOwner(changes, fwdStr);
    const fwdPlan = resolvePlanForDate(changes, fwdStr);
    const fwdAmount = fwdPlan ? fwdPlan.amount : 0;
    if (fwdOwner !== owner || fwdAmount !== fullAmount) {
      activeEnd = format(subDays(fwd, 1), 'yyyy-MM-dd');
      break;
    }
    fwd = addDays(fwd, 1);
  }

  // 100% Real Money Invariant: Budget pool is fully intact without proration
  const carryMode = plan?.carryMode;
  const carriedOverAmount = plan?.carriedOverAmount || 0;

  // Sum spend and income from activeStart to todayStr
  let spent = 0;
  let income = 0;
  const daysSoFar = eachDayOfInterval({
    start: parseISO(activeStart),
    end: parseISO(todayStr),
  });
  for (const d of daysSoFar) {
    const dStr = format(d, 'yyyy-MM-dd');
    spent += Number(spentByDate[dStr]) || 0;
    if (incomeByDate) {
      income += Number(incomeByDate[dStr]) || 0;
    }
  }
  spent = round2(spent);
  income = round2(income);

  // ADR 0012: ONE budget per calendar period. After Pure Mode (or a switch) and back inside the same period the
  // hero continues with what is left of the period's pool; Pure Mode days spent from the same pool count too.
  const pools = buildBudgetPools(changes, todayStr);
  const pool = pools[`${owner}_${bounds.start}`];
  const poolMode = !!pool && activeStart > pool.startedOn && activeStart >= BUDGET_RULES_V2_FROM;
  if (poolMode && pool) {
    const tomorrowStr = format(addDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
    const through = poolSpentBefore(pools, changes, pool, tomorrowStr, spentByDate);
    if (pool.closedOn && activeStart >= pool.closedOn) {
      // Switched away and back inside this period: what was left was carried away, nothing is left here.
      spent = round2(pool.budget + Math.max(0, through - poolSpentBefore(pools, changes, pool, pool.closedOn, spentByDate)));
    } else {
      spent = through;
    }
  }

  const fin = calculateCycleFinancials({
    scheduledBudget: poolMode && pool ? pool.budget : fullAmount,
    carriedOverAmount: poolMode ? 0 : carryForPeriod(plan, bounds.start),
    // Income is a separate pool (see moneyWaterfall.ts); it is not part of the period budget.
    eligibleIncome: 0,
    spent,
  });

  const budget = fin.spendable;
  const remaining = fin.remaining;
  const isOver = fin.isOverBudget;
  const overBy = fin.overAmount;

  // Dynamic Pace Suggestions (Non-binding guidance):
  const today = parseISO(todayStr);
  const periodEndDate = parseISO(bounds.end);
  const remainingDays = Math.max(1, differenceInCalendarDays(periodEndDate, today) + 1);

  // Suggested Daily Pace to stay within budget
  const suggestedDailyPace = Math.round(remaining / remainingDays);

  // If Monthly mode: Suggested Weekly Pace
  let suggestedWeeklyPace: number | undefined;
  if (owner === 'monthly') {
    suggestedWeeklyPace = Math.round((remaining / remainingDays) * 7);
  }

  // If Weekly mode: Projected Monthly Budget based on actual calendar days in current month (28, 29, 30, or 31 days)
  let projectedMonthlyBudget: number | undefined;
  if (owner === 'weekly') {
    // Same rule as every screen (BUD-009): a weekly budget is worth weekly / 7 per day, for each day of the month.
    projectedMonthlyBudget = Math.round(monthlyAllowanceFromWeeklyBudget(fullAmount, todayStr));
  }

  return {
    cadence: owner,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    activeStart,
    activeEnd,
    budget,
    spent,
    remaining,
    isOver,
    overBy,
    rolloverLabelDate: activeEnd,
    remainingDays,
    suggestedDailyPace,
    suggestedWeeklyPace,
    projectedMonthlyBudget,
    baseBudget: fullAmount,
    carriedOverAmount,
    carryMode,
  };
}
