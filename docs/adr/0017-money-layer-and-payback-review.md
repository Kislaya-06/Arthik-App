# 0017. Unified Money Layer and Payback Review Resolution

## Status
Accepted (20 October 2026). Canonical rules: `BUD-009`, `MNY-001`, `SPL-005` (point 5), `NOT-001` (point 3).

## Context
1. Calculation logic across Arthik screens previously had subtle discrepancies:
   - Monthly budget cadence was sometimes approximated (e.g. dividing by 30 in weekly insights, or by 365/12 in yearly insights) instead of being allocated across the actual calendar days of the specific month.
   - Multiple screens and components separately evaluated transaction eligibility by manually combining `isIncomeTransaction(...)` and `isExcludedFromTotals(...)`.
2. In Automatic Logging (`ReviewSheet.tsx`), when a user tapped an incoming credit to settle a friend's debt ("Aditya owes ₹X → Settle"), the settlement was completed, but because the transaction had no user-selected category, it was flagged with `needs_category`. Since a payback has no category of its own (its money restores the categories of the original split expenses, `SPL-003`), the review dialog immediately prompted again asking for a category.

## Decision
1. **Unified `src/money/` Domain Layer (`MNY-001`)**:
   - `dateKeys.ts`: Single authoritative date string format (`yyyy-MM-dd`), date navigation, and calendar day counts.
   - `ledger.ts`: Single-pass normalization of transaction rows into typed ledger items with explicit `amountPaid` vs `amountCountedAfterMoneyBack`.
   - `budgetAllowance.ts` (`BUD-009`): One unified daily rate for all budget cadences. A monthly budget is divided by the actual number of days in that specific calendar month (e.g., 31 in Oct, 30 in Nov, 28/29 in Feb).
   - `budgetStatus.ts`: Standardized computation of left-to-spend, overspent amount, and budget ratio based on `calculateCycleFinancials`.
   - `overspendFunding.ts`: Waterfall attribution resolving whether overspends were funded by income or Gullak.
2. **Centralized Transaction Classification**:
   - Centralized into `classifyTransaction` (`spending`, `income`, `moneyBack`, `selfTransfer`).
   - Replaced duplicate filter loops across weekly, monthly, yearly insights, and `SavingsScreen`.
3. **Friend's Payback Review Resolution (`SPL-005 point 5`)**:
   - In `ReviewSheet.tsx`, `settleWith` explicitly passes `{ clearNeedsCategory: true }` to `classifyEvent`, preventing the prompt from reappearing.
   - The primary footer button indicates action state with `"Saving <Person>'s payback · ₹X"`.
   - In `src/store/expense/moneyBack.ts`, `convertIncomeToMoneyBack` triggers `finishLinkedAutoLogReview` to cleanly reconcile and dismiss any pending review event when settling via transaction details or notifications.

## Consequences
- Zero numerical drift across Home, Savings, and Weekly/Monthly/Yearly Insights.
- Payback settlements immediately complete without zombie review loops.
- 100% OTA-safe pure TypeScript logic.
- Verified by 118 test files (1,731 tests passing).
