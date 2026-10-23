import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endOfMonth } from 'date-fns/endOfMonth';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { subMonths } from 'date-fns/subMonths';
import { subWeeks } from 'date-fns/subWeeks';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useNotificationStore, NotificationType } from '../store/notificationStore';
import {
  dailyCarryForDate,
  periodCarryForPeriod,
  getPeriodBounds,
  getNextPeriodStart,
  resolvePlanForDate,
  getCurrentPeriodSummary,
} from './budgetPeriods';
import {
  CadencePeriod,
  PeriodStats,
  PlanContext,
  buildNotificationPlan,
} from './notificationPolicy';
import { makeIncomeClassifier } from './incomeClassifier';
import { isExcludedFromTotals } from './transactionUtils';
import { computeSpentByDate } from './budgetCalculations';
import {
  NOTIFICATIONS_ENABLED_KEY,
  applyNotificationPlan,
  cancelAllPlanned,
  collectDeliveredForInbox,
  migrateLegacyNotifications,
} from './notificationService';

/**
 * Glue between the app's data and the notification planner.
 * Whenever the user's data changes (or the app comes to the foreground) the plan is rebuilt from scratch and
 * the OS schedule is replaced, so every scheduled message is always true, and a nudge vanishes the moment the
 * user logs something. Unchanged plans are not rescheduled.
 */

const SYNC_DEBOUNCE_MS = 3000;
const dayOf = (e: Expense): string => (e.expense_date || '').split('T')[0].trim();

interface Bucket {
  txnCount: number;
  spent: number;
  byCategory: Map<string, number>;
}

function emptyBucket(): Bucket {
  return { txnCount: 0, spent: 0, byCategory: new Map() };
}

/** Pure-ish: builds the planner input from the current store state. Exported for tests. */
/** Days (today and the next 2 weeks) on which part of the daily budget is carried-over money. */
function buildCarryDays(
  now: Date,
  budget: ReturnType<typeof useDailyBudgetStore.getState>
): NonNullable<PlanContext['carryDays']> {
  const out: NonNullable<PlanContext['carryDays']> = [];
  if (!budget.isBudgetModeEnabled || !budget.planChanges || budget.planChanges.length === 0) return out;
  for (let i = 0; i < 14; i++) {
    const d = format(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), 'yyyy-MM-dd');
    const c = dailyCarryForDate(budget.planChanges, (x) => budget.dailyRecords[x]?.budget, budget.dailyBudgetAmount, d);
    if (!c || c.funded <= 0) continue;
    out.push({ date: d, mode: c.mode, budget: c.base + c.extraBudget, funded: c.funded, toAdd: c.toAdd, remainingAfter: c.remainingAfter });
  }
  return out;
}

/**
 * The first day / period AFTER carried money has run out (CAR-001): the user is told once that from then on
 * they must add the money themselves. Switches that only added carry to the first day (next_day) have no end.
 */
function buildCarryEnds(
  days: NonNullable<PlanContext['carryDays']>,
  periods: NonNullable<PlanContext['carryPeriods']>
): NonNullable<PlanContext['carryEnds']> {
  const out: NonNullable<PlanContext['carryEnds']> = [];
  for (const d of days) {
    if (d.mode === 'next_day' || d.remainingAfter > 0) continue;
    const next = format(new Date(new Date(`${d.date}T12:00:00`).getTime() + 86400000), 'yyyy-MM-dd');
    out.push({ date: next, cadence: 'daily', budget: d.budget });
  }
  for (const p of periods) {
    if (p.remainingAfter > 0) continue;
    out.push({ date: getNextPeriodStart(p.cadence, p.periodStart), cadence: p.cadence, budget: p.budget });
  }
  return out;
}

