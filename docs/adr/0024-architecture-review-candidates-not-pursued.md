# ADR 0024: Architecture Review Candidates Not Pursued (Expense Sync, Budget Period, Insights Data)

## Status: Active

## Context

The architecture review of 22 Nov 2026 proposed five deepening candidates. Two were built: the Money Scope module (ADR 0022) and the one transaction classifier (ADR 0023). The owner's rule for refactors is that the app must behave exactly as before. The other three were checked against the code (24 Nov 2026) and dropped.

## Decision

1. **Expense store pushes one sync to the Daily Budget store: not pursued.**
   - Every expense list change in the store (`addExpense`, `updateExpense`, `deleteExpense`, rollbacks, the offline flush) already calls `syncWithExpenses` with the new list.
   - Money back (`recordMoneyBack`, `convertIncomeToMoneyBack`) goes through `addExpense` / `deleteExpense`, so it is synced too. There is no forgotten-sync gap.
   - The ~9 extra calls in screens (Expense Detail, History, the Add / Edit form) run the same sync again after the network save. Removing them changes nothing in the figures, but a save that crosses midnight, or one that ends while start-up hydration finishes, would then wait for the next screen focus to roll over.
   - A store subscription ("sync on every list change") would add syncs at sign-out, at every item of an offline flush and before hydration. `syncWithExpenses` writes today's record, sends budget alerts and runs `checkAndRollover`, so its timing is money behaviour.
   - Home, Insights and Savings each keep their own `loadData`; the three differ (hydration, categories, day reference).
   - The ~60 re-exports of the Daily Budget facade stay: removing them changes import paths (AGENTS §19.4) with no user benefit.
2. **Budget Period module owns bounds and date keys: not pursued, except the week start.**
   - Every week calculation used `weekStartsOn: 1`; no screen disagreed on the week. The owner then asked for the safe part only (24 Nov 2026): the rule now lives once, as `WEEK_OPTIONS` in `src/money/dateKeys.ts`, and every date-fns week function receives it (same value, so no figure changes). `tests/weekStart.test.ts` fails if a file writes its own `weekStartsOn` or calls a week function without `WEEK_OPTIONS`.
   - `toDateKey` (`src/money/dateKeys.ts`, DAT-001) exists for new code. The 43 older `split('T')[0]` uses in 20 files differ slightly (some trim, some return `undefined` instead of `''`), so moving them is not an exact no-op and touches stable screens, notifications and Gullak code.
3. **Insights data as a plain module: not pursued.** It was rated speculative in the review, and Insights has no open problem.

## Consequences

- Future architecture reviews should not re-suggest these three unless a real bug appears: a forgotten sync, a screen with a different week start, or a date-key mismatch between screens.
- New code still uses `toDateKey` / `todayDateKey`, and passes `WEEK_OPTIONS` to every week function.
