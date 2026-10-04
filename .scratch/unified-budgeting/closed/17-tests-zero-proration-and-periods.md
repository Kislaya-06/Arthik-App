# 17: Zero-Proration & Budget Period Unit Tests

**What to build:**
Update and expand `tests/budgetPeriods.test.ts` and `tests/budgetModeUtils.test.ts`:
- Verify mid-period starts (Friday start for weekly, 16th start for monthly) receive full unprorated budget pool.
- Verify `isProrated` is false everywhere.
- Verify `suggestedDailyPace` correctly calculates non-binding pace.
- Verify natural cycle completions record `amountSaved = budget - spent`.
- Verify premature switches record `amountSaved = 0`.

**Blocked by:** 03-calculation-engine-zero-proration.md, 04-pacing-preview-refactor.md, 07-gullak-natural-cycle-rollover.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `tests/budgetPeriods.test.ts`
- `tests/budgetModeUtils.test.ts`

**Acceptance Criteria:**
- [ ] All tests in `tests/budgetPeriods.test.ts` and `tests/budgetModeUtils.test.ts` pass with zero failures.

**Independent Verification:**
- Run `npm test tests/budgetPeriods.test.ts tests/budgetModeUtils.test.ts`.
