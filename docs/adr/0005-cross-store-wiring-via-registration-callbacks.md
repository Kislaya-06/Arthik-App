# 0005. Cross-Store Wiring via Explicit Registration Callbacks

## Context
In Arthik, several independent Zustand stores need to coordinate state changes and trigger side-effects across boundaries:
- `authStore` must reset `expenseStore`, `categoryStore`, `dailyBudgetStore`, and `notificationStore` when the user signs out or deletes their account.
- `networkStore` must trigger `expenseStore.syncPendingExpenses()` when internet connectivity is re-established.
- `dailyBudgetStore` needs to compute spending directly from `expenseStore.expenses`.
- `expenseStore` must notify `dailyBudgetStore.syncWithExpenses()` whenever transactions change.

Directly importing stores into one another creates circular dependency graphs (e.g. `authStore` -> `expenseStore` -> `dailyBudgetStore` -> `authStore`). In JavaScript/TypeScript bundling, circular imports lead to `undefined` module exports at runtime, initialization order bugs, and difficult-to-trace null pointer exceptions.

## Decision
We prohibited circular store imports and adopted an explicit callback registration pattern:
1. Stores declare lightweight registration functions:
   - `registerStoreResetCallback(callback)` in `authStore.ts`
   - `registerSyncCallback(callback)` in `networkStore.ts`
   - `registerExpenseGetter(getter)` in `dailyBudgetStore.ts`
2. Dependent stores register their handlers during module evaluation:
   - `expenseStore.ts` calls `registerSyncCallback(() => useExpenseStore.getState().syncPendingExpenses())`
   - `expenseStore.ts` calls `registerExpenseGetter(() => useExpenseStore.getState().expenses)`
   - Every user-data store calls `registerStoreResetCallback(() => get().reset())`
3. Callbacks are stored in Sets or single reference slots and invoked safely within `try/catch` blocks during events.

## Consequences
- **Positive**: Complete elimination of circular dependency cycles. Clear and decoupled store lifecycles. Zero external event-bus dependency needed.
- **Negative**: Coordination is implicit at module boot time. A newly added store with user data must remember to register its reset callback with `authStore`, otherwise stale data could leak across sign-in sessions.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- All stores are combined into a single monolithic Zustand slice store where all actions share state access via slice setters.
- A typed event-emitter bus or dependency injection container is introduced to manage cross-domain event orchestration across a substantially larger engineering team.
