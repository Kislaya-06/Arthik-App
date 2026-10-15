# Technical Architecture Map: `src/store/dailyBudgetStore.ts`

> [!NOTE]
> **Architecture & Modular Decomposition (October 2026)**
> `src/store/dailyBudgetStore.ts` serves as the public facade (779 lines) delegating to focused submodules under `src/store/dailyBudget/`:
> - Types & Interfaces: `src/store/dailyBudget/types.ts`
> - Offline Pending Storage: `src/store/dailyBudget/pendingStorage.ts`
> - Cross-Store Expense Bridge: `src/store/dailyBudget/expenseBridge.ts`
> - Category Map Classifiers: `src/store/dailyBudget/classifiers.ts`
> - Metrics & Waterfall: `src/store/dailyBudget/metrics.ts`
> - Rollover Engine: `src/store/dailyBudget/rollover.ts`
> - Supabase Hydration Coordinator: `src/store/dailyBudget/hydrate.ts`
> - Database Anomaly Self-Healing: `src/store/dailyBudget/selfHealing.ts`
> - Plan Actions & Cadence Settings: `src/store/dailyBudget/planActions.ts`
> For system architecture, see [`docs/architecture.md §6`](../architecture.md) and [`docs/adr/0013-store-module-split.md`](../adr/0013-store-module-split.md). For live calculation helpers, see [`src/lib/budgetCalculations.ts`](file:///d:/Arthik-App/src/lib/budgetCalculations.ts) and [`src/lib/budgetUtils.ts`](file:///d:/Arthik-App/src/lib/budgetUtils.ts).

This document catalogs the functions of `dailyBudgetStore` and its sub-modules under `src/store/dailyBudget/`. It adheres strictly to the domain vocabulary defined in [CONTEXT.md](file:///d:/Arthik-App/CONTEXT.md).

---

## 1. Inventory of Functions & Module Map

Every function and helper associated with `src/store/dailyBudgetStore.ts` is catalogued below by its canonical implementation module:

| # | Function / Export | Canonical Implementation Module | Category | Description |
|---|---|---|---|---|
| 1 | `registerExpenseGetter`, `getCurrentExpenses` | `src/store/dailyBudget/expenseBridge.ts` | **CROSS-STORE** | Bridge callbacks linking `expenseStore` data to budget calculations without circular imports. |
| 2 | `buildCategoryClassifier`, `buildEligibleIncomeClassifier` | `src/store/dailyBudget/classifiers.ts` | **CROSS-STORE** | In-memory Category map classifiers delegating directly to `isIncomeTransaction(e, cat)`. |
| 3 | `getPendingSettingsKey`, `savePendingSettingsOffline`, `clearPendingSettingsOffline` | `src/store/dailyBudget/pendingStorage.ts` | **STORAGE** | AsyncStorage offline queues for pending budget, Gullak, and plan change mutations. |
| 4 | `getTodayDateStr`, `computeMetrics`, `runWaterfall`, balance selectors | `src/store/dailyBudget/metrics.ts` | **METRICS** | Local time date strings, waterfall calculations, carryable funds, and available income selectors. |
| 5 | `applyScheduledNextDayBudget`, `finalizeDailyRecords`, `finalizePeriods` | `src/store/dailyBudget/rollover.ts` | **ROLLOVER** | Midnight day evaluation, daily savings finalization, and weekly/monthly cycle rollovers. |
| 6 | `runHydrateFromSupabase`, `buildOfflineHydrationPatch` | `src/store/dailyBudget/hydrate.ts` | **HYDRATION** | Startup hydration coordinator, persist-hydration gate, offline fast-path, and remote fetching. |
| 7 | `selfHealDefaultBudget`, `selfHealCorruptedRows` | `src/store/dailyBudget/selfHealing.ts` | **SELF-HEALING** | Repairs OTA migration defaults (e.g. 500 budget) and corrupted savings log rows. |
| 8 | `handleSetDailyBudget`, `handleToggleAutoRenew`, cadence switch handlers | `src/store/dailyBudget/planActions.ts` | **PLAN-ACTIONS** | Allowance updates, cadence switching, next-day scheduling, and pending plan queues. |
| 9 | `getTodayRecord`, `getPastRecordsList` | `src/store/dailyBudgetStore.ts` | **STORE-READ** | Zustand selectors for today's record and filtered past daily records. |
| 10 | `addGullakDeposit`, `removeGullakDeposit`, `syncPendingGullakDeposits` | `src/store/dailyBudgetStore.ts` | **STORAGE** | Gullak manual deposits management and offline queue synchronization. |
| 11 | `syncWithExpenses` | `src/store/dailyBudgetStore.ts` | **MIXED** | Recomputes today's live spent, checks 80%/100% notification thresholds, and invokes rollover. |
| 12 | `checkAndRollover` | `src/store/dailyBudgetStore.ts` | **FACADE** | Coordinates with `rollover.ts` (`runCheckAndRollover`) and updates store metrics. |
| 13 | `uploadPendingDailyRecords` | `src/store/dailyBudgetStore.ts` | **STORAGE** | Scans `dailyRecords` for `needsUpload === true` and upserts them to Supabase `daily_savings_log`. |
| 14 | `hydrateFromSupabase` | `src/store/dailyBudgetStore.ts` | **FACADE** | Coordinates with `hydrate.ts` (`runHydrateFromSupabase`) for complete store hydration. |
| 15 | `resetDailyBudget` | `src/store/dailyBudgetStore.ts` | **STORAGE** | Wipes local store state and AsyncStorage keys on user sign-out. |

> [!NOTE]
> **Extracted Pure Modules (`src/lib/budgetCalculations.ts`)**:
> `calculateSavingsMetrics`, `evaluateDayStatus`, `computeSpentByDate`, `computeSpentForDate`, `buildDefaultTodayRecord`, `filterPastRecords`, and `shouldIgnoreDuplicates` reside in `src/lib/budgetCalculations.ts` as pure, testable functions and are re-exported by `dailyBudgetStore.ts`.

---

## 2. The Rules, Stated Exactly

All rules below were extracted directly from the source code.

### 2.1 How a Day's Budget is Decided

A day's budget is derived according to three distinct tiers:

1. **Recurring Allowance (Base Daily Budget)**:
   - Configured via `setDailyBudget(amount)` (lines 272–326).
   - Sanitized via `cleanAmount = Math.max(0, Math.round(amount))` (line 273).
   - If `cleanAmount > 0`, `isAutoRenew` is forced to `true` (`willAutoRenew = cleanAmount > 0 ? true : get().isAutoRenew`, line 276).
   - Applies automatically to any new day when `isAutoRenew` is `true`.
2. **Per-Day Override (Day's Allowance)**:
   - Configured via `setTodayBudget(amount)` (lines 379–399).
   - Sanitized via `cleanAmount = Math.max(0, Math.round(amount))` (line 380).
   - Modifies `records[todayStr].budget` directly (line 392); leaves profile `dailyBudgetAmount` and `isAutoRenew` untouched.
3. **Top-Up (`addToTodayBudget`)**:
   - Configured via `addToTodayBudget(extraAmount)` (lines 401–424).
   - Sanitized via `cleanExtra = Math.max(0, Math.round(extraAmount))` (line 402). If `cleanExtra <= 0`, it is a no-op (line 403).
   - If no record exists for today, initializes base budget to `isAutoRenew ? dailyBudgetAmount : 0` (line 409).
   - Sets `newBudget = currentToday.budget + cleanExtra` (line 416).
4. **Day Where the User Set Nothing (Unset / Fresh Day)**:
   - In `getTodayRecord()` (lines 253–254): If no record exists in `dailyRecords`, budget is `get().isAutoRenew ? get().dailyBudgetAmount : 0`. If `isAutoRenew` is `false`, budget is strictly `0`.
   - In `syncWithExpenses()` (line 446): If `!todayRecord`, budget is `get().isAutoRenew && get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : 0`.
   - In `hydrateFromSupabase()` (lines 1077, 1086–1089): If `!records[todayStr]`, budget is `resolvedAutoRenew && resolvedBudget > 0 ? resolvedBudget : 0`. If a record exists but has `budget === 0` while `isFinalized === false` and `resolvedAutoRenew === true`, it is updated to `resolvedBudget`.
   - In `checkAndRollover()` for historical days without records (lines 613–626):
     ```ts
     615: if (get().isAutoRenew && get().dailyBudgetAmount > 0) {
     616:   budget = get().dailyBudgetAmount;
     617:   saved = Math.max(0, budget - spent);
     618:   status = spent > budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';
     619: } else if (spent > 0) {
     620:   status = 'unknown';
     621:   budget = 0;
     622:   saved = 0;
     623: } else {
     624:   // No prior record, 0 budget, 0 spent: skip
     625:   continue;
     626: }
     ```
   - In `checkAndRollover()` for historical days with existing record having `budget === 0` (lines 628–638): If `isAutoRenew && dailyBudgetAmount > 0`, retroactively assigns `budget = dailyBudgetAmount`; otherwise, locks `status = 'unknown'`, `budget = 0`, `saved = 0`.

### 2.2 How "Spent" is Computed and Excluded Transactions

The computation of spent delegates to pure helpers `computeSpentForDate` and `computeSpentByDate` in `src/lib/budgetCalculations.ts` (lines 204–242) using `isIncomeFn = buildCategoryClassifier()`:

- In `syncWithExpenses` (lines 323–325):
  ```ts
  const isIncomeFn = buildCategoryClassifier();
  const todaySpent = computeSpentForDate(expenses, todayStr, isIncomeFn);
  ```
- In `checkAndRollover` (lines 430–433) and `hydrateFromSupabase` (lines 766–767):
  ```ts
  const isIncomeFn = buildCategoryClassifier();
  const spentByDate = computeSpentByDate(expenses, isIncomeFn);
  ```

Inside `computeSpentForDate` and `computeSpentByDate`, each expense is inspected via the extracted predicate `extractDateAndAmount(e, isIncomeFn)`:
```ts
const isIncome = isIncomeFn ? isIncomeFn(e) : isIncomeTransaction(e);
if (isIncome) return null;
const cleanDate = e.expense_date?.split('T')[0]?.trim();
if (!cleanDate) return null;
const amount = Number(e.amount) || 0;
```

**Excluded Transactions**:
1. **Income Transactions**: Excluded if `isIncomeFn(e)` evaluates to `true`, which uses `buildCategoryClassifier()` (lines 22–32) to look up the transaction's category from `useCategoryStore` and delegate directly to `isIncomeTransaction(e, cat)` (checks explicit `type` first, then category name keywords).
2. **Date Mismatches**: Excluded if `cleanDate !== targetDate`.
3. **Pre-Registration Transactions**:
   - In `calculateSavingsMetrics` (lines 40–43): `if (userCreatedAt && r.date < userCreatedAt) return;`
   - In `checkAndRollover` (lines 452–460): Any record where `d < userCreatedAtStr` is purged from state via `delete records[d]` and skipped.
   - In `hydrateFromSupabase` (line 778): Any log entry where `d < userCreatedAtStr` is ignored.
4. **Invalid Amounts**: Transactions with `NaN` or non-numeric amounts resolve to `0` via `Number(e.amount) || 0`.

### 2.3 How "Saved" is Computed

- **For Active / Today Records**:
  - Formula: `saved = Math.max(0, budget - spent)` (lines 177, 234, 287, 312, 336, 352).
  - Unspent allowance is calculated in real time. If `spent >= budget`, `saved` is `0`.
- **For Finalized Past Days**:
  - In `checkAndRollover` (lines 500, 510) via `evaluateDayStatus(budget, spent)`: `saved = Math.max(0, budget - spent)`.
  - If `status === 'unknown'`: `saved = 0`.
  - In `hydrateFromSupabase` (lines 847–853) via `evaluateDayStatus(dayBudget, daySpent, 'unknown')`:
    - If `dayBudget <= 0`: `daySaved = 0`, `status = 'unknown'`.
    - If `dayBudget > 0`: `daySaved = Math.max(0, dayBudget - daySpent)`.

### 2.4 When a Day Becomes Finalized and What Triggers It

- **Definition of Finalized**: `DailyRecord.isFinalized === true`. The day's metrics are permanently frozen and queued for remote sync to `daily_savings_log` (`needsUpload: true`).
- **Condition for Finalization**: A day is finalized **only if it is strictly in the past** (`d < todayStr`). Today is **never** finalized (`isFinalized: false`, lines 178, 235, 282, 306, 337, 896).
- **Execution Triggers**:
  1. **At the end of `syncWithExpenses(expenses)`** (line 416): Called whenever an expense is added, edited, deleted, or refreshed.
  2. **In `hydrateFromSupabase(userId)`** (line 935): Called upon user authentication or refresh.
- **Roll-over Workflow (`checkAndRollover`)**:
  - Scans all past dates (`pastDates = new Set(...)`, lines 436–449) derived from existing `dailyRecords` keys `< todayStr` unioned with all expense dates `< todayStr`.
  - For each date `d >= userCreatedAtStr`, if any metric changed or `!existing.isFinalized`, sets `isFinalized: true`, `needsUpload: true`, and triggers an asynchronous upsert to Supabase `daily_savings_log` (lines 550–563) with `ignoreDuplicates: shouldIgnoreDuplicates(status)`.

### 2.5 How Each Status is Chosen

1. **Active (`status: 'active'`)**:
   - Chosen exclusively for **today** when `todaySpent <= budget || budget === 0` (lines 179, 236, 283, 307, 338, 897).
   - If `budget === 0`, today remains `'active'` even if `todaySpent > 0`.
2. **Exceeded (`status: 'exceeded'`)**:
   - For today: when `todaySpent > budget && budget > 0` (lines 184, 236, 288, 313, 338, 345).
   - For past days: in `checkAndRollover` and `hydrateFromSupabase` via `evaluateDayStatus`, when `spent > budget && budget > 0`.
3. **Saved (`status: 'saved'`)**:
   - For finalized past days where `budget > 0`, `spent <= budget`, and `saved > 0` (via `evaluateDayStatus`).
4. **Even (`status: 'even'`)**:
   - For finalized past days where `budget > 0`, `spent === budget`, and `saved === 0` (via `evaluateDayStatus`).
5. **Unknown (`status: 'unknown'`)**:
   - Past days where no budget was allocated (`budget === 0`) and `spent === 0` or `spent > 0` (via `evaluateDayStatus(budget, spent, 'unknown')`).
   - Uniformly assigned in both `checkAndRollover` (line 500) and `hydrateFromSupabase` (line 849), preserving user streaks across untracked days (Ticket 03 resolved).

> [!IMPORTANT]
> **Resolution of Past Discrepancies**:
> - **Code vs `schema.sql`**: `schema.sql` line 152 enforces check constraint `CHECK (status IN ('saved', 'missed', 'even', 'unknown'))`. In `dailyBudgetStore.ts`, the TypeScript interface uses `'exceeded'`. When sending to Supabase, lines 541–545 and 641–645 translate `'exceeded'` into `'missed'`.
> - **Status 'unknown' Uniformity (Ticket 03)**: The former discrepancy where `hydrateFromSupabase` assigned `'even'` to zero-budget zero-spend days has been resolved. Both `checkAndRollover` and `hydrateFromSupabase` now evaluate zero-budget zero-spend days as `'unknown'`, preventing untracked days from breaking streaks.
> - **Upsert Duplication Safeguard (Ticket 02)**: In `checkAndRollover` (line 546), `isInsertOnly` is now governed by `shouldIgnoreDuplicates(status)` (`status === 'unknown'`), ensuring that first-time finalization of tracked days (`'saved'`, `'exceeded'`, `'even'`) genuinely overwrites remote records in `daily_savings_log`.

### 2.6 How the Streak is Computed

The savings streak is computed by `calculateSavingsMetrics` (lines 80–102):

```ts
80:  let streak = 0;
81:  let dayCheck = subDays(new Date(), 1);
82:  while (true) {
83:    const dStr = format(dayCheck, 'yyyy-MM-dd');
84:    if (userCreatedAt && dStr < userCreatedAt) {
85:      break;
86:    }
87:    const rec = records[dStr];
88:    if (rec && rec.isFinalized) {
89:      // 'unknown' days neither extend nor break the streak: skip and continue checking earlier days
90:      if (rec.status === 'unknown') {
91:        dayCheck = subDays(dayCheck, 1);
92:        continue;
93:      }
94:      if (rec.status === 'saved' && (rec.saved || 0) > 0) {
95:        streak++;
96:        dayCheck = subDays(dayCheck, 1);
97:        continue;
98:      }
99:    }
100:   // Any other status (exceeded, even, active, or missing unfinalized day) breaks the streak
101:   break;
102: }
```

- **What Extends the Streak**: Only a finalized past day with `rec.status === 'saved'` and `rec.saved > 0` (lines 94–98).
- **What Breaks the Streak**:
  - `status === 'exceeded'`
  - `status === 'even'`
  - `status === 'active'` (an unfinalized past record)
  - Missing day in `records` (`!rec`)
  - Unfinalized day (`!rec.isFinalized`)
  - Reaching registration boundary (`dStr < userCreatedAt`) terminates evaluation cleanly.
- **What is Neutral**: `rec.status === 'unknown'` (lines 90–93). It advances `dayCheck` by 1 without incrementing `streak` and without breaking the loop.
- **Streak Guards & Best Streak**:
  - Lines 144–149: If `confirmedSavedDays === 0`, `streak = 0` and `maxStreak = 0`. If `streak > confirmedSavedDays`, `streak = confirmedSavedDays`. **Note (Ticket 06)**: While `streak` is clamped to `confirmedSavedDays`, `maxStreak` (and therefore `bestStreak`) is **not** clamped by `confirmedSavedDays` whenever `confirmedSavedDays > 0`. Moreover, `finalizedSavedRecords` does not filter out pre-registration days (`< userCreatedAt`), meaning a pre-registration streak can become the user's `bestStreak` once a single post-registration day is saved.
  - Best streak gap bridging (lines 111–121): Identifies the longest contiguous sequence of saved records in historical order, treating intermediate days as neutral bridges only if explicitly recorded with `status === 'unknown'`. **Note (Ticket 07)**: Missing records (`records[d] === undefined`) evaluate `records[d]?.status !== 'unknown'` to `true` and actively **break** the bridge rather than bridging it.

### 2.7 How `totalAccumulatedSavings` is Computed

Total accumulated savings (Gullak) is computed in `calculateSavingsMetrics` (lines 44–74):

```ts
44:  let totalSaved = 0;
45:  let totalOverspent = 0;
46:  const userCreatedAt = userCreatedAtStr || useAuthStore.getState().user?.created_at?.split('T')[0]?.trim();
47:
48:  Object.values(records).forEach((r) => {
49:    // Check confirmed finalized past days that are on or after the user registered
50:    if (r.isFinalized && r.date < todayStr) {
51:      if (userCreatedAt && r.date < userCreatedAt) {
52:        // Pre-registration backdated days do not affect Gullak savings or penalty
53:        return;
54:      }
55:      // 'unknown' days do not affect Gullak savings or penalties
56:      if (r.status === 'unknown') {
57:        return;
58:      }
59:      if (r.budget > 0 && r.spent > r.budget) {
60:        totalOverspent += (r.spent - r.budget);
61:      } else if ((r.saved || 0) > 0) {
62:        totalSaved += (r.saved || 0);
63:      }
64:    }
65:  });
66:
67:  // Include today's live overspend if user spent more than today's budget
68:  const todayRec = records[todayStr];
69:  if (todayRec && todayRec.budget > 0 && todayRec.spent > todayRec.budget) {
70:    totalOverspent += (todayRec.spent - todayRec.budget);
71:  }
72:
73:  // Net accumulated savings cannot drop below 0
74:  const netSavings = Math.max(0, totalSaved - totalOverspent);
```

- **Inclusion of Past Savings**: Sum of all `r.saved` from finalized past days (`r.isFinalized && r.date < todayStr && r.date >= userCreatedAt`).
- **Overspending Penalties**:
  - **Past Overspending**: Every past finalized day where `r.budget > 0 && r.spent > r.budget` adds `r.spent - r.budget` directly to `totalOverspent` (lines 59–60).
  - **Live Today Overspending**: If today's live spending exceeds today's budget (`todayRec.budget > 0 && todayRec.spent > todayRec.budget`), the live deficit `todayRec.spent - todayRec.budget` is added immediately to `totalOverspent` (lines 68–71).
  - Today's unfinalized *savings* are **never** added to `totalSaved` until the day rolls over and finalizes. However, today's *overspending* immediately penalizes the accumulated balance.
- **Floor**: Net accumulated savings can never drop below zero: `Math.max(0, totalSaved - totalOverspent)` (line 74).

---

## 3. Date Boundaries & Timezone Sensitivities

The following table documents every location in `dailyBudgetStore.ts` where dates are resolved, compared, or manipulated.

| Line(s) | Code Snippet | Reference Time | Boundary & Timezone Consequence |
|---------|--------------|----------------|---------------------------------|
| 46 | `user?.created_at?.split('T')[0]?.trim()` | **UTC** | Supabase stores `created_at` in UTC. Splitting at `'T'` takes the UTC date. For an Indian user (UTC+5:30) registering at 2:00 AM IST on Sept 19, the UTC date is `'2026-09-18'`. Backdated transactions logged on Sept 18 will be treated as post-registration rather than pre-registration. |
| 50 | `if (r.isFinalized && r.date < todayStr)` | **String Comparison** | Lexicographical date comparison. Safe assuming `'yyyy-MM-dd'`. |
| 81 | `subDays(new Date(), 1)` | **Local Time** | Subtracts 1 day from current device clock. Crossing midnight will shift `dayCheck` by 1 day immediately upon the next function invocation. |
| 115–116 | `new Date(rec.date)` | **UTC / Engine-dependent** | ECMAScript specifies that date-only strings like `'2026-09-18'` parse as **UTC midnight**. In timezones west of UTC (e.g. UTC-5 New York), `new Date('2026-09-18')` is 7:00 PM Sept 17 local time. |
| 124–126 | `intermediateDate.setDate(prevDate.getDate() + step)` | **Local Time on UTC Date** | `prevDate.getDate()` invokes local day-of-month on a Date object parsed at UTC midnight. For users west of UTC, this shifts the date backwards by 1 day, causing `intermediateStr = format(intermediateDate, 'yyyy-MM-dd')` to evaluate wrong intermediate dates and potentially corrupt `bestStreak`. |
| 229 | `format(new Date(), 'yyyy-MM-dd')` | **Local Time** | Baseline `getTodayDateStr()` generator. Anchors "today" to device local clock. |
| 436, 551, 894 | `e.expense_date?.split('T')[0]?.trim()` | **Stored Date String** | Extracts date string from transaction. If `expense_date` is stored as an ISO timestamp rather than date-only, splitting at `'T'` extracts the UTC day, which may differ from the user's local entry day. |
| 573, 956, 1059 | `format(subDays(new Date(), 1), 'yyyy-MM-dd')` | **Local Time** | Generates `yesterdayStr` based on device clock. |
| 712 | `if (d === yesterdayStr && saved > 0 ...)` | **Local Time** | Rollover notification only triggers for `yesterdayStr`. If a user does not open the app for 2 days, day before yesterday rolls over silently with no notification. |

---

## 4. The Income Inconsistency (Resolved)

### 4.1 Resolution of Dual-Engine Inconsistency
The dual-engine divergence between `paymentUtils.ts` and `dailyBudgetStore.ts` (documented in ADR 0007, superseded by ADR 0008) has been completely resolved.

`getIncomeCategoryIds` was deleted from `dailyBudgetStore.ts`. Both UI screens and the budget engine now standardize strictly on the shared helper `isIncomeTransaction(item, category)` from `src/lib/paymentUtils.ts`:

1. **Category Map Classifier (`src/store/dailyBudgetStore.ts:22–32`)**:
   ```ts
   const buildCategoryClassifier = (): ((e: Expense) => boolean) => {
     const categories = useCategoryStore.getState().categories;
     const categoryMap = new Map<string, Category>();
     for (let i = 0; i < categories.length; i++) {
       categoryMap.set(categories[i].id, categories[i]);
     }
     return (e: Expense): boolean => {
       const cat = e.category_id ? categoryMap.get(e.category_id) : undefined;
       return isIncomeTransaction(e, cat);
     };
   };
   ```
2. **Standardized Invocation**: Invoked in `syncWithExpenses` (line 323), `checkAndRollover` (line 430), and `hydrateFromSupabase` (line 766), passing `isIncomeFn` into pure calculation functions `computeSpentForDate` and `computeSpentByDate`.

### 4.2 Startup Window Sequencing & Residual Risk

To close the failure window where categories were empty on cold start, startup initialization in `App.tsx` (lines 116–120) was resequenced:

```ts
116: await fetchCategories(true);
117: await Promise.all([
118:   fetchExpenses(),
119:   useDailyBudgetStore.getState().hydrateFromSupabase(session.user.id),
120: ]);
```

**Residual Risk Analysis**:
1. **Online vs Offline Cold Start**: When online, `fetchCategories(true)` fetches fresh categories from Supabase. When offline, `categoryStore.fetchCategories` rehydrates cached categories from AsyncStorage (`@arthik_cached_categories_${userId}`), ensuring the category map is populated before expenses and budget logs are evaluated.
2. **Fresh Offline Install (Edge Case)**: The only scenario where categories remain empty is a brand-new, unauthenticated offline install where no cache exists. Because `session?.user?.id` is null on unauthenticated launch, neither `fetchExpenses` nor `hydrateFromSupabase` executes. As soon as a user authenticates, categories are fetched and cached first.
3. **Explicit Transaction Types**: All transactions created or modified in modern app versions write an explicit `type` column (`'expense' | 'income'`). Because `isIncomeTransaction` checks `item?.type === 'income'` and `item?.type === 'expense'` before category keywords, category lookup latency only affects legacy untyped rows (`type: undefined`).

### 4.3 Historical Worked Numerical Example (Pre-Fix vs Post-Fix)

**Scenario**:
- User has a Recurring Allowance of **₹500** (`dailyBudgetAmount: 500`, `isAutoRenew: true`).
- User's previous Gullak accumulated savings: **₹1,500**.
- User's current Savings Streak: **5 days**.
- Today, the user logs two transactions:
  1. Grocery shopping: **₹300**, `type: 'expense'`.
  2. Freelance consulting payout: **₹2,000**, `category_id: 'cat_freelance'` (Category name: "Freelance Work"), `type: undefined` (legacy/untyped row).

**Comparison of Behavior**:

| Metric | Screen Layer | Budget Engine (Pre-Fix) | Budget Engine (Post-Fix) |
|---|---|---|---|
| **Tx 2 Classification** | **Income** (`isIncomeTransaction`) | **Expense** (`incomeIds` was empty) | **Income** (`isIncomeTransaction(e, cat)`) |
| **Today's Spent** | **₹300** | **₹2,300** (+₹2,000 inflation) | **₹300** (Accurate) |
| **Today's Remaining / Saved** | **₹200** (`500 - 300`) | **₹0** (Savings eliminated) | **₹200** (`500 - 300`) |
| **Today's Status** | **Under Budget** (`active`) | **Exceeded** (False failure) | **Under Budget** (`active`) |
| **Overspend Penalty** | **₹0** | **₹1,800** penalty | **₹0** |
| **Gullak Reserve** | **₹1,500** intact | **₹0** (Wiped out) | **₹1,500** intact |
| **Savings Streak Tomorrow** | **6 days** (extended) | **0 days** (Streak broken) | **6 days** (Extended) |
| **Device Notifications** | None | **`🚨 Daily Allowance Exceeded!`** | None (No false alarm) |

---

## 5. What Depends on This File (Blast Radius)

The following components, screens, and stores import and depend on `dailyBudgetStore.ts`:

```mermaid
graph TD
    DBS["dailyBudgetStore.ts"] --> SS["SavingsScreen.tsx"]
    DBS --> HS["HomeScreen.tsx"]
    DBS --> SCM["StreakCalendarModal.tsx"]
    DBS --> ES["expenseStore.ts"]
    DBS --> EFS["ExpenseFormScreen.tsx"]
    DBS --> EDS["ExpenseDetailScreen.tsx"]
    DBS --> APP["App.tsx"]
    DBS --> AS["authStore.ts"]
```

### 5.1 Consumers & Selectors

1. **`src/screens/SavingsScreen.tsx`**:
   - `dailyBudgetAmount`, `isAutoRenew`, `totalAccumulatedSavings`, `savingsStreak`, `bestStreak`
   - `setDailyBudget`, `toggleAutoRenew`, `setTodayBudget`, `addToTodayBudget`
   - `syncWithExpenses`, `dailyRecords`, `getTodayRecord`, `getPastRecordsList`
2. **`src/screens/HomeScreen.tsx`**:
   - `dailyBudgetAmount`, `isAutoRenew`, `totalAccumulatedSavings`, `getTodayRecord`, `dailyRecords`
   - `syncWithExpenses`, `hydratedForUserId`, `hydrateFromSupabase`
3. **`src/components/StreakCalendarModal.tsx`**:
   - `savingsStreak`, `bestStreak`, `dailyRecords`
4. **`src/store/expenseStore.ts`**:
   - `registerExpenseGetter`
   - `useDailyBudgetStore.getState().syncWithExpenses(...)`
   - `useDailyBudgetStore.getState().uploadPendingDailyRecords()`
5. **`src/screens/ExpenseFormScreen.tsx`**:
   - `useDailyBudgetStore.getState().syncWithExpenses(...)`
6. **`src/screens/ExpenseDetailScreen.tsx`**:
   - `useDailyBudgetStore.getState().syncWithExpenses(...)`
7. **`App.tsx`**:
   - `useDailyBudgetStore.getState().hydrateFromSupabase(...)`
   - `useDailyBudgetStore.getState().uploadPendingDailyRecords()`
8. **`src/store/authStore.ts`**:
   - Registered reset callback: `registerStoreResetCallback` (in `dailyBudgetStore.ts`).

---

## 6. Extraction Status & Modular Inventory

The table below reflects the completed modular decomposition across all submodules:

| Functionality / Domain Concept | Canonical Implementation Location | Status | Rationale & Safety |
|---|---|---|---|
| `evaluateDayStatus`, `calculateSavingsMetrics` | `src/lib/budgetCalculations.ts` | **EXTRACTED** | Pure mathematical aggregation and status determination. |
| `computeSpentByDate`, `computeSpentForDate` | `src/lib/budgetCalculations.ts` | **EXTRACTED** | Single-pass date grouping and single-date spending calculation using injected `isIncomeFn`. |
| `buildDefaultTodayRecord`, `filterPastRecords`, `shouldIgnoreDuplicates` | `src/lib/budgetCalculations.ts` | **EXTRACTED** | Pure fallback today record synthesis and projection filtering. |
| `getPendingSettingsKey`, `savePendingSettingsOffline`, `clearPendingSettingsOffline` | `src/store/dailyBudget/pendingStorage.ts` | **EXTRACTED** | Dedicated AsyncStorage offline mutations and queue keys. |
| `registerExpenseGetter`, `getCurrentExpenses`, `areExpensesLoaded` | `src/store/dailyBudget/expenseBridge.ts` | **EXTRACTED** | Cross-store expense singletons and callbacks avoiding circular store imports. |
| `buildCategoryClassifier`, `buildEligibleIncomeClassifier` | `src/store/dailyBudget/classifiers.ts` | **EXTRACTED** | In-memory Category map classifiers delegating directly to `isIncomeTransaction(e, cat)`. |
| `computeCarryableAmount`, `computeTotalAccountRemaining`, `computeAvailableIncomeBalance`, `runWaterfall` | `src/store/dailyBudget/metrics.ts` | **EXTRACTED** | Balance and income selectors, unspent waterfall orchestration, and cadence metrics. |
| `applyScheduledNextDayBudget`, `finalizeDailyRecords`, `finalizePeriods` | `src/store/dailyBudget/rollover.ts` | **EXTRACTED** | Modular rollover helpers evaluating midnight day status, streak calculation, and period rollouts. |
| `runHydrateFromSupabase`, `buildOfflineHydrationPatch`, `fetchRemoteBudgetData` | `src/store/dailyBudget/hydrate.ts` | **EXTRACTED** | Startup hydration coordinator, persist-wait timeout, offline fast-path, and remote fetching. |
| `selfHealDefaultBudget`, `selfHealCorruptedRows` | `src/store/dailyBudget/selfHealing.ts` | **EXTRACTED** | Database anomaly self-healing repairing 500 migration defaults and corrupted savings rows. |
| `handleSetDailyBudget`, `handleToggleAutoRenew`, `handleSetBudgetCadence`, plan sync | `src/store/dailyBudget/planActions.ts` | **EXTRACTED** | Plan adjustments, cadence transitions, next-day scheduling, and pending plan queues. |
| `useDailyBudgetStore` | `src/store/dailyBudgetStore.ts` | **FACADE (779 lines)** | Preserves 100% of public exports, store types, hooks, and external contracts. |

---

## 7. What You Are Unsure About

During the audit, several non-obvious design decisions, heuristics, and potential edge-case bugs were identified. Their current resolution status is recorded below:

1. **The 500 "OTA Update Bug" Heuristic Deletion Logic (Resolved — Ticket 01)**:
   - *Previous state*: Lines 974–990 previously deleted historical rows from Supabase and local store if `daySpent === 0 && (rawLogBudget === 500 || rawLogSaved === 500)`. This risked permanently deleting legitimate ₹500 zero-spend days.
   - *Resolution*: Unsafe deletion was eliminated and replaced by `resolveHydratedDayBudget` in `src/lib/budgetUtils.ts`, which safely infers true budgets without destructive row purging.
2. **Use of `ignoreDuplicates: isInsertOnly` in `checkAndRollover` (Resolved — Ticket 02)**:
   - *Previous state*: Line 672 defined `const isInsertOnly = status === 'unknown' || wasUnfinalized;`. Because `wasUnfinalized` was `true` on every day's first rollover, Supabase executed `ON CONFLICT DO NOTHING`, silently discarding finalized metrics if a row already existed remotely.
   - *Resolution*: Line 546 now uses `const isInsertOnly = shouldIgnoreDuplicates(status);` (`status === 'unknown'`). Real finalized days (`'saved'`, `'exceeded'`, `'even'`) genuinely overwrite remote records.
3. **Date Shifting in `bestStreak` Calculation (`src/lib/budgetCalculations.ts:115–134`)**:
   - Line 116 creates `new Date(rec.date)` from a `'yyyy-MM-dd'` string. Line 125 modifies it via `intermediateDate.setDate(prevDate.getDate() + step)`.
   - *Uncertainty*: Because `new Date('yyyy-MM-dd')` standardizes on UTC midnight while `.getDate()` and `.setDate()` operate on client local time, users operating in timezones west of UTC (e.g. UTC-4 to UTC-10) may experience corrupted `bestStreak` counts due to date shifting across day boundaries.
4. **Zero-Spend Zero-Budget Day Assigned Status `'even'` (Resolved — Ticket 03)**:
   - *Previous state*: In `hydrateFromSupabase`, line 1015 set `evaluatedStatus = daySpent > 0 ? 'unknown' : 'even'`. A zero-budget zero-spend day loaded from Supabase was assigned `'even'`, which broke the user's savings streak.
   - *Resolution*: `hydrateFromSupabase` (line 849) now uses `evaluateDayStatus(dayBudget, daySpent, 'unknown')`, which returns `'unknown'` for zero-budget zero-spend days, preserving streaks uniformly across both rollover and hydration.
5. **Notification Race Condition on Startup**:
   - `syncWithExpenses` triggers `checkAndRollover(expenses)` with `skipRolloverNotification = false`.
   - `hydrateFromSupabase` triggers `checkAndRollover(currentExpenses, true)` with `skipRolloverNotification = true`.
   - In `App.tsx` (lines 116–120), `fetchExpenses()` and `hydrateFromSupabase()` run in `Promise.all`.
   - *Uncertainty*: If `fetchExpenses()` finishes first, `useExpenseStore` calls `syncWithExpenses()` before `hydrateFromSupabase()` sets `hydratedForUserId`. Line 422 blocks execution (`if (get().hydratedForUserId !== currentUser.id) return;`). Then `hydrateFromSupabase()` finishes and calls `checkAndRollover(currentExpenses, true)` which skips notifications. If `syncWithExpenses` is not subsequently re-invoked, does the user miss yesterday's rollover celebration notification entirely?

---

## 8. Multi-Cadence Budget Modes Architecture (v1.2.5+)

With the introduction of Budget Modes, the store orchestrates two high-level tracking modes and three budget cadences:

### 8.1 Mode Shell & Navigation Gating
- **Pure Mode (`isBudgetModeEnabled: false`)**:
  - Default for all new accounts.
  - Limits bottom navigation bar to 4 tabs (`Home`, `History`, `Add`, `Insights`).
  - Guards all direct navigation attempts to `'Savings'` via `resolveSavingsRoute(isBudgetModeEnabled, routeType)`, safely falling back to `'Home'`.
  - Suppresses all budget warning, limit exceeded, and rollover notifications.
  - Preserves past active budget allowances in all-time, monthly, and weekly Inflow metrics (Real-Money Invariant).
- **Budget Mode (`isBudgetModeEnabled: true`)**:
  - Enables the 5th `'Savings'` tab with fluid spring entrance/exit.
  - Supports user-selectable cadences: `'daily'`, `'weekly'`, `'monthly'`.

### 8.2 Plan Changes Timeline (`src/lib/budgetPeriods.ts`)
- Instead of mutating today's budget abruptly, budget and cadence adjustments create a `BudgetPlanChange` row with `effectiveFrom = tomorrowStr` (or next standard boundary).
- `buildPlanSlices(planChanges, todayStr, userCreatedAtStr)` divides the user's timeline into non-overlapping active slices `[activeStart, activeEnd]`, preventing double-counting across cadence transitions.
- Mid-period switches are prorated via `calculateProratedBudget(fullBudget, cadence, activeStart, activeEnd)`:
  $$\text{Prorated Budget} = \text{round}\left(\frac{\text{Budget}}{\text{Days in Cycle}} \times \text{Remaining Active Days}\right)$$

### 8.3 Multi-Cadence Period Finalization (`checkAndRollover`)
- **Daily Cadence**: Finalizes yesterday's record in `dailyRecords` (`daily_savings_log` in Supabase) at midnight.
- **Weekly Cadence**: Completed weeks (Monday to Sunday) are evaluated by `buildPeriodsToFinalize`, upserted to `budget_periods`, and rolled over into Gullak accumulated savings.
- **Monthly Cadence**: Completed calendar months (1st to month-end) are evaluated, upserted to `budget_periods`, and rolled over.
- During weekly and monthly cadences, no `dailyRecords` are generated for intermediate days.

### 8.4 Offline Queueing & Cross-Session Sync
- **Plan Changes**: Queued in `@arthik_pending_plan_changes_${userId}` until synced with Supabase `budget_plan_changes`.
- **Budget Periods**: Queued in `@arthik_pending_budget_periods_${userId}` until upserted to Supabase `budget_periods`.
- **Mode & Cadence Settings**: Queued in `@arthik_pending_settings_${userId}` (`is_budget_mode_enabled`, `budget_cadence`, `daily_budget`, `weekly_budget`, `monthly_budget`) until synced to `profiles`.

### 8.5 Period Notification Deduplication
- **Warnings (80%)**: Emitted once per period and deduped by `lastPeriodWarningKey: ${cadence}_${periodStart}`.
- **Limit Exceeded (100%)**: Emitted once per period and deduped by `lastPeriodExceededKey: ${cadence}_${periodStart}`.
- **Rollover**: Emitted once per finalized period and deduped by `lastPeriodRolloverKey: periodId`.
- **Sign-Out Reset**: All cadence-aware keys and queues are cleared on user sign-out via `registerStoreResetCallback`.

