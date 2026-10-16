# 0013. Store Helper Decomposition and Module Encapsulation

## Status
Accepted (October 2026).

## Context
As Arthik expanded to support multi-cadence budgets (Daily, Weekly, Monthly), unprorated pacing, carry-over transitions, and offline-first queue resilience, two core stores grew into multi-thousand-line monolithic files:
- `dailyBudgetStore.ts` exceeded 2,500 lines, mixing local state setters, metrics calculations, rollover checks, complex hydration/self-healing logic, offline storage, and cross-store bridges in a single file.
- `expenseStore.ts` exceeded 1,190 lines, intertwining offline queue management, exponential backoff, Supabase synchronization phases (adds, updates, deletes, side-queues), and UI action handlers.

Navigating, reviewing, and safely refactoring these monolithic stores introduced excessive blast radius. Editing a helper function risked unintended mutations to surrounding store state or accidental cyclic dependency graphs.

## Decision
We decomposed `dailyBudgetStore` and `expenseStore` into focused, cohesive helper modules located in subdirectory packages (`src/store/dailyBudget/*` and `src/store/expense/*`), while preserving the existing public interface and external import contracts:

1. **Strict Dependency Hierarchy (No Store Imports in Helpers)**:
   - Helper modules never import the store itself (e.g. `src/store/dailyBudget/rollover.ts` never imports `dailyBudgetStore.ts`).
   - Helpers receive store state, getters, and setters (`get`, `set`) explicitly as function arguments.
   - Types and interfaces are imported using `import type`.
2. **Re-Export Backward Compatibility**:
   - The primary store files (`src/store/dailyBudgetStore.ts` and `src/store/expenseStore.ts`) re-export all extracted functions, interfaces, and storage keys.
   - External consumers, screens, and test suites continue importing from the root store modules without breaking changes.
3. **Singleton Isolation**:
   - Module-level singletons (e.g. `expenseGetter`, `expensesLoadedGetter`) live in exactly one dedicated bridge module (`src/store/dailyBudget/expenseBridge.ts`) and are never duplicated across files.
4. **Canonical Storage List Deduplication**:
   - Generic JSON-array AsyncStorage read/write operations (`getStoredList`, `setStoredList`) are consolidated into a single utility `src/lib/asyncStorageList.ts` and reused across stores.

### Module Architecture

| Store | Sub-modules | Responsibilities |
|---|---|---|
| `expenseStore` | `src/store/expense/types.ts` | Core types, queue item interfaces, payload definitions |
| | `src/store/expense/pendingQueues.ts` | Storage keys, exponential backoff, UUID validation, queue mutators |
| | `src/store/expense/syncPending.ts` | Discrete sync phases (`syncPendingDeletes`, `syncPendingAdds`, `syncPendingUpdates`, `flushSideQueues`) |
| `dailyBudgetStore` | `src/store/dailyBudget/types.ts` | State interfaces, profile patches, deposit records |
| | `src/store/dailyBudget/pendingStorage.ts` | Offline pending budget and Gullak storage key getters and mutators |
| | `src/store/dailyBudget/expenseBridge.ts` | Cross-store expense singletons and registration callbacks |
| | `src/store/dailyBudget/classifiers.ts` | Category map construction and income transaction classification |
| | `src/store/dailyBudget/metrics.ts` | `computeMetrics`, `computeAllTimeBudget`, `runWaterfall`, cadence calculations |
| | `src/store/dailyBudget/rollover.ts` | Modular rollover helpers (`applyScheduledNextDayBudget`, `finalizeDailyRecords`, `finalizePeriods`, etc.) |
| | `src/store/dailyBudget/hydrate.ts` | Hydration orchestration and phases (`waitForPersistHydration`, remote fetch, Gullak sync) |
| | `src/store/dailyBudget/selfHealing.ts` | Database anomaly self-healing (`selfHealDefaultBudget`, `selfHealCorruptedRows`) |
| | `src/store/dailyBudget/planActions.ts` | Plan adjustments, cadence switching, settings mutators, and background queue sync |

## Consequences
- **Positive**:
  - Dramatically lowered cognitive load and blast radius: `dailyBudgetStore.ts` line count dropped from ~2,500 to ~875 lines; `expenseStore.ts` dropped to ~655 lines.
  - Testability: Sub-operations and phases can be tested in isolation with zero mock overhead.
  - Zero circular dependency introduction: helper modules operate strictly downstream of data sources.
  - Zero breaking changes for screens, components, or existing test suites.
- **Negative**:
  - More files to manage in `src/store/`.
  - Developers adding new actions must follow the parameter-passing convention (`get`, `set`) rather than importing the hook directly inside helper modules.

## What Would Have to Be True to Revisit
We would revisit this decomposition only if:
- Zustand is replaced by an alternative state management library with native modular slice composition (e.g., Redux Toolkit slices or MobX domain models).
- The store logic shrinks significantly due to moving core accounting and rollover orchestration entirely to Supabase database triggers or Edge Functions.
