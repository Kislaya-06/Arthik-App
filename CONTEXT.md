# Arthik

Arthik is a personal finance, expense, and daily-savings tracking mobile application for Android built with React Native (Expo) and Supabase.

## Language

### 1. Financial Transactions & Direction

**Transaction**:
A single record of monetary movement (inflow or outflow) stored in the database with a first-class `type` field (`'expense' | 'income'`).
- *Code location*: `src/store/expenseStore.ts` (`Expense` interface, lines 10–23), `schema.sql` (`expenses` table)
- *_Avoid_*: Entry, Item, Ledger Record

**Expense**:
An outflow transaction (`type: 'expense'`) that deducts from the user's Day's Allowance and contributes to total expenditure.
- *Code location*: `src/store/expenseStore.ts` (`type: 'expense'`), `src/lib/paymentUtils.ts` (`isIncomeTransaction(...) === false`)
- *_Avoid_*: Debit, Charge, Payment, Outflow

**Income**:
An inflow transaction (`type: 'income'`) that increases total incoming funds without deducting from the Daily Allowance.
- *Code location*: `src/lib/paymentUtils.ts` (`isIncomeTransaction(...) === true`), `src/screens/ExpenseFormScreen.tsx` (`transactionType === 'income'`)
- *_Avoid_*: Credit, Deposit (conflicts with Gullak Deposit), Top-up

**Transaction Direction Inference**:
The single, unified evaluation rule used across screens, helpers, and the budget engine to determine if a transaction is income. Implemented in `isIncomeTransaction`: checks explicit `type === 'income'` (returns `true`) or `type === 'expense'` (returns `false`) first, then falls back to matching the resolved category name against `DEFAULT_INCOME_KEYWORDS` only when `type` is absent or indeterminate.
Category lookup is resolved via a category map (`categoryMap.get(item.category_id)` in screens; in `dailyBudgetStore.ts` via `buildCategoryClassifier()` at lines 38–48, constructed from `useCategoryStore.getState().categories`). Startup sequencing in `App.tsx` (line 124) awaits `fetchCategories` before `hydrateFromSupabase`, guaranteeing categories are in memory before budget engine classification runs.
- *Code location*: `src/lib/paymentUtils.ts` (`isIncomeTransaction`, lines 49–58), `src/store/dailyBudgetStore.ts` (`buildCategoryClassifier`, lines 38–48), `App.tsx` (lines 124–127), screens (`HomeScreen.tsx`, `HistoryScreen.tsx`, `ExpenseDetailScreen.tsx`)
- *_Avoid_*: Dual-Engine Inference, Keyword Guessing, Category Type Checking

**Unified Income Classification**:
The architectural standard where `src/lib/paymentUtils.ts` and `src/store/dailyBudgetStore.ts` share the exact same classification logic, eliminating the historical dual-engine divergence (formerly documented in `docs/adr/0007-income-classification-divergence.md`, superseded by `docs/adr/0008-unified-income-classification.md`).
- *Code location*: `src/lib/paymentUtils.ts` (`isIncomeTransaction`), `src/store/dailyBudgetStore.ts` (`buildCategoryClassifier`, lines 38–48)
- *_Avoid_*: Dual-Engine Income Inference, Divergent Direction Check

---

### 2. Daily Savings & Budgeting (Gullak)

**Recurring Allowance (Base Daily Budget)**:
The user's persistent profile baseline allowance automatically applied to each new day when Auto-Renew is enabled.
- *Code location*: `src/store/dailyBudgetStore.ts` (`dailyBudgetAmount`, `isAutoRenew`), `src/store/authStore.ts` (`Profile.daily_budget`)
- *_Avoid_*: Baseline Budget, Base Allowance, Daily Cap, Spending Ceiling

**Day's Allowance (Date Budget)**:
The specific spending limit allocated for a single calendar date (`yyyy-MM-dd`), which defaults to the Recurring Allowance. To maintain financial discipline, edits to the daily budget take effect starting the next day at 12:00 AM without altering today's active allowance.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.budget`, `scheduleNextDailyBudget`, `scheduledNextDailyBudget`)
- *_Avoid_*: Daily Quota, Profile Budget, Top-up

