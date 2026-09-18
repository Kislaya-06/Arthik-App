# `ignoreDuplicates` on first day finalization silently discards savings and spending data in Supabase

Status: closed

## Resolution

Resolved in mid-September 2026 (dailyBudgetStore refactor): extracted `shouldIgnoreDuplicates(status)` in `src/lib/budgetCalculations.ts` so real finalized days ('saved', 'exceeded', 'even') always overwrite existing server records, leaving only untracked days ('unknown') insert-only.

## Description

In `src/store/dailyBudgetStore.ts`, when `checkAndRollover` finalizes a past day for the very first time, it sets `ignoreDuplicates: true` on the Supabase `upsert` call.

If a row already exists in `daily_savings_log` for that `(user_id, date)` pair, Postgres evaluates `ON CONFLICT (user_id, date) DO NOTHING`. The finalized metrics (`amount_saved`, `spent_amount`, `budget_amount`, `status`) are silently ignored by the database and never persisted remotely, while local state marks the record as successfully uploaded (`needsUpload: false`).

---

## Code Location

```typescript
// src/store/dailyBudgetStore.ts:648-686
const hasChanged =
  !existing ||
  !existing.isFinalized ||
  existing.spent !== spent ||
  existing.saved !== saved ||
  existing.status !== status ||
  existing.budget !== budget;

if (hasChanged) {
  const wasUnfinalized = !existing?.isFinalized;
  records[d] = {
    date: d,
    budget,
    spent,
    saved,
    isFinalized: true,
    status,
    needsUpload: true,
  };
  updated = true;

  // Sync updated past day to Supabase daily_savings_log (async fire-and-forget with offline fallback)
  try {
    const supabaseStatus =
      status === 'unknown'
        ? 'unknown'
        : saved > 0
        ? 'saved'
        : status === 'even'
        ? 'even'
        : 'missed';

    const isInsertOnly = status === 'unknown' || wasUnfinalized;

    supabase
      .from('daily_savings_log')
      .upsert(
        {
          user_id: currentUser.id,
          date: d,
          amount_saved: saved,
          spent_amount: spent,
          status: supabaseStatus,
          budget_amount: budget,
        },
        { onConflict: 'user_id,date', ignoreDuplicates: isInsertOnly }
      )
      .then(
        ({ error }) => {
          if (!error) {
            const cur = get().dailyRecords;
            if (cur[d]) {
              set({
                dailyRecords: {
                  ...cur,
                  [d]: { ...cur[d], needsUpload: false },
                },
              });
            }
          }
// ...
```

---

## Detailed Mechanism

1. **`wasUnfinalized` Evaluation (line 649)**:
   When a day in progress (e.g. yesterday) transitions from active to finalized during rollover, `existing.isFinalized` was previously `false`.
   `wasUnfinalized = !existing?.isFinalized` evaluates to **`true`**.

2. **`isInsertOnly` Evaluation (line 672)**:
   `const isInsertOnly = status === 'unknown' || wasUnfinalized;`
   Because `wasUnfinalized` is `true`, `isInsertOnly` evaluates to **`true`** for every day undergoing initial finalization, regardless of whether its status is `'saved'`, `'exceeded'`, or `'even'`.

3. **Supabase Query Formulation (lines 675–686)**:
   The query specifies:
   `{ onConflict: 'user_id,date', ignoreDuplicates: true }`
   In the Supabase JavaScript client / PostgREST, `ignoreDuplicates: true` appends `resolution=ignore-duplicates` to the HTTP request, which translates in PostgreSQL to:
   ```sql
   INSERT INTO public.daily_savings_log (user_id, date, amount_saved, spent_amount, status, budget_amount)
   VALUES (...)
   ON CONFLICT (user_id, date) DO NOTHING;
   ```

4. **Consequence When a Row Already Exists**:
   A row can already exist in `daily_savings_log` for that date due to:
   - Initial user setup or seed data.
   - Synchronization from another client session.
   - An earlier partial sync or background task.
   - Historical backfill entries.

   When the conflict occurs:
   - PostgreSQL executes **`DO NOTHING`**. None of the columns (`amount_saved`, `spent_amount`, `budget_amount`, `status`) are updated with the finalized values.
   - Because `DO NOTHING` is a valid, error-free SQL completion, Supabase returns success (`error: null`).
   - Line 689 executes:
     ```typescript
     if (!error) {
       // ...
       dailyRecords: { ...cur, [d]: { ...cur[d], needsUpload: false } }
     }
     ```
   - Local state sets `needsUpload = false`, assuming the finalized numbers are safely stored in Supabase.

5. **Subsequent State Drift**:
   Remote Supabase remains stuck with the pre-existing stale or unfinalized row. On the next cold start or fresh device login, `hydrateFromSupabase` fetches the un-updated remote row from Supabase and overwrites the local store, discarding the user's actual savings and spent amounts.
