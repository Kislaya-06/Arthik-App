import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useNotificationStore, NotificationType } from '../store/notificationStore';
import { makeIncomeClassifier } from './incomeClassifier';
import { computeSpentByDate } from './budgetCalculations';
import { getCurrentPeriodSummary } from './budgetPeriods';
import {
  CadencePeriod,
  PeriodStats,
  PlanContext,
  buildNotificationPlan,
} from './notificationPolicy';
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

    if (isIncome(e) || e.transaction_class === 'self_transfer' || e.transaction_class === 'reimbursement') continue;
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
      const saved = rec.status === 'exceeded' ? 0 : rec.saved || 0;
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