**Today's Spent**:
The sum of all non-income transactions logged for the current local date.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.spent`), `src/screens/HomeScreen.tsx` (`todayLiveSpent`)
- *_Avoid_*: Current Spend, Today's Outflow

**Daily Savings**:
The unspent portion of a day's allowance (`Math.max(0, budget - spent)`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.saved`)
- *_Avoid_*: Surplus, Daily Remainder, Leftover Money

**Gullak (Total Accumulated Savings)**:
The lifetime net piggy-bank reserve: all finalized past savings plus any Gullak Deposits, minus past overspending penalties.
- *Code location*: `src/store/dailyBudgetStore.ts` (`totalAccumulatedSavings`, line 152), `src/screens/SavingsScreen.tsx`
- *_Avoid_*: Piggy Bank (use Gullak), Total Savings, Net Balance

**Gullak Deposit**:
A manual top-up the user makes directly into their Gullak reserve, separate from automated daily savings. Classified by a distinct `source` (`'income' | 'external'`):
- **From Income (`'income'`)**: Funds moved from tracked income into Gullak. Increases Gullak reserve while leaving total available budget unchanged. Capped by lifetime available income (`getAvailableIncomeBalance`).
- **External (`'external'`)**: Fresh money from outside the app (cash gift, windfall, bonus). Increases both Gullak reserve and the period's available balance across Daily, Weekly, Monthly, and All views.
Both sources appear alongside expenses in recent transactions (`HomeScreen`) and `HistoryScreen` (via `GullakDepositRow`), and open `GullakDepositDetailScreen`. Stored in `gullak_deposits` in Supabase and `gullakDeposits` in local state.
- *Code location*: `src/store/dailyBudgetStore.ts` (`GullakDeposit` interface, `addGullakDeposit`, `getAvailableIncomeBalance`), `src/components/DepositGullakModal.tsx`, `src/screens/GullakDepositDetailScreen.tsx`, `src/components/GullakDepositRow.tsx`, `schema.sql` (`gullak_deposits` table)
- *_Avoid_*: Manual Deposit, Savings Top-up, Windfall

**Daily Record**:
An accounting snapshot tracking budget, spent, saved, finalization flag, and evaluation status for a specific date.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord` interface)
- *_Avoid_*: Day Log, Budget History Item

**Finalized Day**:
A past calendar day (`date < today`) whose budget and savings are permanently locked and synced to the database. Initial rollover finalization uses `shouldIgnoreDuplicates(status)` (returns `true` only for `'unknown'` status), ensuring that real finalized metrics for tracked days overwrite remote records in `daily_savings_log`.
- *Code location*: `src/store/dailyBudgetStore.ts` (`DailyRecord.isFinalized`, `checkAndRollover` line 537), `src/lib/budgetCalculations.ts` (`shouldIgnoreDuplicates`, lines 301–303)
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
  - *Unadopted in UI as 'missed'*: `src/components/StreakCalendarModal.tsx` (`DayLogData.status`, cell render status `'saved' | 'missed' | 'neutral'`).
- *_Avoid_*: Missed (use Exceeded as canonical domain term; 'missed' is a DB constraint & unadopted component artifact), Failed Day, Overspent Day, Deficit Day

**Day Status — Even**:
The status of a finalized past day where spending exactly equaled the allocated budget (`budget > 0 && spent === budget`, `saved === 0`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`status: 'even'`), `src/lib/budgetCalculations.ts` (`evaluateDayStatus`)
- *_Avoid_*: Break Even, Zero Day, Exact Day

**Day Status — Unknown**:
The status of a past day where no budget was allocated (`budget === 0`) or the day was untracked before registration, assigned uniformly across both `checkAndRollover` and `hydrateFromSupabase`.
- *Code location*: `src/store/dailyBudgetStore.ts` (`status: 'unknown'`), `src/lib/budgetCalculations.ts` (`evaluateDayStatus`)
- *_Avoid_*: Unset, Null Day, Ignored Day

**Savings Streak**:
The number of consecutive finalized past days ending yesterday with status `'saved'` (`saved > 0`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`savingsStreak`, `calculateSavingsMetrics`)
- *_Avoid_*: Daily Streak, Budget Streak, Habit Streak

**Streak Reset**:
The zeroing of the savings streak caused by any day with status `'exceeded'`, `'even'`, or an unfinalized missing tracked day. Days with status `'unknown'` are neutral and do not reset the streak.
- *Code location*: `src/store/dailyBudgetStore.ts` (`calculateSavingsMetrics`)
- *_Avoid_*: Streak Break, Streak Cancellation

---

### 3. Offline Write Path & Data Sync

**Optimistic Row**:
A transaction created, updated, or deleted locally in client state immediately (0 ms UI latency) before server confirmation. Marked with `pending: true` in state.
- *Code location*: `src/store/expenseStore.ts` (`optimisticExpense`, `pending: true`)
- *_Avoid_*: Local Row, Speculative Row, Unconfirmed Row

**Pending Create Queue**:
The per-user AsyncStorage queue storing optimistic new transactions waiting to be uploaded to Supabase.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_pending_expenses_${userId}`, `getPendingStorageKey`, line 69)
- *_Avoid_*: Outbox, Add Buffer, Local Creation Queue

