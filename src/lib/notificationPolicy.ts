/**
 * notificationPolicy.ts
 *
 * THE rulebook for every notification Arthik shows. Pure functions only (no React, no stores, no
 * expo-notifications), so every rule is unit-tested.
 *
 * Principles
 *  1. Say something the user cannot already see on the screen in front of them.
 *  2. Deliver every necessary notification: scheduled messages fire at their intended hours
 *     (morning Gullak reward / carry cover, evening recaps, or evening nudge) without dropping valid messages.
 *  3. Never nag: nudges only fire if nothing was logged, and stop after 3 unopened days.
 *  4. Be accurate: numbers come from what the user has actually logged; never promise more than the
 *     accounting does (an over-limit day saves 0 and ends the streak, but whether the overspend is taken
 *     from income or Gullak depends on the user's balances, so the copy never claims it).
 *  5. Short and clean: a plain title (<= ~34 chars) and one calm line, no emoji, no shouting.
 *
 * Two audiences
 *  - "pure"   : Budget Mode OFF. No limits, no Gullak. They get: a log nudge, a weekly and a monthly recap.
 *  - "gullak" : Budget Mode ON. Additionally: morning "saved yesterday" reward (daily cadence),
 *               limit alerts, and period-aware recaps (weekly / monthly cadence).
 *
 * Everything scheduled is computed on-device from the latest data and RE-planned every time the app opens or
 * the user's data changes, so a scheduled message is cancelled the moment it stops being true.
 */

import { addDays, endOfMonth, endOfWeek, format } from 'date-fns';
import { formatCurrency } from './formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanType = 'log_nudge' | 'gullak_reward' | 'weekly_recap' | 'monthly_recap' | 'carry_cover';
export type ChannelKey = 'alerts' | 'reminders' | 'gullak' | 'recaps';
export type Cadence = 'daily' | 'weekly' | 'monthly';
export type Profile = 'pure' | 'gullak';

export interface ChannelSpec {
  id: string;
  name: string;
  description: string;
  importance: 'HIGH' | 'DEFAULT' | 'LOW';
  vibrate: boolean;
}

/**
 * Android notification channels. Users can mute any of them separately in system settings, which is the
 * granular control. (Android can never change a channel's importance after creation, hence new ids.)
 */
export const CHANNELS: Record<ChannelKey, ChannelSpec> = {
  alerts: {
    id: 'arthik-budget-alerts',
    name: 'Budget alerts',
    description: 'When you go over your daily, weekly or monthly budget',
    importance: 'HIGH',
    vibrate: true,
  },
  reminders: {
    id: 'arthik-reminders',
    name: 'Reminders',
    description: 'A gentle evening nudge when nothing has been logged',
    importance: 'DEFAULT',
    vibrate: false,
  },
  gullak: {
    id: 'arthik-gullak',
    name: 'Gullak updates',
    description: 'What you saved into your Gullak',
    importance: 'DEFAULT',
    vibrate: false,
  },
  recaps: {
    id: 'arthik-recaps',
    name: 'Weekly & monthly recaps',
    description: 'A short summary of your spending',
    importance: 'LOW',
    vibrate: false,
  },
};

/** The channel that existed before this redesign (MAX importance for everything). Deleted on migration. */
export const LEGACY_CHANNEL_ID = 'daily-budget-alerts';

export interface CategoryTotal {
  name: string;
  amount: number;
}

export interface PeriodStats {
  /** Number of expense (non-income) transactions logged in the period so far. */
  txnCount: number;
  spent: number;
  /** Spend of the previous equivalent period (0 if unknown). */
  prevSpent: number;
  topCategory: CategoryTotal | null;
  /** Gullak profile, daily cadence: days with a budget so far / days under it / rupees saved. */
  daysTracked: number;
  daysUnderBudget: number;
  savedToGullak: number;
}

export interface CadencePeriod {
  cadence: 'weekly' | 'monthly';
  budget: number;
  spent: number;
  remaining: number;
  isOver: boolean;
  overBy: number;
}

