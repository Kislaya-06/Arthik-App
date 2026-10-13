# 0012. One Budget per Calendar Period, and Pure Mode Keeps the Same Books

## Status
Accepted (October 2026). Amends [0011](0011-zero-proration-and-digital-vault-spending-guard.md) and
[0010](0010-budget-cadence-periods.md). Applies to budget periods that start on or after `2026-10-14`
(`BUDGET_RULES_V2_FROM` in `src/lib/budgetPeriods.ts`). Earlier periods keep their numbers: nobody's past Gullak or
income is rewritten by this decision.

## Context
ADR 0011 says a budget is never prorated: the user's amount is 100% real money, even when it starts mid-period.
That is right for the **first** time a week or month gets its budget. Nothing said what happens the **second** time
inside the same week or month. In practice every pause (Pure Mode) or cadence switch and back created a new slice,
and every slice got the full budget again:

- Monthly ₹9,000. Budget Mode 1-8 Oct (₹1,400 spent), Pure Mode 9-23 Oct, Budget Mode again 24 Oct. The second slice
  got a fresh ₹9,000. Gullak received ₹7,400 for one month that only ever held ₹9,000.
- Arthik is not connected to the bank. The user puts the budget money into the bank themselves, so a second
  budget in the same period means money in the app that never existed in the bank.

Related defects found while checking every mode and cadence switch (see CHANGELOG):

1. A weekly / monthly user also got a daily budget record every day (a second budget on the same day).
2. "Add to new budget" carry-over was added to every following week / month, not once.
3. Money left in a weekly / monthly budget disappeared when the user switched to daily.
4. Switching from daily carried the day's leftover forward although the same money also reached Gullak that night.

## Decisions

### D1. A budget pool: one budget per (cadence, calendar period)
A weekly or monthly **pool** is created the first day Budget Mode is on with that cadence inside the period. It holds
the plan amount plus the carry-over of that plan's **first** period only. Pausing, resuming, or switching away and
back inside the period never creates another one. What is left is what continues.

### D2. Pure Mode keeps the same books
Pure Mode only changes the screen (inflow / outflow, no limits or warnings). Money is still accounted as in Budget
Mode, in this order:

1. the budget pool of that period, if it is still alive (spending in Pure Mode uses the same pool),
2. then income (external Gullak deposits count as income),
3. then Gullak.

Coming back to Budget Mode shows exactly what Budget Mode would have shown. Gullak or income are lower only if the
spending went beyond the pool. The Digital Vault guard (ADR 0011) uses the real remaining of the whole account in
both modes, so a user with unspent budget money may still spend in Pure Mode and a user with nothing left is stopped.

### D3. When a period ends
- Ended in Budget Mode: what is left goes to Gullak (unchanged).
- Ended in Pure Mode: what is left becomes **income**. Pure Mode has no Gullak and the money must not vanish. Nothing
  goes to Gullak. The user gets an inbox message.
- Pure Mode on a day with no live pool (a new Pure user, or a new period): the spend is paid from income, then Gullak.

### D4. Switching away and back in the same period
When the user switches to another cadence, what was left of the pool is carried to the new cadence (D5). The pool is
**closed**. Coming back to that cadence in the same period leaves nothing in it (spending comes from income, then
Gullak) until the next period starts. The switch dialog says so.

### D5. Carry-over, one rule for every switch
- Only money that **really is left in the running weekly / monthly budget** (or carried money still unused) can be
  carried. A daily day carries nothing: its unused money goes to Gullak tonight.
- **Additive** carry is added to the first period of the new plan only (never again).
- **Weekly / monthly to daily** has two choices (stored with the same two values, so there is no database change):
  - *Add to tomorrow's budget* (`additive`): the first daily day's budget grows by the carried amount; what is
    unused goes to Gullak at night.
  - *Pay my daily budget from it* (`allocation`): each daily day is paid from the carried money until it is used up
    (e.g. ₹100/day over ₹1,550 = 15 days, then ₹50 on day 16). The daily budget stays ₹100.
- Carried money is already in the user's bank. A morning notification says how much to add today
  ("Nothing to add today", "Add only ₹50 today").
- The "All" total counts carried money once (it is already inside the old budget).

### D6. Daily records belong to daily days only
A day owned by a weekly / monthly plan or by Pure Mode has no daily budget record. Old wrong records are corrected
(and the server rows overwritten) by the self-heal in `checkAndRollover` / hydration. Users with no plan history at all
are old daily users and keep daily records.

## Consequences
- Toggling Budget Mode, or switching cadence and back, never changes what reaches Gullak for a period. This is
  covered by `tests/cadenceFixes.test.ts` (including the ₹9,000 example, where Gullak is ₹3,200 with or without the toggle).
- Gullak and income of users affected by defects 1 and 2 become lower after the heal. This was a deliberate product
  decision: the extra money never existed.
- Periods before `BUDGET_RULES_V2_FROM` are not recomputed with D1 / D3 / D4.
- `getTotalAccountRemaining` and the Gullak hard cap count each pool once, and a closed pool only for what it used.
