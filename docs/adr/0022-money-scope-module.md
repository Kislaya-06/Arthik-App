# ADR 0022: Money Scope Module (Screens Get Card Figures from `src/money` Only)

## Status: Active

## Context

An architecture review (22 Nov 2026) found that `HomeScreen.tsx`, the file changed most often in the repository, built its hero card numbers by chaining about twelve helpers itself: `filterExpenses`, `calculateExpenseTotals`, `spendingTotalsByDateKey`, `calculateBudgetStatus`, `getExternalDepositsInPeriod`, `getCurrentPeriodSummary`, `getCarryCoveredByDate`, `computeWaterfallFromState` + `summarizeScope`, `calculatePeriodSummary` (17 inputs) and the hero details numbers. `SavingsScreen.tsx` repeated part of the same chain (ledger, period summary, waterfall) and chose the allowance card values with five `isCadenceMode ? … : …` lines. Home also read `getAvailableIncomeBalance()`, which reaches the expense list through a hidden global (`expenseBridge`).

The order of these calls and what each one receives decided the money a user sees, but it lived inside two screens. The helpers had tests; the wiring was tested only by reading the screen source. `src/money/index.ts` already said "Screens … do not re-derive classification, totals, allowance or funding", but no module there did the job.

## Decision

The owner approved each point (grilling session, 22–23 Nov 2026):

1. **One Money Scope module.** `src/money/scopeMoney.ts` exposes two functions:
   - `heroMoney(snapshot, { filter, today, todayRecord, userCreatedAt })`: every Home hero number (the `calculatePeriodSummary` result, today's budget / spent / remaining, the running budget period, and the details-sheet numbers).
   - `allowanceCardMoney(snapshot, { today, todayMetrics })`: the Savings allowance card (budget, spent, remaining, over, progress, who paid the overspend).
   Two functions rather than one, because Home and Savings ask different questions; forcing one return shape would change figures.
2. **A pure move.** Refactor Mode (AGENTS §19): every figure stays byte-for-byte the same. `tests/scopeMoney.test.ts` runs the old screen chains (copied verbatim, including the store's `getAvailableIncomeBalance()`) against the module for 8 scenarios × 4 pills and the Savings card.
3. **Numbers only.** Copy stays in the screens (`filterDateLabel`, `carryNote`, card titles) and in `buildHeroDetails`. The two strings `calculatePeriodSummary` already returns (`primaryLabel`, `primarySubtext`) pass through unchanged.
4. **Inputs are passed in.** A plain `MoneySnapshot` (the store objects), built by `useMoneySnapshot()`. The available income balance is read from the same waterfall instead of the hidden global (a test proves the two match). `todayRecord` / `todayMetrics` still come from the store's `getTodayRecord()`, which owns the §8.1 / FIN-16 rules.
5. **No extra work on a pill switch.** The parts that do not depend on the pill (ledger, waterfall, period summary, carry) are kept for the last snapshot; a test checks that switching pills does not read the ledger again.
6. **Old helpers stay.** `calculatePeriodSummary`, `computeWaterfallFromState`, `summarizeScope` and `getCurrentPeriodSummary` keep their exports and tests; the module calls them.

## Consequences

- A change to how a card's money is computed is made once, in `scopeMoney.ts`, and tested through its two functions.
- `tests/opt50to53Cleanup.test.ts` now checks that the screens use `money/scopeMoney` (and that the module uses `lib/moneyWaterfall`), instead of the screens importing `lib/moneyWaterfall` directly.
- Not yet covered: the Insights, History and Category Detail screens still build their own figures. Moving them is separate work.
