import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  PlanContext,
  PlannedNotification,
  PeriodStats,
  buildNotificationPlan,
  capOnePerDay,
  nudgeCopy,
  rewardCopy,
  weeklyRecapCopy,
  monthlyRecapCopy,
  limitCopy,
  rolloverCopy,
  budgetUpdatedCopy,
  planSignature,
  CHANNELS,
  NUDGE_HORIZON_DAYS,
} from '../src/lib/notificationPolicy';

const stats = (over: Partial<PeriodStats> = {}): PeriodStats => ({
  txnCount: 0,
  spent: 0,
  prevSpent: 0,
  topCategory: null,
  daysTracked: 0,
  daysUnderBudget: 0,
  savedToGullak: 0,
  ...over,
});

// Wednesday 7 Oct 2026, 14:00 (local)
const WED = new Date(2026, 9, 7, 14, 0, 0);

const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  now: WED,
  profile: 'pure',
  cadence: 'daily',
  loggedToday: false,
  dailyBudget: 0,
  todaySpent: 0,
  streak: 0,
  week: stats(),
  month: stats(),
  period: null,
  monthName: 'October',
  ...over,
});

const gullakDaily = (over: Partial<PlanContext> = {}) =>
  ctx({ profile: 'gullak', cadence: 'daily', dailyBudget: 500, ...over });

const byType = (plan: PlannedNotification[], t: string) => plan.filter((p) => p.type === t);
const day = (p: PlannedNotification) => format(p.fireAt, 'yyyy-MM-dd');

describe('evening log nudge', () => {
  it('is scheduled for today and the next two evenings when nothing was logged', () => {
    const nudges = byType(buildNotificationPlan(ctx()), 'log_nudge');
    expect(nudges.map(day)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);
    expect(nudges.every((n) => n.fireAt.getHours() === 20 && n.fireAt.getMinutes() === 30)).toBe(true);
    expect(nudges.length).toBe(NUDGE_HORIZON_DAYS);
  });

  it("is dropped for today the moment something is logged (and stays quiet tonight)", () => {
    const nudges = byType(buildNotificationPlan(ctx({ loggedToday: true })), 'log_nudge');
    // The 3-evening horizon counts today, so only tomorrow and the day after remain (and neither is the "going quiet" one).
    expect(nudges.map(day)).toEqual(['2026-10-08', '2026-10-09']);
    expect(nudges.map((n) => n.title)).toEqual(['Nothing logged today', 'Still tracking?']);
  });

  it('skips tonight if it is already past 20:30', () => {
    const late = new Date(2026, 9, 7, 21, 0, 0);
    const nudges = byType(buildNotificationPlan(ctx({ now: late })), 'log_nudge');
    expect(nudges.map(day)).toEqual(['2026-10-08', '2026-10-09']);
  });

  it('never schedules anything in the next minute', () => {
    const justBefore = new Date(2026, 9, 7, 20, 29, 30);
    const nudges = byType(buildNotificationPlan(ctx({ now: justBefore })), 'log_nudge');
    expect(nudges.map(day)).not.toContain('2026-10-07');
  });

  it('goes quiet: the third nudge says so, and nothing is scheduled beyond it', () => {
    const nudges = byType(buildNotificationPlan(ctx()), 'log_nudge');
    expect(nudges[2].title).toBe("We'll stay quiet from here");
    expect(nudges.length).toBe(3);
  });

  it('opens Add Expense, is not archived in the bell, uses the Reminders channel', () => {
    const n = byType(buildNotificationPlan(ctx()), 'log_nudge')[0];
    expect(n.screen).toBe('AddExpense');
    expect(n.inbox).toBe(false);
    expect(n.channel).toBe('reminders');
  });

  describe('copy per profile', () => {
    it('Pure Mode: plain, no Gullak mention', () => {
      const c = nudgeCopy({ profile: 'pure', cadence: 'daily', dailyBudget: 0 }, 0);
      expect(c.title).toBe('Nothing logged today');
      expect(c.body).not.toMatch(/gullak/i);
    });
    it('Gullak daily: explains what an empty day means (the allowance goes to the Gullak)', () => {
      const c = nudgeCopy({ profile: 'gullak', cadence: 'daily', dailyBudget: 500 }, 0);
      expect(c.body).toContain('₹500');
      expect(c.body).toMatch(/Gullak tonight/);
    });
    it('Gullak weekly / monthly: no per-day promise', () => {
      const c = nudgeCopy({ profile: 'gullak', cadence: 'weekly', dailyBudget: 0 }, 0);
      expect(c.body).not.toMatch(/tonight/);
    });
    it('second nudge changes tone', () => {
      expect(nudgeCopy({ profile: 'pure', cadence: 'daily', dailyBudget: 0 }, 1).title).toBe('Still tracking?');
      expect(nudgeCopy({ profile: 'gullak', cadence: 'daily', dailyBudget: 500 }, 1).title).toBe('Your Gullak needs an update');
    });
  });
});

