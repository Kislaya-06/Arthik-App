# 13: Same-Cadence Budget Edit Confirmation & Timing Dialog

**What to build:**
In `src/components/BudgetEditModal.tsx`:
- When user modifies Weekly budget amount while already on Weekly cadence:
  - Display Confirmation Dialog explaining: *"Your new budget of ₹X will take effect next Monday at 12:00 AM. Your current ₹Y budget stays active until Sunday."*
- When user modifies Monthly budget amount while already on Monthly cadence:
  - Display Confirmation Dialog explaining: *"Your new budget of ₹X will take effect on the 1st of next month. Your current budget stays active until then."*
- Clean up legacy proration styles and replace with `pacingCard` styling and Zero-Proration copy.

**Blocked by:** 04-pacing-preview-refactor.md, 11-home-screen-calculations-alignment.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/components/BudgetEditModal.tsx`

**Acceptance Criteria:**
- [ ] Changing weekly budget mid-week triggers confirmation dialog with exact Monday date.
- [ ] Changing monthly budget mid-month triggers confirmation dialog with exact 1st of month date.
- [ ] No mention of "Prorated Allowance" appears in the modal.

**Edge Cases:**
- Editing daily budget continues to show next-day 12:00 AM confirmation.

**Independent Verification:**
- Manual UI test of BudgetEditModal amount changes.
