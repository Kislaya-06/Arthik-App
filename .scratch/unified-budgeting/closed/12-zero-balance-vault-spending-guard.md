# 12: Zero-Balance Digital Vault Spending Guard on ExpenseFormScreen

**What to build:**
In `src/screens/ExpenseFormScreen.tsx` and `src/hooks/useExpenseForm.ts`:
- Implement the Vault Spending Guard: calculate total available liquid funds (`totalVaultLiquidity`).
- In Budget Mode: `totalVaultLiquidity = activeAllowance + availableIncome + externalGullakDeposits`.
- In Pure Mode: `totalVaultLiquidity = totalIncome - totalExpenses`.
- If `transactionType === 'expense'` and `totalVaultLiquidity <= 0`:
  - Block submission when tapping "Save".
  - Open a dedicated Bottom Sheet: *"No Funds Available in Your Vault. Please log an Income or deposit funds first to start spending."*
  - Provide 1-tap `+ Add Income First` action (switches form toggle to 'income').
- Overspending past a daily limit when user has available income/reserves remains permitted.

**Blocked by:** 11-home-screen-calculations-alignment.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/hooks/useExpenseForm.ts`
- `src/screens/ExpenseFormScreen.tsx`

**Acceptance Criteria:**
- [ ] User with ₹0 balance cannot add an expense.
- [ ] Vault Guard Bottom Sheet appears with informative copy and `+ Add Income First` CTA.
- [ ] Adding an income unblocks expense creation immediately.
- [ ] User with active budget > 0 or income > 0 can add expenses normally.

**Edge Cases:**
- User enters expense of ₹500 when available balance is ₹200: expense allowed (overspending covered by reserve/deficit waterfall). Only strict ₹0 total liquidity is blocked.

**Independent Verification:**
- Add unit test verifying `canAddExpense` guard logic.
