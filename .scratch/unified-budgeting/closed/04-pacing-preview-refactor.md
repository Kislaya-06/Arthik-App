# 04: Refactor Pacing Preview in budgetModeUtils.ts

**What to build:**
Refactor `src/lib/budgetModeUtils.ts`:
- Refactor `getProrationPreview()` to `getUnproratedPacingPreview()` (or alias with deprecation).
- Update return object to ensure `isProrated: false` and `previewText` reads `"Full ₹X budget active for remaining Y days"`.
- Ensure explanation clearly distinguishes non-binding pace from hard limit: `"Your full ₹X [weekly/monthly] budget is 100% active. Suggested daily pace: ~₹Y/day (non-binding)."`
- Update all callers in modals and tests.

**Blocked by:** 03-calculation-engine-zero-proration.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `src/lib/budgetModeUtils.ts`
- `tests/budgetModeUtils.test.ts`

**Acceptance Criteria:**
- [ ] Returns `isProrated: false` and `proratedAmount: amount`.
- [ ] Returns singular "1 day" when 1 day remains; plural "X days" otherwise.
- [ ] Unit tests in `tests/budgetModeUtils.test.ts` pass 100%.

**Edge Cases:**
- 0 amount or daily cadence returns `null`.
- Starting on boundary day (e.g. Monday for weekly, 1st for monthly) returns `null` (since full standard cycle applies).

**Independent Verification:**
- Run `npm test tests/budgetModeUtils.test.ts`.
