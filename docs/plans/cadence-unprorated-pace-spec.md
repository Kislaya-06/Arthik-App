# Specification: Unprorated Real-Money Cadence Engine, Dynamic Pace Guidance & Period Renewal

## Problem Statement

Users of Arthik currently experience several usability and financial model frictions:
1. **Optical Vibration on Allowance Card**: The over-budget alerts (`EXCEEDED BY`, amount, status dot, and deduction hints) using dark red `#EF4444` on a deep violet-purple card background cause severe chromatic aberration (retinal vibration and harsh contrast clash), making overspending information visually jarring yet difficult to scan.
2. **Artificial Proration Violating the Real-Money Invariant**: When setting or joining a budget mid-period (e.g. setting a ₹30,000 monthly budget on the 15th of the month), the current engine prorates the budget down mathematically (`amount * remainingDays / totalDays`). Slicing real money arbitrarily feels artificial and confiscatory, directly conflicting with Arthik's foundational principle: every rupee tracked is real money.
3. **Rigid Daily Spending Constraints for Period Budgets**: Users choosing a Weekly (e.g. ₹7,000/week) or Monthly (e.g. ₹30,000/month) cadence expect total-period spending flexibility across days (e.g. spending ₹500 on Monday, ₹2,000 on Tuesday). Currently, the system lacks dynamic, non-binding pace suggestions, leading users to believe they are bound to a strict daily ceiling.
4. **Mismatched Default Tab on Home**: When a Weekly or Monthly user launches the app, the Home screen defaults to the "Daily" tab instead of their chosen active cadence, requiring manual tab switching on every launch.
5. **Inaccurate Calendar-Month Projections**: Projections for Weekly users fail to dynamically factor in true calendar month lengths (28, 29, 30, or 31 days), assuming a naive 28-day (4-week) cycle and omitting the remaining 2 to 3 days.
6. **Lack of Period Transition Experience**: When a weekly or monthly period concludes, users lack a clear, premium celebration of unspent rollover into Gullak and an interactive prompt to renew or adjust their upcoming period's budget.

---

## Solution

1. **Luminous Warm Coral Over-Budget Styling**:
   Replace `#EF4444` on the Allowance Card with a high-luminance, eye-catching Warm Coral (`#FF7A6E` / `#FF8A80`). This provides striking 5.5:1+ contrast against the violet gradient, immediately drawing user attention to overspending without retinal vibration.
2. **Elimination of Proration (Full Real-Money Pools)**:
   Remove all mathematical proration. When a user selects a budget (e.g. ₹30,000/month or ₹7,000/week), the entire budget pool is 100% active and available from day one, regardless of joining date.
3. **Dynamic, Non-Binding Pace Suggestions**:
   - **Daily Tab for Weekly/Monthly Users**: Hero card displays today's actual spending alongside a dynamically recalculated daily spending pace suggestion:
     $$\text{Daily Pace Suggestion} = \frac{\text{Remaining Period Budget}}{\text{Remaining Days in Period}}$$
     Accompanied by a concise disclaimer: *"Suggested daily pace to stay within your ₹X [weekly/monthly] budget (non-binding)."*
   - **Weekly Tab for Monthly Users**: Displays the suggested weekly pace to finish the month on target.
   - **Monthly Tab for Weekly Users**: Displays the projected full-calendar-month spend calculated dynamically using the exact number of days in the active month:
     $$\text{Monthly Projected Budget} = \frac{\text{Weekly Budget}}{7} \times \text{Days In Current Month}$$
     Accurately including the remaining 2–3 days beyond 4 weeks.
4. **Cadence-Default Home Screen Tab**:
   The Home screen automatically detects the user's active cadence on mount and sets the default filter accordingly (`Daily` $\to$ Daily, `Weekly` $\to$ Weekly, `Monthly` $\to$ Monthly).
5. **Adaptive Allowance Card on Savings**:
   The Allowance Card on `SavingsScreen` dynamically adapts title and dates to the active cadence (*"Weekly Allowance (29 Sep – 5 Oct)"* or *"Monthly Allowance (October 2026)"*).
6. **Unified Premium Period Renewal Sheet**:
   At the start of a new week (Monday 12:00 AM) or new month (1st of month 12:00 AM), a premium bottom sheet appears for Weekly and Monthly users:
   - **If Auto-Renew is ON**: Celebrates unspent rollover into Gullak and confirms renewed budget pool with 1-tap *"Keep ₹X"* and *"Change Budget"* buttons.
   - **If Auto-Renew is OFF**: Prompts the user to set/confirm their budget for the new period with pre-filled previous budget or custom keypad entry.

