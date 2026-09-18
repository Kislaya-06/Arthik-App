# 0007. Dual-Engine Income Classification Divergence

## Status
Superseded by [0008. Unified Income Classification via isIncomeTransaction](0008-unified-income-classification.md) (March 2026).

## Context
In Arthik, financial transactions can be classified as either an outflow (`expense`) or an inflow (`income`). Two separate modules independently evaluate whether a given transaction represents income:

1. **General & Screen Layer (`src/lib/paymentUtils.ts` via `isIncomeTransaction`)**:
   Used across `HomeScreen`, `HistoryScreen`, `ExpenseDetailScreen`, and `CategoryDetailScreen`.
   - Prioritizes explicit `item.type === 'income'` (returns `true`) and `item.type === 'expense'` (returns `false`).
   - Only if `type` is absent/indeterminate, it checks whether the resolved category's name matches any substring in `DEFAULT_INCOME_KEYWORDS`.

2. **Budget & Savings Engine (`src/store/dailyBudgetStore.ts` via `getIncomeCategoryIds`)**:
   Used for daily budget tracking, live spent calculation, past day rollover finalization, Gullak accumulated savings, and savings streak calculations.
   - Calls `getIncomeCategoryIds()`, which iterates over categories in `useCategoryStore.getState().categories` and checks if category names match `DEFAULT_INCOME_KEYWORDS` to assemble a `Set<string>` of income category IDs.
   - Evaluates a transaction as income via: `e.type === 'income' || (e.type !== 'expense' && e.category_id ? incomeIds.has(e.category_id) : false)`.

## Decision
We acknowledge and document this dual-engine divergence as a known architectural inconsistency rather than performing an uncoordinated inline fix. 

## Consequences
- **Inconsistent Accounting under Conflicting Metadata**:
  If a transaction's explicit `type` contradicts its category keywords (for example, an entry with `category: "Salary"` but saved with `type: "expense"`):
  - On `HomeScreen` and `HistoryScreen`, `isIncomeTransaction` returns `false` (it respects `type === 'expense'`).
  - In `dailyBudgetStore`, `e.type === 'expense'` causes `e.type !== 'expense'` to evaluate to `false`, aligning in this specific case.
  - However, if a legacy row has `category_id: null` and `type: undefined`, or if `categoryStore` categories have not completed loading into memory upon boot, `incomeIds` in `dailyBudgetStore` will be empty. The budget engine will count the transaction as an expense, while a screen that loads after categories hydrate will count it as income.
- **Reporting Discrepancies**: A transaction whose classification differs between the two engines causes the total spent shown on the Home screen cards to diverge from the `spent` amount recorded in `DailyRecord` and the Gullak savings ledger.

## What Would Have to Be True to Revisit
We would revisit this decision when:
- Refactoring `dailyBudgetStore` to eliminate `getIncomeCategoryIds()` and standardize strictly on the shared `isIncomeTransaction(expense, category)` helper from `src/lib/paymentUtils.ts`, backed by a guaranteed category lookup map.
- Running a database migration to enforce a non-nullable `type` column across all historical and new rows, making keyword heuristics obsolete.
