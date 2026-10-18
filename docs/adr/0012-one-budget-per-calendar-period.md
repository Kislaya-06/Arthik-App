# 0012. One Budget per Calendar Period, and Pure Mode Keeps the Same Books

## Status
Accepted (October 2026). Amends [0011](0011-zero-proration-and-digital-vault-spending-guard.md) and **Canonical note:** carry-forward (D5) governed by canonical `CAR-001`; implementation status in [0014](0014-canonical-rules-and-implementation-status.md).
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
2. then pureLeftover (if an earlier pool ended in Pure Mode; see PUR-002),
3. then income (external Gullak deposits count as income),
4. then Gullak.

Coming back to Budget Mode shows exactly what Budget Mode would have shown. Gullak or income are lower only if the
spending went beyond the pool. *(Amended by canonical SEC-001: The Digital Vault guard does not block in Pure Mode; the user may spend into negative balance).*

### D3. When a period ends
- Ended in Budget Mode: what is left goes to Gullak (unchanged).
- Ended in Pure Mode: *(Amended by canonical `PUR-002`)* what is left is **NOT income**. No inbox message is sent. The unspent pool money is tracked as `pureLeftover`, Remaining does not change, and spending on Pure days draws from `pureLeftover` first. When the user returns to Budget Mode, any unspent `pureLeftover` flows into Gullak (`totalAccumulatedSavings`).
- Pure Mode on a day with no live pool (a new Pure user, or a new period): the spend is paid from `pureLeftover` first, then income, then Gullak.

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
- **Weekly / monthly to weekly or monthly targets** also support both choices:
  - *Add to budget* (`additive`): carried money is added to the first period's budget pool only.
  - *Pay my weekly/monthly budget from it* (`allocation`): multi-period drawdown ($k = 1, 2, 3\dots$). Carried money $U$ funds subsequent periods with $\text{funded}_k = \min(B, \text{remaining}_{k-1})$ and user gap $\text{toAdd}_k = B - \text{funded}_k$. The period budget stays $B$ (not $B + \text{carry}$). Once carry hits 0, later periods are normal.
- Carried money is already in the user's bank. Notifications inform the user at period start:
  - Daily: morning notification ("Nothing to add today", "Add only ₹50 today").
  - Weekly / Monthly: start-of-period notification ("This week's ₹5,000 is funded from your carried balance. ₹10,000 left", or gap message "₹2,000 funded from carry. Add ₹3,000 to complete this week's budget"). Permanent cutoff once carry hits 0.
- The "All" total counts carried money once (it is already inside the old budget). In Allocation mode, carry-covered periods add 0 to the All pill budget pool, only the carry-FUNDED part is left out; the gap part of a period budget counts like any budget (as a normal period does) and real money added grows it by exactly that amount. Home All pill and the account total (guard, Gullak cap, Pure deficit) are the same number. When carry runs out ONE "carried money has run out" notice is sent on the first unfunded day / week / month (`carry_end_<date>`).

### D6. Daily records belong to daily days only
A day owned by a weekly / monthly plan or by Pure Mode has no daily budget record. Old wrong records are corrected
(and the server rows overwritten) by the self-heal in `checkAndRollover` / hydration. Users with no plan history at all
are old daily users and keep daily records.

### D7. Mode Switching Next-Day Scheduling & Same-Day Reversal (PUR-003 Amendment - 2026-10-18)
- **Next-Day Scheduling**: Toggling between Pure Mode and Budget Mode (Pure Mode → Budget Mode or Budget Mode → Pure Mode) takes effect from tomorrow at 12:00 AM (00:00:00). Today's running day budget and midnight Gullak rollover finish cleanly under the currently active mode.
- **Same-Day Reversal**: If a user schedules a mode transition for tomorrow and changes their mind on the same day (reverting the toggle back to today's active mode), the scheduled future change is cancelled immediately (`handleCancelPendingPlanChange`), removing the scheduled plan change and cancelling any scheduled transition notifications (`removeNotification`).
- **Hero Card Tap Guard**: In Pure Mode, the Hero Card disables details-sheet tap since budget slices and targets do not exist.
- **Vault Guard Solvency Check**: Outflows past weekly/monthly budget allowances are absorbed from unspent Income and Gullak savings. Digital Vault Guard blocks transactions only when total vault liquidity across the entire account is exhausted (`accountRemaining <= 0`).

## Consequences
- Toggling Budget Mode, or switching cadence and back, never changes what reaches Gullak for a period. This is
  covered by `tests/cadenceFixes.test.ts` (including the ₹9,000 example, where Gullak is ₹3,200 with or without the toggle).
- Gullak and income of users affected by defects 1 and 2 become lower after the heal. This was a deliberate product
  decision: the extra money never existed.
- Periods before `BUDGET_RULES_V2_FROM` are not recomputed with D1 / D3 / D4.
- `getTotalAccountRemaining` and the Gullak hard cap count each pool once, and a closed pool only for what it used.
- Same-day mode flip backs cleanly cancel pending transitions with 0 notification spam and 0 glitches.

