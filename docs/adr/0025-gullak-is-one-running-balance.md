# ADR 0025: Gullak is one running balance, and switching is simpler

- Status: Active (owner-approved 2026-11-28)
- Spec: [`docs/specs/2026-11-28-simple-money-rules.md`](../specs/2026-11-28-simple-money-rules.md)
- Replaces: the Gullak hard cap, the "Pure leftover" bucket (ADR 0012 part), the paused allowance (ADR 0011 / 0012
  parts), the daily gap filler, and the same-date income / Gullak reconciliation.

## Context

Gullak was rebuilt by a second formula outside the money waterfall (daily savings + deposits - draws, floored, then
period savings added, then capped at the account total). Reproduced effects: a weekly draw was not subtracted
(1,600 shown instead of 1,100), Pure Mode spending silently ate later savings, a 0-budget day could be rebuilt as
savings, and Home counted budget the spending guard did not have.

## Decision

1. `computeMoneyWaterfall` is the only place Gullak is computed. It replays budget endings, returns, income,
   deposits, expenses and daily savings in time order. Gullak never goes below zero; the rest is a `deficit` that only
   later income pays. `total = income left + Gullak + running budget left - deficit` (`tests/moneyInvariant.test.ts`).
2. Weekly / monthly pools describe their own closures (`pure`, `switch`, `carry`); the waterfall moves their money.
3. Only two states: Budget Mode and Pure Mode. `isAutoRenew` stays as a column and equals the mode.
4. A budget that ends early sends its leftover to Gullak unless "Carry forward" (one meaning: pays the new budget
   first), settled at midnight.
5. Days the app was closed are counted by the plan history; 7+ empty days wait for the user's choice. Skipped
   stretches reuse `profiles.allowance_pauses`; only the last opened day has a new column.
6. Add, edit and delete share one check, `previewMoneyImpact`.

## Consequences

- Old history is replayed with these rules, so some users' Gullak number changes; they get one note.
- Pure Mode spending before 2026-10-14 is now drawn too (the money was spent).
- Each gap since the last opened day is queued and judged on its own. An unanswered one is saved with its skipped
  stretch (`ask: true`), and the last opened day in `profiles.last_open_day`, so both survive a reinstall.
- Carried money that ends unused goes to Gullak (`droppedCarries`); before this it vanished (2,500 of 3,500 in the
  reproducing test).
- JavaScript only: ships by OTA. SQL: `20261128120000_last_open_day.sql` (`20261125120000_allowance_pauses.sql` was
  already run). Both are applied to the live project (2026-11-28).
