# 14: Period Renewal Celebration & Cadence Switch Bottom Sheet Updates

**What to build:**
In `src/components/PeriodRenewalModal.tsx` and `src/components/CadenceSwitchModal.tsx`:
- In `PeriodRenewalModal.tsx`:
  - Show exact ₹ saved into Gullak from the completed period.
  - Provide 1-tap `Continue with ₹X` and `Change Budget for This Week`.
- In `CadenceSwitchModal.tsx`:
  - Clearly display Zero Gullak Deposit reassurance banner: `"🔒 Zero Gullak Deposit: Gullak deposits only happen on natural cycle ends. Your unspent money carries forward 100% safely."`
  - Show Additive (Default) vs Allocation radio cards with exact rupee math.
  - Over-capacity warning with safe weekly recommendation pill when applicable.

**Blocked by:** 06-carry-forward-engine.md, 07-gullak-natural-cycle-rollover.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/components/PeriodRenewalModal.tsx`
- `src/components/CadenceSwitchModal.tsx`

**Acceptance Criteria:**
- [ ] Renewal sheet clearly celebrates unspent rollover with Gullak theme (`#ADEBB3`, `PiggyBankCoinIcon`).
- [ ] Cadence switch sheet clearly explains next-day activation and zero Gullak deposit.
- [ ] Safe budget pill automatically applies safe amount on tap.

**Edge Cases:**
- Overspent period when opening CadenceSwitchModal displays Clean Slate notice (zero carry-forward debt).

**Independent Verification:**
- Verify component rendering and callback triggers.
