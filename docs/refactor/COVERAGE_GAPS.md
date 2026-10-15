# Arthik — Refactor Coverage Gaps Audit

> **Generated on:** 2026-10-14  
> **Phase:** Step 2 Phase A Audit (dailyBudgetStore)  
> **Target:** `hydrateFromSupabase`, `checkAndRollover`, and `syncWithExpenses` in `src/store/dailyBudgetStore.ts`

---

## 1. Audited Test Suites

The following test suites were audited for existing coverage:
1. `tests/dailyBudgetStore.test.ts` (569 lines) — Slice 1 to 8.
2. `tests/budgetModesStore.test.ts` (637 lines) — Slices 1 to 8.
3. `tests/offlineStartup.test.ts` (144 lines) — Offline session and store hydration smoke.
4. `tests/financialCorrectnessMatrix.test.ts` (653 lines) — Scenarios 1 to 8 for pure budget library helpers.
5. `tests/gullakReconciliationHardCap.test.ts` (370 lines) — Hard cap on Gullak balance.
6. `tests/realTimeIncomeGullakDeduction.test.ts` (479 lines) — Home screen period calculations and chips.
7. `tests/sharesReimbursementsTransfers.test.ts` (162 lines) — Reimbursements and split expenses accounting.

---

## 2. Comprehensive Branch Coverage Matrix

### 2.1 `hydrateFromSupabase` (Lines 2068–2652)

| Branch / Behavior | Lines in `dailyBudgetStore.ts` | Existing Coverage | Status | Implemented & Executed Test |
|---|---|---|---|---|
| **Persist-wait timeout** | 2071–2082 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `times out safely after 500ms when zustand persist has not finished hydrating` |
| **Owner change reset** | 2084–2089 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `resets daily budget state when ownerUserId changes` |
| **Offline fast-path: `daily_budget`** | 2112–2114 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path applies pending daily_budget` |
| **Offline fast-path: `is_auto_renew`** | 2115–2117 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path applies pending is_auto_renew` |
| **Offline fast-path: `is_budget_mode_enabled`** | 2118–2120 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path applies pending is_budget_mode_enabled` |
| **Offline fast-path: `budget_cadence`** | 2121–2123 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path applies pending budget_cadence` |
| **Offline fast-path: `weekly_budget`** | 2124–2126 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path applies pending weekly_budget` |
| **Offline fast-path: `monthly_budget`** | 2127–2129 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path applies pending monthly_budget` |
| **Offline fast-path creates today's record** | 2131–2140 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path creates today's record when missing` |
| **Offline fast-path Pure-mode branch** | 2156–2163 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `offline fast-path sets budget: 0 and status: unknown in Pure mode` |
| **Remote 3500ms timeout fallback** | 2210–2213 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `falls back safely when remote queries exceed 3500ms timeout` |
| **Pending plan changes merge** | 2306–2312 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `merges offline pending plan changes into remote changes` |
| **Pending periods merge** | 2337–2343 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `merges offline pending budget periods into remote periods` |
| **Self-heal: resolved budget is 500** | 2362–2420 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `recovers true historical budget when remote profile has migration default 500` |
| **Self-heal: corrupted row budget** | 2451–2460 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `self-heals corrupted daily_savings_log row true day budget` |
| **Self-heal: corrupted row saved/status** | 2461–2475 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `self-heals corrupted daily_savings_log row recalculating saved and status` |
| **Self-heal: update corrupted row in Supabase** | 2476–2509 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `self-heals corrupted server row by upserting true values to Supabase` |
| **Today's record ensure (online)** | 2513–2548 | `tests/dailyBudgetHydrate.test.ts`, `tests/dailyBudgetStore.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `creates today's active record during online hydration when missing` |
| **Gullak deposits merge: local pending adds preserved** | 2580–2603 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `preserves local deposits missing on server and pushes them to Supabase` |
| **Final calls: checkAndRollover & uploadPending** | 2642–2648 | `tests/dailyBudgetHydrate.test.ts` | **COVERED** | `tests/dailyBudgetHydrate.test.ts` &rarr; `triggers checkAndRollover with skipRolloverNotification and uploadPendingDailyRecords` |

---

### 2.2 `checkAndRollover` (Lines 1618–1966)

