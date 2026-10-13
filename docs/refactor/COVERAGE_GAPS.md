# Arthik — Refactor Coverage Gaps Audit

> **Generated on:** 2026-10-14  
> **Purpose:** Document audited coverage before refactoring to prevent duplicate test-writing and target genuine gaps.

---

## 1. Safety Net Areas Audit

| Area | Location | Current Test Coverage | Status | Refactor Pre-requisite |
|---|---|---|---|---|
| **`syncPendingExpenses`** | `src/store/expenseStore.ts:337–716` | **0 tests**. Neither `expenseStore.test.ts` nor any other test invokes `syncPendingExpenses()`. | **CRITICAL GAP** | Must write `tests/expenseSyncPending.test.ts` in Step 1. |
| **`hydrateFromSupabase`** | `src/store/dailyBudgetStore.ts:2068–2652` | Partial: `dailyBudgetStore.test.ts` tests toggle invariants and fallback budget; `offlineStartup.test.ts` tests cache bypass. | **MODERATE GAP** | Add characterization tests for full profile sync, plan hydration, and 500-sentinel recovery in Step 2. |
| **`checkAndRollover`** | `src/store/dailyBudgetStore.ts:1618–1966` | Strong: `dailyBudgetStore.test.ts`, `cadenceFixes.test.ts`, `moneyWaterfallStore.test.ts`. | **ADEQUATE** | Extend edge-case assertions (multi-cadence period transitions) in Step 2. |
| **`syncWithExpenses`** | `src/store/dailyBudgetStore.ts:1461–1616` | Covered across `dailyBudgetStore.test.ts`, `gullakReconciliationHardCap.test.ts`. | **ADEQUATE** | Minor regression tests for split repayment unspent budget add. |
| **Auto Logging Email & Sources** | `src/features/autoLog/*` | Strong: `autoLogEmail.test.ts` (40), `autoLogSplit.test.ts` (13), `autoLogFlows.test.ts` (33), `autoLogFixes.test.ts` (39), `autoLogParser.test.ts` (24). | **PROTECTED / FROZEN** | Do not refactor during core store/screen split; use suite as regression gate. |
| **Reimbursements & Self-Transfers** | `src/lib/transactionUtils.ts`, `moneyWaterfall.ts` | Strong: `sharesReimbursementsTransfers.test.ts` (15), `splitRepayment.test.ts` (18). | **COMPLETE** | Covered; maintain existing invariant tests. |
| **Pull-to-History Physics** | `src/lib/pullToHistoryPhysics.ts` | Strong: `pullToHistoryPhysics.test.ts` (28). | **FROZEN** | Frozen component & physics; no changes needed. |

---

## 2. Summary of Actions
- **Step 1:** Write `tests/expenseSyncPending.test.ts` covering 10 distinct scenario suites (deletes, adds, updates, settings, daily records, gullak deposits, category sync, profile patch, P0.12 concurrency re-reads, and network failure backoff).
- **Step 2:** Write `tests/dailyBudgetHydrate.test.ts` targeting `hydrateFromSupabase` edge cases and multi-cadence period healing.
