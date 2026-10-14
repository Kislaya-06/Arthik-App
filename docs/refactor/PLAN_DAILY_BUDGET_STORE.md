# Architecture & Execution Plan: `dailyBudgetStore` Decomposition (Step 7)

> **Target File:** `src/store/dailyBudgetStore.ts` (2,735 lines)  
> **Goal:** Behaviour-preserving decomposition into cohesive, single-responsibility modules under `src/store/dailyBudget/` while preserving 100% of the public API, zero circular dependencies, identical AsyncStorage persistence, and bit-identical financial calculations.  
> **Target Post-Split Size:** `src/store/dailyBudgetStore.ts` reduced from 2,735 lines to ~900–1,100 lines (orchestration, action dispatch, persist/migrate).

---

## 1. Safety Invariants & Architectural Constraints

1. **Singleton Module-Level State (`expenseGetter`, `expensesLoadedGetter`, `sharesGetter`)**:
   - Must exist in **exactly one module** (`src/store/dailyBudget/expenseBridge.ts`).
   - Must be re-exported by `src/store/dailyBudgetStore.ts` so existing importers (`expenseStore.ts`, tests) mutate and read the exact same module reference. Duplicate declarations will cause silent desynchronization and rollover failure.
2. **Preserve Middle Imports & Module Evaluation Order**:
   - Imports in the middle of `dailyBudgetStore.ts` (e.g. `useCategoryStore`, `budgetCalculations`, `budgetPeriods`, `budgetModeUtils`) must not be arbitrarily moved to the top. This guarantees module-evaluation order remains stable.
3. **Persist Configuration & Migration Invariant (`version: 3`)**:
   - Zustand `persist`, `name: 'arthik-daily-budget-storage-v2'`, `version: 3`, `migrate`, and `partialize` remain strictly inside `src/store/dailyBudgetStore.ts` untouched. Any alteration to key names or storage schema would corrupt user local databases.
4. **No Circular Dependencies**:
   - Helper modules under `src/store/dailyBudget/` must **never** import `useDailyBudgetStore` at runtime.
   - Dynamic store state access must be passed via `get: () => DailyBudgetState` and `set: (fn) => void`, preventing stale state snapshots and eliminating cycles.
   - Type imports must strictly use `import type`.
5. **Exact Financial & Timestamp Semantics**:
   - All financial operations (`Math.max`, `Math.min`, `Math.round`, Indian currency formatting, `parseISO`, `format`) and fire-and-forget background promises must remain byte-identical.

---

## 2. Target File Decomposition Map

| Module Path | Target Responsibility | Functions / Variables Extracted | Source Line Range |
|---|---|---|---|
| `src/store/dailyBudget/types.ts` | Shared domain interfaces & store signature types | `ProfileSettingsPatch`, `GullakDepositSource`, `GullakDeposit`, `DailyBudgetState`, `DailyBudgetGet`, `DailyBudgetSet` | 155–162, 223–232, 485–559 |
| `src/store/dailyBudget/pendingStorage.ts` | AsyncStorage keys & offline serialization queues | `getPendingSettingsKey`, `getPendingGullakAddsKey`, `getPendingGullakDeletesKey`, `getPendingPlanChangesKey`, `getPendingBudgetPeriodsKey`, `getLastRenewedPeriodKey`, `savePendingSettingsOffline`, `clearPendingSettingsOffline`, `savePendingPlanChangeOffline`, `savePendingBudgetPeriodOffline`, `getStoredList`, `setStoredList`, `savePendingGullakAdd`, `tryRemovePendingGullakAdd`, `savePendingGullakDelete` | 148–153, 164–221, 234–268 |
| `src/store/dailyBudget/expenseBridge.ts` | Cross-store expense access & registration callbacks | `expenseGetter`, `registerExpenseGetter`, `getCurrentExpenses`, `expensesLoadedGetter`, `sharesGetter`, `registerSharesGetter`, `getCurrentShares`, `registerExpensesLoadedGetter`, `areExpensesLoaded` | 18–33, 46–59 |
| `src/store/dailyBudget/classifiers.ts` | Transaction categorisation & income eligibility | `buildCategoryClassifier`, `buildReimbursementClassifier`, `buildEligibleIncomeClassifier` | 73–86 |
| `src/store/dailyBudget/metrics.ts` | Metric aggregation, waterfalls, and all-time calculations | `getUserCreatedAtLocalDate`, `isDailyOwnedDate`, `dailyCarryExtraFor`, `getUserCreatedAtStr`, `runWaterfall`, `computeAllTimeBudget`, `computeMetrics` | 9–16, 37–44, 120–121, 270–484 |
| `src/store/dailyBudget/rollover.ts` | Day evaluation, gap-filling, daily/period finalization | `applyScheduledNextDayBudget`, `groupSpentByDate`, `collectPastDates`, `finalizeDailyRecords`, `finalizePeriods` | 1618–1967 (helpers extracted from `checkAndRollover`) |
| `src/store/dailyBudget/hydrate.ts` | Startup hydration, remote sync, self-healing recoveries | `waitForPersistHydration`, `readPendingSettings`, `fetchRemoteBudgetData`, `mergePendingPlanChanges`, `mergePendingPeriods`, `selfHealDefaultBudget`, `selfHealCorruptedRows`, `hydrateGullakDeposits`, `buildOfflineHydrationPatch` | 2068–2653 (helpers extracted from `hydrateFromSupabase`) |
| `src/store/dailyBudgetStore.ts` | Public store creation, state interface, actions orchestration, persist/migrate | Store state initialization, action dispatchers delegating to extracted modules, `persist` config | Remaining ~900–1,100 lines |

