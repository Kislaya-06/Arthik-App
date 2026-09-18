# todayLiveSpent memo captures new Date() with no day dependency

Status: closed

## Resolution & Implementation

Resolved in `src/screens/HomeScreen.tsx`:
1. Introduced `todayKey` state seeded from `format(new Date(), 'yyyy-MM-dd')`.
2. Derived a synchronized `referenceDate = useMemo(() => parseISO(todayKey), [todayKey])`.
3. In `useFocusEffect`, updated `todayKey` conditionally (`prev !== nowKey ? nowKey : prev`), guaranteeing zero re-renders on repeated focus during the same calendar day.
4. Rewired all three date-dependent memos together so they cannot drift out of sync:
   - `filtered`: uses `referenceDate` and includes `todayKey` in dependencies.
   - `todayLiveSpent`: reads `todayKey` as `todayStr` and includes `todayKey` in dependencies.
   - Hero summary memo: passes `referenceDate` and includes `todayKey` in dependencies.

## Residual Gap (Documented)

`useFocusEffect` triggers on navigation focus (switching tabs or navigating to Home). If a user leaves the app open on `HomeScreen`, locks the device overnight, and unlocks it directly onto `HomeScreen` without changing tabs, `useFocusEffect` does not fire because navigation focus remained continuous.
In that scenario, the date rolls over on the next user interaction: switching tabs, pull-to-refresh, or recording/editing an expense. Closing this residual gap would require listening to `AppState.addEventListener('change')` for active transitions.

## Cross-Reference

This pattern directly addresses the same defect documented in `.scratch/savings/issues/01-filter-memo-captures-new-date.md` (`useSavingsDashboard.ts`), where `filterSavingsRecords` captures `new Date()` inside a `[pastRecords, activeFilter]` memo. That hook can adopt the identical `todayKey` pattern.

## Description

In `src/screens/HomeScreen.tsx` (lines 356–369), the live spending calculation memo instantiates `new Date()` directly within its function body:

```typescript
// src/screens/HomeScreen.tsx:356-369
  // Calculate today's spent directly from expenses for today to guarantee 0-lag live reactivity
  const todayLiveSpent = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let spent = 0;
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const cleanDate = e.expense_date?.split('T')[0]?.trim();
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      const isIncome = isIncomeTransaction(e, cat);
      if (cleanDate === todayStr && !isIncome) {
        spent += Number(e.amount) || 0;
      }
    }
    return spent;
  }, [expenses, catMap]);
```

However, the dependency array is strictly `[expenses, catMap]`.

## Cross-Reference

This is the exact same class of defect documented in `.scratch/savings/issues/01-filter-memo-captures-new-date.md`, where reference timestamps captured inside a `useMemo` become stale when crossing day boundaries.

## Root Cause & Impact

Because `todayStr` is captured only when `expenses` or `catMap` change:
- If the application remains open in the foreground or background across midnight without new expenses added or categories modified, `todayStr` retains yesterday's calendar date.
- The next morning, until a new expense is recorded or pulled from the server, `todayLiveSpent` compares yesterday's date against expenses and sums yesterday's spending as if it were today's spending.
- This corrupts `todayRecordSpent` (line 371), `todayRemaining` (line 372), `isOverBudget` (line 373), and the Compact Daily Allowance progress bar (lines 743–748) on day rollover.
