# 0008. Unified Income Classification via isIncomeTransaction

## Status
Accepted (March 2026) — Supersedes [0007. Dual-Engine Income Classification Divergence](0007-income-classification-divergence.md).

## Context
Previously, Arthik evaluated transaction direction using two separate implementations:
1. `src/lib/paymentUtils.ts` (`isIncomeTransaction`) used by all UI screens (`HomeScreen`, `HistoryScreen`, `ExpenseDetailScreen`), checking explicit transaction `type` first and falling back to category keywords only if `type` was missing.
2. `src/store/dailyBudgetStore.ts` (`getIncomeCategoryIds`), which inspected category names in `useCategoryStore` against keywords without checking the transaction's own `type` field, causing accounting divergence on conflicting metadata and on startup before categories loaded into memory.

## Decision
We eliminated `getIncomeCategoryIds` and unified the entire application on the single, shared classification helper `isIncomeTransaction(item, category)` from `src/lib/paymentUtils.ts`:

1. **Category Lookup in Budget Engine (`src/store/dailyBudgetStore.ts:38–48`)**:
   Extracted `buildCategoryClassifier()` inside `dailyBudgetStore.ts`. It builds an in-memory `Map<string, Category>` from `useCategoryStore.getState().categories` and constructs a pure predicate `(e: Expense) => boolean` delegating directly to `isIncomeTransaction(e, cat)`.
2. **Startup Sequence Enforcement (`App.tsx:122–127`)**:
   In `App.tsx`, we sequenced boot initialization so `await fetchCategories(true)` completes before launching `Promise.all([fetchExpenses(), hydrateFromSupabase()])`. This guarantees categories are in memory before the budget engine evaluates expenses.
3. **Purity in Budget Calculations (`src/lib/budgetCalculations.ts:204–242`)**:
   Pure calculation functions `computeSpentByDate` and `computeSpentForDate` accept `isIncomeFn: (e: Expense) => boolean` as an injected argument rather than reading store state directly.

## Consequences
- **Positive**: Complete accounting consistency across all screens and the budget engine. An income transaction is treated identically whether viewed on Home cashflow or calculated into Gullak savings, eliminating false overspend alerts and streak breaks.
- **Negative**: `dailyBudgetStore.ts` retains a cross-store dependency on `useCategoryStore` to build the category map during spent calculation. This is mitigated by `App.tsx` startup sequencing and local category caching (`@arthik_cached_categories_${userId}`).

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- A future database migration enforces a non-nullable `type` column (`'expense' | 'income'`) across all historical and new rows in Supabase, allowing category keyword inspection to be removed entirely.