export interface PlanContext {
  now: Date;
  profile: Profile;
  cadence: Cadence;
  /** true if any transaction was logged today (entered today or dated today). */
  loggedToday: boolean;
  /** Daily cadence + Gullak only; 0 otherwise. */
  dailyBudget: number;
  todaySpent: number;
  /** Consecutive saved days up to yesterday. */
  streak: number;
  week: PeriodStats;
  month: PeriodStats;
  /** Weekly / monthly cadence: the running period; null for daily or pure. */
  period: CadencePeriod | null;
  /** e.g. "October" — passed in so the planner stays locale-free. */
  monthName: string;
  /**
   * Days on which part of the daily budget is paid from money carried over from the previous weekly / monthly
   * plan (the user already has that money in the bank). Optional: absent for everyone else.
   */
  carryDays?: CarryCoverDay[];
  /**
   * Periods on which part of the weekly / monthly budget is paid from money carried over (CAR-001 Mode B).
   */
  carryPeriods?: CarryCoverPeriod[];
  /**
   * The first day / period on which carried money no longer funds the budget (CAR-001): one message each,
   * telling the user that from now on they must add the money themselves.
   */
  carryEnds?: CarryCoverEnd[];
}

export interface CarryCoverEnd {
  /** yyyy-MM-dd: the first day of the first day / week / month that is NOT funded by carry. */
  date: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  /** The budget of that day / period that the user now has to fund. */
  budget: number;
}

export interface CarryCoverPeriod {
  /** yyyy-MM-dd (start of the period) */
  periodStart: string;
  cadence: 'weekly' | 'monthly';
  budget: number;
  funded: number;
  toAdd: number;
  remainingAfter: number;
}

export interface CarryCoverDay {
  /** yyyy-MM-dd */
  date: string;
  mode: 'next_day' | 'spread';
  /** Today's budget (including the extra for next_day). */
  budget: number;
  /** Part of it that comes from carried-over money. */
  funded: number;
  /** What the user still has to put into the bank today. */
  toAdd: number;
  /** Carried money left after this day. */
  remainingAfter: number;
}

export interface PlannedNotification {
  /** Stable id, e.g. "nudge_2026-10-04". Also the inbox id for items that are archived. */
  id: string;
  type: PlanType;
  channel: ChannelKey;
  fireAt: Date;
  title: string;
  body: string;
  /** Where a tap goes. */
  screen: 'AddExpense' | 'Savings' | 'Insights' | 'Home';
  /** Also archive it in the in-app Notifications list when it is delivered. */
  inbox: boolean;
}

// ─── Tunables ────────────────────────────────────────────────────────────────

export const NUDGE_TIME = { hour: 20, minute: 30 };
export const REWARD_TIME = { hour: 8, minute: 30 };
/** Morning message: how much to put into the bank today (carried-over days). */
export const CARRY_TIME = { hour: 8, minute: 0 };
export const WEEKLY_RECAP_TIME = { hour: 19, minute: 0 }; // Sunday
export const MONTHLY_RECAP_TIME = { hour: 21, minute: 0 }; // last day of the month
/** Evenings (today included) a nudge may be scheduled for. After that we stay silent until the app is opened. */
export const NUDGE_HORIZON_DAYS = 3;
export const WEEKLY_MIN_TXNS = 3;
export const MONTHLY_MIN_TXNS = 6;
/** A "saved yesterday" reward is sent only for a meaningful amount: >= 10% of the budget and >= ₹10. */
export const REWARD_MIN_SAVED_RATIO = 0.1;
export const REWARD_MIN_SAVED_ABSOLUTE = 10;
/** Streak lengths worth a mention inside the reward. */
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100];
/** Don't schedule anything that fires sooner than this (ms) from "now". */
const MIN_LEAD_MS = 60_000;

