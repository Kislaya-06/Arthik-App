# 0003. Zustand Stores as the Sole Data-Access Layer

## Context
React Native applications often suffer from fragmented state management when UI components directly initiate remote network calls, manage local caching, and handle side-effects independently. In an offline-first app, allowing screens to interact directly with Supabase would inevitably bypass offline write queues, lead to duplicated error-handling logic, and cause UI tearing or inconsistent stale state.

## Decision
We established a strict architectural boundary: Zustand stores (`expenseStore`, `categoryStore`, `dailyBudgetStore`, `authStore`, `networkStore`, `notificationStore`) are the sole data-access layer in the application.

1. **Screens are View-Only**: Screen components render UI, react to store selectors, and dispatch store actions (`addExpense`, `fetchCategories`, `setDailyBudget`). Screens never import the Supabase client or write directly to AsyncStorage.
2. **Stores Own Data Access**: Stores encapsulate all Supabase queries, network status checks, AsyncStorage offline queue serialization, optimistic updates, and cache hydration.
3. **Derived Domain State**: Complex domain calculations (such as Gullak total savings, streaks, and rollover finalization) live inside stores and shared pure helpers in `src/lib/`, not inside component lifecycle hooks.

## Consequences
- **Positive**: Clean separation of concerns. Offline sync invariants, retry loops, and cache invalidation are centralized and audited in one place per domain. Screens remain declarative and simple.
- **Negative**: Store files are large and high blast-radius (`expenseStore.ts` and `dailyBudgetStore.ts` exceed 1,100 lines each). Adding new queries requires modifying store interfaces.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- The app transitions to a query-caching library like TanStack Query (React Query) that supports offline persistence plugins, and store-based derived calculations are extracted into dedicated domain service modules.
