# Arthik

Arthik is a personal finance, expense, and daily-savings tracking mobile application for Android built with React Native (Expo) and Supabase.

## Language

### 1. Financial Transactions & Direction

**Transaction**:
A single record of monetary movement (inflow or outflow) stored in the database with a first-class `type` field (`'expense' | 'income'`).
- *Code location*: `src/store/expenseStore.ts` (`Expense` interface), `schema.sql` (`expenses` table)
- *_Avoid_*: Entry, Item, Ledger Record

**Expense**:
An outflow transaction (`type: 'expense'`) that deducts from the user's day's allowance and contributes to total expenditure.
- *Code location*: `src/store/expenseStore.ts` (`type: 'expense'`), `src/lib/paymentUtils.ts` (`isIncomeTransaction(...) === false`)
- *_Avoid_*: Debit, Charge, Payment, Outflow

**Income**:
An inflow transaction (`type: 'income'`) that increases total incoming funds without adding to or deducting from the daily budget allowance.
- *Code location*: `src/lib/paymentUtils.ts` (`isIncomeTransaction(...) === true`), `src/screens/ExpenseFormScreen.tsx` (`transactionType === 'income'`)
- *_Avoid_*: Credit, Deposit (conflicts with Gullak savings deposit), Top-up

**Transaction Direction Inference**:
The single, unified evaluation rule used across screens, general helpers, and the budget engine (`src/lib/paymentUtils.ts` via `isIncomeTransaction`) to determine if a transaction is income: checks explicit `type === 'income'` (returns `true`) or `type === 'expense'` (returns `false`) first, and falls back to matching the resolved category's name against `DEFAULT_INCOME_KEYWORDS` only if `type` is absent or indeterminate.
Category lookup is resolved via a category lookup map (`categoryMap.get(item.category_id)` in screens; in `dailyBudgetStore.ts` via `buildCategoryClassifier()`, lines 22–32, constructed from `useCategoryStore.getState().categories`). Startup sequencing in `App.tsx` (line 116) awaits category loading before running budget engine hydration, guaranteeing categories are in memory before classification.
- *Code location*: `src/lib/paymentUtils.ts` (`isIncomeTransaction`), `src/store/dailyBudgetStore.ts` (`buildCategoryClassifier`, lines 22–32), `App.tsx` (line 116), screens (`HomeScreen.tsx`, `HistoryScreen.tsx`, `ExpenseDetailScreen.tsx`)
- *_Avoid_*: Dual-Engine Inference, Keyword Guessing, Category Type Checking

**Unified Income Classification**:
The architectural standard where `src/lib/paymentUtils.ts` and `src/store/dailyBudgetStore.ts` share the exact same classification logic, eliminating the historical dual-engine divergence (formerly documented in `docs/adr/0007-income-classification-divergence.md`, superseded by `docs/adr/0008-unified-income-classification.md`).
- *Code location*: `src/lib/paymentUtils.ts` (`isIncomeTransaction`), `src/store/dailyBudgetStore.ts` (`buildCategoryClassifier`, lines 22–32)
- *_Avoid_*: Dual-Engine Income Inference, Divergent Direction Check


---

### 2. Daily Savings & Budgeting (Gullak)

**Recurring Allowance (Base Daily Budget)**:
The user's persistent profile baseline allowance automatically applied to each new day when Auto-Renew is enabled.
- *Code location*: `src/store/dailyBudgetStore.ts` (`dailyBudgetAmount`, `isAutoRenew`), `src/store/authStore.ts` (`Profile.daily_budget`)
- *_Avoid_*: Baseline Budget, Base Allowance, Daily Cap, Spending Ceiling

**Day's Allowance (Date Budget)**:
The specific spending limit allocated for a single calendar date (`yyyy-MM-dd`), which defaults to the Recurring Allowance but can be customized or topped up for that day without altering the user's profile baseline.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.budget`, `setTodayBudget`, `addToTodayBudget`)
- *_Avoid_*: Daily Quota, Profile Budget

**Today's Spent**:
The sum of all non-income transactions logged for the current local date.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.spent`), `src/screens/HomeScreen.tsx` (`todayLiveSpent`)
- *_Avoid_*: Current Spend, Today's Outflow

**Daily Savings**:
The unspent portion of a day's allowance (`Math.max(0, budget - spent)`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.saved`)
- *_Avoid_*: Surplus, Daily Remainder, Leftover Money

