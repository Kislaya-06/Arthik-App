-- Automatic Logging (v2.0) — the ONLY auto-logging data stored on the server.
-- No SMS text, no notification text, no amounts. Bank name + last 4 digits only,
-- used to detect re-install / data-clear (spec §31–34). Run once in Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.autolog_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    setup_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    signed_out_at TIMESTAMPTZ,
    tracked_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT autolog_tracked_accounts_is_array CHECK (jsonb_typeof(tracked_accounts) = 'array'),
    CONSTRAINT autolog_tracked_accounts_small CHECK (jsonb_array_length(tracked_accounts) <= 50)
);

ALTER TABLE public.autolog_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autolog_select_own" ON public.autolog_profiles;
CREATE POLICY "autolog_select_own" ON public.autolog_profiles
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "autolog_insert_own" ON public.autolog_profiles;
CREATE POLICY "autolog_insert_own" ON public.autolog_profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "autolog_update_own" ON public.autolog_profiles;
CREATE POLICY "autolog_update_own" ON public.autolog_profiles
    FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "autolog_delete_own" ON public.autolog_profiles;
CREATE POLICY "autolog_delete_own" ON public.autolog_profiles
    FOR DELETE USING ((select auth.uid()) = user_id);
