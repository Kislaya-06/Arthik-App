# Arthik — Domain Glossary

> Canonical alphabetized reference for domain terminology, architectural concepts, and financial invariants in **Arthik**.  
> Derived from [`CONTEXT.md`](./CONTEXT.md), [`schema.sql`](./schema.sql), and the live codebase.

---

### Active Slice
The continuous calendar interval `[activeStart, activeEnd]` within a calendar period during which a specific budget plan was active. Slices prevent overlapping, account for mid-period plan switches, and ensure no day or rupee is double-counted.
- **Code**: `src/lib/budgetPeriods.ts` (`buildPeriodsToFinalize`, `getCurrentPeriodSummary`), `schema.sql` (`budget_periods.active_start`, `active_end`)
- **Avoid**: *Sub-period, Active Segment, Time Slice*

---

### Actual Money (Real-Money Invariant)
The foundational principle that every tracked rupee in Arthik represents real, tangible capital in the user's possession. Daily, weekly, or monthly allowances configured by the user represent real cash funded into their active spending pool. Past active allowances are never wiped out or dropped when modes switch.
- **Code**: `AGENTS.md` (§1, §8, §15), `CONTEXT.md` (§7), `docs/adr/0011-zero-proration-and-digital-vault-spending-guard.md`
- **Avoid**: *Virtual Currency, Play Money, Gamified Credits*

---

### App Lock
A device-level biometric gate (Fingerprint, Face, or Device PIN) that locks Arthik on cold launch or after returning from the background. Requires biometric validation to toggle on/off.
- **Code**: `src/store/appLockStore.ts`, `src/screens/AuthScreen.tsx`
- **Avoid**: *PIN Lock, Password Lock*

---

### Budget Cadence
The recurring calendar cycle defining how a budget is measured, paced, and renewed:
- **`'daily'`**: Day-by-day allowance renewed each midnight.
- **`'weekly'`**: Monday 00:00:00 to Sunday 23:59:59.
- **`'monthly'`**: 1st of month 00:00:00 to month-end 23:59:59.
- **Code**: `src/lib/budgetPeriods.ts` (`BudgetCadence`), `src/store/dailyBudgetStore.ts` (`budgetCadence`), `schema.sql` (`profiles.budget_cadence`, `budget_plan_changes.cadence`)
- **Avoid**: *Frequency, Interval, Periodicity*

---

### Budget Mode
The structured financial discipline mode (`is_budget_mode_enabled: true`) where users allocate a spending allowance across their chosen cadence, track remaining balances, earn savings into their digital Gullak at period rollover, and maintain savings streaks. Activates a 5th navigation tab (`Savings`).
- **Code**: `src/store/dailyBudgetStore.ts` (`isBudgetModeEnabled`), `src/screens/SavingsScreen.tsx`, `schema.sql` (`profiles.is_budget_mode_enabled`)
- **Avoid**: *Gullak Mode, Allowance Mode, Hard Mode*

---

### Budget Period
A structured period window (`BudgetPeriodRecord`) representing an active or finalized cadence cycle. Records the cadence, calendar bounds (`periodStart` to `periodEnd`), effective active bounds (`activeStart` to `activeEnd`), allocated budget (`budgetAmount`), total non-income spending (`spentAmount`), amount rolled over to Gullak (`amountSaved`), status (`saved`, `missed`, `even`, `unknown`), and carry-forward metadata.
- **Code**: `src/lib/budgetPeriods.ts`, `schema.sql` (`budget_periods` table)
- **Avoid**: *Cycle, Budget Block, Spending Window*

---

### Cadence Switch Carry-Forward
The mechanism transferring unspent funds from a prematurely ended cadence into the newly active cadence starting tomorrow at 12:00 AM (00:00:00). Prevents premature Gullak dumps during mid-cycle switches. Supported in two user-guided modes:
1. **Additive (`'additive'`)**: Adds unspent balance directly on top of the newly chosen target budget (`newBudget + carriedAmount`). Default mode.
2. **Allocation (`'allocation'`)**: Treats unspent balance as an opening headstart toward the target budget ceiling without increasing the base cap.
- **Code**: `src/lib/cadenceSwitch.ts` (`calculateCadenceCarryForward`, `buildCadenceSwitchPlan`), `src/components/CadenceSwitchModal.tsx`, `schema.sql` (`carry_mode`, `carried_over_amount`)
- **Avoid**: *Rollover Transfer, Switch Deposit, Remainder Flush*

