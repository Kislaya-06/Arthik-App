# totalIncome/totalSpent accumulation still lives in HomeScreen

Status: needs-triage

## Description

In `src/screens/HomeScreen.tsx` (lines 122–133), the screen loops over `filtered` expenses and calls `isIncomeTransaction` to split and sum income vs spending:

```typescript
// src/screens/HomeScreen.tsx:122-133
  const { totalIncome, totalSpent } = useMemo(() => {
    let income = 0;
    let spent = 0;
    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      const isIncome = isIncomeTransaction(e, cat);
      if (isIncome) income += Number(e.amount) || 0;
      else spent += Number(e.amount) || 0;
    }
    return { totalIncome: income, totalSpent: spent };
  }, [filtered, catMap]);
```

## Architectural Rationale

This aggregation is pure domain logic, not presentation. Every other comparable financial aggregation and filtering function in HomeScreen now sits in `src/lib/` (`homeCalculations.ts`, `expenseFilters.ts`, `dateFilters.ts`).

## Proposed Solution (When Tackled)

1. Move the accumulation loop into `src/lib/expenseFilters.ts` as a pure function:
   ```typescript
   export interface ExpenseTotals {
     totalIncome: number;
     totalSpent: number;
   }

   export const calculateExpenseTotals = (
     expenses: Expense[],
     catMap: Record<string, Category>
   ): ExpenseTotals => { ... };
   ```
2. Add characterization tests in `tests/expenseFilters.test.ts` covering mixed income/expense transactions, unknown categories, and floating-point amounts.
3. Replace lines 122–133 in `HomeScreen.tsx` with a call to `calculateExpenseTotals(filtered, catMap)`.

## Scope & Effort

Small — a self-contained 15-minute change, not a project or architectural refactor.
