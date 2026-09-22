# 0005. Cross-Store Wiring via Explicit Registration Callbacks

## Context
In Arthik, several independent Zustand stores need to coordinate state changes and trigger side-effects across boundaries:
- `authStore` must reset `expenseStore`, `categoryStore`, `dailyBudgetStore`, `notificationStore`, and `appLockStore` when the user signs out or deletes their account.
- `networkStore` must trigger `expenseStore.syncPendingExpenses()` when internet connectivity is re-established.
- `dailyBudgetStore` needs to compute spending directly from `expenseStore.expenses`.
- `dailyBudgetStore` must know when `expenseStore` has finished loading to avoid running rollover before data is ready.
- `expenseStore` must notify `categoryStore` when a category is deleted, so in-memory expenses can null out their `category_id` without a direct import.

Directly importing stores into one another creates circular dependency graphs (e.g. `authStore` → `expenseStore` → `dailyBudgetStore` → `authStore`). In JavaScript/TypeScript bundling, circular imports lead to `undefined` module exports at runtime, initialization order bugs, and difficult-to-trace null pointer exceptions.

## Decision
We prohibited circular store imports and adopted an explicit callback registration pattern. Five registration functions exist as of v1.2.4:

| Function | Declared in | Registered by | Purpose |
|---|---|---|---|
| `registerStoreResetCallback(cb)` | `authStore.ts` | Every user-data store | Sign-out/account-delete cascade |
| `registerSyncCallback(cb)` | `networkStore.ts` | `expenseStore.ts` | Flush pending queue on reconnect |
| `registerExpenseGetter(getter)` | `dailyBudgetStore.ts` | `expenseStore.ts` | Read expenses without circular import |
| `registerExpensesLoadedGetter(getter)` | `dailyBudgetStore.ts` | `expenseStore.ts` | Guard rollover until expenses are loaded |
| `registerCategoryDeleteCallback(cb)` | `categoryStore.ts` | `expenseStore.ts` | Null `category_id` on in-memory expenses after deletion |

Callbacks are stored in module-scoped reference slots and invoked safely at the appropriate event boundary.

## Consequences
- **Positive**: Complete elimination of circular dependency cycles. Clear and decoupled store lifecycles. Zero external event-bus dependency needed.
- **Negative**: Coordination is implicit at module boot time. A newly added store with user data must remember to call `registerStoreResetCallback`, otherwise stale data leaks to the next signed-in account. The registration table above must be kept current as new stores are added.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- All stores are combined into a single monolithic Zustand slice store where all actions share state access via slice setters.
- A typed event-emitter bus or dependency injection container is introduced to manage cross-domain event orchestration across a substantially larger engineering team.