---

### Day's Allowance (Date Budget)
The spending limit allocated for a single calendar date (`yyyy-MM-dd`), which defaults to the Recurring Allowance. Changes take effect next-day to preserve financial discipline.
- **Code**: `src/store/dailyBudgetStore.ts` (`DailyRecord.budget`, `scheduleNextDailyBudget`)
- **Avoid**: *Daily Quota, Profile Budget, Top-up*

---

### Day Status
The evaluation state of a calendar day or period slice:
- **`'active'`**: Today in progress, spending within budget (`spent <= budget`).
- **`'saved'`**: Finalized period where spending was less than budget (`saved > 0`).
- **`'exceeded'`** *(persisted as `'missed'` in DB)*: Finalized period where spending exceeded budget (`spent > budget`).
- **`'even'`**: Finalized period where spending exactly matched budget (`spent === budget`, `saved === 0`).
- **`'unknown'`**: Untracked day before account registration or day with zero budget.
- **Code**: `src/lib/budgetCalculations.ts` (`evaluateDayStatus`), `src/lib/budgetPeriods.ts`, `schema.sql` (`daily_savings_log.status`, `budget_periods.status`)
- **Avoid**: *Failed Day, Green Day, Broken Day*

---

### Digital Vault Spending Guard (Zero-Balance Guard)
The invariant that Arthik functions as a financial vault: a user cannot create an expense outflow if their net available liquid funds (allocated active budget allowance + logged income + reserves) equal ₹0. Attempting to add an expense with zero available liquidity blocks creation at the input boundary and prompts the user to add income first. Overspending against a single cadence limit is permitted when backed by overall liquidity.
- **Code**: `src/lib/vaultSpendingGuard.ts` (`calculateVaultLiquidity`), `src/components/VaultSpendingGuardModal.tsx`, `src/hooks/useExpenseForm.ts`, `src/screens/ExpenseFormScreen.tsx`
- **Avoid**: *Overdraft, Negative Balance Creation, Phantom Outflow*

---

### Expense
An outflow transaction (`type: 'expense'`) that deducts from the user's spending pool and contributes to total expenditure.
- **Code**: `src/store/expenseStore.ts`, `src/lib/paymentUtils.ts` (`isIncomeTransaction(...) === false`), `schema.sql` (`expenses.type`)
- **Avoid**: *Debit, Charge, Payment, Outflow*

---

### Finalized Period / Finalized Day
A completed past calendar window (`date < today` or `periodEnd < today`) whose budget, spend, and savings are permanently locked and synced to Supabase (`daily_savings_log` or `budget_periods`).
- **Code**: `src/store/dailyBudgetStore.ts`, `src/lib/budgetPeriods.ts` (`buildPeriodsToFinalize`)
- **Avoid**: *Closed Day, Settled Day, Archival Record*

---

### Gullak (Total Accumulated Savings)
The lifetime net savings reserve: all finalized past savings plus manual Gullak Deposits, minus past overspending penalties.
- **Code**: `src/store/dailyBudgetStore.ts` (`totalAccumulatedSavings`), `src/screens/SavingsScreen.tsx`
- **Avoid**: *Piggy Bank (use Gullak), Total Savings, Net Balance*

---

### Gullak Deposit
A savings deposit made directly into the Gullak reserve, classified by its financial source:
1. **`'income'`**: Funds transferred from tracked income into Gullak. Capped by lifetime available income.
2. **`'external'`**: Fresh external funds (bonus, cash gift) that increase both Gullak and available liquid balance.
- **Code**: `src/store/dailyBudgetStore.ts` (`GullakDeposit`, `addGullakDeposit`), `src/components/DepositGullakModal.tsx`, `src/screens/GullakDepositDetailScreen.tsx`, `schema.sql` (`gullak_deposits`)
- **Avoid**: *Manual Deposit, Savings Top-up, Windfall*

---

### Income
An inflow transaction (`type: 'income'`) that increases total incoming funds without counting as an expense against the active allowance.
- **Code**: `src/lib/paymentUtils.ts` (`isIncomeTransaction(...) === true`), `schema.sql` (`expenses.type = 'income'`)
- **Avoid**: *Credit, Deposit, Top-up*

---

