# 09: Budget Renewal & Auto-Renew Transition Logic

**What to build:**
Ensure `src/store/dailyBudgetStore.ts`:
- When `isAutoRenew === true`: cycle completion finalizes past period, credits Gullak, and launches new cycle with identical budget amount automatically.
- When `isAutoRenew === false`: cycle completion finalizes past period, credits Gullak, but leaves new cycle at `budgetAmount = 0` (paused) until user sets a new budget.
- Persist `lastRenewedPeriodKey` to prevent re-triggering renewal sheets or notifications on app re-open.

**Blocked by:** 08-budget-cycle-lifecycle.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/store/dailyBudgetStore.ts`
- `src/screens/HomeScreen.tsx`

**Acceptance Criteria:**
- [ ] Auto-renew ON automatically carries same budget into new week/month.
- [ ] Auto-renew OFF leaves new week/month at ₹0 budget.
- [ ] `lastRenewedPeriodKey` ensures celebration sheet triggers strictly once per period.

**Edge Cases:**
- Offline cycle transition: checks and transitions safely without network connection upon local date change.

**Independent Verification:**
- Run `npm test tests/dailyBudgetStore.test.ts`.
