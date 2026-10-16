# Notifications — product spec

Single source of truth: [`src/lib/notificationPolicy.ts`](../src/lib/notificationPolicy.ts) (pure, unit-tested in `tests/notificationPolicy.test.ts`).

## Principles
1. **Relevance over volume.** A notification must tell the user something they cannot already see on the screen in front of them, in one short specific line. No emoji, no shouting.
2. **Deliver every necessary notification.** Notifications are scheduled when their domain trigger is met (morning Gullak reward / carry cover, evening recaps, or evening nudge). They are not artificially dropped or limited to one per day if both morning and evening messages are relevant.
3. **Never nag.** The evening nudge exists only on days with nothing logged, and goes quiet after 3 evenings without the app being opened.
4. **Be accurate.** Numbers come from what the user logged. When a user exceeds their limit, the Money Waterfall calculates in real time where the overspend is drawn from, and the alert states the breakdown explicitly: e.g. "₹300 over limit: ₹100 covered from Income, ₹200 drawn from Gullak" (or "covered from your Income" / "drawn from your Gullak").
5. **Own actions stay in the app.** Things caused by the user's action while the app is open (80% used, rollover, budget updated) go to the in-app bell only. The single exception is "over the limit" (silent banner).

## Why the evening nudge matters (domain rule)
In Budget Mode an empty day is a *full-allowance* day: the whole allowance rolls into the Gullak at midnight. Not logging inflates the Gullak, so for Gullak users the nudge is about accuracy, and its copy says so.

**Interaction with Automatic Logging**: If an expense is logged automatically (via Bank SMS or Bank Email alert) while the app is closed, it is directly recorded into transactions. Because an expense is recorded for today, tonight's 20:30 evening nudge is cancelled/omitted and rollover accounts for the real spent amount (e.g. ₹349 spent out of ₹500 saves ₹151, not ₹500), so the Gullak is never falsely inflated.

## Matrix
| Moment | Pure Mode (no Gullak) | Gullak, daily | Gullak, weekly / monthly | Channel |
|---|---|---|---|---|
| 20:30, nothing logged today (today + next 2 evenings, then silence) | "Nothing logged today — Add today's spends…" | "…If you spent nothing, ₹500 goes to your Gullak tonight." | "…Keep this week/month's balance accurate" | Reminders |
| 08:30 next morning, only if today was logged and ended with a real saving | – | "₹320 saved yesterday — Added to your Gullak. (7-day streak.)" | – | Gullak updates |
| Sunday 19:00 (≥ 3 expenses that week) | "This week: ₹4,820 spent — Food led with ₹1,900 · 12% less than last week" | "…5 of 7 days under budget · ₹850 added to your Gullak" | weekly: "Week wrap: ₹5,200 of ₹7,000 — ₹1,800 left…" | Recaps |
| Last evening of month 21:00 (≥ 6 expenses) | "October: ₹32,400 spent — Top: Food ₹9,800 · 61 transactions" | "+ ₹4,150 added to your Gullak" | monthly: "October wrap: ₹X of ₹Y" | Recaps |
| Crossing the limit (in app) | – | "Over today's limit — ₹X over: ₹A covered from Income, ₹B drawn from Gullak." | "Over this week's / month's budget" | Budget alerts (silent banner) |
| 80% used (in app) | – | in-app bell only | in-app bell only | – |
| Next-day rollover, scheduled budget applied (in app) | – | in-app bell only | in-app bell only | – |

Tapping: nudge → Add Expense; recaps → Insights; Gullak / limit alerts → Savings (Home if Budget Mode is off).

## How it stays true
`notificationSync.ts` rebuilds the whole plan from the latest data (3 s after any expense / budget change, on app foreground, after login) and replaces the OS schedule; an identical plan is not rescheduled. Logging an expense therefore cancels tonight's nudge immediately.

## Channels (Android; users can mute each separately in system settings)
Budget alerts (high) · Reminders (default) · Gullak updates (default) · Weekly & monthly recaps (low). Created lazily. The old single MAX channel is deleted once on upgrade, together with the old repeating 20:00 reminder.

## Switch
Profile → Notifications toggle turns everything off (cancels the schedule) / on (asks OS permission if needed, rebuilds).
