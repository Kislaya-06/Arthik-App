# filter memo captures `new Date()` with no time dependency

Status: needs-triage

## Description

In `src/screens/SavingsScreen.tsx` (originally lines 213-230), the filtered-records `useMemo` created `const now = new Date()` inside itself but its dependency array depended only on `[pastRecords, activeFilter]`:

```typescript
// src/screens/SavingsScreen.tsx:213-230 (original implementation)
  // Filter past records with memoization (Week strictly starts Monday, Month strictly starts on 1st)
  const filteredRecords = useMemo(() => {
    if (activeFilter === 'All') return pastRecords;
    const now = new Date();

    return pastRecords.filter((rec) => {
      try {
        const d = parseISO(rec.date);
        if (activeFilter === 'This Week') {
          return isSameWeek(d, now, { weekStartsOn: 1 });
        } else if (activeFilter === 'This Month') {
          return isSameMonth(d, now) && isSameYear(d, now);
        }
      } catch {
        return false;
      }
      return true;
    });
  }, [pastRecords, activeFilter]);
```

## Root Cause & Impact

Because `now` was instantiated inside the memoized callback without any time or calendar-day dependency:
- If the application remains open across midnight (or across a Sunday-to-Monday week rollover) without the user toggling `activeFilter` or triggering an update to `pastRecords`, `now` retains the stale timestamp from whenever the memo last evaluated.
- Consequently, `isSameWeek(d, now, { weekStartsOn: 1 })` and `isSameMonth(d, now)` evaluate against the previous day/week/month.
- This is the exact same class of problem removed from `calculateSavingsMetrics` in step 7, where reference dates were converted into explicit arguments.

## Current Status: Partially Addressed

During the SavingsScreen decomposition:

### What was fixed (Pure domain math layer):
- The filtering logic was extracted from the UI into `src/lib/budgetCalculations.ts` as `filterSavingsRecords`.
- The reference date is now an explicit, required parameter:
  ```typescript
  export const filterSavingsRecords = (
    records: DailyRecord[],
    filter: SavingsFilter,
    referenceDate: Date
  ): DailyRecord[] => { ... };
  ```
- Week boundary (`{ weekStartsOn: 1 }` Monday-start) and month boundary checks are 100% pure and verified by 11 characterization and boundary tests in `tests/budgetCalculations.test.ts`.

### What remains (Hook / React lifecycle layer):
- In `src/hooks/useSavingsDashboard.ts`:
  ```typescript
  const filteredRecords = useMemo(
    () => filterSavingsRecords(pastRecords, activeFilter, new Date()),
    [pastRecords, activeFilter]
  );
  ```
- The hook passes `new Date()` at memo execution time, but the memo dependency array `[pastRecords, activeFilter]` still cannot detect midnight rollover or day transitions.
- If the app remains open in the foreground across midnight without user interaction (no filter toggle, pull-to-refresh, or expense sync), `filteredRecords` will retain the stale `referenceDate` until a re-render is triggered.
- **To fully resolve**: Introduce a date-boundary dependency (e.g. today's local date string `yyyy-MM-dd` or a midnight event trigger) into the hook's memo dependencies.
