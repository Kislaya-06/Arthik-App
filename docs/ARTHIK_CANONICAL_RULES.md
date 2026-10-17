# Arthik — Canonical Business & Financial Rules

> **Authoritative Source of Truth**  
> **Status:** ACTIVE — Governed by Owner Approval Protocol  
> **Repository:** `Arthik-App` (this file lives at `docs/ARTHIK_CANONICAL_RULES.md`)  
> **Initial Creation:** 2026-10-17  
> **Last Updated:** 2026-10-17  

---

## Document Purpose & Non-Negotiable Rules

This document is the **single authoritative canonical source of truth** for all business, financial, and accounting rules in **Arthik**.

1. **Owner Approval Invariant**: No rule in this document may be added, edited, or deleted without the explicit, unambiguous approval of the repository owner.
2. **Code Alignment Invariant**: Code implementations across `src/lib/`, `src/store/`, `src/screens/`, and tests MUST strictly align with the approved rules documented here.
3. **Zero Documentation Lag**: Any approved change to logic must update this canonical document immediately, and all secondary documents (`AGENTS.md`, `CONTEXT.md`, `docs/prd.md`, `docs/architecture.md`, `docs/maps/*`, `docs/adr/*`, `README.md`, `CHANGELOG.md`) must agree with it and reference it rather than duplicate rule definitions.
4. **Contradiction Protocol**: If a requested change (a new feature, an edit, a refactor, a bug fix) would contradict any rule here, the agent must STOP, say which rule would break and what it affects, and change nothing until the owner explicitly says to change it. Only then are the code, tests, this file and every affected document updated together, with precision.

---

## Approved Canonical Rules

### Domain 1: Transaction Identity & Classification (TXN)

#### `TXN-001`: Transaction Direction Authority (Explicit Type)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Transaction direction (Income vs Expense) is determined strictly by the explicit `type` field:
  - If `item.type === 'income'`, it is classified as Income (`true`).
  - If `item.type === 'expense'`, it is classified as Expense (`false`).
- **Code Enforcement:** `src/lib/transactionUtils.ts` (`isIncomeTransaction`)
- **Database Schema Guarantee:** `schema.sql` enforces `type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income'))`.
- **Verified By:** `tests/incomeClassifier.test.ts`, `tests/transactionUtils.test.ts`

#### `TXN-002`: Category Keywords Are an Inert Legacy Fallback
- **Status:** `APPROVED AS-IS` (Owner decision on 2026-10-17)
- **Canonical Definition:**
  The explicit `type` field is the only authority for direction (`TXN-001`). Category-name keyword matching (`DEFAULT_INCOME_KEYWORDS`) exists only as an inert, dormant fallback for historical rows that have no `type` at all:
  1. The user explicitly selects "Income" on the Add screen, which saves `type = 'income'` and sets `category_id = null`.
  2. AutoLog determines `type` directly from Credit vs Debit.
  3. The database makes `type` NOT NULL, so active accounting never reaches the keyword path.
  4. Keywords, notes and category names are never used to guess a transfer or any other class (`TXN-003`).
- **Code Enforcement:** `src/lib/transactionUtils.ts` (`isIncomeTransaction`)
- **Verified By:** `tests/transactionUtils.test.ts`, `tests/selfTransfersAndIncome.test.ts`

#### `TXN-003`: Self-Transfer Exclusion from Totals
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Transactions representing internal movements between a user's own accounts (e.g. bank to bank, ATM cash withdrawal, credit card bill payment from savings account) designated ONLY via `transaction_class === 'self_transfer'`:
  1. **Excluded from Outflow/Expense:** Must NEVER increment total spent, period spent, or daily spent.
  2. **Excluded from Inflow/Income:** Must NEVER increment total income or available income.
  3. **Protected Budget & Streak:** Must NEVER deduct from daily allowance or break Gullak savings streaks.
  4. **Preserved in History:** Displayed exclusively in transaction logs and history feeds as an informational record.
- **Code Enforcement:** `src/lib/transactionUtils.ts` (`isExcludedFromTotals`, `isCountedExpense`, `isCountedIncome`)
- **Verified By:** `tests/selfTransfersAndIncome.test.ts`, `tests/moneyFixesFour.test.ts`

#### `TXN-004`: Reimbursements / Repayments Treatment
- **Status:** `APPROVED AS-IS` (Owner decision on 2026-10-17)
- **Canonical Definition:**
  To keep accounting completely friction-free and simple:
  1. **No Separate Reimbursement Class:** Transactions are strictly either `'expense'` or `'income'` (with internal `'self_transfer'`).
  2. **Friend Repayment as Income:** When a friend returns their share of a shared expense (or any refund arrives), it is recorded simply as **Income** (or Add Money).
  3. **Natural Lifetime Cashflow Settlement:** Lifetime net spending (`All-Time Spent − All-Time Income`) naturally settles without needing complex transaction-linking or proportional waterfall restoration.
  4. **Old Data:** Any row that still carries the retired `'reimbursement'` class is read as normal income.
- **Code Enforcement:** `src/lib/transactionUtils.ts` (`getTransactionClass`), `supabase/migrations/20261017_retire_shares_reimbursements.sql`
- **Verified By:** `tests/selfTransfersAndIncome.test.ts`

