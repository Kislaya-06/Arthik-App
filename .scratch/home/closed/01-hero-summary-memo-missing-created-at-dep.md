# hero summary memo is missing userCreatedAtStr in its deps

Status: closed

## Resolution

Resolved by adding `userCreatedAtStr` to the dependency array of the hero summary memo in `src/screens/HomeScreen.tsx` (line 207). When `authStore` finishes hydrating `user` on cold start / mount, the memo now reliably recomputes, eliminating the stale registration boundary calculation.

## Architectural Note: The `filtered` Dependency Masking Effect

Ticket A's bug was partially masked by the `filtered` dependency on the hero memo, because `filtered` (at `HomeScreen.tsx:116`) already depended on `userCreatedAtStr`. When `filtered` produced a new array reference upon `userCreatedAtStr` changing, the hero memo recomputed via `filtered`.

However, if `expenses` was empty (`[]`) or if `filtered` was ever refactored out as redundant, the memo would stay stale. Crucially: removing `filtered` as "redundant" would have been a behaviour change, not a cleanup. With `userCreatedAtStr` now explicitly in the dependency array, the memo directly declares its boundary dependency, but `filtered` must remain until/unless the 'All' filter's consumption of `params.filtered` is redesigned.

## Description

In `src/screens/HomeScreen.tsx` (lines 385–558), the Hero Summary Card memo reads `user?.created_at` at line 391:

```typescript
// src/screens/HomeScreen.tsx:391
const userCreatedAtStr = user?.created_at?.split('T')[0]?.trim();
```

However, its dependency array at line 558 completely omits `user` and `userCreatedAtStr`:

```typescript
// src/screens/HomeScreen.tsx:558
  }, [activeFilter, todayBudget, dailyBudgetAmount, isAutoRenew, dailyRecords, totalIncome, totalSpent, filtered]);
```

## Root Cause & Trace: Impact on Displayed Balance

If `authStore` has not yet finished hydrating or loading `user` when `HomeScreen` mounts and runs this memo, `user` is undefined and therefore `userCreatedAtStr` is `undefined`.

The period date boundary math evaluates as follows:

1. **Weekly Filter (`activeFilter === 'Weekly'`, lines 398–408)**:
   ```typescript
   const monday = startOfWeek(now, { weekStartsOn: 1 });
   const mondayStr = format(monday, 'yyyy-MM-dd');
   const startDateStr = (userCreatedAtStr && userCreatedAtStr > mondayStr) ? userCreatedAtStr : mondayStr;
   ```
   - When `userCreatedAtStr` is `undefined`, `(userCreatedAtStr && ...)` evaluates to `undefined` (falsy).
   - `startDateStr` unconditionally falls back to `mondayStr`.
   - Even if the user registered on a Friday, `periodDates` is populated with all 5 days (Monday through Friday) instead of 1 day.
   - At line 462, for all past unrecorded days of the week, the loop accumulates budget:
     `periodBudget += isBudgetConfigured ? dailyBudgetAmount : 0;`
   - `periodBudget` is inflated to `dailyBudgetAmount * 5` instead of `dailyBudgetAmount * 1`.
   - At line 475: `available = budgetPool + income; remaining = Math.max(0, available - spent);`.
   - **Displayed Balance**: For a user with a ₹500 daily allowance joining on Friday, the screen displays **₹2,500 remaining** instead of ₹500, with subtext `"₹2,500 budget (5 days)"`.

2. **Monthly Filter (`activeFilter === 'Monthly'`, lines 409–419)**:
   ```typescript
   const firstOfMonth = startOfMonth(now);
   const firstOfMonthStr = format(firstOfMonth, 'yyyy-MM-dd');
   const startDateStr = (userCreatedAtStr && userCreatedAtStr > firstOfMonthStr) ? userCreatedAtStr : firstOfMonthStr;
   ```
   - When `userCreatedAtStr` is `undefined`, `startDateStr` defaults to `firstOfMonthStr` (1st of the month).
   - If a user registered on the 28th of the month, `periodDates` populates with all 28 days elapsed so far.
   - For a ₹500 daily budget, `periodBudget` accumulates 28 × ₹500 = **₹14,000**, falsely showing an enormous unearned allowance balance.

3. **All Filter (`activeFilter === 'All'`, lines 420–441)**:
   - `(!userCreatedAtStr || d >= userCreatedAtStr)` evaluates to unconditionally `true`, allowing any pre-registration or backdated test records to leak into `allDates` and accumulate into `periodBudget`.

### The Stale Memo Trap

Because `userCreatedAtStr` (and `user`) is missing from the dependency array, when `authStore` finishes session retrieval moments later and populates `user`, **this memo does NOT re-run**. The user is stuck viewing an inflated, incorrect remaining balance until they tap a different filter pill or add an expense.