/** Higher wins when two scheduled items land on the same day. */
const PRIORITY: Record<PlanType, number> = {
  carry_cover: 5, // "how much to add today" is the one message the user can act on
  monthly_recap: 4,
  weekly_recap: 3,
  gullak_reward: 2,
  log_nudge: 1,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const money = (n: number): string => formatCurrency(Math.round(n * 100) / 100);
const atTime = (d: Date, t: { hour: number; minute: number }): Date => {
  const x = new Date(d);
  x.setHours(t.hour, t.minute, 0, 0);
  return x;
};
const dayKey = (d: Date): string => format(d, 'yyyy-MM-dd');
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

// ─── Copy ────────────────────────────────────────────────────────────────────

export interface Copy {
  title: string;
  body: string;
}

/** Evening check-in. `n` is how many nudges came before this one in the current run (0, 1, 2). */
export function nudgeCopy(ctx: Pick<PlanContext, 'profile' | 'cadence' | 'dailyBudget'>, n: number): Copy {
  if (n >= 2) {
    return {
      title: "We'll stay quiet from here",
      body: 'Open Arthik whenever you want to catch up on your spends.',
    };
  }
  if (ctx.profile === 'gullak' && ctx.cadence === 'daily' && ctx.dailyBudget > 0) {
    return n === 0
      ? {
          title: 'Nothing logged today',
          body: `If you spent nothing, ${money(ctx.dailyBudget)} goes to your Gullak tonight. Spent something? Add it now.`,
        }
      : {
          title: 'Your Gullak needs an update',
          body: "Log your recent spends so your savings stay accurate.",
        };
  }
  if (ctx.profile === 'gullak') {
    return n === 0
      ? { title: 'Nothing logged today', body: "Add today's spends to keep your budget balance accurate." }
      : { title: 'Still tracking?', body: 'A couple of entries keeps your budget balance accurate.' };
  }
  return n === 0
    ? { title: 'Nothing logged today', body: "Add today's spends before you forget — it takes a few seconds." }
    : { title: 'Still tracking?', body: 'Log a couple of entries to keep your numbers accurate.' };
}

/** Morning-after reward for a saved day (Gullak, daily cadence). */
export function rewardCopy(saved: number, streakIfSaved: number): Copy {
  const streak = STREAK_MILESTONES.includes(streakIfSaved) ? ` ${streakIfSaved}-day streak.` : '';
  return {
    title: `${money(saved)} saved yesterday`,
    body: `Added to your Gullak.${streak}`,
  };
}

function topLine(week: PeriodStats): string[] {
  const parts: string[] = [];
  if (week.topCategory) parts.push(`${week.topCategory.name} led with ${money(week.topCategory.amount)}`);
  if (week.prevSpent > 0) {
    const pct = Math.round((Math.abs(week.spent - week.prevSpent) / week.prevSpent) * 100);
    if (pct >= 5) parts.push(`${pct}% ${week.spent < week.prevSpent ? 'less' : 'more'} than last week`);
  }
  if (parts.length === 0) parts.push(`${week.txnCount} ${plural(week.txnCount, 'transaction', 'transactions')}`);
  return parts;
}

export function weeklyRecapCopy(ctx: PlanContext): Copy {
  const { profile, cadence, week, period } = ctx;
  if (profile === 'gullak' && cadence !== 'daily' && period && period.cadence === 'weekly') {
    return period.isOver
      ? { title: 'Week wrap: over budget', body: `${money(period.spent)} of ${money(period.budget)} — ${money(period.overBy)} over.` }
      : {
          title: `Week wrap: ${money(period.spent)} of ${money(period.budget)}`,
          body: `${money(period.remaining)} left — it moves to your Gullak tonight.`,
        };
  }
  const title = `This week: ${money(week.spent)} spent`;
  if (profile === 'gullak' && cadence === 'daily' && week.daysTracked > 0) {
    const parts = [`${week.daysUnderBudget} of ${week.daysTracked} days under budget`];
    if (week.savedToGullak > 0) parts.push(`${money(week.savedToGullak)} added to your Gullak`);
    return { title, body: parts.join(' · ') };
  }
  return { title, body: topLine(week).join(' · ') };
}

export function monthlyRecapCopy(ctx: PlanContext): Copy {
  const { profile, cadence, month, period, monthName } = ctx;
  if (profile === 'gullak' && cadence === 'monthly' && period && period.cadence === 'monthly') {
    return period.isOver
      ? { title: `${monthName} wrap: over budget`, body: `${money(period.spent)} of ${money(period.budget)} — ${money(period.overBy)} over.` }
      : {
          title: `${monthName} wrap: ${money(period.spent)} of ${money(period.budget)}`,
          body: `${money(period.remaining)} left — it moves to your Gullak tonight.`,
        };
  }
  const parts: string[] = [];
  if (month.topCategory) parts.push(`Top: ${month.topCategory.name} ${money(month.topCategory.amount)}`);
  parts.push(`${month.txnCount} ${plural(month.txnCount, 'transaction', 'transactions')}`);
  if (profile === 'gullak' && month.savedToGullak > 0) parts.push(`${money(month.savedToGullak)} added to your Gullak`);
  return { title: `${monthName}: ${money(month.spent)} spent`, body: parts.join(' · ') };
}

// ─── In-app event copy (inbox, and a banner for "over the limit") ────────────

export interface LimitCopyInput {
  kind: 'warning' | 'exceeded';
  cadence: Cadence;
  spent: number;
  budget: number;
  remaining: number;
  /** Days left in the current weekly / monthly period. */
  remainingDays?: number;
  /** Amount of overspend covered from available income. */
  incomeCovered?: number;
  /** Amount of overspend drawn from Gullak reserve. */
  gullakCovered?: number;
}

const PERIOD_WORD: Record<Cadence, string> = { daily: "today's", weekly: "this week's", monthly: "this month's" };

export function limitCopy(i: LimitCopyInput): Copy {
  const word = PERIOD_WORD[i.cadence];
  if (i.kind === 'exceeded') {
    const over = Math.max(0, i.spent - i.budget);
    let body = '';
    if (i.incomeCovered && i.incomeCovered > 0 && i.gullakCovered && i.gullakCovered > 0) {
      body = `${money(over)} over limit: ${money(i.incomeCovered)} covered from Income, ${money(i.gullakCovered)} drawn from Gullak.`;
    } else if (i.incomeCovered && i.incomeCovered > 0) {
      body = `${money(over)} over limit: covered from your Income.`;
    } else if (i.gullakCovered && i.gullakCovered > 0) {
      body = `${money(over)} over limit: drawn from your Gullak.`;
    } else {
      body =
        i.cadence === 'daily'
          ? `${money(i.spent)} spent of ${money(i.budget)} — ${money(over)} over. Today won't add to your Gullak.`
          : `${money(i.spent)} of ${money(i.budget)} — ${money(over)} over.`;
    }
    return {
      title: `Over ${word} ${i.cadence === 'daily' ? 'limit' : 'budget'}`,
      body,
    };
  }
  const pct = i.budget > 0 ? Math.min(99, Math.round((i.spent / i.budget) * 100)) : 80;
  if (i.cadence === 'daily') {
    return { title: `${pct}% of today's budget used`, body: `${money(i.remaining)} left of ${money(i.budget)}.` };
  }
  const days = i.remainingDays ?? 0;
  return {
    title: `${pct}% of ${word} budget used`,
    body: `${money(i.remaining)} left${days > 0 ? ` · ${days} ${plural(days, 'day', 'days')} to go` : ''}.`,
  };
}

/** "How much to add today" when part of today's budget is already in the bank (carried over). */
export function carryCoverCopy(d: CarryCoverDay): Copy {
  if (d.mode === 'next_day') {
    return {
      title: `Add only ${money(d.toAdd)} today`,
      body: `Today's budget is ${money(d.budget)}. ${money(d.funded)} of it is carried over from your last plan.`,
    };
  }
  if (d.toAdd <= 0) {
    return {
      title: 'Nothing to add today',
      body: `Today's ${money(d.budget)} is covered by money carried over from your last plan. ${money(d.remainingAfter)} left after today.`,
    };
  }
  return {
    title: `Add only ${money(d.toAdd)} today`,
    body: `${money(d.funded)} of today's ${money(d.budget)} comes from money carried over from your last plan.`,
  };
}

/** "How much to add this week/month" when part of the period budget is carried over (CAR-001 Mode B). */
export function periodCarryCoverCopy(p: CarryCoverPeriod): Copy {
  const thisWord = p.cadence === 'weekly' ? "This week's" : "This month's";
  if (p.toAdd <= 0) {
    return {
      title: `${thisWord} budget covered`,
      body: `${thisWord} ${money(p.budget)} is funded from your carried balance. ${money(p.remainingAfter)} left.`,
    };
  }
  return {
    title: `Add only ${money(p.toAdd)} this ${p.cadence === 'weekly' ? 'week' : 'month'}`,
    body: `${money(p.funded)} funded from carry. Add ${money(p.toAdd)} to complete ${thisWord.toLowerCase()} budget.`,
  };
}

/** One-time message on the first day / period carried money no longer funds the budget (CAR-001). */
export function carryEndCopy(e: CarryCoverEnd): Copy {
  const unit = e.cadence === 'daily' ? 'daily' : e.cadence === 'weekly' ? 'weekly' : 'monthly';
  const when = e.cadence === 'daily' ? 'today' : e.cadence === 'weekly' ? 'this week' : 'this month';
  return {
    title: 'Carried money has run out',
    body: `From ${e.cadence === 'daily' ? 'today' : when} your ${money(e.budget)} ${unit} budget is no longer covered by carried money. Add ${money(e.budget)} ${when} to fund it.`,
  };
}

export function rolloverCopy(cadence: Cadence, amount: number): Copy {
  const from = cadence === 'daily' ? "yesterday's unspent allowance" : cadence === 'weekly' ? "last week's unspent budget" : "last month's unspent budget";
  return { title: `${money(amount)} added to your Gullak`, body: `From ${from}.` };
}

export function budgetResumedCopy(cadence: 'weekly' | 'monthly', remaining: number, budget: number): Copy {
  const word = cadence === 'weekly' ? "week's" : "month's";
  return {
    title: 'Welcome back',
    body: `${money(remaining)} left of this ${word} ${money(budget)}. It is the same budget, not a new one.`,
  };
}

export function pureDeficitBalancedCopy(deficit: number): Copy {
  return {
    title: 'Pure Mode deficit balanced',
    body: `You spent ₹${deficit} more than you had in Pure Mode. We added ₹${deficit} to Total Income so everything is balanced.`,
  };
}

export function budgetUpdatedCopy(amount: number): Copy {
  return { title: 'Daily budget updated', body: `${money(amount)} per day is active from today.` };
}

// ─── Planner ─────────────────────────────────────────────────────────────────

/**
 * Builds everything that should be scheduled, given the latest data. Idempotent: same context => same plan.
 * The caller cancels the previous plan and schedules this one.
 */
export function buildNotificationPlan(ctx: PlanContext): PlannedNotification[] {
  const { now } = ctx;
  const earliest = now.getTime() + MIN_LEAD_MS;
  const items: PlannedNotification[] = [];

  // 1) Evening log nudge — only for evenings where nothing has been logged; at most 3 in a row.
  let nudgeIndex = 0;
  for (let i = 0; i < NUDGE_HORIZON_DAYS; i++) {
    const day = addDays(now, i);
    const fireAt = atTime(day, NUDGE_TIME);
    if (fireAt.getTime() < earliest) continue;
    if (i === 0 && ctx.loggedToday) continue; // already logged today: no nudge tonight
    const copy = nudgeCopy(ctx, nudgeIndex);
    items.push({
      id: `nudge_${dayKey(day)}`,
      type: 'log_nudge',
      channel: 'reminders',
      fireAt,
      ...copy,
      screen: 'AddExpense',
      inbox: false,
    });
    nudgeIndex++;
  }

  // 1b) Carry cover — a morning message on every day part of the daily budget is already in the bank.
  for (const cd of ctx.carryDays || []) {
    const day = new Date(`${cd.date}T00:00:00`);
    const fireAt = atTime(day, CARRY_TIME);
    if (fireAt.getTime() < earliest) continue;
    items.push({
      id: `carry_${cd.date}`,
      type: 'carry_cover',
      channel: 'gullak',
      fireAt,
      ...carryCoverCopy(cd),
      screen: 'Home',
      inbox: true,
    });
  }

  // 1c) Period carry cover — first day of each funded weekly / monthly period (CAR-001 Mode B).
  for (const cp of ctx.carryPeriods || []) {
    const day = new Date(`${cp.periodStart}T00:00:00`);
    const fireAt = atTime(day, CARRY_TIME);
    if (fireAt.getTime() < earliest) continue;
    items.push({
      id: `carry_${cp.periodStart}`,
      type: 'carry_cover',
      channel: 'gullak',
      fireAt,
      ...periodCarryCoverCopy(cp),
      screen: 'Home',
      inbox: true,
    });
  }

  // 1d) Carry ended — ONE message on the first day / period that carried money no longer pays for (CAR-001).
  for (const ce of ctx.carryEnds || []) {
    const day = new Date(`${ce.date}T00:00:00`);
    const fireAt = atTime(day, CARRY_TIME);
    if (fireAt.getTime() < earliest) continue;
    items.push({
      id: `carry_end_${ce.date}`,
      type: 'carry_cover',
      channel: 'gullak',
      fireAt,
      ...carryEndCopy(ce),
      screen: 'Home',
      inbox: true,
    });
  }

  // 2) Gullak reward — tomorrow morning, only if today was logged and ended in a real saving.
  if (ctx.profile === 'gullak' && ctx.cadence === 'daily' && ctx.dailyBudget > 0 && ctx.loggedToday) {
    const saved = Math.max(0, Math.round((ctx.dailyBudget - ctx.todaySpent) * 100) / 100);
    const threshold = Math.max(REWARD_MIN_SAVED_ABSOLUTE, ctx.dailyBudget * REWARD_MIN_SAVED_RATIO);
    if (ctx.todaySpent <= ctx.dailyBudget && saved >= threshold) {
      const tomorrow = addDays(now, 1);
      const fireAt = atTime(tomorrow, REWARD_TIME);
      if (fireAt.getTime() >= earliest) {
        items.push({
          id: `reward_${dayKey(tomorrow)}`,
          type: 'gullak_reward',
          channel: 'gullak',
          fireAt,
          ...rewardCopy(saved, ctx.streak + 1),
          screen: 'Savings',
          inbox: true,
        });
      }
    }
  }

  // 3) Weekly recap — this week's Sunday evening, only for an active week.
  const sunday = endOfWeek(now, { weekStartsOn: 1 });
  const weeklyAt = atTime(sunday, WEEKLY_RECAP_TIME);
  if (weeklyAt.getTime() >= earliest && ctx.week.txnCount >= WEEKLY_MIN_TXNS) {
    items.push({
      id: `weekly_${dayKey(sunday)}`,
      type: 'weekly_recap',
      channel: 'recaps',
      fireAt: weeklyAt,
      ...weeklyRecapCopy(ctx),
      screen: 'Insights',
      inbox: true,
    });
  }

  // 4) Monthly recap — last evening of this month, only for an active month.
  const lastDay = endOfMonth(now);
  const monthlyAt = atTime(lastDay, MONTHLY_RECAP_TIME);
  if (monthlyAt.getTime() >= earliest && ctx.month.txnCount >= MONTHLY_MIN_TXNS) {
    items.push({
      id: `monthly_${format(lastDay, 'yyyy-MM')}`,
      type: 'monthly_recap',
      channel: 'recaps',
      fireAt: monthlyAt,
      ...monthlyRecapCopy(ctx),
      screen: 'Insights',
      inbox: true,
    });
  }

  return items.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** Keeps the single most important item for each calendar day. */
export function capOnePerDay(items: PlannedNotification[]): PlannedNotification[] {
  const best = new Map<string, PlannedNotification>();
  for (const it of items) {
    const key = dayKey(it.fireAt);
    const cur = best.get(key);
    if (!cur || PRIORITY[it.type] > PRIORITY[cur.type]) best.set(key, it);
  }
  return [...best.values()];
}

/** Changes whenever the plan would change — used to skip re-scheduling an identical plan. */
export function planSignature(plan: PlannedNotification[]): string {
  return plan.map((p) => `${p.id}|${p.fireAt.getTime()}|${p.title}|${p.body}`).join('\n');
}
