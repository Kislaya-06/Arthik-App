# ExpenseStore Refactoring Plan (Step 6)

## 1. Overview & Objectives

`src/store/expenseStore.ts` is currently ~1,193 lines long. It encapsulates:
- Type definitions (`Expense`, `FailedSyncItem`, `ExpenseUpdatePayload`, etc.)
- AsyncStorage queue keys and offline queue helpers (~130 lines)
- A 380-line `syncPendingExpenses` action spanning 8 distinct synchronization phases
- Store actions: `fetchExpenses`, `addExpense`, `updateExpense`, `deleteExpense`
- Cross-store registration callbacks (ADR-0005) and `getPendingSyncCount`

**Goal**: Split `expenseStore.ts` safely into focused modules without altering runtime behavior, public APIs, or AsyncStorage keys, and without introducing circular dependencies.

---

## 2. Architectural Constraints

1. **ADR-0001 (Offline-First Write Path)**:
   - Queues and keys must remain byte-identical:
     - `@arthik_pending_expenses_${userId}`
     - `@arthik_pending_updates_${userId}`
     - `@arthik_pending_deletes_${userId}`
     - `@arthik_cached_expenses_${userId}`
     - `@arthik_failed_sync_${userId}`
2. **ADR-0003 (Sole Data-Access Layer)**:
   - Stores and their sub-modules are the only layer touching Supabase and AsyncStorage for expenses.
3. **ADR-0005 (Cross-Store Wiring)**:
   - Registration callbacks (`registerSyncCallback`, `registerExpenseGetter`, `registerExpensesLoadedGetter`, `registerCategoryDeleteCallback`, `registerStoreResetCallback`) must remain intact.
4. **No Circular Dependencies**:
   - Helper modules under `src/store/expense/` must NEVER import `useExpenseStore` at runtime.
   - Any reference to `Expense` or `ExpenseState` across modules must use `import type`.
   - Store actions pass `get` and `set` explicitly to helper functions.

---

## 3. Proposed Module Structure

```
src/store/
├── expense/
│   ├── pendingQueues.ts    # Queue keys, retry schedule, offline storage helpers (Step 6a)
│   └── syncPending.ts      # 4 sync phases: deletes, adds, updates, side queues (Step 6c)
└── expenseStore.ts         # Zustand store, action orchestrator, re-exports, cross-store wiring
```

### 3.1 `src/store/expense/pendingQueues.ts` (Step 6a)
Moves pure queue key generators, backoff logic, UUID validators, and AsyncStorage queue mutators:
- **Key Getters**: `getPendingStorageKey`, `getPendingUpdatesKey`, `getPendingDeletesKey`, `getCachedStorageKey`, `getFailedSyncStorageKey`
- **Constants & Pure Logic**: `MAX_SYNC_RETRIES`, `getBackoffDelay`, `UUID_REGEX`, `isValidUUID`, `sanitizeNote`
- **Queue Mutators**:
  - `saveFailedSyncItem(userId, item, set?)` — takes optional `set` callback to update `failedSyncItems` without importing `useExpenseStore`.
  - `savePendingUpdateOffline(userId, id, payload)`
  - `savePendingDeleteOffline(userId, id)`
  - `updatePendingItemOffline(userId, id, patch)`
  - `removePendingItemOffline(userId, id)`
- **Types**: `PendingUpdate`, `PendingDelete`, `ExpenseUpdatePayload`, `FailedSyncItem`

### 3.2 `src/store/expense/syncPending.ts` (Step 6c)
Extracted phase functions for pending synchronization:
- `syncPendingDeletes(userId: string, get: () => ExpenseState, set: (partial: Partial<ExpenseState>) => void): Promise<void>`
- `syncPendingAdds(userId: string, get: () => ExpenseState, set: (partial: Partial<ExpenseState>) => void): Promise<void>`
- `syncPendingUpdates(userId: string, get: () => ExpenseState, set: (partial: Partial<ExpenseState>) => void): Promise<void>`
- `flushSideQueues(userId: string, get: () => ExpenseState): Promise<void>`

---

## 4. Public Symbol Re-exports from `expenseStore.ts`

External callers import the following symbols from `src/store/expenseStore.ts`:

| Symbol | Importers | Re-export Strategy |
|---|---|---|
| `useExpenseStore` | Screens, components, hooks, tests | Main export of `src/store/expenseStore.ts` |
| `Expense` | Screens, components, stores, lib, tests | Exported type from `expenseStore.ts` |
| `FailedSyncItem` | `SyncFailedBanner`, tests | Re-exported from `./expense/pendingQueues` |
| `ExpenseUpdatePayload` | Internal & tests | Re-exported from `./expense/pendingQueues` |
| `UUID_REGEX`, `isValidUUID` | `src/features/autoLog/ledger.ts`, tests | Re-exported from `./expense/pendingQueues` |
| `isNetworkFailure` | `src/screens/SplashScreen.tsx` | Re-exported from `../lib/networkUtils` |
| `getPendingSyncCount` | `src/screens/ProfileScreen.tsx` | Defined in `expenseStore.ts` (uses keys from `pendingQueues`) |

---

## 5. Dependency Graph & Cycle Verification

### Before Refactoring:
`expenseStore.ts` imports:
- `authStore.ts` (`useAuthStore`, `registerStoreResetCallback`)
- `dailyBudgetStore.ts` (`registerExpenseGetter`, `registerExpensesLoadedGetter`)
- `networkStore.ts` (`registerSyncCallback`)
- `categoryStore.ts` (`registerCategoryDeleteCallback`)

### After Refactoring:
```
src/store/expense/pendingQueues.ts
  └─ imports AsyncStorage, Crypto, types. (No store imports)

src/store/expense/syncPending.ts
  ├─ imports ./pendingQueues
  ├─ imports ../../config/supabase
  ├─ imports ../../lib/networkUtils
  ├─ imports ../dailyBudgetStore (useDailyBudgetStore)
  ├─ imports ../categoryStore (useCategoryStore)
  └─ import type { Expense, ExpenseState } from '../expenseStore'  <-- Type only! No runtime cycle!

src/store/expenseStore.ts
  ├─ imports ./expense/pendingQueues
  ├─ imports ./expense/syncPending
  └─ re-exports types and utilities
```

Runtime cycle check: **ZERO circular imports**. Verified via `npx madge --circular`.

---

## 6. Execution Order & Test Gates

1. **Sub-step 6a**: Extract `src/store/expense/pendingQueues.ts`.
   - Re-export `UUID_REGEX`, `isValidUUID`, etc., from `expenseStore.ts`.
   - Pass `set` parameter to `saveFailedSyncItem`.
   - Gate: `tests/expenseSyncPending.test.ts` & `tests/expenseStore.test.ts` pass untouched.
2. **Sub-step 6b**: In-place split of `syncPendingExpenses` into 4 phase functions in `expenseStore.ts`.
   - Keep orchestrator thin (~30 lines).
   - Gate: `tests/expenseSyncPending.test.ts` passes; mutation check on `ignoreDuplicates: true`.
3. **Sub-step 6c**: Move phase functions to `src/store/expense/syncPending.ts`.
   - `import type` only from `expenseStore.ts`.
   - Gate: All 85 test files pass; `npx tsc --noEmit` clean; `madge --circular` confirms no cycles.
