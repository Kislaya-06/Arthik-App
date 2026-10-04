# 06: Carry-Forward Engine & Deficit Isolation in cadenceSwitch.ts

**What to build:**
Enforce exact carry-forward mechanics in `src/lib/cadenceSwitch.ts`:
- `calculateCadenceCarryForward()`:
  - In `additive` mode: `effectiveBudgetPool = round2(targetBudget + unspentAmount)`.
  - In `allocation` mode: `effectiveBudgetPool = targetBudget` with `allocatedHeadstart = Math.min(targetBudget, unspentAmount)`.
  - In deficit state (`unspentAmount <= 0`): `carriedAmount = 0`, `effectiveBudgetPool = targetBudget`. Deficits do NOT carry forward.
- `checkCadenceCapacity()`: verifies target weekly/daily budget does not exceed remaining capacity when moving from larger to smaller cadence.

**Blocked by:** 05-cadence-switching-next-day.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/lib/cadenceSwitch.ts`
- `tests/cadenceSwitch.test.ts`

**Acceptance Criteria:**
- [ ] Additive mode sums target and unspent funds with 2 decimal precision.
- [ ] Allocation mode keeps target budget whole with headstart.
- [ ] Overspent condition (`spent > budget`) strictly produces `carriedAmount = 0`.
- [ ] `checkCadenceCapacity` flags over-capacity with correct `maxSafeWeeklyAmount`.

**Edge Cases:**
- Negative unspent amount (-₹1,000) must return `carriedAmount = 0`, never negative debt.
- Zero unspent amount returns `carriedAmount = 0`.

**Independent Verification:**
- Run `npm test tests/cadenceSwitch.test.ts`.
