-- Arthik - Sign-up name safety (SEC-04) + expense change counter for OPT-69.
-- Written 16 Nov 2026. Run ONCE in Supabase -> SQL Editor (or MCP apply_migration). Safe to run again.
--
-- What this does (NO stored value, NO money row, NO policy on an existing table and NO index is changed):
--   Part 1  handle_new_user(): the name taken from the sign-up data is trimmed and cut to 50 characters, and a blank
--           name falls through to the next source. Before, a Google account whose name was longer than 50 characters,
--           or blank, hit the profile name rule and the whole sign-up failed ("Database error saving new user").
--           Everything else in the function (profile row, first plan row, default categories) is word for word the same.
--   Part 2  expense_sync_versions: one small counter per user that goes up on every insert / update / delete of that
--           user's expenses (trigger), and arthik_expenses_version() to read it. The app (OPT-69) asks "has the number
--           changed?" and skips downloading the expense list when it has not.
--           This is exactly Part B of 20261030145341_performance_sync_version_bootstrap.sql. If that file was already
--           run, Part 2 changes nothing (CREATE ... IF NOT EXISTS / CREATE OR REPLACE with the same text).
--
-- Old app versions keep working: they never call the new function and every table they use is unchanged.
-- The app keeps working BEFORE this file is run: OPT-69 falls back to a full download.

-- === Part 1: Sign-up name safety (SEC-04) ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_profile_id UUID;
    extracted_name TEXT;
BEGIN
    -- First non-blank of: first_name, full_name, name, the part of the email before "@".
    -- Trimmed and cut to 50 characters so profiles_first_name_len can never refuse a sign-up.
    extracted_name := btrim(left(COALESCE(
        NULLIF(btrim(new.raw_user_meta_data->>'first_name'), ''),
        NULLIF(btrim(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(btrim(new.raw_user_meta_data->>'name'), ''),
        NULLIF(btrim(split_part(new.email, '@', 1)), '')
    ), 50));

    INSERT INTO public.profiles (
        id, 
        first_name, 
        last_name, 
        email, 
        daily_budget, 
        is_auto_renew,
        is_budget_mode_enabled,
        budget_cadence,
        weekly_budget,
        monthly_budget
    )
    VALUES (
        new.id,
        extracted_name,
        left(new.raw_user_meta_data->>'last_name', 50), -- cut to profiles_last_name_len
        new.email,
        0,
        false,
        false,
        'daily',
        0,
        0
    );

    -- Seed initial budget plan change record for new user (pure expense mode by default)
    INSERT INTO public.budget_plan_changes (
        user_id,
        effective_from,
        is_enabled,
        cadence,
        amount
    )
    VALUES (
        new.id,
        CURRENT_DATE,
        false,
        'daily',
        0
    )
    ON CONFLICT (user_id, effective_from) DO NOTHING;

    INSERT INTO public.categories (user_id, name, icon, color, is_default, kind) VALUES
    (new.id, 'Food & Drinks', 'Utensils', '#FF857A', true, 'expense'),
    (new.id, 'Shopping', 'ShoppingBag', '#EBAEE6', true, 'expense'),
    (new.id, 'Transport', 'Car', '#4A90D9', true, 'expense'),
    (new.id, 'Bills & Utilities', 'FileText', '#F4A460', true, 'expense'),
    (new.id, 'Entertainment', 'Film', '#9988A1', true, 'expense'),
    (new.id, 'Health', 'HeartPulse', '#E35336', true, 'expense'),
    (new.id, 'Others', 'DollarSign', '#ADEBB3', true, 'expense'),
    (new.id, 'Salary', 'Briefcase', '#10B981', true, 'income'),
    (new.id, 'Freelance', 'Laptop', '#6366F1', true, 'income'),
    (new.id, 'Interest', 'Percent', '#F59E0B', true, 'income'),
    (new.id, 'Gift', 'Gift', '#F472B6', true, 'income'),
    (new.id, 'Other Income', 'Wallet', '#14B8A6', true, 'income');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- === Part 2: Expense change counter (OPT-69) =========================================================

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

-- The probe the app calls. 0 = no expense write since this was installed.
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

-- Tell PostgREST about the function right away (otherwise it can take a moment).
NOTIFY pgrst, 'reload schema';
