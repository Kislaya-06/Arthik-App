# Arthik — Refactor Baseline (Step 0)

> **Generated on:** 2026-10-14  
> **Environment:** Node.js v24.19.0 | Windows | Vitest v5.0.1 | TypeScript 5.9.3 | Expo SDK 57  
> **Git Branch:** `refactor/00-baseline`  
> **Initial Tag:** `pre-refactor`

---

## 1. Test & Typecheck Baseline

### Untouched Baseline vs Post-Assertion-Fix Baseline
- **Untouched Pre-Refactor Baseline**: Contained 2 failing tests in `tests/dailyBudgetStore.test.ts` (1 failure) and `tests/gullakDeposits.test.ts` (1 failure) due to legacy test fixtures: the fixtures registered a ₹500 regular expense funded from income without a budget, but the test assertions (`3200`, `5000`, `3000`) had not subtracted that ₹500 expense from available income (`availableIncomeBalance = grossIncome - expensesFromIncome - incomeDepositsToGullak`).
- **Post-Assertion-Fix Baseline (commit 92f97bd)**: Measured on clean local build after correcting the expectations to match the canonical Real-Money Waterfall (`3200 → 2700`, `5000 → 4500`, `3000 → 2500`):

| Check | Result |
|---|---|
| `npm test` (Vitest) | **79 test files passed (100%)**, **1379 tests passed (100%)**, 0 failed |
| Duration | ~4.11s |
| `npx tsc --noEmit` | **0 errors** |
| Current `any` in `src/` | 82 occurrences |
| Current `@ts-ignore` in `src/` | 1 occurrence |
| Current `any` in `tests/` | 243 occurrences |
| Circular dependencies (`madge`) | 3 cycles (documented below) |

### Final Verification Post-Refactor Status (2026-10-15)
- `npm test` (Vitest): **86 test files passed (100%)**, **1438 tests passed (100%)**, 0 failed
- `npx tsc --noEmit`: **0 errors**
- `dailyBudgetStore.ts`: Reduced from 2,734 lines (initial) / 1,789 lines (audited snapshot) to **779 lines** (facade delegating to 9 sub-modules in `src/store/dailyBudget/` including extracted `selfHealing.ts`).
- New test suites added: `tests/dailyBudgetHydrate.test.ts`, `tests/dailyBudgetRollover.test.ts`, `tests/expenseSyncPending.test.ts`, `tests/dailyBudgetPlanActions.test.ts`, and others, increasing passing tests from 1,379 to 1,438.

### Circular Dependencies Detected
1. `src/store/dailyBudgetStore.ts` > `src/store/expenseStore.ts`
2. `src/features/autoLog/service.ts` > `src/features/autoLog/background.ts`
3. `src/features/autoLog/service.ts` > `src/features/autoLog/background.ts` > `src/features/autoLog/store.ts`

---

## 2. Danger List Table