/** Periods on which part of the weekly / monthly budget is carried-over money (CAR-001 Mode B). */
function buildCarryPeriods(
  now: Date,
  budget: ReturnType<typeof useDailyBudgetStore.getState>
): NonNullable<PlanContext['carryPeriods']> {
  const out: NonNullable<PlanContext['carryPeriods']> = [];
  if (!budget.isBudgetModeEnabled || !budget.planChanges || budget.planChanges.length === 0) return out;
  const todayStr = format(now, 'yyyy-MM-dd');
  let plan = resolvePlanForDate(budget.planChanges, todayStr);
  if (!plan || !plan.isEnabled || (plan.cadence !== 'weekly' && plan.cadence !== 'monthly') || plan.carryMode !== 'allocation') {
    const upcoming = budget.planChanges
      .filter(
        (p) =>
          p.isEnabled &&
          (p.cadence === 'weekly' || p.cadence === 'monthly') &&
          p.carryMode === 'allocation' &&
          Number(p.carriedOverAmount) > 0 &&
          p.effectiveFrom >= todayStr
      )
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    plan = upcoming[0] || null;
  }
  if (!plan || (plan.cadence !== 'weekly' && plan.cadence !== 'monthly')) return out;

  let currentStart = getPeriodBounds(plan.cadence, plan.effectiveFrom).start;
  const seen = new Set<string>();
  while (true) {
    if (seen.has(currentStart)) break;
    seen.add(currentStart);
    const c = periodCarryForPeriod(budget.planChanges, currentStart);
    if (!c || c.funded <= 0) break;
    out.push({
      periodStart: currentStart,
      cadence: plan.cadence,
      budget: c.base,
      funded: c.funded,
      toAdd: c.toAdd,
      remainingAfter: c.remainingAfter,
    });
    if (c.remainingAfter <= 0) break;
    currentStart = getNextPeriodStart(plan.cadence, currentStart);
  }
  return out;
}

export function buildPlanContext(now: Date): PlanContext {
  const expenses = useExpenseStore.getState().expenses;
  const categories = useCategoryStore.getState().categories;
  const budget = useDailyBudgetStore.getState();

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const isIncome = makeIncomeClassifier(categories);

  const todayStr = format(now, 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

  const week = emptyBucket();
  const prevWeek = emptyBucket();
  const month = emptyBucket();
  const prevMonth = emptyBucket();
  let loggedToday = false;

  for (const e of expenses) {
    const d = dayOf(e);
    if (!d) continue;
    let enteredToday = false;
    if (e.created_at) {
      try {
        enteredToday = format(parseISO(e.created_at), 'yyyy-MM-dd') === todayStr;
      } catch {
        enteredToday = false;
      }
    }
    if (d === todayStr || enteredToday) loggedToday = true;

    if (isIncome(e) || isExcludedFromTotals(e)) continue;
    const amount = Number(e.amount) || 0;
    const name = (e.category_id && catMap.get(e.category_id)?.name) || 'Other';
    const add = (b: Bucket) => {
      b.txnCount += 1;
      b.spent += amount;
      b.byCategory.set(name, (b.byCategory.get(name) || 0) + amount);
    };
    if (d >= weekStart && d <= weekEnd) add(week);
    if (d >= prevWeekStart && d <= prevWeekEnd) add(prevWeek);
    if (d >= monthStart && d <= monthEnd) add(month);
    if (d >= prevMonthStart && d <= prevMonthEnd) add(prevMonth);
  }

  const top = (b: Bucket) => {
    let best: { name: string; amount: number } | null = null;
    b.byCategory.forEach((amount, name) => {
      if (!best || amount > best.amount) best = { name, amount };
    });
    return best;
  };

  const isGullak = budget.isBudgetModeEnabled;
  const cadence = budget.budgetCadence;
  const spentByDate = computeSpentByDate(expenses, isIncome);
  const todaySpent = spentByDate[todayStr] || 0;

  // Gullak stats from the day records (finalized past days + today so far)
  let daysTracked = 0;
  let daysUnderBudget = 0;
  let weekSaved = 0;
  let monthSaved = 0;
  if (isGullak) {
    for (const rec of Object.values(budget.dailyRecords)) {
      if (!rec || !(rec.budget > 0) || rec.date > todayStr) continue;
      const saved = rec.status === 'missed' ? 0 : rec.saved || 0;
      if (rec.date >= weekStart && rec.date <= weekEnd) {
        daysTracked += 1;
        if (rec.status === 'saved' || rec.status === 'even' || rec.status === 'active') daysUnderBudget += 1;
        weekSaved += saved;
      }
      if (rec.date >= monthStart && rec.date <= monthEnd) monthSaved += saved;
    }
    for (const p of Object.values(budget.budgetPeriods || {})) {
      if (p.activeEnd >= monthStart && p.activeEnd <= monthEnd && p.activeEnd < todayStr) monthSaved += p.amountSaved || 0;
    }
  }

  let period: CadencePeriod | null = null;
  if (isGullak && cadence !== 'daily') {
    const s = getCurrentPeriodSummary(budget.planChanges, spentByDate, todayStr);
    if (s && s.budget > 0) {
      period = { cadence: s.cadence, budget: s.budget, spent: s.spent, remaining: s.remaining, isOver: s.isOver, overBy: s.overBy };
    }
  }

  let dailyBudget = 0;
  if (isGullak && cadence === 'daily' && budget.isAutoRenew && budget.dailyBudgetAmount > 0) {
    dailyBudget = budget.dailyRecords[todayStr]?.budget || budget.dailyBudgetAmount;
  }

  const stats = (b: Bucket, prev: Bucket, saved: number): PeriodStats => ({
    txnCount: b.txnCount,
    spent: Math.round(b.spent * 100) / 100,
    prevSpent: Math.round(prev.spent * 100) / 100,
    topCategory: top(b),
    daysTracked,
    daysUnderBudget,
    savedToGullak: Math.round(saved * 100) / 100,
  });

  const carryDays = isGullak ? buildCarryDays(now, budget) : undefined;
  const carryPeriods = isGullak ? buildCarryPeriods(now, budget) : undefined;

  return {
    now,
    profile: isGullak ? 'gullak' : 'pure',
    cadence,
    loggedToday,
    dailyBudget,
    todaySpent,
    streak: budget.savingsStreak || 0,
    week: stats(week, prevWeek, weekSaved),
    month: { ...stats(month, prevMonth, monthSaved), daysTracked: 0, daysUnderBudget: 0 },
    period,
    monthName: format(now, 'MMMM'),
    carryDays,
    carryPeriods,
    carryEnds: isGullak ? buildCarryEnds(carryDays || [], carryPeriods || []) : undefined,
  };
}

/** Rebuild + apply the plan for the signed-in user. Safe to call any time. */
export async function syncNotificationPlan(): Promise<void> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) {
      await cancelAllPlanned();
      return;
    }
    // Don't plan from half-loaded data (it would think nothing was logged).
    if (!useExpenseStore.getState().isExpensesLoaded) return;
    if (useDailyBudgetStore.getState().hydratedForUserId !== user.id) return;

    await migrateLegacyNotifications();
    const plan = buildNotificationPlan(buildPlanContext(new Date()));
    await applyNotificationPlan(plan);
  } catch (error) {
    if (__DEV__) console.log('[NotificationSync] failed:', error);
  }
}

