-- ==============================================================================
-- Migration: 20261001_budget_modes.sql
-- Goal: Additive database migration for budget modes (Daily, Weekly, Monthly)
-- Invariants: Strictly additive, idempotent, safe for legacy app bundles (OTA-safe)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Profiles Table: Add budget mode columns
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_budget_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS budget_cadence TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_budget NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_budget_cadence_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_budget_cadence_check CHECK (budget_cadence IN ('daily', 'weekly', 'monthly'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_weekly_budget_non_negative;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_weekly_budget_non_negative CHECK (weekly_budget >= 0);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_monthly_budget_non_negative;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_monthly_budget_non_negative CHECK (monthly_budget >= 0);

-- ------------------------------------------------------------------------------
-- 2. New Table: public.budget_plan_changes (Rule Timeline & Cadence Audit Log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_plan_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    is_enabled BOOLEAN NOT NULL,
    cadence TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_effective_from UNIQUE (user_id, effective_from)
);

ALTER TABLE public.budget_plan_changes DROP CONSTRAINT IF EXISTS budget_plan_changes_cadence_check;
ALTER TABLE public.budget_plan_changes ADD CONSTRAINT budget_plan_changes_cadence_check CHECK (cadence IN ('daily', 'weekly', 'monthly'));

ALTER TABLE public.budget_plan_changes DROP CONSTRAINT IF EXISTS budget_plan_changes_amount_non_negative;
ALTER TABLE public.budget_plan_changes ADD CONSTRAINT budget_plan_changes_amount_non_negative CHECK (amount >= 0);

CREATE INDEX IF NOT EXISTS idx_budget_plan_changes_user_effective 
ON public.budget_plan_changes (user_id, effective_from DESC);

ALTER TABLE public.budget_plan_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own budget plan changes" ON public.budget_plan_changes;
CREATE POLICY "Users can view their own budget plan changes" 
ON public.budget_plan_changes FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own budget plan changes" ON public.budget_plan_changes;
CREATE POLICY "Users can insert their own budget plan changes" 
ON public.budget_plan_changes FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own budget plan changes" ON public.budget_plan_changes;
CREATE POLICY "Users can update their own budget plan changes" 
ON public.budget_plan_changes FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own budget plan changes" ON public.budget_plan_changes;
CREATE POLICY "Users can delete their own budget plan changes" 
ON public.budget_plan_changes FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- 3. New Table: public.budget_periods (Weekly & Monthly Governed Periods)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cadence TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    active_start DATE NOT NULL,
    active_end DATE NOT NULL,
    budget_amount NUMERIC(12, 2) NOT NULL,
    spent_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_saved NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    is_prorated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_cadence_active_start UNIQUE (user_id, cadence, active_start)
);

ALTER TABLE public.budget_periods DROP CONSTRAINT IF EXISTS budget_periods_cadence_check;
ALTER TABLE public.budget_periods ADD CONSTRAINT budget_periods_cadence_check CHECK (cadence IN ('weekly', 'monthly'));

ALTER TABLE public.budget_periods DROP CONSTRAINT IF EXISTS budget_periods_end_gte_start;
ALTER TABLE public.budget_periods ADD CONSTRAINT budget_periods_end_gte_start CHECK (period_end >= period_start);

ALTER TABLE public.budget_periods DROP CONSTRAINT IF EXISTS budget_periods_budget_non_negative;
ALTER TABLE public.budget_periods ADD CONSTRAINT budget_periods_budget_non_negative CHECK (budget_amount >= 0);

ALTER TABLE public.budget_periods DROP CONSTRAINT IF EXISTS budget_periods_spent_non_negative;
ALTER TABLE public.budget_periods ADD CONSTRAINT budget_periods_spent_non_negative CHECK (spent_amount >= 0);

ALTER TABLE public.budget_periods DROP CONSTRAINT IF EXISTS budget_periods_saved_non_negative;
ALTER TABLE public.budget_periods ADD CONSTRAINT budget_periods_saved_non_negative CHECK (amount_saved >= 0);

ALTER TABLE public.budget_periods DROP CONSTRAINT IF EXISTS budget_periods_status_check;
ALTER TABLE public.budget_periods ADD CONSTRAINT budget_periods_status_check CHECK (status IN ('saved', 'missed', 'even', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_budget_periods_user_start 
ON public.budget_periods (user_id, period_start DESC);

ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own budget periods" ON public.budget_periods;
CREATE POLICY "Users can view their own budget periods" 
ON public.budget_periods FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own budget periods" ON public.budget_periods;
CREATE POLICY "Users can insert their own budget periods" 
ON public.budget_periods FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own budget periods" ON public.budget_periods;
CREATE POLICY "Users can update their own budget periods" 
ON public.budget_periods FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own budget periods" ON public.budget_periods;
CREATE POLICY "Users can delete their own budget periods" 
ON public.budget_periods FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- 4. Idempotent Backfill (D5)
-- ------------------------------------------------------------------------------
-- 4.1: Enable budget mode ONLY for active users who actually used budget or gullak.
-- Note: daily_budget > 0 is deliberately NOT used because legacy default was 100.
UPDATE public.profiles
SET is_budget_mode_enabled = TRUE
WHERE is_budget_mode_enabled = FALSE
  AND (
    is_auto_renew = TRUE
    OR EXISTS (
      SELECT 1 FROM public.gullak_deposits g 
      WHERE g.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.daily_savings_log l 
      WHERE l.user_id = profiles.id 
        AND l.status = 'saved' 
        AND l.amount_saved > 0
    )
  );

-- 4.2: Seed budget_plan_changes row for each profile that doesn't have one yet.
INSERT INTO public.budget_plan_changes (user_id, effective_from, is_enabled, cadence, amount)
SELECT 
    p.id,
    COALESCE(p.created_at::date, u.created_at::date, CURRENT_DATE),
    p.is_budget_mode_enabled,
    'daily',
    COALESCE(p.daily_budget, 0)
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.budget_plan_changes bpc WHERE bpc.user_id = p.id
)
ON CONFLICT (user_id, effective_from) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. Update Trigger: handle_new_user()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_profile_id UUID;
    extracted_name TEXT;
BEGIN
    extracted_name := COALESCE(
        new.raw_user_meta_data->>'first_name',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );

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
        new.raw_user_meta_data->>'last_name',
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

    INSERT INTO public.categories (user_id, name, icon, color, is_default) VALUES
    (new.id, 'Food & Drinks', 'Utensils', '#FF857A', true),
    (new.id, 'Shopping', 'ShoppingBag', '#EBAEE6', true),
    (new.id, 'Transport', 'Car', '#4A90D9', true),
    (new.id, 'Bills & Utilities', 'FileText', '#F4A460', true),
    (new.id, 'Entertainment', 'Film', '#9988A1', true),
    (new.id, 'Health', 'HeartPulse', '#E35336', true),
    (new.id, 'Others', 'DollarSign', '#ADEBB3', true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
