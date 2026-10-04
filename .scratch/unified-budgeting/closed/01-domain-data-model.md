# 01: Domain & Data Model Types for Zero-Proration & Vault Guard

**What to build:**
Update domain TypeScript interfaces in `src/types/index.ts` to reflect the approved budgeting architecture:
- Lock `isProrated` to `false` in `BudgetPeriodRecord`.
- Add `totalVaultLiquidity` and `canAddExpense` types for the Zero-Balance Vault Guard.
- Formalize `UnproratedPacingInfo` type replacing legacy proration preview types.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/types/index.ts`

**Acceptance Criteria:**
- [ ] `BudgetPeriodRecord` interface has `isProrated: boolean` (with JSDoc documenting zero-proration invariant).
- [ ] `UnproratedPacingInfo` type exported with fields `remainingDays`, `totalDays`, `fullBudget`, `suggestedDailyPace`, `previewText`, `explanationText`.
- [ ] `npx tsc --noEmit` passes with zero type errors.

**Edge Cases:**
- Existing records in AsyncStorage with legacy `isProrated: true` must be read safely without runtime crashes.

**Independent Verification:**
- Run `npx tsc --noEmit` and check that all type definitions are exported and consumed without regression.