const ARCHIVE_TYPES: Record<string, NotificationType> = {
  weekly_recap: 'weekly_recap',
  monthly_recap: 'monthly_recap',
  gullak_reward: 'gullak_reward',
};

/** Keep delivered recaps / rewards in the in-app bell too. */
export async function archiveDeliveredNotifications(): Promise<void> {
  await collectDeliveredForInbox((item) => {
    const type = ARCHIVE_TYPES[item.type];
    if (!type) return;
    useNotificationStore.getState().addNotification({
      id: `plan_${item.id}`,
      title: item.title,
      message: item.message,
      type,
      data: { screen: item.screen },
    });
  });
}

/** Settings toggle. */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  if (enabled) {
    await syncNotificationPlan();
  } else {
    await cancelAllPlanned();
  }
}

/** Start keeping the schedule in sync. Returns a cleanup function. */
export function startNotificationSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      syncNotificationPlan();
    }, SYNC_DEBOUNCE_MS);
  };

  const unsubExpenses = useExpenseStore.subscribe(schedule);
  const unsubBudget = useDailyBudgetStore.subscribe(schedule);
  const unsubAuth = useAuthStore.subscribe(schedule);
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      archiveDeliveredNotifications();
      schedule();
    }
  });

  archiveDeliveredNotifications();
  schedule();

  return () => {
    if (timer) clearTimeout(timer);
    unsubExpenses();
    unsubBudget();
    unsubAuth();
    appState.remove();
  };
}