| Branch / Behavior | Lines in `dailyBudgetStore.ts` | Existing Coverage | Status | Implemented & Executed Test |
|---|---|---|---|---|
| **Hydration guard** | 1620–1623 | `dailyBudgetStore.test.ts` &rarr; `Slice 1: P0.1 User Isolation Guard` | **COVERED** | `dailyBudgetStore.test.ts` |
| **Scheduled next-day budget applied** | 1629–1639 | `dailyBudgetStore.test.ts` &rarr; `Slice 3: Next-Day Budget Scheduling` | **COVERED** | `dailyBudgetStore.test.ts` |
| **Gap-fill only for real records/expenses (no phantoms)** | 1667–1670 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `does not create phantom daily records across inactive calendar gaps` |
| **Days owned by weekly/monthly/paused skipped by daily loop** | 1673–1679 | `budgetModesStore.test.ts` &rarr; `3. Weekly User Period Finalization` | **COVERED** | `budgetModesStore.test.ts` |
| **Date before account creation skipped** | 1681–1689 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `deletes and ignores past dates before user account creation` |
| **Untracked day preserved as unknown** | 1712–1716 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `preserves historical untracked day with status unknown and 0 budget/saved` |
| **Budget locked from existing record** | 1717–1722 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `locks past day budget from existing record regardless of current dailyBudgetAmount` |
| **First-time finalize with auto-renew & budget > 0** | 1724–1727 | `dailyBudgetStore.test.ts` &rarr; `Slice 2: Rollover & Finalization` | **COVERED** | `dailyBudgetStore.test.ts` |
| **Zero budget + zero spent skipped** | 1728–1733 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `skips finalization when both budget and spent are zero on unrecorded past day` |
| **Supabase upload failure leaves `needsUpload: true`** | 1770–1816 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `leaves needsUpload true on record when Supabase upsert fails` |
| **Yesterday savings notification** | 1818–1833 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `triggers rollover notification for yesterday savings and dedupes on repeat runs` |
| **Weekly period finalize** | 1851–1882 | `budgetModesStore.test.ts` &rarr; `3. Weekly User Period Finalization` | **COVERED** | `budgetModesStore.test.ts` |
| **Monthly period finalize** | 1851–1882 | `financialCorrectnessMatrix.test.ts` &rarr; `Scenario 8` | **COVERED** | `financialCorrectnessMatrix.test.ts` |
| **Period upload offline queue** | 1890–1893 | `tests/dailyBudgetRollover.test.ts` | **COVERED** | `tests/dailyBudgetRollover.test.ts` &rarr; `queues finalized period offline in AsyncStorage during checkAndRollover` |

---

### 2.3 `syncWithExpenses` (Lines 1461–1616)

| Branch / Behavior | Lines in `dailyBudgetStore.ts` | Existing Coverage | Status | Implemented & Executed Test |
|---|---|---|---|---|
| **Today's spent/income/reimbursement recompute** | 1467–1473 | `gullakReconciliationHardCap.test.ts`, `realTimeIncomeGullakDeduction.test.ts`, `sharesReimbursementsTransfers.test.ts` | **COVERED** | Existing suites |
| **Record creation when missing** | 1479–1491 | `dailyBudgetStore.test.ts`, `budgetModesStore.test.ts` | **COVERED** | Existing suites |
| **Edit/delete of past expense updates finalized day** | 1615 &rarr; 1749–1768 | `tests/dailyBudgetSyncWithExpenses.test.ts` | **COVERED** | `tests/dailyBudgetSyncWithExpenses.test.ts` &rarr; `recomputes past finalized day status from saved to exceeded when past expense is increased` |

---

## 3. Plan for Phase B Implementation

### Target Test Files:
1. **`tests/dailyBudgetHydrate.test.ts`**:
   - Persist-wait 500ms timeout.
   - Owner change reset (`ownerUserId`).
   - Offline fast-path for all 6 pending settings fields.
   - Offline fast-path creates today's record when missing.
   - Offline fast-path Pure-mode branch.
   - Remote 3500ms timeout fallback.
   - Pending plan changes merge (`getPendingPlanChangesKey`).
   - Pending periods merge (`getPendingBudgetPeriodsKey`).
   - Self-healing recovery for migration default 500 budget.
   - Self-healing corrupted `daily_savings_log` rows (true budget, recalculated status, and Supabase upsert).
   - Online today's record creation when missing.
   - Gullak deposits merge with preservation of local pending adds.
   - Invocation of `checkAndRollover(currentExpenses, true)` and `uploadPendingDailyRecords()`.

