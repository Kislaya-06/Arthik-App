# ADR 0023: One Transaction Classifier, No Categories (TXN-002 Retired)

## Status: Active

Supersedes [ADR 0008](0008-unified-income-classification.md).

## Context

ADR 0008 put every screen and the budget engine on one rule, `isIncomeTransaction(item, category)`. The rule only needed the category for TXN-002: an old row with no `type` was called income when its category name held a keyword such as "Salary". Because of that one dormant path, the whole app carried categories into every money calculation:

- four near-identical names (`isIncomeTransaction`, `isEligibleIncome`, `isCountedIncome`, `isCountedExpense`), two of them identical;
- two classifier factories with their own caches (`src/lib/incomeClassifier.ts`) and a store module that reached into the category store to build them (`src/store/dailyBudget/classifiers.ts`, the "Negative" of ADR 0008);
- a predicate parameter on `computeSpentByDate` / `computeIncomeByDate` (and their per-date versions), on `groupSpentByDate`, and an optional one on the monthly charts;
- a `categories` input on the ledger, the waterfall, Home totals and the expense funding card, used only to look up that category.

The database makes `expenses.type` NOT NULL (default `'expense'`), `addExpense` defaults it to `'expense'`, and Automatic Logging always sets it. No stored row reaches the keyword path.

## Decision

The owner approved (24 Nov 2026), on the condition that no user's data or figures change:

1. **TXN-002 is retired.** Direction comes from `type` only. A row without a `type` is spending, the same as the database default.
2. **One classifier, row only.** `classifyTransaction(row)` in `src/lib/transactionUtils.ts` returns `spending` / `income` / `moneyBack` / `selfTransfer`. `isCountedIncome(row)` and `isCountedExpense(row)` are one-line questions on it for totals. `isIncomeTransaction(row)` is the row's direction only (`type === 'income'`), for display sign and colour.
3. **Deleted:** `isEligibleIncome` (same as `isCountedIncome`), `DEFAULT_INCOME_KEYWORDS`, `src/lib/incomeClassifier.ts`, `src/store/dailyBudget/classifiers.ts`, the predicate parameters of the spent / income helpers and of `computeMonthlyCashFlowData`, and the `categories` inputs that only fed the classifier (`buildLedgerEntries`, `sumSpendingBetweenDateKeys`, `sumCountedSpending`, `classifyForWaterfall`, `computeWaterfallFromState`, `calculateExpenseTotals`, `calculateExpenseFunding`, `MoneySnapshot`).
4. **Insights helpers keep their positional `categories` argument** where it is no longer read (`_categories`, the file's existing convention), so their callers did not change.

## Consequences

- The budget engine no longer depends on the category store; categories loading late can never change a total.
- `tests/transactionClassifierEquivalence.test.ts` copies the old classifier and the old spent / income helpers and checks, for every type x class x category combination, that the classification, spent / income per day, Home totals, ledger kinds and waterfall rows are unchanged. Only a row with no `type` changes, and the database cannot hold one.
- Test fixtures that relied on a category name to make a row income now say `type: 'income'`, as real rows do.
