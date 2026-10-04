# 16: Vault Spending Guard Unit Tests

**What to build:**
Create dedicated test file `tests/vaultSpendingGuard.test.ts`:
- Test that total available liquidity is 0 when no income and no budget configured.
- Test that expense creation is blocked when available liquidity <= 0.
- Test that positive income unblocks expense creation.
- Test that active budget allowance unblocks expense creation.
- Test that overspending against daily budget is allowed when total income/reserves > 0.

**Blocked by:** 12-zero-balance-vault-spending-guard.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `tests/vaultSpendingGuard.test.ts` (new)

**Acceptance Criteria:**
- [ ] 100% of test cases in `tests/vaultSpendingGuard.test.ts` pass cleanly.
- [ ] Edge cases (floating point near zero, ₹0.01 balance) verified.

**Independent Verification:**
- Run `npm test tests/vaultSpendingGuard.test.ts`.
