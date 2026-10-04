# 15: Past Expense Deletion Ripple Preview Dialog

**What to build:**
In `src/screens/ExpenseDetailScreen.tsx`:
- When user taps "Delete Expense" on a transaction whose `expense_date < today`:
  - Show a confirmation dialog informing user of downstream savings impact:
    `"Deleting this ₹X expense on [Date] will return ₹X to that day's budget and add ₹X into your Gullak savings."`
  - Button: `Delete & Update Savings` (destructive style)
  - Secondary: `Cancel`

**Blocked by:** 07-gullak-natural-cycle-rollover.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/screens/ExpenseDetailScreen.tsx`

**Acceptance Criteria:**
- [ ] Deleting today's expense uses standard confirmation.
- [ ] Deleting past expense explicitly describes the Gullak savings refund.
- [ ] Deleting past expense self-heals past day status and updates Gullak total.

**Edge Cases:**
- Deleting an income transaction notes that available income balance will decrease.

**Independent Verification:**
- Test deletion flow on past transaction and verify Gullak balance update.