describe('morning Gullak reward', () => {
  const base = { loggedToday: true, todaySpent: 180, streak: 2 };

  it('is scheduled for tomorrow 08:30 for a Gullak daily user who logged and stayed under budget', () => {
    const r = byType(buildNotificationPlan(gullakDaily(base)), 'gullak_reward');
    expect(r.length).toBe(1);
    expect(day(r[0])).toBe('2026-10-08');
    expect(r[0].fireAt.getHours()).toBe(8);
    expect(r[0].fireAt.getMinutes()).toBe(30);
    expect(r[0].title).toBe('₹320 saved yesterday');
    expect(r[0].channel).toBe('gullak');
    expect(r[0].inbox).toBe(true);
    expect(r[0].screen).toBe('Savings');
  });

  it('mentions a streak only at a milestone (day 3 here)', () => {
    expect(rewardCopy(320, 3).body).toBe('Added to your Gullak. 3-day streak.');
    expect(rewardCopy(320, 4).body).toBe('Added to your Gullak.');
  });

  it('never for Pure Mode, weekly or monthly cadence', () => {
    expect(byType(buildNotificationPlan(ctx({ ...base, dailyBudget: 500 })), 'gullak_reward')).toHaveLength(0);
    expect(byType(buildNotificationPlan(gullakDaily({ ...base, cadence: 'weekly' })), 'gullak_reward')).toHaveLength(0);
  });

  it('never when nothing was logged (an empty day is not a real saving)', () => {
    expect(byType(buildNotificationPlan(gullakDaily({ loggedToday: false })), 'gullak_reward')).toHaveLength(0);
  });

  it('never when over budget, and not for a tiny saving', () => {
    expect(byType(buildNotificationPlan(gullakDaily({ ...base, todaySpent: 620 })), 'gullak_reward')).toHaveLength(0);
    expect(byType(buildNotificationPlan(gullakDaily({ ...base, todaySpent: 480 })), 'gullak_reward')).toHaveLength(0); // saved 20 < 10% of 500
    expect(byType(buildNotificationPlan(gullakDaily({ ...base, todaySpent: 450 })), 'gullak_reward')).toHaveLength(1); // saved 50 = 10%
  });
});

describe('weekly and monthly recaps', () => {
  it('weekly: this Sunday 19:00, only with enough activity', () => {
    expect(byType(buildNotificationPlan(ctx({ week: stats({ txnCount: 2 }) })), 'weekly_recap')).toHaveLength(0);
    const w = byType(buildNotificationPlan(ctx({ week: stats({ txnCount: 5, spent: 4820 }) })), 'weekly_recap');
    expect(w).toHaveLength(1);
    expect(day(w[0])).toBe('2026-10-11');
    expect(w[0].fireAt.getHours()).toBe(19);
    expect(w[0].channel).toBe('recaps');
    expect(w[0].screen).toBe('Insights');
    expect(w[0].inbox).toBe(true);
  });

  it('weekly, Pure Mode: top category and change vs last week', () => {
    const c = weeklyRecapCopy(
      ctx({ week: stats({ txnCount: 14, spent: 4820, prevSpent: 5480, topCategory: { name: 'Food', amount: 1900 } }) })
    );
    expect(c.title).toBe('This week: ₹4,820 spent');
    expect(c.body).toBe('Food led with ₹1,900 · 12% less than last week');
  });

  it('weekly, Pure Mode: ignores a change below 5% and falls back to the transaction count', () => {
    const c = weeklyRecapCopy(ctx({ week: stats({ txnCount: 7, spent: 1000, prevSpent: 1020 }) }));
    expect(c.body).toBe('7 transactions');
  });

  it('weekly, Gullak daily: days under budget and what reached the Gullak', () => {
    const c = weeklyRecapCopy(gullakDaily({ week: stats({ txnCount: 9, spent: 3200, daysTracked: 7, daysUnderBudget: 5, savedToGullak: 850 }) }));
    expect(c.body).toBe('5 of 7 days under budget · ₹850 added to your Gullak');
  });

  it('weekly, Gullak weekly cadence: the period result (under and over)', () => {
    const under = weeklyRecapCopy(
      ctx({ profile: 'gullak', cadence: 'weekly', period: { cadence: 'weekly', budget: 7000, spent: 5200, remaining: 1800, isOver: false, overBy: 0 } })
    );
    expect(under.title).toBe('Week wrap: ₹5,200 of ₹7,000');
    expect(under.body).toBe('₹1,800 left — it moves to your Gullak tonight.');
    const over = weeklyRecapCopy(
      ctx({ profile: 'gullak', cadence: 'weekly', period: { cadence: 'weekly', budget: 7000, spent: 7400, remaining: 0, isOver: true, overBy: 400 } })
    );
    expect(over.body).toContain('₹400 over');
  });

  it('monthly: last evening of the month, only with enough activity', () => {
    expect(byType(buildNotificationPlan(ctx({ month: stats({ txnCount: 5 }) })), 'monthly_recap')).toHaveLength(0);
    const m = byType(buildNotificationPlan(ctx({ month: stats({ txnCount: 40, spent: 32400 }) })), 'monthly_recap');
    expect(m).toHaveLength(1);
    expect(day(m[0])).toBe('2026-10-31');
    expect(m[0].fireAt.getHours()).toBe(21);
  });

  it('monthly copy for both profiles', () => {
    const pure = monthlyRecapCopy(ctx({ month: stats({ txnCount: 61, spent: 32400, topCategory: { name: 'Food', amount: 9800 } }) }));
    expect(pure.title).toBe('October: ₹32,400 spent');
    expect(pure.body).toBe('Top: Food ₹9,800 · 61 transactions');
    const gullak = monthlyRecapCopy(gullakDaily({ month: stats({ txnCount: 61, spent: 32400, savedToGullak: 4150 }) }));
    expect(gullak.body).toContain('₹4,150 added to your Gullak');
    expect(pure.body).not.toMatch(/gullak/i);
  });

  it('no recap when the recap time has already passed', () => {
    const sundayNight = new Date(2026, 9, 11, 21, 0, 0);
    expect(byType(buildNotificationPlan(ctx({ now: sundayNight, week: stats({ txnCount: 9 }) })), 'weekly_recap')).toHaveLength(0);
  });
});