---

## User Stories

1. As a budget-conscious user overspending my allowance, I want the over-budget alerts on the violet card to be styled in luminous warm coral, so that my eyes immediately register the alert without strain or optical clashing.
2. As a user joining mid-month with a ₹30,000 budget, I want my full ₹30,000 to be allocated to my spending pool, so that none of my real money is artificially reduced by proration algorithms.
3. As a weekly budget user, I want the flexibility to spend variably each day (e.g. ₹500 on Monday, ₹2,000 on Tuesday), so that I am not restricted by an artificial daily ceiling.
4. As a weekly budget user viewing the Daily tab on Home, I want to see my actual spend for today compared to a suggested daily pace, so that I know what pace to maintain to finish the week comfortably.
5. As a weekly budget user viewing the Daily tab, I want the daily pace to clearly state that it is a non-binding suggestion, so that I do not mistake it for a hard daily limit.
6. As a weekly budget user who spends more on a given day, I want the app to dynamically recalculate the suggested daily pace for the remaining days of the week, so that my guidance is always live and accurate.
7. As a weekly budget user viewing the Monthly tab, I want to see an accurate calendar-month spending projection based on 28, 29, 30, or 31 days (including the extra 2–3 days), so that I understand my monthly financial run-rate.
8. As a monthly budget user, I want to see my full monthly balance on the Monthly tab, so that I have complete clarity on my all-month spending headroom.
9. As a monthly budget user viewing the Weekly tab, I want to see a suggested weekly pace, so that I can break down my monthly target into manageable weekly milestones.
10. As a monthly budget user viewing the Daily tab, I want to see today's spend alongside a suggested daily pace, so that I have daily orientation without daily rigidity.
11. As a user with an active Weekly cadence, I want the Home screen to automatically open to the Weekly tab when I launch the app, so that I instantly see my primary financial metrics.
12. As a user with an active Monthly cadence, I want the Home screen to automatically open to the Monthly tab when I launch the app, so that my primary cadence is front and center.
13. As a user with an active Daily cadence, I want the Home screen to continue defaulting to the Daily tab, so that my daily habit loop remains uninterrupted.
14. As a weekly or monthly user visiting the Savings screen, I want the Allowance Card to reflect my active cadence ("Weekly Allowance" or "Monthly Allowance"), so that the card matches my mental model.
15. As a weekly user finishing Sunday night with unspent funds, I want the remaining weekly balance to roll over into my Gullak at midnight, so that my discipline grows my lifetime savings.
16. As a monthly user finishing the month with unspent funds, I want the remaining monthly balance to roll over into my Gullak on the last night of the month, so that my unspent funds are permanently safeguarded.
17. As a weekly or monthly user with Auto-Renew ON opening the app on a new period, I want a premium bottom sheet celebrating my rollover savings and confirming my renewed budget, so that I feel motivated and informed.
18. As a weekly or monthly user with Auto-Renew OFF opening the app on a new period, I want a premium bottom sheet prompting me to set my budget for the new period, so that I can set an intentional spending plan.
19. As a user reviewing the period renewal sheet, I want the design language to feature elegant linework and frosted glass instead of a generic boxy modal, so that it matches Arthik's premium aesthetic.
20. As a daily budget user, I do not want to see the weekly/monthly renewal bottom sheet, so that my daily midnight rollover remains seamless and unprompted.

---

## Implementation Decisions

### 1. Color System Update
- **Tokens**: In `src/screens/SavingsScreen.tsx`, replace over-budget references (`#EF4444`) with high-luminance Warm Coral:
  - `OVER_BUDGET_CORAL = '#FF7A6E'` (primary text & amounts, 65% luminance)
  - `OVER_BUDGET_CORAL_DOT = '#FF6B5E'` (vibrant alert dot)
  - Contrast against `#8B5CF6` / `#581C87`: exceeds 4.8:1 WCAG AA standards with zero chromatic vibration.

### 2. Elimination of Proration Engine
- **Module**: `src/lib/budgetPeriods.ts` and `src/lib/budgetModeUtils.ts`
- **Decision**: In `getCurrentPeriodSummary` and `buildPeriodsToFinalize`:
  - Set `budget = plan.amount` (full unprorated budget pool).
  - Deprecate mathematical proration scaling (`amount * activeDays / totalDays`).
  - Mark `isProrated: false` everywhere. The user's capital pool is real, whole, and unfragmented.

