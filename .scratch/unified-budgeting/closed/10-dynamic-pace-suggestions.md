# 10: Dynamic Daily/Weekly Pacing Suggestions & Monthly Projections

**What to build:**
In `src/lib/budgetPeriods.ts` (`getCurrentPeriodSummary`):
- Compute `suggestedDailyPace = Math.round(remaining / remainingDays)` for Weekly and Monthly cadences.
- In Monthly mode: compute `suggestedWeeklyPace = Math.round((remaining / remainingDays) * 7)`.
- In Weekly mode: compute `projectedMonthlyBudget = Math.round((budget / 7) * daysInCurrentMonth)`.
- Verify pacing values update live as expenses are logged without mutating actual budget limits.

**Blocked by:** 08-budget-cycle-lifecycle.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/lib/budgetPeriods.ts`
- `tests/budgetPeriods.test.ts`

**Acceptance Criteria:**
- [ ] `suggestedDailyPace` updates dynamically on every expense.
- [ ] In Monthly mode, `suggestedWeeklyPace` accurately projects 7-day average.
- [ ] In Weekly mode, `projectedMonthlyBudget` factors in exact calendar month length (28–31 days).

**Edge Cases:**
- `remainingDays = 1` (last day of cycle): `suggestedDailyPace` equals remaining balance.
- Over-budget condition (`remaining = 0`): `suggestedDailyPace = 0`.

**Independent Verification:**
- Run `npm test tests/budgetPeriods.test.ts`.