**Pending Update Queue**:
The per-user AsyncStorage queue storing modified transaction payloads waiting to be synced to Supabase.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_pending_updates_${userId}`, `getPendingUpdatesKey`, line 70)
- *_Avoid_*: Edit Queue, Patch Buffer

**Pending Delete Queue**:
The per-user AsyncStorage queue storing transaction IDs marked for server-side deletion.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_pending_deletes_${userId}`, `getPendingDeletesKey`, line 71)
- *_Avoid_*: Trash Queue, Removal Queue

**Failed Sync Queue**:
The per-user AsyncStorage list holding items that failed server synchronization after `MAX_SYNC_RETRIES` (5) attempts with exponential backoff, or encountered permanent database validation errors (HTTP 4xx).
- *Code location*: `src/store/expenseStore.ts` (`@arthik_failed_sync_${userId}`, `getFailedSyncStorageKey` line 73, `FailedSyncItem` interface lines 25–31, `MAX_SYNC_RETRIES` line 75)
- *_Avoid_*: Dead Letter Queue, Error Log, Sync Trash

**Cached Expenses**:
The per-user AsyncStorage snapshot of server-confirmed expenses used to populate the app on cold start or offline launch.
- *Code location*: `src/store/expenseStore.ts` (`@arthik_cached_expenses_${userId}`, `getCachedStorageKey`, line 72)
- *_Avoid_*: Local Database, Offline Replica, Expense Store Backup

**Cached Categories**:
The per-user AsyncStorage snapshot of categories used to instantly render real user categories on cold start or offline launch before the remote fetch completes.
- *Code location*: `src/store/categoryStore.ts` (`@arthik_cached_categories_${userId}`)
- *_Avoid_*: Category Cache, Offline Category Replica

**Startup Hydration Sequence**:
The ordered async boot sequence in `App.tsx` that guarantees stores are populated in dependency order: `loadPendingExpenses` → `fetchCategories` → (`fetchExpenses` + `hydrateFromSupabase`) in parallel. Categories must be loaded before `hydrateFromSupabase` so `buildCategoryClassifier` has a populated category map when `checkAndRollover` fires.
- *Code location*: `App.tsx` (lines 122–128)
- *_Avoid_*: Boot Sequence, App Init, Store Preload

---

### 4. App Lock

**App Lock**:
A device-level biometric gate (fingerprint, face, or device PIN) that locks Arthik on launch or after returning from background. Enabled or disabled via `setAppLockEnabled`, which always requires a successful biometric authentication before toggling. The lock state (`isLocked`) gates all navigation until `authenticate` succeeds.
- *Code location*: `src/store/appLockStore.ts` (`useAppLockStore`, lines 28–212), `src/screens/AuthScreen.tsx`
- *_Avoid_*: PIN Lock, Password Lock, Passcode