### Natural Cycle Rollover
The transfer of eligible unspent budget into the Gullak reserve that occurs **exclusively upon the natural completion of a full cycle** (Daily at 23:59:59, Weekly Sunday at 23:59:59, Monthly at month-end). Premature cadence terminations never deposit to Gullak.
- **Code**: `src/lib/budgetPeriods.ts` (`buildPeriodsToFinalize`), `src/store/dailyBudgetStore.ts` (`checkAndRollover`)
- **Avoid**: *Premature Deposit, Mid-Cycle Rollover, Cutoff Deposit*

---

### Non-Prorated Budget (Zero-Proration Policy)
The invariant that a user's entered budget is **never scaled down or prorated** due to a mid-period start or cadence switch. The full entered amount becomes active immediately for the remainder of the period. Dynamic daily/weekly pacing is calculated strictly as non-binding guidance.
- **Code**: `docs/adr/0011-zero-proration-and-digital-vault-spending-guard.md`, `src/lib/budgetModeUtils.ts` (`getUnproratedPacingPreview`), `src/lib/budgetPeriods.ts` (`getCurrentPeriodSummary`, `isProrated: false`)
- **Avoid**: *Prorated Allowance, Fractional Budget, Scaled Budget*

---

### Optimistic Row & Pending Queues
A local transaction state written immediately with 0 ms UI latency (`pending: true`), while queued in per-user AsyncStorage queues (`@arthik_pending_expenses_<userId>`, `@arthik_pending_updates_<userId>`, `@arthik_pending_deletes_<userId>`). Queues flush automatically when online connectivity resumes.
- **Code**: `src/store/expenseStore.ts`
- **Avoid**: *Outbox, Local Row, Speculative Row*

---

### Pure Mode
The default expense tracking mode (`is_budget_mode_enabled: false`) where users record expenses and income freely without daily allowances, spending limits, or Gullak savings. Renders 4 navigation tabs (`Home`, `History`, `Add`, `Insights`) and displays a concentric `DualRingChart` (Inflow vs. Outflow) on Home.
- **Code**: `src/store/dailyBudgetStore.ts` (`isBudgetModeEnabled: false`), `src/components/BottomNavBar.tsx`, `src/components/DualRingChart.tsx`
- **Avoid**: *Free Mode, Basic Mode, No-Budget Mode*

---

### Recurring Allowance (Base Budget)
The user's persistent profile baseline allowance automatically applied to each new period when Auto-Renew is enabled.
- **Code**: `src/store/dailyBudgetStore.ts` (`dailyBudgetAmount`, `weeklyBudgetAmount`, `monthlyBudgetAmount`), `schema.sql` (`profiles.daily_budget`, `weekly_budget`, `monthly_budget`)
- **Avoid**: *Baseline Budget, Daily Cap, Spending Ceiling*

---

### Savings Streak
The count of consecutive finalized periods stayed within budget (`saved > 0`), measured in units matching the user's active cadence (days, weeks, months). Paused intervals act as neutral bridges and do not break streaks.
- **Code**: `src/store/dailyBudgetStore.ts` (`savingsStreak`, `bestStreakByCadence`), `src/components/StreakCalendarModal.tsx`
- **Avoid**: *Daily Streak, Habit Streak*

---

### Suggested Pace Guidance
Non-binding, informational pacing calculations displayed across Home and Savings:
- **Daily Pace**: `remainingBudget / remainingDays` (shown to Weekly & Monthly users viewing Daily).
- **Weekly Pace**: `(remainingBudget / remainingDays) * 7` (shown to Monthly users viewing Weekly).
- **Projected Monthly Budget**: `(weeklyBudget / 7) * daysInMonth` (shown to Weekly users viewing Monthly, accurately based on actual 28, 29, 30, or 31 month days).
- **Code**: `src/lib/budgetPeriods.ts` (`getCurrentPeriodSummary`), `src/components/BrandedHeroCard.tsx`
- **Avoid**: *Prorated Allowance, Daily Limit, Enforced Pace*

---

### Transaction Direction Inference
The single, unified evaluation rule implemented in `isIncomeTransaction(item, category)`:
1. Checks explicit `item.type === 'income'` $\to$ `true`.
2. Checks explicit `item.type === 'expense'` $\to$ `false`.
3. Falls back to matching category name against `DEFAULT_INCOME_KEYWORDS` only when `type` is missing or indeterminate.
- **Code**: `src/lib/paymentUtils.ts` (`isIncomeTransaction`), `src/store/dailyBudgetStore.ts` (`buildCategoryClassifier`), `docs/adr/0008-unified-income-classification.md`
- **Avoid**: *Dual-Engine Inference, Keyword Guessing*
