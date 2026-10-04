# 07: Gullak - Natural Cycle Rollover vs Zero-Deposit on Mid-Cycle Switch

**What to build:**
Enforce the Gullak Rollover Invariant in `src/store/dailyBudgetStore.ts` (`checkAndRollover`) and `src/lib/budgetPeriods.ts` (`buildPeriodsToFinalize`):
- Natural cycle completion (Daily at 23:59:59, Weekly Sunday at 23:59:59, Monthly month-end midnight):
  `amountSaved = Math.max(0, budgetAmount - spentAmount)`.
- Premature termination due to cadence switch:
  `amountSaved = 0` (strictly 0 Gullak deposit).
  Unspent amount assigned to `carriedOverAmount`.

**Blocked by:** 06-carry-forward-engine.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/lib/budgetPeriods.ts`
- `src/store/dailyBudgetStore.ts`

**Acceptance Criteria:**
- [ ] Natural period finalization deposits 100% of unspent funds into Gullak reserve.
- [ ] Cadence switch slice finalization records `amountSaved: 0` in `budget_periods`.
- [ ] Rollover device notification triggers ONLY on natural cycle completion.

**Edge Cases:**
- Mid-week switch on Thursday: Sunday night weekly rollover does NOT fire; Thursday slice finalizes with `amountSaved: 0`.

**Independent Verification:**
- Run `npm test tests/budgetPeriods.test.ts`.
