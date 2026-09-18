# Past-day budget of 500 is overwritten when the user's current budget differs

Status: in-progress

## Resolution (Site 1: `checkAndRollover`)

Resolved in `src/store/dailyBudgetStore.ts` and `src/lib/budgetUtils.ts`.
Extracted `resolveRolloverBudget` pure function and eliminated the 500-sentinel rewrite. Past days finalized with budget 500 are preserved as recorded, preventing retroactive corruption of streaks and Gullak savings when the user's current allowance changes. Verified by characterization tests in `tests/budgetUtils.test.ts`.

## Resolution (Site 3A: `calculatePeriodSummary` Budget Accumulation)

Resolved in `src/lib/homeCalculations.ts` (lines 140–143).
Removed the retroactive budget rewrite in the 'All' filter period budget accumulation. Recorded past budgets are now counted as recorded, ensuring the hero summary card accurately reflects the user's historical allowance. Verified by characterization tests in `tests/homeCalculations.test.ts`.

## Trade-off: Site 3B Zero-Spend ₹500 Skip in `calculatePeriodSummary` (Deliberate Trade-Off, Not a Fix)

**Location**: [`src/lib/homeCalculations.ts:118-120`](file:///d:/Arthik-App/src/lib/homeCalculations.ts#L118-L120)
```typescript
// Skip phantom zero-spend 500 days from periodDates (Sentinel site 3, Issue 01)
if (dailyRecords[d]?.spent === 0 && dailyRecords[d]?.budget === 500 && dailyRecords[d]?.saved === 500) {
  return;
}
```

- **What it does**: In the 'All' filter date aggregation loop of `calculatePeriodSummary`, this check explicitly excludes any day record matching the signature `spent === 0 && budget === 500 && saved === 500` from being added to `periodDates`.
- **Who it still hurts**: A genuine ₹500 daily-budget user who spent nothing on a day produces this exact signature (`spent: 0, budget: 500, saved: 500`). Because client-side records lack creation timestamps, there is no way to distinguish their legitimate zero-spend days from synthetic phantom rows (proven in step 6). As a result, legitimate ₹500 users have their real zero-spend days silently missing from the 'All' filter's day count in the hero subtext (e.g. "for X days") and excluded from the total budget pool (`periodBudget`).
- **Why we kept it anyway**: Without this client-side guardrail, the synthetic phantom rows inserted by the 35-day backfill loop during the 2026-09-16 window leak back into the 'All' filter totals. For an inactive user who never configured a budget or spent money, their 'All' filter would falsely display an inflated budget pool of ₹17,500+ across 35+ non-existent tracking days.
- **Exit Path (What allows safe removal)**: A one-time SQL cleanup of phantom records in Supabase using the `created_at` timestamp within the known backfill bug window. In the database, legitimate rows and backfill glitch rows are cleanly separable by timestamp. Once those orphaned phantom rows are purged from Supabase, this guardrail has nothing left to guard and can be deleted from `src/lib/homeCalculations.ts`.

### Remediation SQL (Drafted in Step 6)

The backfill window is:
- **Start**: `2026-09-16 13:51:18+05:30` (Commit `d375bc2` introducing the backfill loop)
- **End**: `2026-09-17 00:36:56+05:30` (Commit `010ea38` terminating the backfill loop)

#### 1. Preview Count Query (Run first in Supabase SQL Editor)
```sql
SELECT count(*) AS phantom_rows_count
FROM public.daily_savings_log
WHERE created_at >= '2026-09-16 13:51:18+05:30'
  AND created_at <= '2026-09-17 00:36:56+05:30'
  AND budget_amount = 500
  AND (spent_amount = 0 OR spent_amount IS NULL);
```

#### 2. Optional: Inspect Matching Rows
```sql
SELECT id, user_id, date, amount_saved, spent_amount, budget_amount, created_at
FROM public.daily_savings_log
WHERE created_at >= '2026-09-16 13:51:18+05:30'
  AND created_at <= '2026-09-17 00:36:56+05:30'
  AND budget_amount = 500
  AND (spent_amount = 0 OR spent_amount IS NULL)
ORDER BY created_at ASC;
```

#### 3. Targeted Deletion Query
```sql
DELETE FROM public.daily_savings_log
WHERE created_at >= '2026-09-16 13:51:18+05:30'
  AND created_at <= '2026-09-17 00:36:56+05:30'
  AND budget_amount = 500
  AND (spent_amount = 0 OR spent_amount IS NULL);
```

## Description

In `src/store/dailyBudgetStore.ts`, historical daily records with a budget of exactly `500` are assumed to be corrupted artifacts from a historical bug. When a user whose daily budget was previously ₹500 later changes their daily allowance to a different value (e.g. ₹200), the app actively rewrites their finalized historical ₹500 days to the new budget amount.

This causes retroactive modification of past finalized savings, slashes Gullak accumulated reserves, and retroactively breaks savings streaks for days that were already settled months in the past.

---

## Code Locations

### 1. `checkAndRollover` Budget Rewrite (lines 604–612)

```typescript
// src/store/dailyBudgetStore.ts:604-612
} else if (existing && (existing.budget > 0 || existing.isFinalized)) {
  // Lock to budget-at-the-time persisted in existing record
  budget = existing.budget;
  // Guard: If existing was corrupted to 500 by previous bug, repair to user's real daily budget
  if (budget === 500 && get().dailyBudgetAmount > 0 && get().dailyBudgetAmount !== 500) {
    budget = get().dailyBudgetAmount;
  }
  saved = Math.max(0, budget - spent);
  status = spent > budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';
```

When `budget` is overwritten from 500 to `get().dailyBudgetAmount`:
- Lines 648–660 detect `hasChanged = true` because `existing.budget !== budget` (500 !== 200) and `existing.saved !== saved`.
- Lines 651–658 update local state: `records[d].budget = 200` and `records[d].saved = Math.max(0, 200 - spent)`.
- Lines 662–686 trigger an asynchronous upsert to Supabase `daily_savings_log` with `budget_amount: 200`.
- Line 745 recomputes `calculateSavingsMetrics()` across all historical records, recalculating Gullak total savings and streaks with the altered numbers.

---

### 2. Profile Budget Inversion in Recovery Block (lines 848–857 & 904–954)

```typescript
// src/store/dailyBudgetStore.ts:848-857
const remoteBudget = Math.max(0, Math.round(Number(profileData.daily_budget)));
if (remoteBudget === 500) {
  // Keep local value for now; self-healing block below will fix it from savings log history
  resolvedBudget = get().dailyBudgetAmount; // may be 0 on fresh install — overwritten by recovery
} else {
  resolvedBudget = remoteBudget;
}
```

```typescript
// src/store/dailyBudgetStore.ts:904-954
const budgetLooksWrong = resolvedBudget === 500 || (resolvedBudget === 0 && (logsData?.length ?? 0) > 0);
if (budgetLooksWrong && logsData && logsData.length > 0) {
  // ...
  // Ignores all historical 500 values because of `b !== 500`:
  if (b > 0 && b !== 500) {
    budgetCandidates[b] = (budgetCandidates[b] || 0) + 2;
  }
  // ...
  if (bestCandidate > 0 && bestCandidate !== 500) {
    resolvedBudget = bestCandidate;
    resolvedAutoRenew = true;
    wasRepairedFromHistory = true;
    supabase.from('profiles').update({ daily_budget: resolvedBudget, is_auto_renew: true }).eq('id', userId).then(() => {});
  }
}
```

---

### 3. Historical Supabase Log Rewrite Trigger (lines 1004–1025)

```typescript
// src/store/dailyBudgetStore.ts:1004-1025
const wasCorrupted =
  (rawLogBudget === 500 && dayBudget !== 500) ||
  rawLogSaved !== daySaved ||
  (rawLogBudget !== null && rawLogBudget !== dayBudget) ||
  log.status !== (evaluatedStatus === 'even' ? 'even' : daySaved > 0 ? 'saved' : evaluatedStatus === 'unknown' ? 'unknown' : 'missed');

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

---

## Concrete Failure Scenarios

### Scenario 1: Historical ₹500 Days Rewritten on Budget Decrease (Lines 604–612)

1. **User History**:
   - User ran a legitimate daily budget of **₹500** throughout June and July.
   - On June 15, user spent **₹350**.
   - On June 16, rollover finalized June 15 as:
     `budget = 500, spent = 350, saved = 150, status = 'saved'`.
   - Gullak was credited with **+₹150**, and the day counted toward the user's savings streak.
2. **User Action**:
   - In August, the user decides to tighten expenses and updates their profile daily budget to **₹200** (`dailyBudgetAmount = 200`).
3. **Execution**:
   - The user opens the app or records an expense, invoking `checkAndRollover()`.
   - `checkAndRollover` loops over all past records (`pastDates`).
   - For `d = '2026-06-15'`, `existing.budget` is `500`.
   - Line 608 checks: `budget === 500 && dailyBudgetAmount > 0 && dailyBudgetAmount !== 500` (500 === 500 && 200 > 0 && 200 !== 500) $\rightarrow$ **`true`**.
   - Line 609 executes: `budget = 200`.
   - Line 611 executes: `saved = Math.max(0, 200 - 350) = 0`.
   - Line 612 executes: `spent > budget` (350 > 200) $\rightarrow$ `status = 'exceeded'`.
   - Lines 650–686 overwrite local storage and Supabase with `budget_amount: 200, amount_saved: 0, status: 'missed'`.
4. **Consequences**:
   - The user's past finalized day is rewritten from **Saved** to **Exceeded**.
   - June 15 now breaks the user's contiguous savings streak, resetting it to 0.
   - Gullak accumulated balance is docked: the original ₹150 savings is removed, and a ₹150 overspending penalty (`350 - 200`) is charged, causing a net loss of **₹300** from the user's Gullak for a day finalized 2 months prior.

---

### Scenario 2: Active Profile Budget Reverted to Old Pre-500 Budget (Lines 848–857 & 904–954)

1. **User History**:
   - User registered in January with a daily budget of **₹100** and logged 15 saved days.
   - In February, user upgraded their daily budget to **₹500** (`profiles.daily_budget = 500`) and logged 60 saved days.
2. **Trigger**:
   - User clears app data, re-installs, or logs into a new device.
3. **Execution**:
   - `profileData.daily_budget` returns `500`.
   - Line 852 checks `if (remoteBudget === 500)`: defers resolution and leaves `resolvedBudget = 0` (clean install default).
   - Line 904 checks `budgetLooksWrong`: `0 === 0 && logsData.length > 0` $\rightarrow$ **`true`**.
   - Lines 907–935 scan past logs. Every day with a ₹500 budget is skipped because lines 917, 923, and 931 all enforce `!== 500`.
   - The only non-500 candidate found is `100` from January.
   - Line 948 detects `bestCandidate = 100` and executes:
     `supabase.from('profiles').update({ daily_budget: 100, is_auto_renew: true })`.
4. **Consequences**:
   - The user's current, legitimate ₹500 daily budget is overwritten in Supabase and local state with their obsolete ₹100 budget from months ago.
   - Any historical day without an explicit log budget resolves to `resolvedBudget` (100 instead of 500), cascading the corruption to past records.

---

## Suggested Remediation

1. In `checkAndRollover` (line 608), remove the `if (budget === 500 ...)` mutation guard entirely. Finalized records must preserve the exact budget allocated on that day.
2. In `hydrateFromSupabase` (lines 852 and 904–954), remove or deprecate the legacy OTA heuristic that assumes remote `daily_budget = 500` is corrupt. If the user's remote profile specifies 500, accept 500.
