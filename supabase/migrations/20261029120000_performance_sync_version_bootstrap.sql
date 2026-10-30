-- Arthik — Performance: indexes, expense change-version probe, one-call budget bootstrap (OPT-65, OPT-67, OPT-68, OPT-69).
-- Approved by owner 29 Oct 2026. Run ONCE in Supabase → SQL Editor (or MCP). Safe to re-run.
--
-- What this does (NO stored value, NO money row and NO policy on an existing table is changed):
--   Part A  Indexes. An index never changes what a query returns, only how fast it is found.
--   Part B  expense_sync_versions: one small counter per user that goes up on every insert / update / delete of
--           that user's expenses (trigger). The app asks "has the number changed?" and, when it has not, reuses
--           the expense list it already downloaded in this session instead of downloading every row again.
--   Part C  arthik_budget_bootstrap(): profile + savings log + plan changes + budget periods in ONE request,
--           returned as one JSON value, so the 1000-row API cap can never cut a list short.
--           arthik_gullak_deposits(): the same for Gullak deposits.
--   Every function is SECURITY INVOKER (runs as the signed-in user), so Row Level Security still decides
--   what is visible, exactly as the direct table queries do today. Only the trigger helpers are SECURITY
--   DEFINER, because they write a counter the user cannot write directly.
--
-- Old app versions keep working: they never call the new functions and every table they use is unchanged.
-- New app versions keep working BEFORE this file is run: every new call falls back to the old query.

-- ═══ Part A: Indexes (OPT-65) ═══════════════════════════════════════════════════════════════════════════════

-- A1. The expense list query sorts by (expense_date DESC, created_at DESC, id DESC) for one user.
--     The old index only covered (user_id, expense_date DESC), so Postgres had to sort the rest by hand.
--     DESC columns are NULLS FIRST, the same as ORDER BY ... DESC in the query.
CREATE INDEX IF NOT EXISTS idx_expenses_user_date_created_id
    ON public.expenses (user_id, expense_date DESC, created_at DESC, id DESC);
-- The new index starts with the same two columns, so the old one is now pure write cost.
DROP INDEX IF EXISTS public.idx_expenses_user_date;

-- A2. expenses.transfer_rule_id is a foreign key with ON DELETE SET NULL. Without an index, deleting one
--     self-transfer rule scans the whole expenses table. Partial: only rows that use a rule are indexed.
CREATE INDEX IF NOT EXISTS idx_expenses_transfer_rule_id
    ON public.expenses (transfer_rule_id) WHERE transfer_rule_id IS NOT NULL;

-- A3. The app never filters expenses by these columns on the server (it reads the whole list once and
--     works on the phone). They only slowed down every insert and update.
DROP INDEX IF EXISTS public.idx_expenses_split_person;
DROP INDEX IF EXISTS public.idx_expenses_recovery;
DROP INDEX IF EXISTS public.idx_expenses_transaction_class;
-- Kept on purpose: idx_expenses_category (FK category_id ON DELETE SET NULL),
-- idx_expenses_reimburses_share_id (FK, used when an old expense_shares row is cascade-deleted).

-- A4. budget_periods is read ordered by active_start; the old index was on period_start (never queried).
CREATE INDEX IF NOT EXISTS idx_budget_periods_user_active_start
    ON public.budget_periods (user_id, active_start);
DROP INDEX IF EXISTS public.idx_budget_periods_user_start;

-- A5. budget_plan_changes already has UNIQUE (user_id, effective_from), which serves every read in both
--     directions. idx_budget_plan_changes_user_effective is an exact duplicate of it.
DROP INDEX IF EXISTS public.idx_budget_plan_changes_user_effective;

-- A6. gullak_deposits is read ordered by created_at DESC for one user.
CREATE INDEX IF NOT EXISTS idx_gullak_deposits_user_created
    ON public.gullak_deposits (user_id, created_at DESC);

