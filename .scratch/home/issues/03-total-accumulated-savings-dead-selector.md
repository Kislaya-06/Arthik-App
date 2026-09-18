# totalAccumulatedSavings is a dead selector in HomeScreen

Status: needs-triage

## Description

In `src/screens/HomeScreen.tsx` line 252, `totalAccumulatedSavings` is selected from `dailyBudgetStore`:

```typescript
// src/screens/HomeScreen.tsx:252
const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
```

However, `totalAccumulatedSavings` is never referenced anywhere in `HomeScreen.tsx` — not in any calculation, helper, memo, or JSX element.

## Root Cause & Impact

Because Zustand creates a component-level subscription for each selected state slice:
- Whenever a savings record updates, a daily budget rolls over, or Gullak savings recalculates, `totalAccumulatedSavings` in `dailyBudgetStore` changes.
- This forces the entire 1083-line `HomeScreen` component tree to re-evaluate and re-render needlessly, even though none of its rendered UI or derived state consumes `totalAccumulatedSavings` (HomeScreen displays daily/period budget and today's remaining allowance, not the Gullak total).

## Proposed Fix (When Tackled)

Remove `const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);` from `HomeScreen.tsx` line 252.
