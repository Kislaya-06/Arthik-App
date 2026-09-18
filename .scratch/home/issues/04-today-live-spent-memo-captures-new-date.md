# todayLiveSpent memo captures new Date() with no day dependency

Status: needs-triage

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
