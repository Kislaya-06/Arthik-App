# filter memo captures `new Date()` with no time dependency

Status: needs-triage

## Description

In `src/screens/SavingsScreen.tsx` lines 213-230, the filtered-records `useMemo` creates `const now = new Date()` inside itself but its dependency array depends only on `[pastRecords, activeFilter]`:

```typescript
// src/screens/SavingsScreen.tsx:213-230
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

Because `now` is instantiated inside the memoized callback without any time or calendar-day dependency:
- If the application remains open across midnight (or across a Sunday-to-Monday week rollover) without the user toggling `activeFilter` or triggering an update to `pastRecords`, `now` retains the stale timestamp from whenever the memo last evaluated.
- Consequently, `isSameWeek(d, now, { weekStartsOn: 1 })` and `isSameMonth(d, now)` evaluate against the previous day/week/month.
- This is the exact same class of problem removed from `calculateSavingsMetrics` in step 7, where reference dates were converted into explicit arguments.
- The eventual fix likely belongs in `src/lib/` (as pure filter functions taking an explicit reference date), rather than ad-hoc inline math in the screen.