---

## 3. Public API & Re-Export Contract

The following symbols **MUST** remain exported from `src/store/dailyBudgetStore.ts` without breaking changes:

| Symbol Name | Type | Current Importers Across Codebase | Re-export Target |
|---|---|---|---|
| `useDailyBudgetStore` | Hook / Store | 26+ files (`HomeScreen`, `SavingsScreen`, `HistoryScreen`, `ExpenseFormScreen`, stores, tests) | Main store in `dailyBudgetStore.ts` |
| `registerExpenseGetter` | Function | `src/store/expenseStore.ts`, `tests/helpers/autoLogTestEnv.ts`, tests | `./dailyBudget/expenseBridge` |
| `getCurrentExpenses` | Function | `src/screens/HomeScreen.tsx`, `src/features/autoLog/engine.ts`, tests | `./dailyBudget/expenseBridge` |
| `registerExpensesLoadedGetter`| Function | `src/store/expenseStore.ts`, tests | `./dailyBudget/expenseBridge` |
| `areExpensesLoaded` | Function | `src/features/autoLog/engine.ts`, tests | `./dailyBudget/expenseBridge` |
| `registerSharesGetter` | Function | `HomeScreen.tsx` | `./dailyBudget/expenseBridge` |
| `getPendingSettingsKey` | Function | `src/store/expenseStore.ts`, `src/store/expense/syncPending.ts` | `./dailyBudget/pendingStorage` |
| `getPendingGullakAddsKey` | Function | Tests, `ProfileScreen.tsx` | `./dailyBudget/pendingStorage` |
| `getPendingGullakDeletesKey` | Function | Tests | `./dailyBudget/pendingStorage` |
| `getPendingPlanChangesKey` | Function | Tests | `./dailyBudget/pendingStorage` |
| `getPendingBudgetPeriodsKey`| Function | Tests | `./dailyBudget/pendingStorage` |
| `getLastRenewedPeriodKey` | Function | Tests | `./dailyBudget/pendingStorage` |
| `savePendingSettingsOffline`| Function | `ProfileScreen.tsx`, tests | `./dailyBudget/pendingStorage` |
| `clearPendingSettingsOffline`| Function| Tests | `./dailyBudget/pendingStorage` |
| `savePendingPlanChangeOffline`| Function | `CadenceSwitchModal.tsx`, tests | `./dailyBudget/pendingStorage` |
| `savePendingBudgetPeriodOffline`| Function| Tests | `./dailyBudget/pendingStorage` |
| `ProfileSettingsPatch` | Interface | `src/store/expenseStore.ts`, `src/store/expense/syncPending.ts` | `./dailyBudget/types` |
| `GullakDepositSource` | Type | `src/screens/SavingsScreen.tsx`, `src/features/autoLog/ledger.ts`, tests | `./dailyBudget/types` |
| `GullakDeposit` | Interface | `src/screens/SavingsScreen.tsx`, `src/components/GullakDepositDetailModal.tsx`, tests | `./dailyBudget/types` |
| Re-exported Pure Helpers | Functions | `computeSpentByDate`, `calculateSavingsMetrics`, etc. | Preserved re-exports from `../lib/budgetCalculations` |

