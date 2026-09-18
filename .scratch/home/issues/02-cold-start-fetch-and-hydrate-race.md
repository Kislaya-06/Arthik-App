# fetchExpenses and hydrateFromSupabase race and duplicate requests on cold start

Status: needs-triage

## Description

On a cold app start, multiple components and lifecycle listeners trigger concurrent network fetches to Supabase for the same data without any in-flight deduplication.

### Call Sites: `fetchExpenses` (3 concurrent fires)
1. `App.tsx:118` — Inside `supabase.auth.onAuthStateChange` when `event === 'INITIAL_SESSION'` or `'SIGNED_IN'`:
   ```typescript
   await Promise.all([
     fetchExpenses(),
     useDailyBudgetStore.getState().hydrateFromSupabase(session.user.id),
   ]);
   ```
2. `src/screens/SplashScreen.tsx:130` — Inside `initAuthAndNavigate`:
   ```typescript
   if (session) {
     await Promise.all([fetchCategories(), fetchExpenses()]);
     nextScreen = 'AppTabs';
   }
   ```
3. `src/screens/HomeScreen.tsx:275` — Inside `loadData(false)` triggered by `useFocusEffect` on initial screen mount:
   ```typescript
   // HomeScreen.tsx:275
   await fetchExpenses();
   ```

### Call Sites: `hydrateFromSupabase` (2 concurrent fires)
1. `App.tsx:119` — Inside `onAuthStateChange`:
   ```typescript
   useDailyBudgetStore.getState().hydrateFromSupabase(session.user.id);
   ```
2. `src/screens/HomeScreen.tsx:266–267` — Inside `loadData`:
   ```typescript
   if (currentUser && useDailyBudgetStore.getState().hydratedForUserId !== currentUser.id) {
     await useDailyBudgetStore.getState().hydrateFromSupabase(currentUser.id);
   }
   ```
   If `HomeScreen` mounts before `App.tsx`'s background hydration finishes, `hydratedForUserId` is still `null`, triggering a second concurrent call to `hydrateFromSupabase`.

## Redundant-Request Cost & Impact

1. **3× Concurrent Select Queries on `expenses` table**: Three independent network round-trips over mobile data requesting identical expense lists.
2. **2× Concurrent Select Queries on `profiles` and `daily_savings_log`**: Double fetch from `hydrateFromSupabase`.
3. **Redundant JS Work**: Both `hydrateFromSupabase` calls run `calculateSavingsMetrics` and trigger `checkAndRollover` sequentially upon resolution, writing to Zustand state twice in close succession.

## Architectural Seam Note

A de-duplication / in-flight request guard belongs **inside the store** (`expenseStore.fetchExpenses` and `dailyBudgetStore.hydrateFromSupabase`), not in the callers (`App.tsx`, `SplashScreen.tsx`, `HomeScreen.tsx`).

If `hydrateFromSupabase(userId)` or `fetchExpenses()` already has a pending promise in flight for that user, it should return the existing in-flight promise rather than spawning duplicate network requests. Callers should have the freedom to request data without knowing who else is fetching.