**App Lock Persistence**:
The lock preference is stored in two AsyncStorage keys: a global device key (`@arthik_app_lock_enabled`) for fast cold-start reads, and a per-user key (`@arthik_app_lock_enabled_${userId}`) for multi-account correctness. The `init` function reads global first, then user-specific, then scans all lock keys as a final fallback.
- *Code location*: `src/store/appLockStore.ts` (`GLOBAL_STORAGE_KEY` line 24, `getUserStorageKey` line 25–26, `init` lines 36–90)
- *_Avoid_*: Biometric Setting, Lock Config

---

### 5. Categories

**Default Category**:
A system-seeded category created automatically for each new user upon account registration.
- *Code location*: `schema.sql` (`handle_new_user()`, `is_default: true`), `src/store/categoryStore.ts`
- *_Avoid_*: Global Category, System Category

**Custom Category**:
A user-created category added via the category management interface (`is_default: false`).
- *Code location*: `src/store/categoryStore.ts` (`addCategory`, `is_default: false`), `schema.sql` (`user_id = auth.uid()`)
- *_Avoid_*: User Category, Personal Category

**Category Placeholder**:
A transient visual category array (`id: '1'` to `'7'`, `isPlaceholder: true`) rendered purely in memory as `DEFAULT_CATEGORIES` while real categories load from the database. These IDs are never selectable and never sent to Supabase.
- *Code location*: `src/store/categoryStore.ts` (`DEFAULT_CATEGORIES` lines 34–42, `isPlaceholder: true`)
- *_Avoid_*: Temporary Category, Mock Category

**Category Disassociation (Orphan Prevention)**:
The database behavior where deleting a category sets `category_id = null` on associated transactions (`ON DELETE SET NULL`). The UI additionally blocks category deletion entirely if any transactions are currently attached (`categoryExpenseCounts`).
- *Code location*: `schema.sql` (`ON DELETE SET NULL`), `src/screens/ManageCategoriesScreen.tsx` (`categoryExpenseCounts`)
- *_Avoid_*: Cascade Delete, Category Unlinking

**Category Delete Callback**:
A cross-store registration pattern (`registerCategoryDeleteCallback`) that lets `expenseStore` be notified when a category is deleted, so it can null out `category_id` on affected in-memory expenses without a direct store-to-store import.
- *Code location*: `src/store/categoryStore.ts` (`registerCategoryDeleteCallback`, lines 28–30), `src/store/expenseStore.ts`
- *_Avoid_*: Category Event Bus, Category Listener

---

### 6. Payment Modes

**Payment Mode**:
The financial channel through which a transaction occurred, strictly constrained to three lowercase identifiers: `'cash'`, `'upi'`, and `'card'`.
- *Code location*: `src/lib/paymentUtils.ts` (`PaymentMode` type, line 4), `schema.sql` (`CHECK (payment_mode IN ('cash', 'upi', 'card'))`), `src/store/expenseStore.ts` (`Expense.payment_mode`, line 17)
- *_Avoid_*: Payment Method, Payment Type, Account Type, Tender Mode

**Cash**:
Physical currency transaction (`'cash'`). Icon: `Wallet` (lucide-react-native).
- *Code location*: `src/lib/paymentUtils.ts` (`getPaymentIcon`, `getPaymentLabel`, lines 12–16, 22–26)
- *_Avoid_*: Physical, Paper

**UPI**:
Unified Payments Interface instant digital transfer (`'upi'`). Icon: `CheckSquare` (lucide-react-native).
- *Code location*: `src/lib/paymentUtils.ts` (`getPaymentIcon`, `getPaymentLabel`)
- *_Avoid_*: NetBanking, Online, Instant Transfer