-- ═══ Part B: Expense change version (OPT-69) ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.expense_sync_versions (
    -- No foreign key on purpose: the delete trigger below may run while the user's account is being
    -- deleted, and a foreign key would then block the account deletion.
    user_id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expense_sync_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_sync_versions_select_own" ON public.expense_sync_versions;
CREATE POLICY "expense_sync_versions_select_own" ON public.expense_sync_versions
    FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
-- No insert / update / delete policy: only the trigger (SECURITY DEFINER) writes this table.

CREATE OR REPLACE FUNCTION public.arthik_bump_expense_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        INSERT INTO public.expense_sync_versions AS v (user_id, version, updated_at)
        VALUES (NEW.user_id, 1, NOW())
        ON CONFLICT (user_id) DO UPDATE SET version = v.version + 1, updated_at = NOW();
    END IF;

    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
        -- Skip when the account itself is being deleted (nothing will ever read the counter again).
        IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
            INSERT INTO public.expense_sync_versions AS v (user_id, version, updated_at)
            VALUES (OLD.user_id, 1, NOW())
            ON CONFLICT (user_id) DO UPDATE SET version = v.version + 1, updated_at = NOW();
        END IF;
    END IF;

    RETURN NULL; -- AFTER trigger: the return value is ignored
END;
$$;

REVOKE ALL ON FUNCTION public.arthik_bump_expense_version() FROM PUBLIC;

-- Fires for every write path, including ON DELETE SET NULL from a deleted category or transfer rule
-- (Postgres runs row triggers for foreign-key actions too).
DROP TRIGGER IF EXISTS arthik_expenses_bump_version ON public.expenses;
CREATE TRIGGER arthik_expenses_bump_version
    AFTER INSERT OR UPDATE OR DELETE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.arthik_bump_expense_version();

-- Remove the counter row when an account is deleted (the edge function deletes auth.users; everything
-- else cascades). Errors are swallowed on purpose: a leftover counter must never block an account deletion.
CREATE OR REPLACE FUNCTION public.arthik_cleanup_expense_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    BEGIN
        DELETE FROM public.expense_sync_versions WHERE user_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.arthik_cleanup_expense_version() FROM PUBLIC;

DROP TRIGGER IF EXISTS arthik_on_auth_user_deleted_cleanup ON auth.users;
CREATE TRIGGER arthik_on_auth_user_deleted_cleanup
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.arthik_cleanup_expense_version();

-- The probe the app calls. 0 = no expense write since this file was run.
CREATE OR REPLACE FUNCTION public.arthik_expenses_version(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT v.version FROM public.expense_sync_versions v WHERE v.user_id = p_user_id),
        0
    )::BIGINT;
$$;

REVOKE ALL ON FUNCTION public.arthik_expenses_version(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arthik_expenses_version(UUID) TO authenticated;

-- ═══ Part C: One-call reads (OPT-67, OPT-68) ═════════════════════════════════════════════════════════════
-- Same columns, same order and the same JSON values as the direct queries in
-- src/store/dailyBudget/hydrate.ts (PostgREST also builds its JSON with to_json).

CREATE OR REPLACE FUNCTION public.arthik_budget_bootstrap(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT json_build_object(
        'profile', (
            SELECT json_build_object(
                'daily_budget', p.daily_budget,
                'is_auto_renew', p.is_auto_renew,
                'is_budget_mode_enabled', p.is_budget_mode_enabled,
                'budget_cadence', p.budget_cadence,
                'weekly_budget', p.weekly_budget,
                'monthly_budget', p.monthly_budget
            )
            FROM public.profiles p
            WHERE p.id = p_user_id
        ),
        'logs', COALESCE((
            SELECT json_agg(json_build_object(
                'date', l.date,
                'amount_saved', l.amount_saved,
                'spent_amount', l.spent_amount,
                'status', l.status,
                'budget_amount', l.budget_amount
            ) ORDER BY l.date ASC)
            FROM public.daily_savings_log l
            WHERE l.user_id = p_user_id
        ), '[]'::json),
        'plans', COALESCE((
            SELECT json_agg(json_build_object(
                'id', c.id,
                'effective_from', c.effective_from,
                'is_enabled', c.is_enabled,
                'cadence', c.cadence,
                'amount', c.amount,
                'carry_mode', c.carry_mode,
                'carried_over_amount', c.carried_over_amount,
                'created_at', c.created_at
            ) ORDER BY c.effective_from ASC)
            FROM public.budget_plan_changes c
            WHERE c.user_id = p_user_id
        ), '[]'::json),
        'periods', COALESCE((
            SELECT json_agg(json_build_object(
                'id', b.id,
                'cadence', b.cadence,
                'period_start', b.period_start,
                'period_end', b.period_end,
                'active_start', b.active_start,
                'active_end', b.active_end,
                'budget_amount', b.budget_amount,
                'spent_amount', b.spent_amount,
                'amount_saved', b.amount_saved,
                'status', b.status,
                'is_prorated', b.is_prorated,
                'carry_mode', b.carry_mode,
                'carried_over_amount', b.carried_over_amount,
                'created_at', b.created_at
            ) ORDER BY b.active_start ASC)
            FROM public.budget_periods b
            WHERE b.user_id = p_user_id
        ), '[]'::json)
    );
$$;

REVOKE ALL ON FUNCTION public.arthik_budget_bootstrap(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arthik_budget_bootstrap(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.arthik_gullak_deposits(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COALESCE((
        SELECT json_agg(json_build_object(
            'id', g.id,
            'amount', g.amount,
            'date', g.date,
            'note', g.note,
            'source', g.source,
            'created_at', g.created_at
        ) ORDER BY g.created_at DESC)
        FROM public.gullak_deposits g
        WHERE g.user_id = p_user_id
    ), '[]'::json);
$$;

REVOKE ALL ON FUNCTION public.arthik_gullak_deposits(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arthik_gullak_deposits(UUID) TO authenticated;

-- Refresh planner statistics for the tables whose indexes changed.
ANALYZE public.expenses;
ANALYZE public.budget_periods;
ANALYZE public.budget_plan_changes;
ANALYZE public.gullak_deposits;

-- Tell PostgREST about the new functions right away (otherwise it can take a moment).
NOTIFY pgrst, 'reload schema';