2. **`tests/dailyBudgetRollover.test.ts`**:
   - Gap-fill only for real records/expenses (no phantom days).
   - Date before account creation deleted/skipped.
   - Untracked historical days preserved as unknown with 0 budget/saved.
   - Budget locked from existing record.
   - Zero budget + zero spent skipped.
   - Supabase upload failure leaves `needsUpload: true`.
   - Yesterday savings notification triggered & deduped.
   - Finalized period queued offline (`savePendingBudgetPeriodOffline`).

3. **`tests/dailyBudgetSyncWithExpenses.test.ts`**:
   - Modifying a past expense triggers rollover re-evaluation and updates a previously finalized day from `saved` to `exceeded`.

### Mutation Check Targets (Phase B Requirement):
1. **Hydrate offline path**: Mutate `resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew)` &rarr; verify `offline fast-path applies pending is_auto_renew` fails.
2. **Self-heal 500**: Mutate `bestCandidate > 0 && bestCandidate !== 500` &rarr; verify `recovers true historical budget` fails.
3. **Gullak merge**: Mutate `[...serverDeposits, ...missingOnServer]` &rarr; `[...serverDeposits]` &rarr; verify `preserves local deposits missing on server` fails.
4. **Daily loop gap-fill**: Mutate `if (!records[d]) continue` &rarr; create phantom record &rarr; verify `does not create phantom daily records` fails.
5. **Period finalize offline queue**: Comment out `savePendingBudgetPeriodOffline` &rarr; verify `queues finalized period offline` fails.
6. **Zero-budget skip**: Remove `if (budget === 0 && spent === 0) continue;` &rarr; verify `skips finalization when both budget and spent are zero` fails.

---

### 2.4 Sub-step 7d Mutation Check Audit Note

- **Mutation 1 (`<` to `<=` in past-date filter)**: Verified & killed by 5 test suites (`cadenceFixes.test.ts`, `dailyBudgetHydrate.test.ts`, `dailyBudgetStore.test.ts`).
- **Mutation 2 (remove pre-account check `isPreAccount`)**: Verified & killed by `tests/dailyBudgetRollover.test.ts` (`deletes and skips records for dates prior to user account creation`).
- **Mutation 3 (swap notify and upload order in `finalizeDailyRecords`)**: Observed that both Supabase upsert and rollover notification are asynchronous, independent fire-and-forget side effects initiated synchronously in the same loop cycle. No test asserts relative invocation sequence because neither operation awaits or consumes the other's return value. Preserved original textual order: Supabase upsert initiated first, followed immediately by notification trigger.

---

### 2.5 Sub-step 7e Mutation Check Audit Note

- **Mutation 1 (remove offline pending-settings override `resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew)`)**: Verified & killed by `tests/dailyBudgetHydrate.test.ts` (failed 2 tests: `applies all 6 pending settings fields offline from AsyncStorage` and `offline fast-path creates today record when missing with resolved budget and active status`).
- **Mutation 2 (change remote timeout 3500ms to 0ms in `fetchRemoteBudgetData`)**: All 85 test suites passed because Supabase mock queries resolve synchronously in test environments unless explicit delayed Promises are used. Documented as a coverage gap. Preserved 3500ms timeout verbatim.
- **Mutation 3 (skip `selfHealDefaultBudget`)**: Verified & killed by `tests/dailyBudgetHydrate.test.ts` (`detects original 250 budget from savings logs when remote profile was reset to migration default 500`).
- **Mutation 4 (remove `missingOnServer` preservation in `hydrateGullakDeposits`)**: Verified & killed by `tests/dailyBudgetHydrate.test.ts` (`Gullak Deposits Merge > preserves local deposits missing on server and inserts them into Supabase without loss`).
- **Mutation 5 (remove `checkAndRollover(currentExpenses, true)` call at end of `hydrateFromSupabase`)**: Unit test setup already had `isFinalized: true` in the tested record. Rollover re-execution during hydration is preserved verbatim to ensure unfinalized stale local caches roll over immediately on startup.
- **Mutation 6 (swap order of `mergePendingPlanChanges` and `mergePendingPeriods`)**: `resolvedPlanChanges` and `resolvedPeriods` operate on independent keys and data structures; swapping their resolution order produces identical state. Original textual sequence preserved.

