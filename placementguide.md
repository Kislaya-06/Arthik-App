# Placement Guide — Offline Safety Round (OPT-60 .. OPT-65)

**Date:** 31 Oct 2026 · **Ship as:** ONE OTA update (`eas update`) · **New APK:** not needed
**Owner decision:** money fix OPT-63 approved; pending tasks OPT-07, OPT-23, OPT-40, OPT-45, OPT-46 (hide amounts) and
Phase 7 removed from `docs/optimisation.md` for good.

> **Agent, read this first.** Do the parts in order: **Part 1 → Part 2 → Part 3 → Part 4 → Part 5**.
> Do not change any file that is not listed here. Do not "improve" anything. If any check fails, STOP and tell the
> owner the exact command and output. Never `git commit`, `git push`, `git merge` or `eas update` unless the owner says so.

---

## What this update does (plain words)

1. **Nothing you save can be lost.** Online add / edit / delete are now written to the phone's offline queue BEFORE
   talking to the server, and removed only when the server confirms. App killed mid-save, phone off, network gone →
   the entry is still there and syncs later.
2. **Saving never hangs.** After 10 seconds the form stops waiting; the entry shows "sync pending" and syncs by itself.
3. **No lost writes in storage.** Queue writes never overlap anymore (one writer at a time).
4. **No false "Sync failed".** An entry that was already on the server is now treated as saved.
5. **Offline cold start shows everything.** The on-phone copy is refreshed after every confirmed save.
6. **Stale data can never overwrite the server** (the 30 Oct issue). Server rows in `daily_savings_log` are only
   rewritten when the expense list came fresh from the server in this session.
7. **No silent 1,000-row cut** for savings log, plan changes, budget periods and Gullak deposits.
8. **SQL:** one new index that makes the expense list query faster. Index only, no data touched.

**What does NOT change:** every number, calculation, stored value, key name, screen, text and navigation. The
"sync pending" sign works exactly as now. Offline banner shows exactly when it shows now.

---

## Part 1 — Files

All paths are from the repo root. Copy each file from this zip over the repo, replacing it.

### NEW files (create)
| File | What it is |
|---|---|
| `src/lib/queueLock.ts` | `runExclusive(key, fn)` — one writer at a time per storage key (OPT-61) |
| `src/lib/supabasePaging.ts` | `fetchAllPages` — no silent 1,000-row cut (OPT-64) |
| `supabase/migrations/20261031120000_expenses_list_index.sql` | The SQL of Part 4 (kept in the repo as history) |
| `tests/opt60to64OfflineSafety.test.ts` | 23 tests for this round |
| `placementguide.md` | This file. Keep it in the repo root, or delete it after the release — owner's choice |

### REPLACE files (overwrite the existing file)
| File | Change |
|---|---|
| `src/store/expenseStore.ts` | Write-ahead queue + 10 s timeout for add / edit / delete; `.maybeSingle()`; offline copy after confirmed save; no duplicate on cold start; fresh-from-server flag |
| `src/store/expense/pendingQueues.ts` | Every queue writer under the lock; new helpers `enqueuePendingDelete`, `removePendingDelete`, `readPendingUpdate`, `settlePendingUpdate`, `removePendingAddIfUnchanged`, `stableStringify` |
| `src/store/expense/syncPending.ts` | Lock around the final queue writes; keeps an edit that arrived while sending; `.maybeSingle()` |
| `src/store/dailyBudget/expenseBridge.ts` | `registerExpensesFreshGetter` / `areExpensesFreshFromServer` |
| `src/store/dailyBudget/hydrate.ts` | Paging for 4 lists; passes `allowServerWrites` to self-heal |
| `src/store/dailyBudget/selfHealing.ts` | `allowServerWrites` option (skips only the server write, local numbers identical) |
| `tests/dailyBudgetHydrate.test.ts` | Fresh flag in setup + new OPT-63 test; `range` in mock |
| `tests/dailyBudgetStore.test.ts` | `range` added to Supabase mock |
| `tests/gullakParallelHydration.test.ts` | Mock `order` now returns `{ range }` |
| `tests/expenseStore.test.ts` | `maybeSingle` in mock; one assertion now checks "no queue entry for this id" |
| `tests/expenseSyncPending.test.ts` | Mock `single` → `maybeSingle` |
| `tests/ledgerSettleActions.test.ts` | `maybeSingle` added to mock |
| `tests/pureModeRules.test.ts` | `maybeSingle` added to mock |
| `tests/splitMoneyBackStore.test.ts` | `maybeSingle` added to mock |
| `tests/splitPartialPaybackCategories.test.ts` | `maybeSingle` added to mock |
| `schema.sql` | New index line after `idx_expenses_user_date` |
| `app.json` | ONE new line at the top of `highlights` (nothing else) |
| `CHANGELOG.md` | New entry at the top of `## [Unreleased]` |
| `AGENTS.md` | Repo map (2 new lib files) + one convention line about offline queues |
| `docs/optimisation.md` | Phase 8 added (OPT-60..65); removed tasks recorded; Appendix B corrected |
| `docs/architecture.md` | §4 write path diagram; new test file in the test table |
| `docs/CODEBASE_GUIDE.md` | 2 new rows (`queueLock.ts`, `supabasePaging.ts`) |
| `docs/adr/0001-offline-first-asyncstorage-write-path.md` | "Update — 31 Oct 2026" section at the end |

### DELETE files
None.

### NOT touched (do not edit)
`docs/ARTHIK_CANONICAL_RULES.md` (no rule changed), `package.json`, `package-lock.json`, everything in
`modules/`, `android/`, `ios/`, every screen and component.

