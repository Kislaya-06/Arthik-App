# 02: Database Schema & Migration Verification for Budget Periods

**What to build:**
Verify and update `schema.sql` to ensure database tables `budget_plan_changes` and `budget_periods` strictly match the finalized business rules:
- `is_prorated` default is `FALSE` with comments reflecting zero-proration.
- Verify `unique_user_effective_from` on `budget_plan_changes` and `unique_user_cadence_active_start` on `budget_periods`.
- Ensure RLS policies allow authenticated users to select/insert/update/delete their own plan changes and periods.

**Blocked by:** 01-domain-data-model.md

**Status:** ready-for-agent

**Files/Modules Likely Affected:**
- `schema.sql`

**Acceptance Criteria:**
- [ ] `schema.sql` contains exact DDL for `budget_plan_changes` and `budget_periods`.
- [ ] Unique constraints prevent duplicate periods for the same cadence and active_start.
- [ ] RLS policies scoped to `auth.uid() = user_id`.

**Edge Cases:**
- Existing databases migrating forward must not fail if `budget_periods` or columns already exist (use `IF NOT EXISTS` and `DROP CONSTRAINT IF EXISTS`).

**Independent Verification:**
- Syntax-check SQL block and verify idempotent execution order.