---

### Domain 2: WAT & BUD — Time-Ordered Money Waterfall & Rollover

#### `WAT-001`: Chronological Funding Priority Hierarchy
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Every transaction outflow is funded in strict, deterministic 3-tier chronological priority:
  1. **Tier 1 (Active Period Budget):** The active scheduled allowance for the current cadence (Daily allowance, Weekly budget pool, or Monthly budget pool).
  2. **Tier 2 (Available Income Pool):** If spending exceeds the active budget allowance (overspend), the deficit is absorbed by any chronologically available, unspent earned income (`incomeRemaining`).
  3. **Tier 3 (Gullak Reserve):** Only when BOTH the active budget allowance AND available income are fully exhausted does overspend draw down accumulated Gullak savings (`gullakDrawn`).
- **Code Enforcement:** `src/lib/moneyWaterfall.ts`
- **Verified By:** `tests/moneyWaterfall.test.ts`, `tests/moneyWaterfallStore.test.ts`

#### `BUD-003`: Real Money Invariant — Income Never Rolls to Gullak
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Unspent earned Income NEVER rolls into Gullak at midnight or period completion:
  1. **Gullak Origin:** Gullak savings are generated EXCLUSIVELY from unspent scheduled budget allowances (`saved = max(0, budget − spent)`).
  2. **Income Preservation:** Unspent income remains in the user's liquid Available Income pool permanently until spent or explicitly deposited by the user via manual deposit. Income never masquerades as budget savings.
- **Code Enforcement:** `src/lib/budgetCalculations.ts`
- **Verified By:** `tests/budgetCalculations.test.ts`, `tests/moneyWaterfall.test.ts`

#### `WAT-002`: Same-Day Chronological Ordering (Income First)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  On any calendar date containing both income and expenses, income transactions are evaluated BEFORE expense transactions. Any incoming funds received on day D are instantly available to absorb expenses incurred on day D, preventing artificial same-day Gullak deductions.
- **Code Enforcement:** `src/lib/moneyWaterfall.ts`
- **Verified By:** `tests/moneyWaterfall.test.ts`

#### `BUD-001`: Canonical Cycle Financial Engine (`calculateCycleFinancials`)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  The authoritative financial evaluation function across all cadences (Daily, Weekly, Monthly):
  1. **Total Spendable:** `Spendable = Scheduled Budget + Carried Over + Eligible Income`
  2. **Saved State (Spent < Spendable):** `Remaining = Spendable - Spent`. For daily budgets, `Gullak Deposit = Remaining`, and status is set to `'saved'`.
  3. **Overspent State (Spent > Spendable):** `Over Amount = Spent - Spendable`, `Remaining = 0`, and status is set to `'missed'`.
  4. **Even State (Spent === Spendable):** Status is set to `'even'`.
  5. **Unknown / Paused State (Spendable <= 0 and Spent <= 0):** Status is set to `'unknown'` with 0 savings and no streak penalty.
- **Code Enforcement:** `src/lib/budgetCalculations.ts`
- **Verified By:** `tests/budgetCalculations.test.ts`

#### `BAL-001`: Total Account Remaining Formula
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Represents the real liquid cash balance of the user:
  `Total Account Remaining = All-Time Inflow − All-Time Spent`
  - In BOTH modes (Budget Mode and Pure Mode): `Inflow = allowances (daily/weekly/monthly) + Total Income + External Deposits`. Pure Mode only changes the screen presentation, not the underlying money.
  - `Spent = Total Expenses`
- **Code Enforcement:** `src/store/dailyBudget/metrics.ts`
- **Verified By:** `tests/financialCorrectnessMatrix.test.ts`, `tests/pureModeRules.test.ts`

#### `BAL-002`: Available Income Balance
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  The real-time unspent earned income calculated chronologically by the money waterfall (`waterfall.incomeRemaining`). Reflects liquid salary/income still available after absorbing past budget overspends. Clamped to minimum 0.
- **Code Enforcement:** `src/store/dailyBudget/metrics.ts`
- **Verified By:** `tests/moneyWaterfall.test.ts`

---

### Domain 3: GUL — Gullak (Savings Reserve) & Real-Money Vault

#### `GUL-001`: Universal Savings Cap & Real-Money Vault
- **Status:** `APPROVED AS-IS` (Owner refined and approved on 2026-10-17)
- **Canonical Definition:**
  1. **Universal Upper Bound:** Gullak savings can NEVER exceed the user's Total Account Remaining (`All` filter balance).
     `Gullak = Minimum(Raw Accumulated Savings from Waterfall, Total Account Remaining)`
  2. **Sub-Vault Principle:** Gullak is an internal savings envelope within the user's total money. A sub-pocket cannot physically hold more cash than the user's entire account universe.
  3. **Natural Waterfall Deduction:** Overspending beyond active budget and income draws down Gullak naturally via chronological waterfall priority. No artificial zeroing hacks are required.
  4. **Automatic Deficit Protection:** If Total Account Remaining drops to 0 or deficit, Gullak balance naturally evaluates to 0.