### 3. Dynamic Non-Binding Pace Suggestion Engine
- **Module**: `src/lib/budgetPeriods.ts` & `src/lib/homeCalculations.ts`
- **Data Shapes**:
  ```ts
  export interface PaceSuggestion {
    suggestedDailyAmount: number;
    suggestedWeeklyAmount?: number;
    remainingDays: number;
    totalDays: number;
    disclaimer: string;
  }
  ```
- **Formulas**:
  - `remainingDays = Math.max(1, differenceInCalendarDays(periodEnd, today) + 1)`
  - `remainingBudget = Math.max(0, periodBudget - periodSpent)`
  - `suggestedDailyPace = Math.round(remainingBudget / remainingDays)`
  - In Monthly mode: `suggestedWeeklyPace = Math.round((remainingBudget / remainingDays) * 7)`
- **Monthly Projection for Weekly Users**:
  - `daysInMonth = getDaysInMonth(currentDate)`
  - `projectedMonthly = Math.round((weeklyBudget / 7) * daysInMonth)` (accurately counting 28, 29, 30, or 31 days).

### 4. Cadence-Default Home Tab
- **Module**: `src/screens/HomeScreen.tsx`
- **Decision**: Initialize `activeFilter` dynamically from `useDailyBudgetStore.getState().budgetCadence`:
  - `'daily'` $\to$ `'Daily'`
  - `'weekly'` $\to$ `'Weekly'`
  - `'monthly'` $\to$ `'Monthly'`
  - Fallback to `'Daily'` if Budget Mode is disabled.

### 5. Adaptive Allowance Card on SavingsScreen
- **Module**: `src/screens/SavingsScreen.tsx`
- **Decision**:
  - Title: `'Daily Allowance'` vs `'Weekly Allowance'` vs `'Monthly Allowance'`.
  - Date subtitle: Formatted active period date bounds (`'EEEE, d MMM'` for daily; `'d MMM – d MMM'` for weekly; `'MMMM yyyy'` for monthly).
  - Progress bar: Displays period spent vs full period budget. Over-budget triggers full-width coral bar.
  - Auto-save hint: Displays rollover timing according to active cadence.

### 6. Unified Period Renewal Bottom Sheet (`PeriodRenewalModal.tsx`)
- **Module**: `src/components/PeriodRenewalModal.tsx`
- **State**: Tracked in `dailyBudgetStore.ts` via `@arthik_last_renewed_period_<userId>`.
- **Triggers**: When `currentDate` enters a new period slice and `budgetCadence !== 'daily'`:
  - If `isAutoRenew === true`: Sheet renders with Gullak rollover celebration, renewed amount badge, *"Keep ₹X"* primary CTA, and *"Change Budget"* secondary link.
  - If `isAutoRenew === false`: Sheet renders with *"Set your budget for this [week/month]"*, pre-filled previous budget, and tactile numeric input.

---

## Testing Decisions & Seams

### Test Seam 1: Period Math & Unprorated Pool Integrity (`tests/budgetPeriods.test.ts`)
- **Focus**: Verify that `getCurrentPeriodSummary` always returns `budget === plan.amount` (never fractional proration), regardless of what calendar day the plan is initialized or evaluated.
- **Pace Calculations**: Verify that `suggestedDailyPace` accurately divides remaining pool across remaining days, and recalculates when expenditure increases.
- **Monthly Projection**: Verify that a ₹7,000/week budget projects to ₹31,000 in October (31 days), ₹30,000 in November (30 days), and ₹28,000 in February (28 days).

### Test Seam 2: Gullak Rollover & Auto-Renew Lifecycle (`tests/dailyBudgetStore.test.ts` & `tests/gullakDeposits.test.ts`)
- **Focus**: Verify that period-end finalization deposits full unspent balance to Gullak at Sunday midnight for Weekly, and month-end midnight for Monthly.
- **Overspending Protection**: Verify that period overspending is covered by Income buffer first before Gullak.

### Test Seam 3: UI Formatters & Cadence Presentation (`tests/budgetModeUtils.test.ts`)
- **Focus**: Verify that date labels, allowance headers, and pace suggestion text render cleanly without paragraph clutter.

---

## Out of Scope

1. **Mid-Cycle Cadence Switching Logic**: Deferred to the subsequent implementation phase as instructed in Voice Note 9.
2. **Pure Mode Financial Engine**: Pure Mode cashflow calculations remain untouched.
3. **Daily Renewal Pop-ups**: Daily cadence continues to renew silently at midnight without modal interruptions.

---

## Further Notes
- All changes are 100% TypeScript strict and respect existing design tokens.
- No native module additions; changes deploy seamlessly via live-reload and OTA updates.