describe('never more than one scheduled notification per day', () => {
  it('Sunday: the weekly recap wins over the evening nudge', () => {
    const sunday = new Date(2026, 9, 11, 10, 0, 0);
    const plan = buildNotificationPlan(ctx({ now: sunday, week: stats({ txnCount: 6, spent: 900 }) }));
    const onSunday = plan.filter((p) => day(p) === '2026-10-11');
    expect(onSunday).toHaveLength(1);
    expect(onSunday[0].type).toBe('weekly_recap');
  });

  it('last day of the month: the monthly recap wins over weekly and nudge', () => {
    const lastDay = new Date(2026, 9, 31, 10, 0, 0); // Saturday
    const plan = buildNotificationPlan(ctx({ now: lastDay, month: stats({ txnCount: 30, spent: 100 }), week: stats({ txnCount: 5 }) }));
    const that = plan.filter((p) => day(p) === '2026-10-31');
    expect(that).toHaveLength(1);
    expect(that[0].type).toBe('monthly_recap');
  });

  it("morning reward beats that evening's nudge", () => {
    const plan = buildNotificationPlan(gullakDaily({ loggedToday: true, todaySpent: 100 }));
    const tomorrow = plan.filter((p) => day(p) === '2026-10-08');
    expect(tomorrow).toHaveLength(1);
    expect(tomorrow[0].type).toBe('gullak_reward');
  });

  it('holds for every profile and cadence on every weekday', () => {
    for (let d = 0; d < 35; d++) {
      const now = new Date(2026, 9, 1 + d, 9, 0, 0);
      for (const c of [
        ctx({ now, week: stats({ txnCount: 9 }), month: stats({ txnCount: 30 }) }),
        gullakDaily({ now, loggedToday: true, todaySpent: 50, week: stats({ txnCount: 9 }), month: stats({ txnCount: 30 }) }),
        ctx({ now, profile: 'gullak', cadence: 'monthly', week: stats({ txnCount: 9 }), month: stats({ txnCount: 30 }) }),
      ]) {
        const plan = buildNotificationPlan(c);
        const days = plan.map(day);
        expect(new Set(days).size).toBe(days.length);
        expect(plan.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it('capOnePerDay keeps the highest priority', () => {
    const mk = (type: any, h: number): PlannedNotification => ({
      id: type, type, channel: 'recaps', fireAt: new Date(2026, 9, 7, h), title: '', body: '', screen: 'Home', inbox: false,
    });
    expect(capOnePerDay([mk('log_nudge', 20), mk('weekly_recap', 19), mk('gullak_reward', 8)]).map((x) => x.type)).toEqual(['weekly_recap']);
  });
});

describe('hygiene of every message', () => {
  const contexts: PlanContext[] = [
    ctx({ week: stats({ txnCount: 9, spent: 4820, prevSpent: 5480, topCategory: { name: 'Food & Drinks', amount: 1900 } }), month: stats({ txnCount: 40, spent: 32400, topCategory: { name: 'Food & Drinks', amount: 9800 } }) }),
    gullakDaily({ loggedToday: true, todaySpent: 100, streak: 6, week: stats({ txnCount: 9, spent: 3200, daysTracked: 7, daysUnderBudget: 5, savedToGullak: 850 }), month: stats({ txnCount: 40, spent: 15000, savedToGullak: 4150 }) }),
    ctx({ profile: 'gullak', cadence: 'weekly', week: stats({ txnCount: 9 }), month: stats({ txnCount: 40 }), period: { cadence: 'weekly', budget: 7000, spent: 5200, remaining: 1800, isOver: false, overBy: 0 } }),
    ctx({ profile: 'gullak', cadence: 'monthly', week: stats({ txnCount: 9 }), month: stats({ txnCount: 40 }), period: { cadence: 'monthly', budget: 30000, spent: 32000, remaining: 0, isOver: true, overBy: 2000 } }),
  ];
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

  it('short plain titles, one calm line, no emoji, no shouting, sensible hours', () => {
    for (const c of contexts) {
      for (const n of buildNotificationPlan(c)) {
        expect(n.title.length).toBeLessThanOrEqual(36);
        expect(n.body.length).toBeLessThanOrEqual(115);
        expect(n.title + n.body).not.toMatch(emoji);
        expect(n.title + n.body).not.toMatch(/!/);
        expect(n.fireAt.getHours()).toBeGreaterThanOrEqual(8);
        expect(n.fireAt.getHours()).toBeLessThanOrEqual(21);
        expect(CHANNELS[n.channel]).toBeDefined();
      }
    }
  });

  it('every item has a unique stable id', () => {
    for (const c of contexts) {
      const ids = buildNotificationPlan(c).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('signature changes only when the plan changes', () => {
    const a = buildNotificationPlan(contexts[1]);
    expect(planSignature(a)).toBe(planSignature(buildNotificationPlan(contexts[1])));
    expect(planSignature(a)).not.toBe(planSignature(buildNotificationPlan({ ...contexts[1], todaySpent: 200 })));
  });
});

describe('in-app event copy', () => {
  it('over the daily limit: factual, and never promises how the overspend is deducted', () => {
    const c = limitCopy({ kind: 'exceeded', cadence: 'daily', spent: 620, budget: 500, remaining: 0 });
    expect(c.title).toBe("Over today's limit");
    expect(c.body).toBe("₹620 spent of ₹500 — ₹120 over. Today won't add to your Gullak.");
    expect(c.body).not.toMatch(/deduct|taken from|lose/i);
  });
  it('over a weekly / monthly budget', () => {
    expect(limitCopy({ kind: 'exceeded', cadence: 'weekly', spent: 7400, budget: 7000, remaining: 0 }).title).toBe("Over this week's budget");
    expect(limitCopy({ kind: 'exceeded', cadence: 'monthly', spent: 32000, budget: 30000, remaining: 0 }).body).toBe('₹32,000 of ₹30,000 — ₹2,000 over.');
  });
  it('80% warnings carry what is left (and days to go for weekly / monthly)', () => {
    expect(limitCopy({ kind: 'warning', cadence: 'daily', spent: 400, budget: 500, remaining: 100 })).toEqual({
      title: "80% of today's budget used",
      body: '₹100 left of ₹500.',
    });
    expect(limitCopy({ kind: 'warning', cadence: 'weekly', spent: 5600, budget: 7000, remaining: 1400, remainingDays: 3 }).body).toBe('₹1,400 left · 3 days to go.');
    expect(limitCopy({ kind: 'warning', cadence: 'weekly', spent: 5600, budget: 7000, remaining: 1400, remainingDays: 1 }).body).toBe('₹1,400 left · 1 day to go.');
  });
  it('rollover and budget-updated', () => {
    expect(rolloverCopy('daily', 320)).toEqual({ title: '₹320 added to your Gullak', body: "From yesterday's unspent allowance." });
    expect(rolloverCopy('weekly', 1800).body).toBe("From last week's unspent budget.");
    expect(budgetUpdatedCopy(600)).toEqual({ title: 'Daily budget updated', body: '₹600 per day is active from today.' });
  });
});

describe('channels', () => {
  it('four channels, new ids (the old MAX channel can not be re-tuned), mutable separately', () => {
    const ids = Object.values(CHANNELS).map((c) => c.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain('daily-budget-alerts');
    expect(CHANNELS.alerts.importance).toBe('HIGH');
    expect(CHANNELS.recaps.importance).toBe('LOW');
  });
});