- **Code Enforcement:** `src/store/dailyBudget/metrics.ts`
- **Verified By:** `tests/gullakReconciliationHardCap.test.ts`, `tests/gullakDeposits.test.ts`

#### `GUL-002`: Pure Mode Interface Exclusion
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  In Pure Mode, the Savings / Gullak feature does not exist in the user interface (4-tab layout). The Savings route redirects to Home, and no Gullak widgets or balances are displayed.

#### `GUL-004`: Gullak Deposit Sources (Income vs External)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Users can manually allocate money into Gullak via two distinct sources:
  1. **Source `'income'` (Transfer from Salary/Earned Income):** Decrements the Available Income pool and increments Gullak savings by equal amount. Total Account Remaining (`All` pill) is unchanged. Cannot exceed currently available income balance.
  2. **Source `'external'` (Fresh Outside Cash):** Fresh capital added to Gullak. Increments both Gullak savings AND Total Account Remaining (`All` pill).
- **Code Enforcement:** `src/store/dailyBudget/planActions.ts`
- **Verified By:** `tests/gullakDeposits.test.ts`

#### `GUL-008`: Automated Overspend Drawdown (No Manual Withdrawal)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Gullak does not provide a manual arbitrary "Withdrawal" action. Saved funds are unlocked automatically in real time whenever an expense exceeds both the active budget allowance and available income, acting as an automatic overdraft safety reserve.
- **Code Enforcement:** `src/lib/moneyWaterfall.ts`
- **Verified By:** `tests/moneyWaterfall.test.ts`

---

### Domain 4: BPR & CAR — Cadence Switching & The Universal Carry-Forward Law

> **SUPREMACY CLAUSE:** This specification was authored and approved by the repository owner on 2026-10-17. It is SUPREME and overrides any conflicting legacy provisions in ADR 0010, ADR 0011, or ADR 0012.

#### `BPR-001`: Supported Budget Cadences
- **Status:** `APPROVED AS-IS`
- **Canonical Definition:**
  Arthik supports exactly 3 budget cadences:
  1. **Daily:** Fixed daily allowance resetting every midnight.
  2. **Weekly:** Fixed weekly allowance starting Monday 00:00:00 and concluding Sunday 23:59:59.
  3. **Monthly:** Fixed monthly allowance starting on the 1st of the calendar month and concluding on the final day of the month at 23:59:59.

#### `BPR-002`: Tomorrow Effective Rule
- **Status:** `APPROVED AS-IS`
- **Canonical Definition:**
  All budget allowance modifications and cadence switch plans take effect starting **Tomorrow at 00:00:00** (`effectiveFrom = tomorrow`). The active calendar day concludes safely under the existing plan so historical day records, daily savings, and streak metrics are not disrupted mid-day.
  *(Exception: Enabling Budget Mode for the very first time from Pure Mode activates immediately on "Today").*

#### `CAR-001`: The Universal Carry-Forward Law (Supreme Owner Specification)
- **Status:** `APPROVED BY OWNER (SUPREME SPECIFICATION)` (2026-10-17)
- **Canonical Definition:**
  Whenever a user switches cadence mid-cycle with unspent funds $U$ remaining in their current budget pool (e.g. Weekly to Daily, Monthly to Daily, Monthly to Weekly, Weekly to Monthly):
  
  1. **Zero Gullak on Mid-Cycle Switch:**
     Unspent funds $U$ are NEVER dumped into Gullak on switch night (`gullakDeposit: 0`). They are carried forward into the new cadence plan.

  2. **Two Universal Carry Modes (Across ALL Switches):**
     - **Mode A (Additive Mode):**
       - Unspent funds $U$ are added on top of the new target budget.
       - A clear UI popup/banner informs the user that their unspent funds have been carried into their new pool.
     - **Mode B (Allocation / Headstart Mode — Funded Multi-Period Drawdown):**
       - Unspent funds $U$ are used to fund future periods day-by-day (or week-by-week) without requiring the user to deposit new money.
       - **Fully Funded Periods:** Each day/week, the budget is paid out of the carried balance $U$. The user deposits ₹0 fresh cash.
       - **Partial / Exhaustion Period:** On the day/week where carried funds are insufficient to cover the full target budget (e.g. Daily target is ₹500, but only ₹200 carry remains):
         - The remaining ₹200 carry funds part of the budget.
         - The user is required to deposit ONLY the gap (₹300).
       - **Completion:** Once carried funds reach ₹0, standard budgeting resumes normally.

  3. **The All-Pill Zero Double-Counting Guarantee (Real Money Invariant):**
     - Carried money $U$ was ALREADY counted in the user's Total Account Remaining (`All` filter balance) when the original budget period began.
     - During the carry drawdown (both Additive and Allocation), **the All-pill MUST NEVER increment for carry-funded amounts**.
     - Only the carry-FUNDED part of a budget is left out of the All-pill. The gap part of the budget on the partial day/week/month (e.g. the ₹300) counts like any budget does (exactly as every normal day, week or month adds its budget), real money the user adds grows it by exactly that amount, and once carry is exhausted standard budgeting resumes. Owner decision 2026-10-17.
     - The Home All-pill and the account total used by the spending guard, the Gullak cap and the Pure Mode deficit MUST always be the same number, including on gap periods and across any switch (`BAL-001`).

  4. **Crisp, Concise Notification Lifecycle:**
     - **During Drawdown:** On each funded day/week, a short, concise notification is sent (e.g. *"Today's ₹500 budget is funded from your carried balance. ₹1,500 remaining."*).
     - **On Partial Gap Day:** A concise prompt is sent (e.g. *"₹200 funded from carry. Add ₹300 to complete today's budget."*).
     - **Funding-Ended Notice:** On the FIRST day/week/month that carried money no longer funds the budget, ONE notification is sent (e.g. *"Carried money has run out. From today your ₹500 daily budget is no longer covered by carried money. Add ₹500 today to fund it."*). After that notice, no further carry notifications are sent (no fatigue). Switches that only add carry on top (Additive / next-day) have no such notice. Owner decision 2026-10-17.

  5. **Multi-Switch Cascading Invariant:**
     - A user may switch cadences multiple times within the same month (e.g. Monthly ➔ Weekly ➔ Daily).
     - Unspent carry cascades forward through each switch using `dailyCarryRemaining`, tracking exactly how much carried cash remains unused.
     - Switching back to a prior cadence in the same calendar period reuses the existing period pool and does not mint duplicate budget allocations.
