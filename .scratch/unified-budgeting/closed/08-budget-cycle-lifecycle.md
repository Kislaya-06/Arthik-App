# 08: Budget Cycle Lifecycle - Slicing & Boundary Walking

**What to build:**
Ensure `src/lib/budgetPeriods.ts` (`getPeriodBounds`, `buildPeriodsToFinalize`):
- Weekly cycle bounds are strictly Monday 00:00:00 to Sunday 23:59:59 (`weekStartsOn: 1`).
- Monthly cycle bounds are strictly 1st of month 00:00:00 to last day of month 23:59:59 (calculating exact days: 28, 29, 30, or 31).
- Walking interval starts from the earliest active change or user account creation date (`userCreatedAtStr`).

**Blocked by:** 07-gullak-natural-cycle-rollover.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/lib/budgetPeriods.ts`

**Acceptance Criteria:**
- [ ] Weekly periods consistently bound Monday–Sunday.
- [ ] Leap years (February 29) handled seamlessly via `getDaysInMonth`.
- [ ] No pre-registration slices created before `userCreatedAtStr`.

**Edge Cases:**
- User joins on Thursday: initial cycle runs Thu–Sun (4 days); bounds show start Monday, active start Thursday. Full budget is active.

**Independent Verification:**
- Run `npm test tests/budgetPeriods.test.ts`.
