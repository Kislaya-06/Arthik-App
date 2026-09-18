# Historical untracked days with status `'even'` are not self-healed to `'unknown'` in Supabase `daily_savings_log`

Status: needs-triage

## Description

In `src/store/dailyBudgetStore.ts`, when `hydrateFromSupabase` detects a corrupted historical row in `daily_savings_log` (`wasCorrupted === true`), it only triggers a self-healing `upsert` to Supabase if `dayBudget > 0`:

```typescript
// src/store/dailyBudgetStore.ts:867-882
if (wasCorrupted && dayBudget > 0) {
  supabase
    .from('daily_savings_log')
    .upsert(
      {
        user_id: userId,
        date: d,
        amount_saved: daySaved,
        spent_amount: daySpent,
        budget_amount: dayBudget,
        status: evaluatedStatus === 'even' ? 'even' : daySaved > 0 ? 'saved' : evaluatedStatus === 'unknown' ? 'unknown' : 'missed',
      },
      { onConflict: 'user_id,date' }
    )
    .then(() => {});
}
```

For untracked zero-budget, zero-spend days (`dayBudget <= 0` and `daySpent === 0`):
1. On app launch, `hydrateFromSupabase` recalculates `evaluatedStatus = 'unknown'`.
2. `wasCorrupted` evaluates to `true` (since remote `log.status` is `'even'` while `evaluatedStatus` is `'unknown'`).
3. However, because `dayBudget <= 0`, the guard `if (wasCorrupted && dayBudget > 0)` prevents the self-healing Supabase upsert from firing.
4. As a result, local device state updates `records[d].status = 'unknown'` (so local savings streak correctly recovers in memory), but the remote Supabase database row remains permanently stuck with `status: 'even'`.

---

## Consequences

1. **Remote vs Local Inconsistency**:
   Any external query, admin dashboard, reporting job, or future multi-device sync inspecting Supabase `daily_savings_log` directly will continue to read `status = 'even'` instead of `'unknown'` for these historical days.
2. **Re-hydration Dependency**:
   Because the remote database row is never updated, every fresh install or hydration cycle must repeatedly recalculate `evaluatedStatus` on the fly rather than reading clean data from Supabase.

---

## Proposed Remediation

In `hydrateFromSupabase`:
Allow self-healing to update Supabase when `wasCorrupted` is true, even when `dayBudget <= 0`, specifically when transitioning an untracked zero-budget day from `'even'` to `'unknown'`:
```typescript
if (wasCorrupted && (dayBudget > 0 || evaluatedStatus === 'unknown')) {
  // upsert to Supabase
}
```
Or execute a one-time SQL migration in Supabase SQL editor:
```sql
UPDATE daily_savings_log
SET status = 'unknown'
WHERE (budget_amount IS NULL OR budget_amount <= 0)
  AND (spent_amount IS NULL OR spent_amount = 0)
  AND status = 'even';
```
