# 11: Home Screen Calculations & Active Cadence Defaulting

**What to build:**
In `src/lib/homeCalculations.ts` & `src/screens/HomeScreen.tsx`:
- Ensure `HomeScreen` automatically aligns initial `activeFilter` to the user's active cadence (`Daily` -> Daily, `Weekly` -> Weekly, `Monthly` -> Monthly) on mount/hydration.
- When viewing a non-active filter pill (e.g. `Monthly` pill while on `Weekly` cadence), show clear contextual explanation: `"Estimated pace based on your ₹X/week budget · Not an actual spend"`.
- Ensure Inflow/Outflow calculations in Pure Mode properly respect the Real-Money Invariant.

**Blocked by:** 10-dynamic-pace-suggestions.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/lib/homeCalculations.ts`
- `src/screens/HomeScreen.tsx`
- `src/components/BrandedHeroCard.tsx`

**Acceptance Criteria:**
- [ ] Weekly user opening app lands on Weekly view by default.
- [ ] Clicking Daily or Monthly pill displays contextual explanation without altering active budget cadence.
- [ ] Hero Card displays clear distinction between live allowance and total vault balance.

**Edge Cases:**
- User toggles Budget Mode OFF (Pure Mode): app switches to 4-tab layout and defaults to Inflow/Outflow view.

**Independent Verification:**
- Run `npm test tests/homeCalculations.test.ts`.