- **Code Enforcement:** `src/lib/budgetPeriods.ts` (`dailyCarryForDate`, `dailyCarryRemaining`, `periodCarryForPeriod`, `periodCarryRemaining`), `src/lib/homeCalculations.ts`, `src/store/dailyBudget/metrics.ts`, `src/lib/notificationPolicy.ts` (`carryEndCopy`), `src/lib/notificationSync.ts` (`buildCarryEnds`), `src/lib/cadenceSwitch.ts`
- **Verified By:** `tests/cadenceFixes.test.ts`, `tests/carryAllocationWeeklyMonthly.test.ts`

---

### Domain: DAT & RND — Dates, Timezones & Monetary Precision

#### `RND-001`: Monetary Precision Standard (`round2`)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  All currency calculations, balances, budget allocations, remaining funds, and Gullak savings must strictly be rounded to 2 decimal places using `round2(n) = Math.round(n * 100) / 100`. Floating-point inaccuracies (e.g. `0.1 + 0.2 === 0.30000000000000004`) are forbidden from persisting in state or database.
- **Code Enforcement:** `src/lib/formatters.ts` (`round2`)
- **Verified By:** Full test suite (`npm test`)

#### `DAT-001` & `DAT-004`: Canonical Date Format & Local Timezone "Today"
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. **ISO Date Format:** All dates across stores, components, and database rows are strictly represented as `yyyy-MM-dd` strings.
  2. **Strict Parsing:** Parsing must use `date-fns parseISO`, never unparsed `new Date('...')` constructors.
  3. **Local "Today":** "Today" is strictly determined by the user's device local timezone (`format(new Date(), 'yyyy-MM-dd')`), preventing UTC rollover shifts from prematurely rolling over daily budgets before local midnight.
- **Code Enforcement:** Global standard across `src/lib/` and `src/store/`

#### `DAT-003`: Monday Week Boundary (`weekStartsOn: 1`)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Calendar weeks strictly start on **Monday** at 00:00:00 and conclude on **Sunday** at 23:59:59. For Weekly Budget cadences, the budget pool runs from Monday through Sunday, and rollover occurs at Sunday midnight.
- **Code Enforcement:** `src/lib/dateFilters.ts`, `src/lib/homeCalculations.ts`

---

### Domain: REF — No Splits, No Shares, No Debt Tracking