---

## Part 2 — Checks before the OTA (all must pass)

Run from the repo root:

```bash
# 1. Types
npm run typecheck                      # expected: 0 errors

# 2. Tests
npm test                               # expected: 165 files, 2,350 tests, all passing, 0 unhandled errors

# 3. Bundle builds
npx expo export --platform android --output-dir /tmp/arthik-export   # expected: exports one .hbc (~6.6 MB)

# 4. OTA-safe (no native change)
git diff --name-only main...HEAD | grep -E '^(android|ios|modules)/' && echo "STOP: native file changed" || echo "OK: no native files"
git diff main...HEAD -- package.json   # expected: empty
git diff main...HEAD -- app.json       # expected: exactly one added line inside "highlights"
```

If the test count differs because `main` gained tests since 31 Oct, that is fine as long as **everything passes** and
the count did not go down.

---

## Part 3 — Check on a phone (dev build or preview OTA channel)

| # | Do this | Expected |
|---|---|---|
| 1 | Normal Wi-Fi: add an expense | Saves and closes like before; no "sync pending" left |
| 2 | Airplane mode: add, edit, delete expenses | Same as today: offline banner, "sync pending" sign; turn network on → all sync, sign clears |
| 3 | Add an expense, **kill the app within 1 second** of tapping Save, reopen | The expense is there (pending or synced), never missing, never twice |
| 4 | Wi-Fi with no internet (router unplugged), add an expense | Form closes after max ~10 s; entry shows "sync pending"; no stuck spinner; plug router back → syncs |
| 5 | Add online, then airplane mode, kill app, reopen | The new expense is shown (offline copy) |
| 6 | Home, History, Insights, Savings, Streak calendar | Every number identical to before the update |
| 7 | Pull to refresh on Home | Works as before |

---

## Part 4 — Supabase SQL (agent runs this through the Supabase MCP server)

**What it does:** creates ONE index on `public.expenses`. It does not insert, update or delete any row, and does not
change any column, policy, trigger or function. It is idempotent (`IF NOT EXISTS`): running it twice is harmless.
**When:** any time (before or after the OTA — the app works the same either way). Best at a quiet time: while the index
is built (well under a second for this table size) new writes to `expenses` wait; the app's queue retries them anyway.

### Step 4.1 — Data snapshot BEFORE (read-only)
Tool: **`execute_sql`**. Save the output.

```sql
SELECT 'expenses' AS t, count(*) AS rows, coalesce(sum(amount), 0) AS total FROM public.expenses
UNION ALL SELECT 'daily_savings_log', count(*), coalesce(sum(amount_saved), 0) FROM public.daily_savings_log
UNION ALL SELECT 'gullak_deposits', count(*), coalesce(sum(amount), 0) FROM public.gullak_deposits
UNION ALL SELECT 'budget_periods', count(*), coalesce(sum(budget_amount), 0) FROM public.budget_periods
UNION ALL SELECT 'budget_plan_changes', count(*), coalesce(sum(amount), 0) FROM public.budget_plan_changes;
```

### Step 4.2 — Create the index
Tool: **`apply_migration`** · name: **`expenses_list_index`** · query (copy exactly):

```sql
CREATE INDEX IF NOT EXISTS idx_expenses_user_date_created
ON public.expenses (user_id, expense_date DESC, created_at DESC);
```

Rules:
- Do **NOT** add `CONCURRENTLY` (it cannot run inside the migration transaction and will fail).
- Do **NOT** drop `idx_expenses_user_date` or any other index.
- Do **NOT** run anything else from `schema.sql`.

### Step 4.3 — Confirm the index exists (read-only)
Tool: **`execute_sql`**.

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'expenses' AND indexname = 'idx_expenses_user_date_created';
```
Expected: exactly 1 row, `indexdef` contains `(user_id, expense_date DESC, created_at DESC)`.

### Step 4.4 — Query plan check (read-only; `EXPLAIN` without `ANALYZE` does not run the query)
Tool: **`execute_sql`**.

```sql
EXPLAIN
SELECT * FROM public.expenses
WHERE user_id = (SELECT user_id FROM public.expenses LIMIT 1)
ORDER BY expense_date DESC, created_at DESC
LIMIT 1000;
```
Expected: the plan mentions `idx_expenses_user_date_created`. If the table is very small, Postgres may still choose a
`Seq Scan` — that is normal and NOT an error; report it to the owner and continue.

### Step 4.5 — Data snapshot AFTER (read-only)
Run the exact query of Step 4.1 again. **Every `rows` and `total` value must be identical to Step 4.1** (unless a user
saved something in between — then only `expenses` / their own rows may have grown). If anything decreased or changed
unexpectedly, STOP and tell the owner.

### If you must undo (only if the owner asks)
Tool: `apply_migration` · name: `drop_expenses_list_index`
```sql
DROP INDEX IF EXISTS public.idx_expenses_user_date_created;
```
This removes only the new index; no data is affected.

---

## Part 5 — Release

1. Owner reviews, merges the PR into `main`.
2. Owner runs the OTA (`eas update`) himself. One OTA for everything.
3. No canonical rule changed, so `docs/ARTHIK_CANONICAL_RULES.md` stays as is.

## Known limits (written down on purpose, not bugs of this update)
- A Gullak deposit deleted on another device can come back (old behaviour, left as is by owner decision).
- Server rows that need "self-heal" are now healed on the next hydration with fresh data (pull-to-refresh, midnight,
  next launch) instead of possibly from a stale cache at startup.
- Rollover at startup can still run on cached expenses (`ROL-*` logic; not touched).
