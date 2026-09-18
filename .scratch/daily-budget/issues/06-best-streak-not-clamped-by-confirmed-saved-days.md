# bestStreak is not clamped by confirmedSavedDays while streak is

Status: needs-triage

## Description

In `src/lib/budgetCalculations.ts` (formerly in `src/store/dailyBudgetStore.ts`), `calculateSavingsMetrics` computes `confirmedSavedDays` by counting finalized saved days that occurred on or after user registration (`!userCreatedAt || r.date >= userCreatedAt`).

However, the historical sequence for `maxStreak` (`finalizedSavedRecords`) does **not** filter out days prior to `userCreatedAt`. Furthermore, the clamp at lines 136–138 clamps `streak` to `confirmedSavedDays`, but does not clamp `maxStreak` or `bestStreak`.

As a consequence, when a user has at least one post-registration saved day (`confirmedSavedDays > 0`), their `bestStreak` can be populated by pre-registration saved days, allowing `bestStreak` to significantly exceed `confirmedSavedDays`.

---

## Code Locations

### 1. `confirmedSavedDays` Filters by `userCreatedAt` (lines 65–67):
```typescript
// src/lib/budgetCalculations.ts:65-67
const confirmedSavedDays = Object.values(records).filter(
  (r) => r.isFinalized && r.date < todayStr && r.status === 'saved' && (r.saved || 0) > 0 && (!userCreatedAt || r.date >= userCreatedAt)
).length;
```

### 2. `finalizedSavedRecords` Does Not Filter by `userCreatedAt` (lines 95–97):
```typescript
// src/lib/budgetCalculations.ts:95-97
const finalizedSavedRecords = Object.values(records)
  .filter((r) => r.isFinalized && r.date < todayStr && r.status === 'saved' && (r.saved || 0) > 0)
  .sort((a, b) => a.date.localeCompare(b.date));
```

### 3. Clamp Clamps `streak`, But Not `maxStreak` or `bestStreak` (lines 133–140):
```typescript
// src/lib/budgetCalculations.ts:133-140
if (confirmedSavedDays === 0) {
  streak = 0;
  maxStreak = 0;
} else if (streak > confirmedSavedDays) {
  streak = confirmedSavedDays;
}
const bestStreak = confirmedSavedDays === 0 ? 0 : Math.max(maxStreak, streak);
```

---

## Concrete Scenario

1. User registers on `2026-09-06` (`userCreatedAt = '2026-09-06'`).
2. User has 5 backdated pre-registration saved days (`2026-09-01` through `2026-09-05`).
3. User has 1 post-registration saved day (`2026-09-06`).
4. On `2026-09-07`:
   - `confirmedSavedDays` = 1 (only `2026-09-06` qualifies).
   - `streak` evaluates backward from yesterday (`2026-09-06`), counts 1 day, and stops at `userCreatedAt`. `streak = 1`.
   - `finalizedSavedRecords` contains all 6 days. `maxStreak` evaluates to 6 (or 5 if there was a gap).
   - `confirmedSavedDays === 0` is false (it is 1).
   - `streak > confirmedSavedDays` (1 > 1) is false.
   - `bestStreak = Math.max(maxStreak, streak)` evaluates to `Math.max(6, 1) = 6` (or 5).

Result: The user has only 1 confirmed saved day on record since account creation, but the app displays `bestStreak = 5` (or 6), while `savingsStreak = 1`.

---

## Documentation Inaccuracy

In `docs/daily-budget-map.md` Section 2.6:
> *"Lines 144–149: If confirmedSavedDays === 0, streak = 0. If streak > confirmedSavedDays, streak = confirmedSavedDays."*

The map implies that streaks are strictly bounded by `confirmedSavedDays`. It fails to document that `bestStreak` is unconstrained by `confirmedSavedDays` whenever `confirmedSavedDays >= 1`.