**Card**:
Credit or debit card transaction (`'card'`). Icon: `CreditCard` (lucide-react-native). Permitted for expenses; excluded in UI for income additions.
- *Code location*: `src/lib/paymentUtils.ts` (`getPaymentIcon`, `getPaymentLabel`), `src/screens/ExpenseFormScreen.tsx`
- *_Avoid_*: Credit Card, Debit Card, Plastic

---

### 7. Budget Modes & Multi-Cadence Periods

**Pure Mode**:
The default expense tracking mode (`isBudgetModeEnabled: false`) where users record expenses and income freely without daily allowances, spending limits, or Gullak savings. The bottom navigation renders 4 tabs (`Home`, `History`, `Add`, `Insights`) and the Home screen shows an Inflow/Outflow cashflow overview with a concentric `DualRingChart`.
- *Code location*: `src/store/dailyBudgetStore.ts` (`isBudgetModeEnabled: false`), `src/components/BottomNavBar.tsx`, `src/components/DualRingChart.tsx`
- *_Avoid_*: Free Mode, Basic Mode, No-Budget Mode

**Budget Mode**:
The structured financial discipline mode (`isBudgetModeEnabled: true`) where users define a spending allowance across a chosen cadence (`daily`, `weekly`, or `monthly`), track remaining balances, earn savings into their digital Gullak at period rollover, and maintain savings streaks. The bottom navigation dynamically shows 5 tabs (including `Savings`).
- *Code location*: `src/store/dailyBudgetStore.ts` (`isBudgetModeEnabled: true`), `src/screens/SavingsScreen.tsx`
- *_Avoid_*: Gullak Mode, Allowance Mode, Hard Mode

**Cadence**:
The recurring calendar cycle defining how a budget is measured and renewed: `'daily'` (day-by-day), `'weekly'` (Monday 00:00 to Sunday 23:59:59), or `'monthly'` (1st of month to month-end).
- *Code location*: `src/lib/budgetPeriods.ts` (`BudgetCadence` type), `src/store/dailyBudgetStore.ts` (`budgetCadence`)
- *_Avoid_*: Frequency, Interval, Periodicity

**Budget Period**:
A structured period window (`BudgetPeriod`) representing an active or finalized cadence cycle. Records the cadence, calendar bounds (`periodStart` to `periodEnd`), effective active bounds (`activeStart` to `activeEnd`), allocated budget (`budgetAmount`), total non-income spending (`spentAmount`), amount rolled over to Gullak (`amountSaved`), status (`saved`, `exceeded`, `even`), and proration flag (`isProrated`).
- *Code location*: `src/lib/budgetPeriods.ts` (`BudgetPeriod` interface, `buildPeriodsToFinalize`, `getCurrentPeriodSummary`), `src/store/dailyBudgetStore.ts` (`budgetPeriods`)
- *_Avoid_*: Cycle, Budget Block, Spending Window

**Active Slice**:
The continuous date interval `[activeStart, activeEnd]` within a calendar period during which a specific budget plan was active. Slices prevent overlapping, account for mid-period plan switches, and ensure no day or rupee is double-counted.
- *Code location*: `src/lib/budgetPeriods.ts` (`buildPlanSlices`, `walkPlanSlices`)
- *_Avoid_*: Active Segment, Sub-period, Time Slice

**Non-Prorated Budget (Zero-Proration Policy)**:
The architectural invariant that a user's entered budget amount is NEVER scaled down or prorated simply because they configured or switched it mid-cycle. The user-entered amount represents 100% real cash allocated into their active spending pool. Dynamic pacing (e.g. suggested daily pace) is computed strictly for non-binding informational guidance.
- *Code location*: `src/lib/budgetModeUtils.ts` (`getUnproratedPacingPreview`), `src/lib/budgetPeriods.ts` (`getCurrentPeriodSummary`, `isProrated: false`), `docs/adr/0011-zero-proration-and-digital-vault-spending-guard.md`
- *_Avoid_*: Prorated Allowance, Scaled Budget, Fractional Allowance

