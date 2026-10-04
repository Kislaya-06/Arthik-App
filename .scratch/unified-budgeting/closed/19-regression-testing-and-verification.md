# 19: Full Test Suite Regression Verification & TypeScript Compilation

**What to build:**
Run full repository regression checks across all 34 test files:
- Run `npm test` across the entire repo (all 577+ tests).
- Run `npx tsc --noEmit` across `src/` and `tests/`.
- Verify light and dark themes for modified modals.
- Verify zero regression in offline startup path and optimistic write queues.

**Blocked by:** All previous tickets (16, 17, 18).

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- Entire repository

**Acceptance Criteria:**
- [ ] `npm test` passes with 0 failures across all test files.
- [ ] `npx tsc --noEmit` produces 0 errors.
- [ ] No regression in startup hydration sequence (`App.tsx`).

**Independent Verification:**
- Execute `npm test && npx tsc --noEmit`.