---

## 4. Import Graph & Circular Dependency Proof

### Baseline
```
madge: 2 cycles (frozen in features/autoLog)
0 cycles in src/store/
```

### Proposed Structure
```
src/store/dailyBudget/types.ts           (leaf: no internal imports)
src/store/dailyBudget/pendingStorage.ts   --> imports types.ts, AsyncStorage
src/store/dailyBudget/expenseBridge.ts    --> imports types from ../expense/types.ts
src/store/dailyBudget/classifiers.ts      --> imports ../categoryStore, ../../lib/incomeClassifier
src/store/dailyBudget/metrics.ts          --> imports expenseBridge, classifiers, lib/budgetCalculations
src/store/dailyBudget/rollover.ts         --> imports metrics, lib/budgetPeriods, types.ts
src/store/dailyBudget/hydrate.ts          --> imports pendingStorage, metrics, config/supabase, types.ts
src/store/dailyBudgetStore.ts             --> imports all above modules, assembles zustand store
```
- No helper module under `src/store/dailyBudget/` imports `src/store/dailyBudgetStore.ts`.
- `expenseBridge.ts` imports types only from `../expense/types.ts`.
- **Circular graph count remains exactly 2 (AutoLog frozen background tasks)**.

---

## 5. Execution Phasing (Sub-steps 7a to 7g)

| Step | Action | Files Touched | Guarding Test Suites |
|---|---|---|---|
| **7a** | Extract Pending Storage & Types | `src/store/dailyBudget/types.ts`, `src/store/dailyBudget/pendingStorage.ts`, `dailyBudgetStore.ts` | `tests/dailyBudgetStore.test.ts`, `tests/offlineStartup.test.ts` |
| **7b** | Extract Expense Bridge & Classifiers | `src/store/dailyBudget/expenseBridge.ts`, `src/store/dailyBudget/classifiers.ts`, `dailyBudgetStore.ts` | `tests/dailyBudgetStore.test.ts`, `tests/incomeClassifier.test.ts`, `tests/splitRepayment.test.ts` |
| **7c** | Extract `computeMetrics` | `src/store/dailyBudget/metrics.ts`, `dailyBudgetStore.ts` | `tests/moneyWaterfall.test.ts`, `tests/budgetCalculations.test.ts`, `tests/financialCorrectnessMatrix.test.ts` |
| **7d-1** | Split `checkAndRollover` into named helpers (in-place) | `src/store/dailyBudgetStore.ts` | `tests/dailyBudgetRollover.test.ts`, `tests/cadenceFixes.test.ts`, `tests/dailyBudgetStore.test.ts` |
| **7d-2** | Move rollover helpers to `dailyBudget/rollover.ts` | `src/store/dailyBudget/rollover.ts`, `dailyBudgetStore.ts` | `tests/dailyBudgetRollover.test.ts`, `tests/cadenceFixes.test.ts` |
| **7e-1** | Split `hydrateFromSupabase` into named helpers (in-place) | `src/store/dailyBudgetStore.ts` | `tests/dailyBudgetHydrate.test.ts`, `tests/offlineStartup.test.ts`, `tests/dailyBudgetStore.test.ts` |
| **7e-2** | Move hydrate helpers to `dailyBudget/hydrate.ts` | `src/store/dailyBudget/hydrate.ts`, `dailyBudgetStore.ts` | `tests/dailyBudgetHydrate.test.ts`, `tests/offlineStartup.test.ts` |
| **7f** | Optional: Streamline remaining large actions (`setDailyBudget`, `toggleAutoRenew`, `setBudgetModeEnabled`) | `dailyBudgetStore.ts` | `tests/budgetModesStore.test.ts`, `tests/cadenceSwitch.test.ts` |
| **7g** | Final verification, madge check, and merge to `refactor/integration` | `dailyBudgetStore.ts`, `CHANGELOG.md` | Full test suite (`85/85` test files, 1,429 tests) |