**Gullak (Total Accumulated Savings)**:
The lifetime net piggy-bank reserve calculated as all finalized past savings minus any past or present overspending penalties.
- *Code location*: `src/store/dailyBudgetStore.ts` (`totalAccumulatedSavings`), `src/screens/SavingsScreen.tsx`
- *_Avoid_*: Piggy Bank (use Gullak), Total Savings, Net Balance

**Daily Record**:
An accounting snapshot tracking budget, spent, saved, finalization flag, and evaluation status for a specific date.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord`)
- *_Avoid_*: Day Log, Budget History Item

**Finalized Day**:
A past calendar day (`date < today`) whose budget and savings are permanently locked and synced to the database. Initial rollover finalization uses `shouldIgnoreDuplicates(status)` (`status === 'unknown'`), ensuring finalized metrics for tracked days genuinely overwrite remote records in `daily_savings_log`.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.isFinalized`, `checkAndRollover`, lines 525–562), `src/lib/budgetCalculations.ts` (`shouldIgnoreDuplicates`, lines 283–285)
- *_Avoid_*: Closed Day, Settled Day, Archival Record

**Day Status — Active**:
The in-progress status of today where spending has not exceeded the allocated budget (`spent <= budget`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`status: 'active'`)
- *_Avoid_*: Pending, In Progress, Open

**Day Status — Saved**:
The status of a finalized past day where the user spent less than their allocated budget (`saved > 0`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`status: 'saved'`)
- *_Avoid_*: Successful Day, Under Budget, Green Day

**Day Status — Exceeded**:
The canonical domain status for a day where spending exceeded the allocated budget (`spent > budget`).
- *Code location*:
  - *Adopted as 'exceeded'*: `src/store/dailyBudgetStore.ts` (`status: 'exceeded'`), `src/screens/SavingsScreen.tsx` (`rec.status === 'exceeded'`).
  - *Persisted as 'missed'*: `schema.sql` (`daily_savings_log` check constraint `('saved', 'missed', 'even', 'unknown')`), translated on upload in `dailyBudgetStore.ts`.
  - *Unadopted in UI as 'missed'*: `src/components/StreakCalendarModal.tsx` (`DayLogData.status`, `TooltipState.status`, cell render status `'saved' | 'missed' | 'neutral'`).
- *_Avoid_*: Missed (use Exceeded as canonical domain term; 'missed' is a DB constraint & unadopted component artifact), Failed Day, Overspent Day, Deficit Day

**Day Status — Even**:
The status of a finalized past day where spending exactly equaled the allocated budget (`budget > 0 && spent === budget`, `saved === 0`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`status: 'even'`), `src/lib/budgetCalculations.ts` (`evaluateDayStatus`)
- *_Avoid_*: Break Even, Zero Day, Exact Day

**Day Status — Unknown**:
The status of a past day where no budget was allocated (`budget === 0`) or the day was untracked before registration, assigned uniformly across both `checkAndRollover` and `hydrateFromSupabase`.
- *Code location*: `src/store/dailyBudgetStore.ts` (`status: 'unknown'`), `src/lib/budgetCalculations.ts` (`evaluateDayStatus`, lines 167–171)
- *_Avoid_*: Unset, Null Day, Ignored Day

**Savings Streak**:
The number of consecutive finalized past days ending yesterday with status `'saved'` (`saved > 0`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`savingsStreak`, `calculateSavingsMetrics`)
- *_Avoid_*: Daily Streak, Budget Streak, Habit Streak

**Streak Reset**:
The zeroing of the savings streak caused by any day with status `'exceeded'`, `'even'`, or an unfinalized missing tracked day (days with status `'unknown'` are neutral and do not reset the streak).
- *Code location*: `src/store/dailyBudgetStore.ts` (`calculateSavingsMetrics`)
- *_Avoid_*: Streak Break, Streak Cancellation

---

### 3. Offline Write Path & Data Sync

