# 0014. Canonical Rules File, Retired Split Feature, and CAR-001 Implementation Status

## Status
Accepted (October 2026).

## Context
Money rules had spread over AGENTS.md, CONTEXT.md, the PRD, several ADRs and the code, and they had started to disagree (for example: a "Shares / Split" feature, a `reimbursement` transaction class, two names for an overspent day, and carry-over rules that differed between ADR 0011 and ADR 0012). The owner wrote one supreme file, [`docs/ARTHIK_CANONICAL_RULES.md`](../ARTHIK_CANONICAL_RULES.md), so that no future change can silently break how money behaves.

## Decision
1. `docs/ARTHIK_CANONICAL_RULES.md` is the single authority for every money rule. Code, tests and every other document must agree with it. A rule changes only on the owner's explicit approval; a request that would contradict a rule makes the agent stop and say so first (AGENTS.md §0).
2. *(Superseded by [ADR 0016](0016-split-expenses-and-money-back.md), 2026-10-18: a new, simpler Split and Money back feature exists; `REF-001` is replaced by `SPL-001..006`.)* **Split Expenses / Shares and the `reimbursement` class are removed** (`REF-001`, `TXN-004`). A friend paying back, or a refund, is plain Income. Self-transfers stay (`TXN-003`) and are marked only by `transaction_class = 'self_transfer'`. Old `reimbursement` rows are converted by `supabase/migrations/20261017083146_retire_shares_reimbursements.sql`; the `expense_shares` table is left in place, unused.
3. **One status vocabulary** (`BUD-008`): `'saved' | 'missed' | 'even' | 'unknown'`, plus the never-persisted in-progress marker `'active'`. `'exceeded'` is gone as a status (the notification alert kind `exceeded` is a different thing and is unchanged). Cached days from older versions are read as `'missed'`.
4. The carry-forward rules of ADR 0010 D4, ADR 0011 D2 and ADR 0012 D5 are governed by canonical `CAR-001`. Where they differ, `CAR-001` wins.

## CAR-001: implementation status (100% complete)
- Switching a weekly or monthly budget to **Daily** supports both carry modes: Additive and Allocation (carried money pays each daily budget until it runs out, the user adds only the gap, and the "All" total counts the money once).
- Switching to **Weekly or Monthly** supports both carry modes fully:
  - **Mode A (Additive):** Carried money is added once to the first period of the new plan (`carryForPeriod`).
  - **Mode B (Allocation / Multi-Period Drawdown):** Carried money $U$ funds subsequent periods $k = 1, 2, 3\dots$ with $\text{funded}_k = \min(B, \text{remaining}_{k-1})$ and user gap $\text{toAdd}_k = B - \text{funded}_k$ (`periodCarryForPeriod`, `periodCarryRemaining`). The All-pill and all-time account metrics subtract carry-covered amounts to guarantee zero double counting. Crisp notifications fire on the first day of each funded period, on the partial gap period, with a permanent cutoff once carry hits 0.
- Switching **from Daily**: today's unused daily money goes to Gullak at night, so nothing is carried (ADR 0012 D5).
All acceptance tests are verified in `tests/carryAllocationWeeklyMonthly.test.ts` and `tests/cadenceFixes.test.ts`.

## Pure Mode Rules (PUR-001, PUR-002, PUR-003, SEC-001 amend) Status (100% complete)
- **SEC-001 amend:** Pure Mode allows spending into negative without blocking (`canAddExpense: true`, no guard sheet, AutoLog `isExceedingVaultLiquidity` returns `false`). Budget Mode guard is unchanged.
- **PUR-002:** Pools ending in Pure Mode do NOT convert into income (`incomeAvail` and `incomeRestored` are untouched; no notification is sent). Unspent money is stored in `pureLeftover`, consumed first by Pure days, and flows to Gullak only when Budget Mode is re-enabled.
- **PUR-001:** Switching from Pure to Budget Mode with negative remaining ($R < 0$) automatically creates one real income transaction for deficit $D = \text{round2}(-R)$ with note `Auto-balance (Pure Mode deficit)`, backdated by scanning expenses in reverse chronological order to the first expense where Gullak draw $\ge D$ (WAT-002). Excluded from Home budget chip `periodIncome` but included in all-time inflows/waterfall.
- **PUR-003:** Mode switching between Pure Mode and Budget Mode schedules for tomorrow at 12:00 AM (`effectiveFrom = tomorrow`) to protect today's running budget and midnight Gullak rollover. Toggling back on the same day cancels the pending plan change and scheduled notifications immediately (same-day reversal protection). Overspending past weekly/monthly budget draws from unspent Income and Gullak; Vault Guard only blocks if whole account liquidity ($R \le 0$) is exhausted.
All acceptance tests are verified in `tests/pureModeRules.test.ts`, `tests/budgetModesStore.test.ts`, and `tests/vaultSpendingGuard.test.ts`.

## Consequences
- Old users who used Split will see repaid amounts counted as income after the migration (lifetime income goes up by those amounts).
- One bug was fixed on the way: the all-time "account remaining" used to count the debit leg of a self-transfer as money spent while ignoring its credit leg (`BAL-001`, `TXN-003`).
- Pure Mode users have unrestricted spending freedom while maintaining real-money ledger consistency and zero-loss deficit balance when re-enabling budgets.
- Documentation must be updated in the same change as any rule change (canonical purpose rule 3).

## Follow-up fixes after the first CAR-001 / PUR review (owner-approved 2026-10-17)
- **One number everywhere:** the Home All pill leaves out only the carry-funded part of a period (`pc.funded`), so on a gap week it equals the account total used by the guard, the Gullak cap and the Pure Mode deficit. The gap counts like any budget.
- **Daily allocation keeps the account total flat** (`computeAllTimeBudget` includes the carry still to be used). Carried money is never new money and never disappears. Regression-tested.
- **Funding-ended notice:** one "Carried money has run out" message on the first unfunded day / week / month (`carryEndCopy`, `buildCarryEnds`), then silence. Canonical `CAR-001` §3/§4 and `NOT-001` §3 updated to say so.
- Housekeeping: test-only guards removed from `expenseStore.ts`, stale Pure Mode comment fixed, duplicate `CONTEXT.md` glossary entry removed.

