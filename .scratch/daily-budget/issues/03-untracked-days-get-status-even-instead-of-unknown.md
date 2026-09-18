# Untracked zero-budget, zero-spend days receive status `'even'` instead of `'unknown'`, resetting the savings streak

Status: needs-triage

## Description

In `src/store/dailyBudgetStore.ts`, `hydrateFromSupabase` assigns the status `'even'` to any historical day where no budget was set (`dayBudget <= 0`) and no spending occurred (`daySpent === 0`).

Because `calculateSavingsMetrics` treats `'unknown'` as a neutral bridge that preserves a streak, but treats `'even'` as a streak-breaking terminal condition, classifying untracked days as `'even'` prematurely breaks the user's savings streak upon app launch.

---

## Code Locations

### 1. Status Assignment in `hydrateFromSupabase` (line 1015):
```typescript
// src/store/dailyBudgetStore.ts:1013-1019
if (dayBudget <= 0) {
  daySaved = 0;
  evaluatedStatus = daySpent > 0 ? 'unknown' : 'even';
} else {
  daySaved = Math.max(0, dayBudget - daySpent);
  evaluatedStatus = daySpent > dayBudget ? 'exceeded' : daySaved > 0 ? 'saved' : 'even';
}
```

### 2. Streak Evaluation in `calculateSavingsMetrics` (lines 87–102):
```typescript
// src/store/dailyBudgetStore.ts:87-102
const rec = records[dStr];
if (rec && rec.isFinalized) {
  // 'unknown' days neither extend nor break the streak: skip and continue checking earlier days
  if (rec.status === 'unknown') {
    dayCheck = subDays(dayCheck, 1);
    continue;
  }
  if (rec.status === 'saved' && (rec.saved || 0) > 0) {
    streak++;
    dayCheck = subDays(dayCheck, 1);
    continue;
  }
}
// Any other status (exceeded, even, active, or missing unfinalized day) breaks the streak
break;
```

---

## Domain & Behavioral Inconsistency

### 1. Conflict with Domain Model (`CONTEXT.md`)
According to `CONTEXT.md` Section 2:
- **`Day Status — Unknown`**:
  > *"The status of a past day where no budget was allocated (`budget === 0`) or the day was untracked before registration."*
- **`Day Status — Even`**:
  > *"The status of a finalized past day where spending exactly equaled the allocated budget (`saved === 0` and not exceeded)."*

An untracked day where `budget === 0` and `spent === 0` belongs domain-wise to `'unknown'`, because the user was not participating in the daily allowance tracking system on that date. Giving it status `'even'` misclassifies an untracked day as a day where an active budget was fully depleted down to zero savings.

### 2. Divergence in Streak Processing
In `calculateSavingsMetrics`:
- **When status is `'unknown'` (lines 90–93)**: The evaluator advances `dayCheck = subDays(dayCheck, 1)` and executes `continue`. It skips the day without incrementing the streak and without resetting it. It bridges historical gaps neutrally.
- **When status is `'even'` (line 100)**: The evaluator falls through the `if (rec.status === 'saved')` check and reaches:
  ```typescript
  // Any other status (exceeded, even, active, or missing unfinalized day) breaks the streak
  break;
  ```
  Execution terminates immediately.

### 3. Concrete Consequence
If a user with an active streak has an older historical day synced from Supabase where `budget_amount` was `0` (or `null`) and `spent_amount` was `0`:
1. `hydrateFromSupabase` sets `evaluatedStatus = 'even'`.
2. When the user completes consecutive successful saved days today and yesterday, `calculateSavingsMetrics` scans backwards.
3. Upon reaching the untracked day, instead of skipping it as `'unknown'`, it reads `status === 'even'`.
4. The loop breaks immediately, capping or zeroing the user's `savingsStreak`.