**Optimistic Row**:
A transaction created, updated, or deleted locally in client state immediately (0ms UI latency) before server confirmation.
- *Code location*: `src/store/expenseStore.ts` (`optimisticExpense`, `pending: true`)
- *_Avoid_*: Local Row, Speculative Row, Unconfirmed Row

**Pending Create Queue**:
The per-user AsyncStorage queue storing optimistic new transactions waiting to be uploaded to Supabase.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_pending_expenses_${userId}`)
- *_Avoid_*: Outbox, Add Buffer, Local Creation Queue

**Pending Update Queue**:
The per-user AsyncStorage queue storing modified transaction payloads waiting to be synced to Supabase.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_pending_updates_${userId}`)
- *_Avoid_*: Edit Queue, Patch Buffer

**Pending Delete Queue**:
The per-user AsyncStorage queue storing transaction IDs marked for server-side deletion.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_pending_deletes_${userId}`)
- *_Avoid_*: Trash Queue, Removal Queue

**Failed Sync Queue**:
The per-user AsyncStorage list holding items that failed server synchronization after 5 retry attempts or encountered permanent database validation errors.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_failed_sync_${userId}`, `FailedSyncItem`)
- *_Avoid_*: Dead Letter Queue, Error Log, Sync Trash

**Cached Expenses**:
The per-user AsyncStorage snapshot of server-confirmed expenses used to populate the app on cold start or offline launch.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_cached_expenses_${userId}`)
- *_Avoid_*: Local Database, Offline Replica, Expense Store Backup

**Cached Categories**:
The per-user AsyncStorage snapshot of categories used to instantly render real user categories on cold start or offline launch before remote fetch completes.
- *Code location*: `src/store/categoryStore.ts` (`@arthik_cached_categories_${userId}`)
- *_Avoid_*: Category Cache, Offline Category Replica

---

### 4. Categories

**Default Category**:
A system-seeded category created automatically for each new user upon account registration.
- *Code location*: `schema.sql` (`handle_new_user()`, `is_default: true`), `src/store/categoryStore.ts`
- *_Avoid_*: Global Category, System Category

**Custom Category**:
A user-created category added via the category management interface.
- *Code location*: `src/store/categoryStore.ts` (`addCategory`, `is_default: false`), `schema.sql` (`user_id = auth.uid()`)
- *_Avoid_*: User Category, Personal Category

**Category Placeholder**:
A transient visual category item (`id: '1'` to `'7'`) rendered purely in memory while real categories load from the database.
- *Code location*: `src/store/categoryStore.ts` (`isPlaceholder: true`, `DEFAULT_CATEGORIES`)
- *_Avoid_*: Temporary Category, Mock Category

**Category Disassociation (Orphan Prevention)**:
The database and client behavior where deleting a category sets `category_id = null` on associated transactions (though the UI blocks category deletion if transactions are attached).
- *Code location*: `schema.sql` (`ON DELETE SET NULL`), `src/screens/ManageCategoriesScreen.tsx` (`categoryExpenseCounts`)
- *_Avoid_*: Cascade Delete, Category Unlinking

---

### 5. Payment Modes

**Payment Mode**:
The financial channel through which a transaction occurred, strictly constrained to three lowercase identifiers: `'cash'`, `'upi'`, and `'card'`.
- *Code location*: `src/lib/paymentUtils.ts` (`PaymentMode`), `schema.sql` (`CHECK (payment_mode IN ('cash', 'upi', 'card'))`), `src/store/expenseStore.ts`
- *_Avoid_*: Payment Method, Payment Type, Account Type, Tender Mode

**Cash**:
Physical currency transaction (`'cash'`).
- *Code location*: `src/lib/paymentUtils.ts` (`mode === 'cash'`)
- *_Avoid_*: Physical, Paper

**UPI**:
Unified Payments Interface instant digital transfer (`'upi'`).
- *Code location*: `src/lib/paymentUtils.ts` (`mode === 'upi'`)
- *_Avoid_*: NetBanking, Online, Instant Transfer

**Card**:
Credit or debit card transaction (`'card'`). Permitted for expenses; excluded in UI for income additions.
- *Code location*: `src/lib/paymentUtils.ts` (`mode === 'card'`), `src/screens/ExpenseFormScreen.tsx`
- *_Avoid_*: Credit Card, Debit Card, Plastic