**Zero-Balance Spending Guard (Digital Bank Vault Invariant)**:
The strict invariant that Arthik functions as a financial vault: a user cannot execute an outflow (expense) if their total available liquid funds (allocated budget allowance + logged incomes + reserves) equal zero. Attempting to add an expense with zero available inflow blocks creation at the input boundary and prompts the user to fund their account first. Overspending against a single cadence limit is permitted only when backed by available funds/income elsewhere.
- *Code location*: `src/lib/vaultSpendingGuard.ts` (`calculateVaultLiquidity`), `src/components/VaultSpendingGuardModal.tsx`, `src/hooks/useExpenseForm.ts`, `src/screens/ExpenseFormScreen.tsx`
- *_Avoid_*: Overdraft, Negative Balance Creation, Phantom Outflow

**Natural Cycle Rollover**:
The transfer of unspent budget funds into the digital Gullak reserve that occurs exclusively upon the natural completion of a full calendar cycle (Daily at 23:59:59, Weekly on Sunday at 23:59:59, Monthly at month-end). Terminating or switching a cadence mid-period does NOT trigger a Gullak deposit.
- *Code location*: `src/lib/budgetPeriods.ts` (`buildPeriodsToFinalize`), `src/store/dailyBudgetStore.ts` (`checkAndRollover`)
- *_Avoid_*: Premature Deposit, Mid-Cycle Rollover, Cutoff Deposit

**Cadence Switch Carry-Forward**:
The mechanism by which unspent funds from a prematurely terminated cadence transfer into the newly active cadence context starting tomorrow at 00:00:00. Supported in two modes:
- **Additive (`'additive'`)**: Carried funds are added on top of the target budget ceiling (`targetBudget + carriedOverAmount`). Default mode.
- **Allocation (`'allocation'`)**: Carried funds provide a pre-funded headstart toward the target budget ceiling (`targetBudget`).
- *Code location*: `src/lib/cadenceSwitch.ts` (`calculateCadenceCarryForward`, `buildCadenceSwitchPlan`), `src/components/CadenceSwitchModal.tsx`
- *_Avoid_*: Rollover Transfer, Switch Deposit, Remainder Flush

**Cadence-Native Streak**:
The streak evaluation unit matching the active cadence: Daily evaluates consecutive saved days, Weekly evaluates consecutive saved weeks (Monday–Sunday), and Monthly evaluates consecutive saved calendar months. Mid-period daily variations do not break a Weekly or Monthly streak.
- *Code location*: `src/lib/budgetPeriods.ts` (`computeCadenceStreak`), `src/store/dailyBudgetStore.ts` (`bestStreakByCadence`)
- *_Avoid_*: Universal Daily Streak, Pace Streak

**Paused**:
The state where a date range or calendar period had no active budget plan (e.g. Budget Mode was turned OFF, or tracking was paused). In the Streak Calendar, paused intervals are displayed with a neutral muted "Paused" badge and never penalize the user, break streaks, or turn red.
- *Code location*: `src/components/StreakCalendarModal.tsx`, `src/lib/budgetModeUtils.ts` (`getWeeklyStreakCards`, `getMonthlyStreakGrid`)
- *_Avoid_*: Stopped, Inactive, Broken, Skipped

---

### 8. Database Entities & Schema Mapping

The source of truth for all database tables, columns, constraints, and Row Level Security policies is [`schema.sql`](./schema.sql). All tables enforce strict multi-tenant isolation via `auth.uid() = user_id`.

**`profiles`**:
User profile metadata and active budget configuration.
- Columns: `id` (PK, matches `auth.users`), `first_name`, `last_name`, `email`, `daily_budget`, `is_auto_renew`, `is_budget_mode_enabled`, `budget_cadence` (`'daily' | 'weekly' | 'monthly'`), `weekly_budget`, `monthly_budget`, `created_at`.
- *Code location*: `src/store/authStore.ts`, `src/store/dailyBudgetStore.ts`, `schema.sql` (lines 11–49, 504–518)