#### `REF-001`: Arthik Is Simple Personal Cashflow
- **Status:** `APPROVED AS-IS` (Owner decision on 2026-10-17)
- **Canonical Definition:**
  Arthik does not have a Split Expenses / Shares feature. There is no friend directory, no share allocation, no outstanding-debt tracking, no repayment matching and no reimbursement class. An expense is recorded at its full amount; money that comes back (a friend's share, a refund) is recorded as Income (`TXN-004`). AutoLog never asks "is this a friend's share?".
- **Database:** the `expense_shares` table and `expenses.reimburses_share_id` column are retired and unused by the app (kept in the database, no data deleted).

---

### Domain 5: ROL & HEA — Midnight Rollover, Finalization & Self-Healing (Tier 5)

#### `ROL-001`: Scheduled Next-Day Budget Activation
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  When a user edits their daily budget mid-day, the change is scheduled for the next calendar day (`scheduledNextDailyBudget`). Upon local midnight rollover (as soon as date advances past `scheduledBudgetSetDate`), the scheduled amount automatically activates as the live `dailyBudgetAmount`.
- **Code Enforcement:** `src/store/dailyBudget/rollover.ts` (`applyScheduledNextDayBudget`)
- **Verified By:** `tests/dailyBudgetRollover.test.ts`

#### `ROL-002`: Daily Record Finalization Idempotency
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  During midnight rollover, past unfinalized calendar days are evaluated against confirmed expenses, marked `isFinalized: true`, and locked. A finalized record is immutable unless the user explicitly navigates to a past date to add, edit, or delete a transaction, which re-evaluates only that specific day's status and savings.
- **Code Enforcement:** `src/store/dailyBudget/rollover.ts` (`finalizeDailyRecords`)
- **Verified By:** `tests/dailyBudgetRollover.test.ts`

#### `ROL-003`: Multi-Cadence Period Finalization
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Weekly and Monthly budget pools are evaluated upon period conclusion (Sunday midnight for weekly, month-end midnight for monthly). Final spending, unspent savings, and status are calculated and persisted to Supabase `budget_periods` table.
- **Code Enforcement:** `src/store/dailyBudget/rollover.ts` (`finalizePeriods`)
- **Verified By:** `tests/dailyBudgetRollover.test.ts`

#### `HEA-001`: Legacy Default ₹500 Self-Healing
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  To correct historical profiles impacted by a legacy migration default of ₹500, the hydration engine analyzes past confirmed savings logs: `true_budget = amount_saved + spent`. If historical records demonstrate a consistent non-500 budget (e.g. ₹200 or ₹250), the profile's `daily_budget` is automatically healed to the user's true intended allowance.
- **Code Enforcement:** `src/store/dailyBudget/selfHealing.ts` (`selfHealDefaultBudget`)
- **Verified By:** `tests/dailyBudgetHydrate.test.ts`

#### `HEA-002`: Multi-Cadence Daily Record Self-Healing
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Calendar days governed by Weekly, Monthly, or Pure Mode plans must NEVER generate daily budget allowances or daily savings records. If historical bugs generated erroneous daily rows for weekly/monthly days, the self-healing engine automatically resets them to `status = 'unknown'`, `budget = 0`, and `saved = 0` with `forceOverwrite: true` to permanently prevent duplicate Gullak savings.
- **Code Enforcement:** `src/store/dailyBudget/selfHealing.ts` (`selfHealCorruptedRows`)
- **Verified By:** `tests/cadenceFixes.test.ts`

#### `BUD-008`: One Status Vocabulary (`'missed'`)
- **Status:** `APPROVED AS-IS` (Owner decision on 2026-10-17)
- **Canonical Definition:**
  1. **Unified Status Enum:** The single status string for an overspent / unsuccessful budget period across ALL layers (Database, Stores, UI, Insights, Calendar) is `'saved' | 'missed' | 'even' | 'unknown'`. There is no `'exceeded'` status and no translation layer.
  2. **In-Progress Marker:** `'active'` marks only today's still-running daily record. It is never saved to the database and never appears in history.
  3. **Old Cache:** A day cached on a device by an older version as `'exceeded'` is read as `'missed'`.
  4. **Not a Status:** The notification alert kind `exceeded` (limit-exceeded alert) is an alert type, not a budget status, and is unchanged.
- **Database Schema Guarantee:** `schema.sql` CHECK constraint: `CHECK (status IN ('saved', 'missed', 'even', 'unknown'))`.
- **Code Enforcement:** `src/lib/budgetCalculations.ts` (`calculateCycleFinancials`), `src/store/dailyBudget/legacyStatus.ts`
- **Verified By:** `tests/canonicalStatusAndGuard.test.ts`, `tests/budgetCalculations.test.ts`

---

### Domain 6: INS — Insights Analytics & Intelligence Engine (Tier 6)

#### `INS-001`: Safe Daily Spending Pace (Weekly & Monthly Breathing Strip)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  The breathing strip across Weekly and Monthly Insights dynamically computes the safe spending cushion per remaining day:
  1. **Weekly Safe Daily Pace:** `Math.round(remainingWeeklyBudget / Math.max(1, remainingDaysThroughSunday))`
  2. **Monthly Safe Daily Pace:** `Math.round(remainingMonthlyBudget / Math.max(1, remainingDaysInMonth))`
  3. **Display:** Rendered on both `WeeklyBreathingStrip` and `MonthlyBreathingStrip` as:
     *"Safe daily spending pace: ₹X per day with Y days remaining."*
- **Code Enforcement:** `src/lib/weeklyInsightsUtils.ts`, `src/lib/monthlyInsightsUtils.ts`

#### `INS-002`: Auto-Saved to Gullak Metrics (Weekly & Monthly Savings Cards)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  Both Weekly and Monthly Insights calculate and present exact savings performance:
  1. **Auto-Saved Sum:** Aggregates `amount_saved` across all finalized daily records where `status === 'saved'` in the interval.
  2. **Manual Deposits:** Sums all manual Gullak deposits made within the interval.
  3. **Saved Days Count:** Tallies the exact number of days on which budget savings occurred (`savedDaysCount`).
  4. **Display:** Presented on Weekly and Monthly Insights as total saved to Gullak and days saved count.
- **Code Enforcement:** `src/lib/weeklyInsightsUtils.ts` (`computeWeeklyGullakSavings`), `src/lib/monthlyInsightsUtils.ts` (`computeMonthlyGullakSavings`)

#### `INS-003`: Fair Day-Matched Comparisons (MTD & YTD)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  When comparing current period spending against the previous period (e.g. Month-to-Date or Year-to-Date), the calculation strictly compares against the **identical elapsed day range** of the previous period (e.g. Oct 1–17 compared against Sep 1–17, not full 30 days of Sep). This prevents deceptive negative pacing percentages for mid-period evaluation.
- **Code Enforcement:** `src/lib/monthlyInsightsUtils.ts`, `src/lib/yearlyInsightsUtils.ts`

#### `INS-004`: Mid-Period Registration Proration
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  For users who registered mid-week or mid-month, effective budget pacing is prorated to active registered days:
  `Effective Budget = (Target Budget / Total Days) * Active Registered Days`
  Prevents false deficit or artificially skewed pacing warnings for new users.
- **Code Enforcement:** `src/lib/weeklyInsightsUtils.ts`, `src/lib/monthlyInsightsUtils.ts`

#### `INS-005`: Outflow Outliers, Category Shifts & Peak Patterns
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. **Major Single Outflow:** Monthly insights flags any individual transaction consuming $\ge 30\%$ of total monthly expenditure.
  2. **Weekday vs Weekend:** Weekly insights breaks down Mon–Fri vs Sat–Sun outflow percentages and identifies the Peak Spending Day.
  3. **Capital Outliers:** Yearly insights detects major annual anomalies ($\ge ₹500$ and $\ge 5\%$ of annual spend).
  4. **Category Trajectory:** Highlights the primary driver category with the largest percentage spend increase over the previous period.
- **Code Enforcement:** `src/lib/monthlyInsightsUtils.ts`, `src/lib/weeklyInsightsUtils.ts`, `src/lib/yearlyInsightsUtils.ts`

#### `INS-006`: Annual Macro Cashflow & Discipline Score
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. **Savings Rate:** `(Net Savings / Total Inflow) * 100` (percentage of real incoming funds retained).
  2. **Daily Burn Velocity:** `Total Annual Outflow / Active Registered Days in Year` (real average daily expenditure rate).
  3. **Consistency Score:** Ratio of completed calendar months concluded within budget.
- **Code Enforcement:** `src/lib/yearlyInsightsUtils.ts`

---

### Domain 7: NOT & SEC — Notifications & Digital Vault Spending Guard

#### `SEC-001`: Digital Vault Spending Guard (Budget Mode Solvency Protection)
- **Status:** `APPROVED AS-IS` (Owner amended on 2026-10-17)
- **Canonical Definition:**
  1. **Budget Mode Solvency Guard:** In Budget Mode, a user cannot spend money they do not possess. If total account liquidity $\le 0$, new expense creation is blocked and `VaultSpendingGuardModal` is displayed (*"Account balance exhausted. Please add money first."*, `VAULT_GUARD_MESSAGE`).
  2. **Pure Mode Exemption:** Pure Mode never blocks spending and allows the user to spend into negative balance (`canAddExpense: true`, no guard sheet, AutoLog `isExceedingVaultLiquidity` returns `false`).
  3. **Overspending Allowance in Budget Mode:** Spending beyond the active daily/weekly allowance is permitted as long as total account liquidity (allowances, income, or Gullak reserve) remains positive.
- **Code Enforcement:** `src/lib/vaultSpendingGuard.ts`, `src/features/autoLog/ledger.ts`
- **Verified By:** `tests/vaultSpendingGuard.test.ts`, `tests/canonicalStatusAndGuard.test.ts`, `tests/pureModeRules.test.ts`

#### `NOT-001`: Multi-Tier Notification Architecture & Fatigue Protection
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. **Rollover Savings Alert:** Sent once per day during morning boot, ONLY if the user actually saved money yesterday (`saved > 0`). If yesterday resulted in an overspend or zero savings, no nag alert is dispatched.
  2. **Critical Alerts (Uncapped by Rollover Frequency):** Critical operational notifications are permitted when triggered:
     - Real-time Budget Exceeded alert (dispatched once per day upon exceeding daily allowance).
     - Cadence Carry Funding notification (drawdown alert informing user that today's budget is funded from carry).
     - Cadence Carry Gap prompt (alert informing user of remaining partial carry and required top-up).
  3. **Funding-Ended Notice + Cutoff:** While an allocation carry funds the budget, one short funding message is sent per funded day/week/month. On the first unfunded day/week/month ONE "carried money has run out, add the money yourself" notice is sent (`carry_end_<date>`); then carry notifications permanently stop.
- **Code Enforcement:** `src/lib/budgetCalculations.ts`, `src/lib/budgetAlerts.ts`, `src/store/dailyBudget/rollover.ts`

---

### Domain 8: AUT — Automatic Logging Architecture & Financial Privacy

> **Reference Note:** Auto Logging is an extensive on-device subsystem governed by its own authoritative specification document: [`docs/AUTO_LOGGING.md`](AUTO_LOGGING.md). All granular native Kotlin implementations, regex parsing grammars, review inbox states, and deep event queue lifecycles are maintained there. Below is the canonical high-level architecture and financial privacy contract.

#### `AUT-001`: Data Sources & Signal Hygiene
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. **Dual Bank Sources:** AutoLog ingests financial transactions exclusively from:
     - **Bank Transaction SMS:** Native Android `SmsReceiver`. A first privacy gate (`FinancialFilter.kt`) runs natively BEFORE anything reaches JS: messages from personal phone-number senders, OTP messages and messages with no money mention or transaction wording are dropped and never stored.
     - **Bank Transaction Emails:** Notifications of supported email apps (Gmail, Outlook, Samsung Email, Yahoo Mail, Proton Mail, Spark, Zoho Mail), only when the user turned email detection on. Login / OTP / security emails are dropped.
  2. **Payment App Notification Drop:** Notifications from payment apps (Google Pay, PhonePe, Paytm, etc.) are never read; the native listener only handles the supported email apps. Only definitive settlement signals from actual banking institutions are processed to eliminate double-logging and notification chatter.
- **Reference:** [`docs/AUTO_LOGGING.md#data-sources`](AUTO_LOGGING.md)

#### `AUT-002`: Three Operational Modes (Discovery, Recovery, Live)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. **Discovery Mode:** Runs on initial onboarding to scan SMS history, detect bank accounts, and establish the user's starting financial profile.
  2. **Recovery Mode:** Runs on app launch or network reconnection to backfill any transactions missed while the device was offline, low on battery, or the headless task was suspended by Android OS.
  3. **Live Mode:** Real-time event queue listening for incoming bank SMS and transactional emails.
- **Reference:** [`docs/AUTO_LOGGING.md#operational-modes`](AUTO_LOGGING.md)

#### `AUT-003`: Duplicate Elimination & Matching Engine
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  AutoLog never creates double-spending against something already logged:
  1. **Same Reference:** the same bank reference / UTR and direction is the same payment, however late the second signal arrives (up to 30 days).
  2. **Identity Score (no reference):** two signals from DIFFERENT sources are the same payment only when amount and direction match, the accounts and merchants do not contradict, and enough independent details agree (same account, same merchant, same day, within 30 minutes). Amount + direction + time alone is never enough: it stays "weak" and goes to review instead of merging silently.
  3. **Same-Source Protection:** two events from the same source are never fuzzy-merged (two real ₹20 payments stay two).
  4. **Own-Account Transfers:** a debit and a credit of the same amount between the user's tracked accounts within minutes are offered as a possible transfer (`TXN-003`); nothing is deleted unless the user says yes.
  5. **Manual Priority:** if the user already entered the same transaction by hand, the detection is sent to the user as a possible duplicate; it never silently adds a second row.
- **Reference:** [`docs/AUTO_LOGGING.md#matching-engine`](AUTO_LOGGING.md), `src/features/autoLog/matching.ts`
- **Verified By:** `tests/part2Consistency.test.ts`, `tests/autoLogFlows.test.ts`

#### `AUT-004`: Financial Privacy & SQLCipher On-Device Storage
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. **Zero-Knowledge Cloud Architecture:** Raw SMS messages, raw email bodies, and unparsed text are NEVER uploaded to Supabase or any remote server.
  2. **Local SQLCipher Database:** All raw drafts, parser logs, and detected accounts reside strictly on-device in a local SQLite database encrypted with SQLCipher (`expo-sqlite`).
  3. **Hardware Keystore:** The database encryption key is randomly generated on first boot and secured in Android Keystore via `expo-secure-store`.
  4. **User Review Sovereignty:** Only after an expense is parsed and accepted (or auto-approved under strict high-confidence rules) does the clean, finalized transaction record sync to Supabase.
- **Reference:** [`docs/AUTO_LOGGING.md#privacy-and-security`](AUTO_LOGGING.md)

---

### Domain 9: CAT — Category Taxonomy, Deletion Integrity & Fallbacks

#### `CAT-001`: Default System Categories Seeding
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. Upon new user registration, the Supabase database trigger `handle_new_user()` automatically seeds 7 canonical default categories for the user profile:
     - Food & Drinks
     - Shopping
     - Transport
     - Bills & Utilities
     - Entertainment
     - Health
     - Others
  2. Seeded categories are immediately available offline and during first-time onboarding.
- **Code Enforcement:** `schema.sql`, `src/store/categoryStore.ts`

#### `CAT-002`: Category Deletion Protection (Application Level)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. A category cannot be deleted if active transactions are associated with it (`categoryExpenseCounts > 0`).
  2. The application UI blocks deletion and prompts the user to reassign or delete the associated transactions first.
- **Code Enforcement:** `src/screens/ManageCategoriesScreen.tsx`, `src/store/categoryStore.ts`

#### `CAT-003`: Foreign Key Deletion Integrity (Database Level)
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. If a category is ever removed at the database layer (e.g. administrative cleanup), associated transaction rows are preserved.
  2. The foreign key constraint enforces `ON DELETE SET NULL`: the transaction's `category_id` is set to `NULL` while the amount, date, payment method, and description remain intact.
  3. Real money, total spent, and cashflow calculations are NEVER compromised or deleted by category changes.
- **Code Enforcement:** `schema.sql`

---

### Domain 10: UX — Payment Methods & Form Financial Guardrails

#### `UX-001`: Canonical Payment Methods
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. Every transaction must specify exactly one valid payment mode (stored in the `payment_mode` field):
     - `cash` (Physical currency)
     - `upi` (Digital UPI transfer / QR payment)
     - `card` (Debit or Credit card)
  2. Enforced at both the database schema level (`CHECK (payment_mode IN ('cash', 'upi', 'card'))`) and form input level.
- **Code Enforcement:** `schema.sql`, `src/screens/ExpenseFormScreen.tsx`

#### `UX-002`: Payment Method Filtering for Income
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. When creating an Income transaction (`type === 'income'`), the `card` payment option is suppressed in the UI.
  2. Income is received via bank transfer (`upi` / net banking) or physical cash (`cash`). Cards are purely outbound payment instruments in Arthik.
- **Code Enforcement:** `src/screens/ExpenseFormScreen.tsx`

#### `UX-003`: Strict Positive Non-Zero Amount Constraint
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  1. Every financial transaction entered into Arthik must represent real value: `amount > 0`.
  2. Zero (`₹0`) or negative amounts are rejected at keypad entry, form validation, and database schema constraint.
- **Code Enforcement:** `schema.sql`, `src/lib/amountKeypad.ts`, `src/screens/ExpenseFormScreen.tsx`

---

### Domain 11: PUR — Pure Mode Lifecycle & Rebalancing

#### `PUR-001`: Pure → Budget Mode Switch Deficit Auto-Balance
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  When turning Budget Mode ON (`isBudgetModeEnabled` becomes `true`):
  1. Compute account remaining `R = computeTotalAccountRemaining(st, expenses)`.
  2. If `R >= 0`, do nothing (no auto-income, no notification).
  3. If `R < 0`, calculate deficit $D = \text{round2}(-R)$ ($D > 0$).
  4. Automatically create ONE real income transaction with amount $D$, note `Auto-balance (Pure Mode deficit)`, category `null`, payment mode `'upi'`, class `'normal'`.
  5. Backdate the transaction by scanning counted expenses in reverse chronological order summing Gullak drawn (`fromGullak`); set date to the earliest expense date where cumulative draw $\ge D$ (defaulting to today if not reached), ensuring same-day income precedence (`WAT-002`) absorbs the deficit.
  6. Post one inbox notification (`type: 'pure_deficit_balanced'`) with title *"Pure Mode deficit balanced"* and stable ID `pure_deficit_${dateStr}_${D}`.
  7. Invariant: Total Income never decreases. Repeat Pure Mode cycles only balance the new incremental deficit.
  8. Display Guardrail: The auto-balance income is excluded from `periodIncome` on Home budget summary chips, but fully counted in all-time total income, inflows, and the waterfall.
- **Code Enforcement:** `src/store/dailyBudget/planActions.ts`, `src/lib/homeCalculations.ts`, `src/lib/transactionUtils.ts` (`PURE_DEFICIT_NOTE`)
- **Verified By:** `tests/pureModeRules.test.ts`

#### `PUR-002`: Pure Mode Ended-Pool Leftover Retention
- **Status:** `APPROVED AS-IS` (Owner approved on 2026-10-17)
- **Canonical Definition:**
  When a weekly or monthly budget pool ends while the user is in Pure Mode (`endsInPure === true`):
  1. **Not Converted to Income:** Unspent pool money NEVER becomes unallocated income (`incomeAvail` / `incomeRestored` are untouched). No `pure_end_*` notification is sent.
  2. **Waterfall Leftover Bucket:** Unspent funds are captured as `pureLeftover` (`pureLeftoverAdded`).
  3. **Pure Day Spend Priority:** On Pure Mode days, spending draws from `pureLeftover` FIRST before unallocated income or Gullak (`fromLeftover = min(overspend, leftoverAvail)`).
  4. **Gullak Conversion on Resume:** When Budget Mode is turned back ON, remaining unspent `pureLeftover` flows directly into Gullak (`totalAccumulatedSavings`). While in Pure Mode, Gullak displays 0.
  5. **Remaining Stability:** Account remaining (`computeTotalAccountRemaining`) is completely unchanged by period endings in Pure Mode.
- **Code Enforcement:** `src/lib/moneyWaterfall.ts`, `src/store/dailyBudget/metrics.ts`, `src/store/dailyBudget/rollover.ts`
- **Verified By:** `tests/pureModeRules.test.ts`, `tests/cadenceFixes.test.ts`

---

## 3. Canonical Architecture & Audit Summary

With the owner's final approvals on 2026-10-17, this document represents the **single source of truth** for all business and financial logic across Arthik.

### Key Architectural Decisions Finalized:
1. **Real-Money Invariant:** Every rupee in Arthik is real money. Past allowances, unspent balances, and cashflow remain immutable.
2. **No Splits (`REF`):** There is no split expense or debt tracking. Repayments and refunds are recorded as standard Income.
3. **Status Unification:** The codebase and database use one vocabulary: `'saved' | 'missed' | 'even' | 'unknown'` (plus the never-saved in-progress marker `'active'`).
4. **Universal Carry-Forward Law:** Carry-over unspent money never double-counts in all-time inflow. Mode A adds to spendable target; Mode B funds days with ₹0 fresh cash needed from user.
5. **AutoLog Privacy:** Dual bank sources (SMS + Email), payment app notifications dropped, zero-knowledge encrypted on-device SQLite database (SQLCipher) with hardware Keystore. Granular specs in [`docs/AUTO_LOGGING.md`](AUTO_LOGGING.md).
