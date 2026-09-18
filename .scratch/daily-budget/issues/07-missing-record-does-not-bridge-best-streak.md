# In the bestStreak gap bridge, a missing record does not bridge while an explicit 'unknown' record does

Status: needs-triage

## Description

In `src/lib/budgetCalculations.ts` (formerly in `src/store/dailyBudgetStore.ts`), `calculateSavingsMetrics` checks whether all intermediate calendar days between two saved days are `'unknown'` so that gap days can serve as neutral bridges rather than breaking the streak.

However, the condition checks:
`if (records[intermediateStr]?.status !== 'unknown')`

If an intermediate day has no record entry in `records` at all (i.e. `records[intermediateStr]` is `undefined`), optional chaining yields `undefined`. Because `undefined !== 'unknown'` evaluates to `true`, the loop immediately marks `allIntermediateUnknown = false` and terminates the bridge check.

Consequently, an explicit record `{ status: 'unknown' }` successfully bridges the best streak across empty days, but an absent/missing record completely breaks the bridge.

---

## Code Locations

### Best Streak Gap Traversal (lines 111–120):
```typescript
// src/lib/budgetCalculations.ts:111-120
let allIntermediateUnknown = true;
for (let step = 1; step < diffDays; step++) {
  const intermediateDate = new Date(prevDate);
  intermediateDate.setDate(prevDate.getDate() + step);
  const intermediateStr = format(intermediateDate, 'yyyy-MM-dd');
  if (records[intermediateStr]?.status !== 'unknown') {
    allIntermediateUnknown = false;
    break;
  }
}
```

When `records[intermediateStr]` is `undefined`:
- `records[intermediateStr]?.status` is `undefined`.
- `undefined !== 'unknown'` is `true`.
- `allIntermediateUnknown` becomes `false`.
- `currentRun` resets to `1` instead of continuing the run.

---

## Documentation Inaccuracy

In `docs/daily-budget-map.md` Section 2.6:
> *"Best streak (lines 104–150): Identifies the longest contiguous sequence of saved records in historical order, treating intermediate `'unknown'` days as neutral bridges (lines 122–133)."*

The documentation implies that untracked days bridge gaps neutrally. In reality, only days that have an explicit `{ status: 'unknown' }` object in `records` bridge the streak; days that simply have no entry in `records` (such as days skipped by sparse tracking or days with no local store entry) actively break the best streak bridge.
