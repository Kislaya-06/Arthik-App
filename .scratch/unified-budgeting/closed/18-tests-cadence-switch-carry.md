# 18: Cadence Switch & Carry-Forward Unit Tests

**What to build:**
Update and expand `tests/cadenceSwitch.test.ts`:
- Verify Additive carry mode sums target budget and unspent funds.
- Verify Allocation carry mode counts unspent funds as headstart.
- Verify deficit state (`spent > budget`) produces exactly `carriedAmount = 0`.
- Verify `checkCadenceCapacity()` accurately warns and calculates safe weekly amounts.
- Verify next-day activation logic (`computeEffectiveFrom`).

**Blocked by:** 05-cadence-switching-next-day.md, 06-carry-forward-engine.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `tests/cadenceSwitch.test.ts`

**Acceptance Criteria:**
- [ ] 100% of test cases in `tests/cadenceSwitch.test.ts` pass cleanly.

**Independent Verification:**
- Run `npm test tests/cadenceSwitch.test.ts`.
