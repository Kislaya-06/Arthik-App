# 03: Calculation Engine - Eliminate Proration Scaling & Enforce Full-Pool Math

**What to build:**
Refactor `src/lib/budgetPeriods.ts` to strictly enforce the Zero-Proration Policy:
- Remove header comments referencing `prorated budgets (D4): budget = round2(fullBudget * activeDays / totalDaysInPeriod)`.
- In `getCurrentPeriodSummary()`: Ensure `budget` strictly equals `fullAmount` (+ `carriedOverAmount` if `carryMode === 'additive'`).
- In `buildPeriodsToFinalize()`: Ensure `budgetAmount` strictly equals `baseBudget` (+ `carriedOver` if `carryMode === 'additive'`). `isProrated` is hardcoded to `false`.
- Ensure all monetary values pass through `round2()` to prevent floating-point drift.

**Blocked by:** 01-domain-data-model.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/lib/budgetPeriods.ts`

**Acceptance Criteria:**
- [ ] No mathematical division of `budgetAmount` by total days multiplied by active days exists in `budgetPeriods.ts`.
- [ ] `getCurrentPeriodSummary` returns full user budget amount on mid-period start.
- [ ] `buildPeriodsToFinalize` produces `isProrated: false` for all finalized slices.

**Edge Cases:**
- Mid-period start on Friday (3 days left): budget must remain full ₹7,000, not ₹3,000.
- Switch mid-cycle with carry-forward: additive adds to full target budget; allocation leaves target budget whole.

**Independent Verification:**
- Run `npm test tests/budgetPeriods.test.ts` and verify calculations.