| File | Total Lines | Top 3 Longest Functions / Actions (Name & Lines) | React Hooks (useState / useMemo / useEffect) | Importing Tests (`tests/*.test.ts`) |
|---|---:|---|---|---|
| `src/store/dailyBudgetStore.ts` | 2734 | 1. `hydrateFromSupabase` (lines 2068–2652, 585 lines)<br>2. `checkAndRollover` (lines 1618–1966, 349 lines)<br>3. `syncWithExpenses` (lines 1461–1616, 156 lines) | N/A (Zustand store) | 15 tests:<br>`budgetModesStore.test.ts`<br>`cadenceFixes.test.ts`<br>`dailyBudgetStore.test.ts`<br>`gullakDeposits.test.ts`<br>`gullakReconciliationHardCap.test.ts`<br>`moneyFixesFour.test.ts`<br>`moneyWaterfallStore.test.ts`<br>`monthlyInsightsData.test.ts`<br>`notificationSync.test.ts`<br>`offlineStartup.test.ts`<br>`splitRepayment.test.ts`<br>`useExpenseForm.test.ts`<br>`useSavingsDashboard.test.ts`<br>`weeklyInsightsData.test.ts`<br>`yearlyInsightsData.test.ts` |
| `src/store/expenseStore.ts` | 1192 | 1. `syncPendingExpenses` (lines 337–716, 380 lines)<br>2. `fetchExpenses` (lines 718–866, 149 lines)<br>3. `addExpense` (lines 868–967, 100 lines) | N/A (Zustand store) | 14 tests:<br>`budgetModesStore.test.ts`<br>`cadenceFixes.test.ts`<br>`expenseFilters.test.ts`<br>`expenseStore.test.ts`<br>`gullakReconciliationHardCap.test.ts`<br>`homeSpendingNewUser.test.ts`<br>`moneyFixesFour.test.ts`<br>`moneyWaterfallStore.test.ts`<br>`noteSuggestions.test.ts`<br>`notificationSync.test.ts`<br>`offlineStartup.test.ts`<br>`splitRepayment.test.ts`<br>`transactionFunding.test.ts`<br>`useExpenseForm.test.ts` |
| `src/screens/InsightsScreen.tsx` | 2064 | 1. `InsightsScreen` component (lines 340–1869, 1530 lines)<br>2. `styles` StyleSheet (lines 1871–2064, 194 lines)<br>3. `PeriodNavigator` (lines 173–303, 131 lines) | `useState`: 7<br>`useMemo`: 56<br>`useEffect`: 3 | None (0) |
| `src/screens/SavingsScreen.tsx` | 1491 | 1. `SavingsScreen` component (lines 72–1053, 982 lines)<br>2. `styles` StyleSheet (lines 1055–1491, 437 lines)<br>3. `handleDeleteDeposit` (lines 119–137, 19 lines) | `useState`: 7<br>`useMemo`: 13<br>`useEffect`: 4 | None (0) |
| `src/screens/ProfileScreen.tsx` | 1198 | 1. `ProfileScreen` component (lines 43–886, 844 lines)<br>2. `styles` StyleSheet (lines 888–1198, 311 lines)<br>3. `handleDeleteAccount` (lines 224–270, 47 lines) | `useState`: 14<br>`useMemo`: 0<br>`useEffect`: 2 | None (0) |
| `src/components/StreakCalendarModal.tsx` | 901 | 1. `StreakCalendarModal` component (lines 46–704, 659 lines)<br>2. `styles` StyleSheet (lines 706–901, 196 lines)<br>3. `loadMonthHistory` (lines 208–287, 80 lines) | `useState`: 5<br>`useMemo`: 3<br>`useEffect`: 4 | None (0) |
| `src/screens/ExpenseFormScreen.tsx` | 1177 | 1. `ExpenseFormScreen` component (lines 163–906, 744 lines)<br>2. `styles` StyleSheet (lines 908–1177, 270 lines)<br>3. `CategoryChipItem` (lines 58–161, 104 lines) | `useState`: 6<br>`useMemo`: 7<br>`useEffect`: 2 | None (0) |

---

## 3. High-Priority Safety Net Gaps (Before Refactoring)

1. **`syncPendingExpenses` (src/store/expenseStore.ts)**:
   - Lines: ~380 lines (337–716).
   - Direct unit tests: **0 tests**.
   - Risk: 8 distinct sequential queues (deletes -> adds -> updates -> settings -> daily -> gullak -> categories -> profile -> cache) plus 3 P0.12 concurrency re-reads.
   - Action: Implement characterization tests in Step 1 before touching `expenseStore.ts`.

2. **`hydrateFromSupabase` & `checkAndRollover` (src/store/dailyBudgetStore.ts)**:
   - Lines: ~585 lines (2068–2652) and ~349 lines (1618–1966).
   - Direct unit tests: Partial coverage in `dailyBudgetStore.test.ts` (toggle invariants, basic rollover), but full edge-case matrix and self-healing recovery lack isolated characterization tests.
   - Action: Add safety net tests in Step 2 before splitting `dailyBudgetStore.ts`.
