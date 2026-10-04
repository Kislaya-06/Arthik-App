# 05: Cadence Switching - Next-Day Activation & State Governance

**What to build:**
Ensure `setBudgetCadence()` in `src/store/dailyBudgetStore.ts`:
- Enforces `computeEffectiveFrom('cadence_switch', todayStr)` to activate tomorrow at 00:00:00.
- Today continues under the active cadence until 23:59:59.
- Exception: First-time enabling from 'paused' activates immediately on today (`computeEffectiveFrom('enable', todayStr)`).
- Saves pending plan change offline to `@arthik_pending_plan_changes_${userId}` and syncs to Supabase `budget_plan_changes`.

**Blocked by:** 03-calculation-engine-zero-proration.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/store/dailyBudgetStore.ts`
- `src/lib/budgetPeriods.ts`

**Acceptance Criteria:**
- [ ] Cadence switch generates plan change with `effectiveFrom === tomorrowStr`.
- [ ] Today's date owner remains the previous cadence until midnight passes.
- [ ] Pending change is cancelable prior to midnight via `cancelPendingPlanChange()`.

**Edge Cases:**
- User switches cadence multiple times on the same day: `upsertPendingChange` replaces existing future change with latest one (at most 1 pending change allowed).

**Independent Verification:**
- Run `npm test tests/dailyBudgetStore.test.ts`.