**`categories`**:
Global default categories (seeded on user signup) and custom user-created categories.
- Columns: `id`, `user_id`, `name`, `icon`, `color`, `is_default`, `created_at`.
- Constraints: Orphan prevention via `ON DELETE SET NULL`.
- *Code location*: `src/store/categoryStore.ts`, `schema.sql` (lines 53–102)

**`expenses`**:
Individual monetary transactions (both expenses and income).
- Columns: `id`, `user_id`, `amount`, `category_id`, `payment_mode` (`'cash' | 'upi' | 'card'`), `expense_date`, `type` (`'expense' | 'income'`), `note`, `created_at`.
- *Code location*: `src/store/expenseStore.ts`, `schema.sql` (lines 105–158)

**`daily_savings_log`**:
Finalized records for past daily calendar dates.
- Columns: `id`, `user_id`, `date` (`DATE`), `budget`, `spent`, `saved`, `status` (`'saved' | 'missed' | 'even' | 'unknown'`), `created_at`.
- *Code location*: `src/store/dailyBudgetStore.ts`, `schema.sql` (lines 161–212)

**`budget_plan_changes`**:
Audit log and timeline of budget plan changes, cadence switches, amounts, and carry-forward allocations.
- Columns: `id`, `user_id`, `effective_from` (`DATE`), `is_enabled`, `cadence`, `amount`, `carry_mode` (`'additive' | 'allocation'`), `carried_over_amount`, `created_at`.
- Constraint: `UNIQUE (user_id, effective_from)`.
- *Code location*: `src/lib/budgetPeriods.ts`, `src/lib/cadenceSwitch.ts`, `schema.sql` (lines 520–566, 606–607)

**`budget_periods`** *(Code entity: `BudgetPeriodRecord`)*:
Finalized weekly and monthly governed accounting periods.
- Columns: `id`, `user_id`, `cadence` (`'weekly' | 'monthly'`), `period_start`, `period_end`, `active_start`, `active_end`, `budget_amount`, `spent_amount`, `amount_saved`, `status` (`'saved' | 'missed' | 'even' | 'unknown'`), `is_prorated` (`BOOLEAN`, strictly `false` for unprorated engine), `carried_over_amount`, `carry_mode`, `created_at`.
- Constraint: `UNIQUE (user_id, cadence, active_start)`.
- *Code location*: `src/lib/budgetPeriods.ts`, `src/store/dailyBudgetStore.ts`, `schema.sql` (lines 568–638)

**`gullak_deposits`**:
Direct deposits credited to the Gullak savings reserve.
- Columns: `id`, `user_id`, `amount`, `source` (`'income' | 'external'`), `note`, `deposit_date`, `created_at`.
- *Code location*: `src/store/dailyBudgetStore.ts`, `src/components/DepositGullakModal.tsx`, `schema.sql` (lines 450–499)

---

### 9. UI Design System & Visual Architecture

**Runtime Token Source of Truth**:
The single source of truth for numeric spacing, radii, font sizes, control heights, and color tokens located in `src/config/theme.ts`.
- *Code location*: `src/config/theme.ts`
- *_Avoid_*: Hardcoded Styles, In-Screen Magic Numbers

**Design System Specification**:
The human- and agent-facing canonical design documentation defining semantic roles, component variants, and migration guidelines located in `docs/design-system.md`.
- *Code location*: `docs/design-system.md`
- *_Avoid_*: Ad-hoc Style Guides

**Amount Text Primitive**:
The unified UI component responsible for displaying financial amounts with Indian grouping (`₹`), direction coloring, and accessibility semantics under the Real-Money Invariant.
- *Code location*: `src/components/ui/AmountText.tsx`, `docs/design-system.md`
- *_Avoid_*: Raw String Amounts, Unaligned Currency Text

**App Button Primitive**:
The standardized interactive button component encapsulating primary, secondary, outline, danger, and ghost variants with fixed control heights.
- *Code location*: `src/components/ui/AppButton.tsx`, `docs/design-system.md`
- *_Avoid_*: Raw Pressables, Custom Button Styles



