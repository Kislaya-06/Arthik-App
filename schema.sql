-- ==============================================================================
-- Arthik App - Database Schema & Security Definition (v1.2.3)
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT NOT NULL,
    daily_budget NUMERIC(12, 2) DEFAULT 100.00,
    is_auto_renew BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_daily_budget_non_negative;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_daily_budget_non_negative CHECK (daily_budget >= 0);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_first_name_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_first_name_len CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 50);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_last_name_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_last_name_len CHECK (last_name IS NULL OR char_length(last_name) <= 50);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
TO authenticated
USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile" 
ON public.profiles FOR DELETE 
TO authenticated
USING ((select auth.uid()) = id);

-- ------------------------------------------------------------------------------
-- 2. Categories Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means default system category
    name TEXT NOT NULL,
    icon TEXT NOT NULL, -- Lucide icon name
    color TEXT NOT NULL, -- Hex color code
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_len;
ALTER TABLE public.categories ADD CONSTRAINT categories_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 24);

-- Category side (CAT-004): 'expense' categories for expenses, 'income' categories for income.
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense';
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_kind_valid;
ALTER TABLE public.categories ADD CONSTRAINT categories_kind_valid CHECK (kind IN ('expense', 'income'));

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view default categories and their own" ON public.categories;
CREATE POLICY "Users can view default categories and their own" 
ON public.categories FOR SELECT 
TO authenticated
USING (user_id IS NULL OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
CREATE POLICY "Users can insert their own categories" 
ON public.categories FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update their own categories" 
ON public.categories FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id AND user_id IS NOT NULL)
WITH CHECK ((select auth.uid()) = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
CREATE POLICY "Users can delete their own categories" 
ON public.categories FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id AND user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_id);

-- ------------------------------------------------------------------------------
-- 3. Expenses Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    note TEXT,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'card')),
    expense_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_note_len;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_note_len CHECK (note IS NULL OR char_length(note) <= 250);

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_amount_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_valid CHECK (amount > 0 AND amount <= 999999999.99);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
CREATE POLICY "Users can view their own expenses" 
ON public.expenses FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
CREATE POLICY "Users can insert their own expenses" 
ON public.expenses FOR INSERT 
TO authenticated
WITH CHECK (
    (select auth.uid()) = user_id
    AND (
        category_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = category_id
              AND (user_id IS NULL OR user_id = (select auth.uid()))
        )
    )
);

DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
CREATE POLICY "Users can update their own expenses" 
ON public.expenses FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
    (select auth.uid()) = user_id
    AND (
        category_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = category_id
              AND (user_id IS NULL OR user_id = (select auth.uid()))
        )
    )
);

DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
CREATE POLICY "Users can delete their own expenses" 
ON public.expenses FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date 
ON public.expenses (user_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_category 
ON public.expenses (category_id);

-- ------------------------------------------------------------------------------
-- 4. Daily Savings Log Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_savings_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount_saved NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('saved', 'missed', 'even', 'unknown')),
    budget_amount NUMERIC(12, 2), -- Nullable, NO default (P1.1)
    spent_amount NUMERIC(12, 2),  -- Real spent tracked (P1.2)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_daily_savings UNIQUE (user_id, date)
);
ALTER TABLE public.daily_savings_log DROP CONSTRAINT IF EXISTS daily_savings_spent_non_negative;
ALTER TABLE public.daily_savings_log ADD CONSTRAINT daily_savings_spent_non_negative CHECK (spent_amount IS NULL OR spent_amount >= 0);

ALTER TABLE public.daily_savings_log DROP CONSTRAINT IF EXISTS daily_savings_budget_non_negative;
ALTER TABLE public.daily_savings_log ADD CONSTRAINT daily_savings_budget_non_negative CHECK (budget_amount IS NULL OR budget_amount >= 0);

ALTER TABLE public.daily_savings_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own daily savings log" ON public.daily_savings_log;
CREATE POLICY "Users can view their own daily savings log" 
ON public.daily_savings_log FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own daily savings log" ON public.daily_savings_log;
CREATE POLICY "Users can insert their own daily savings log" 
ON public.daily_savings_log FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own daily savings log" ON public.daily_savings_log;
CREATE POLICY "Users can update their own daily savings log" 
ON public.daily_savings_log FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own daily savings log" ON public.daily_savings_log;
CREATE POLICY "Users can delete their own daily savings log" 
ON public.daily_savings_log FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- 5. Gullak Deposits Table (Manual Savings Top-ups)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gullak_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0 AND amount <= 999999999.99),
    date DATE NOT NULL,
    note TEXT CHECK (note IS NULL OR char_length(note) <= 250),
    source TEXT NOT NULL DEFAULT 'external' CHECK (source IN ('income', 'external')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gullak_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own gullak deposits" ON public.gullak_deposits;
CREATE POLICY "Users can view their own gullak deposits" 
ON public.gullak_deposits FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own gullak deposits" ON public.gullak_deposits;
CREATE POLICY "Users can insert their own gullak deposits" 
ON public.gullak_deposits FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own gullak deposits" ON public.gullak_deposits;
CREATE POLICY "Users can update their own gullak deposits" 
ON public.gullak_deposits FOR UPDATE 
TO authenticated 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own gullak deposits" ON public.gullak_deposits;
CREATE POLICY "Users can delete their own gullak deposits" 
ON public.gullak_deposits FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_gullak_deposits_user_date 
ON public.gullak_deposits (user_id, date DESC);

-- ------------------------------------------------------------------------------
-- 6. Functions & Triggers
-- ------------------------------------------------------------------------------

-- Trigger function: Initialize user profile & default categories on signup
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

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Revoke direct execution from public/authenticated users (security advisor fix)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ==============================================================================
-- MIGRATIONS (For existing databases only)
-- Run the block below in your Supabase SQL Editor to upgrade an already-deployed
-- database without affecting existing user data.
-- ==============================================================================

-- A1. Stop future rows defaulting to 500; add real spent column
ALTER TABLE public.daily_savings_log ALTER COLUMN budget_amount DROP DEFAULT;
ALTER TABLE public.daily_savings_log ADD COLUMN IF NOT EXISTS spent_amount NUMERIC(12, 2);

-- A2. Fix Constraints and Indexes
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_note_len;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_note_len CHECK (note IS NULL OR char_length(note) <= 250);

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_len;
ALTER TABLE public.categories ADD CONSTRAINT categories_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 24);

-- Note: idx_expenses_category and idx_categories_user are already created in sections 2 and 3 above
DROP INDEX IF EXISTS public.idx_daily_savings_log_user_date; -- unique(user_id,date) already covers it

-- A3. Clean up Legacy/Dead RPC Functions
DROP FUNCTION IF EXISTS public.delete_user_account();

-- A4. Default daily limit feature to OFF for new user profiles
ALTER TABLE public.profiles ALTER COLUMN daily_budget SET DEFAULT 0;
ALTER TABLE public.profiles ALTER COLUMN is_auto_renew SET DEFAULT false;

-- A5. Security & Validation Constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_daily_budget_non_negative;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_daily_budget_non_negative CHECK (daily_budget >= 0);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_first_name_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_first_name_len CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 50);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_last_name_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_last_name_len CHECK (last_name IS NULL OR char_length(last_name) <= 50);

ALTER TABLE public.daily_savings_log DROP CONSTRAINT IF EXISTS daily_savings_spent_non_negative;
ALTER TABLE public.daily_savings_log ADD CONSTRAINT daily_savings_spent_non_negative CHECK (spent_amount IS NULL OR spent_amount >= 0);

ALTER TABLE public.daily_savings_log DROP CONSTRAINT IF EXISTS daily_savings_budget_non_negative;
ALTER TABLE public.daily_savings_log ADD CONSTRAINT daily_savings_budget_non_negative CHECK (budget_amount IS NULL OR budget_amount >= 0);

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_amount_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_valid CHECK (amount > 0 AND amount <= 999999999.99);

-- A6. Tighten category tenant isolation on expenses
DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
CREATE POLICY "Users can insert their own expenses" 
ON public.expenses FOR INSERT 
TO authenticated
WITH CHECK (
    (select auth.uid()) = user_id
    AND (
        category_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = category_id
              AND (user_id IS NULL OR user_id = (select auth.uid()))
        )
    )
);

DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
CREATE POLICY "Users can update their own expenses" 
ON public.expenses FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
    (select auth.uid()) = user_id
    AND (
        category_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = category_id
              AND (user_id IS NULL OR user_id = (select auth.uid()))
        )
    )
);

-- ------------------------------------------------------------------------------
-- 9. App Configuration Table (Remote Version Control & Feature Flags)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read app_config" ON public.app_config;
CREATE POLICY "Public can read app_config" 
ON public.app_config FOR SELECT 
TO anon, authenticated 
USING (true);

-- Default configuration row for version control
INSERT INTO public.app_config (key, value)
VALUES (
    'version_control',
    jsonb_build_object(
        'min_supported_version', '1.2.3',
        'force_update_enabled', false,
        'release_url', 'https://github.com/Kislaya-06/Arthik-App/releases/latest'
    )
)
ON CONFLICT (key) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 11. Category Color Normalization (Lively Color Palette v1.2.4)
-- ------------------------------------------------------------------------------
UPDATE public.categories SET color = '#FF857A' WHERE name = 'Food & Drinks' AND color = '#F4B8AE';
UPDATE public.categories SET color = '#EBAEE6' WHERE name = 'Shopping' AND color = '#B8E0C8';
UPDATE public.categories SET color = '#4A90D9' WHERE name = 'Transport' AND color = '#93C5FD';
UPDATE public.categories SET color = '#F4A460' WHERE name = 'Bills & Utilities' AND color = '#FCD34D';
UPDATE public.categories SET color = '#9988A1' WHERE name = 'Entertainment' AND color = '#C084FC';
UPDATE public.categories SET color = '#E35336' WHERE name = 'Health' AND color = '#F87171';
UPDATE public.categories SET color = '#ADEBB3' WHERE name = 'Others' AND color = '#94A3B8';

-- ------------------------------------------------------------------------------
-- 12. Budget Modes (Oct 2026)
-- ------------------------------------------------------------------------------
-- 12.1: Add budget mode columns to profiles (additive & idempotent)
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

-- 12.2: New Table: public.budget_plan_changes (Rule Timeline & Cadence Audit Log)
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

-- 12.3: New Table: public.budget_periods (Weekly & Monthly Governed Periods)
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
    is_prorated BOOLEAN NOT NULL DEFAULT FALSE, -- Zero-Proration Policy: Always false for newly finalized periods
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

ALTER TABLE public.budget_periods ADD COLUMN IF NOT EXISTS carried_over_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.budget_periods ADD COLUMN IF NOT EXISTS carry_mode TEXT CHECK (carry_mode IS NULL OR carry_mode IN ('additive', 'allocation'));

ALTER TABLE public.budget_plan_changes ADD COLUMN IF NOT EXISTS carried_over_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.budget_plan_changes ADD COLUMN IF NOT EXISTS carry_mode TEXT CHECK (carry_mode IS NULL OR carry_mode IN ('additive', 'allocation'));

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

-- 12.4: Idempotent Backfill (D5)
-- Step 12.4.1: Enable budget mode ONLY for active users who actually used budget or gullak.
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

-- Step 12.4.2: Seed budget_plan_changes row for each profile that doesn't have one yet.
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


-- ═══ Automatic Logging (v2.0) — see supabase/migrations/20261006_autolog_profiles.sql ═══
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

-- ═══ v2.0.0 feature flags — see supabase/migrations/20261007_release_v2_flags.sql ═══
-- Arthik v2.0.0 — server-side feature flag for Automatic Logging (Beta).
-- SAFE to run any time (before or after the APK is published). Run once in Supabase → SQL Editor.
--
-- audience:
--   'existing' → only people who used Arthik before v2.0 (Beta paused for new users)  ← start here
--   'all'      → everyone
--   'none'     → hide for anyone who has not set it up yet (kill switch; existing setups keep working)
-- existing_before: accounts created before this moment also count as "existing" (covers reinstalls / new phones).

INSERT INTO public.app_config (key, value)
VALUES (
  'feature_flags',
  jsonb_build_object(
    'autolog', jsonb_build_object(
      'audience', 'existing',
      'existing_before', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  )
)
ON CONFLICT (key) DO NOTHING;

-- ═══ Part 1: Self-Transfers (the Split / Reimbursement feature was retired — see supabase/migrations/20261017083146_retire_shares_reimbursements.sql) ═══
-- Part 1: Self-Transfers (history: this block once also created expense_shares and the 'reimbursement' class)
-- Run once in Supabase → SQL Editor (safe to re-run; uses IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ------------------------------------------------------------------------------
-- 1. expenses: classification + links
-- ------------------------------------------------------------------------------
-- 'normal'       -> a regular expense or regular income (default). A friend paying back is plain income (TXN-004).
-- 'self_transfer'-> movement between the user's own accounts.
--                   NEVER counted as income or expense (TXN-003).
-- 'recovery'     -> money that came back for an expense already paid (Part 2 below, SPL-003). Never income.
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS transaction_class TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_transaction_class_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_transaction_class_valid
    CHECK (transaction_class IN ('normal', 'self_transfer'));

-- RETIRED (unused by the app): used to link a reimbursement back to a friend share. Kept so no data is lost.
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS reimburses_share_id UUID;

-- Links a self-transfer transaction to the "always remember" rule that classified it (optional).
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS transfer_rule_id UUID;

CREATE INDEX IF NOT EXISTS idx_expenses_reimburses_share_id ON public.expenses(reimburses_share_id);
CREATE INDEX IF NOT EXISTS idx_expenses_transaction_class ON public.expenses(user_id, transaction_class);

-- ------------------------------------------------------------------------------
-- 2. expense_shares — RETIRED (unused by the app since the Split feature was removed; table kept, no data lost).
--    Original purpose: friend/person shares recorded against an expense.
--    'Amount reimbursed so far' is intentionally NOT stored: it is derived from the linked
--    reimbursement rows (expenses.reimburses_share_id), so it can never drift or be double-counted.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    friend_label TEXT NOT NULL,
    amount_owed NUMERIC(12, 2) NOT NULL CHECK (amount_owed > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expense_shares DROP CONSTRAINT IF EXISTS expense_shares_label_len;
ALTER TABLE public.expense_shares ADD CONSTRAINT expense_shares_label_len
    CHECK (char_length(friend_label) BETWEEN 1 AND 80);

CREATE INDEX IF NOT EXISTS idx_expense_shares_expense_id ON public.expense_shares(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_user ON public.expense_shares(user_id);

ALTER TABLE public.expense_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_shares_select_own" ON public.expense_shares;
CREATE POLICY "expense_shares_select_own" ON public.expense_shares
    FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "expense_shares_insert_own" ON public.expense_shares;
CREATE POLICY "expense_shares_insert_own" ON public.expense_shares
    FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "expense_shares_update_own" ON public.expense_shares;
CREATE POLICY "expense_shares_update_own" ON public.expense_shares
    FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "expense_shares_delete_own" ON public.expense_shares;
CREATE POLICY "expense_shares_delete_own" ON public.expense_shares
    FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Now that expense_shares exists, point expenses.reimburses_share_id at it.
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_reimburses_share_id_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_reimburses_share_id_fkey
    FOREIGN KEY (reimburses_share_id) REFERENCES public.expense_shares(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 3. self_transfer_rules — narrow "always remember" rules for self-transfer matching
--    Matching is based on supported identifiers/context only (never amount alone).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.self_transfer_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    descriptor TEXT NOT NULL, -- normalized matching key, e.g. bank code + last4, or a stable note descriptor
    label TEXT, -- human-readable label shown to the user, e.g. "HDFC •1234 ↔ SBI •5678"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.self_transfer_rules DROP CONSTRAINT IF EXISTS self_transfer_rules_descriptor_len;
ALTER TABLE public.self_transfer_rules ADD CONSTRAINT self_transfer_rules_descriptor_len
    CHECK (char_length(descriptor) BETWEEN 1 AND 120);

CREATE UNIQUE INDEX IF NOT EXISTS idx_self_transfer_rules_user_descriptor
    ON public.self_transfer_rules(user_id, descriptor);

ALTER TABLE public.self_transfer_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_transfer_rules_select_own" ON public.self_transfer_rules;
CREATE POLICY "self_transfer_rules_select_own" ON public.self_transfer_rules
    FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "self_transfer_rules_insert_own" ON public.self_transfer_rules;
CREATE POLICY "self_transfer_rules_insert_own" ON public.self_transfer_rules
    FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "self_transfer_rules_delete_own" ON public.self_transfer_rules;
CREATE POLICY "self_transfer_rules_delete_own" ON public.self_transfer_rules
    FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Now that self_transfer_rules exists, point expenses.transfer_rule_id at it.
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_transfer_rule_id_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_transfer_rule_id_fkey
    FOREIGN KEY (transfer_rule_id) REFERENCES public.self_transfer_rules(id) ON DELETE SET NULL;

-- ═══ Part 2: Split expenses, money back and refunds (SPL-001..SPL-006) ═══
-- Same SQL as supabase/migrations/20261018_split_and_money_back.sql (safe to re-run).
-- 'recovery' rows are income-direction rows that are NEVER income: they point back at the expenses they repaid.

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS split_person TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS split_amount NUMERIC(12, 2);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS split_allocations JSONB;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recovery_kind TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recovery_person TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recovery_allocations JSONB;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_transaction_class_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_transaction_class_valid
    CHECK (transaction_class IN ('normal', 'self_transfer', 'recovery'));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_split_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_split_valid CHECK (
    (split_person IS NULL AND split_amount IS NULL AND split_allocations IS NULL)
    OR (
        split_person IS NOT NULL AND split_amount IS NOT NULL
        AND char_length(split_person) >= 1
        AND split_amount > 0 AND split_amount <= amount
        AND type = 'expense' AND transaction_class = 'normal'
    )
);

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_recovery_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_recovery_valid CHECK (
    (transaction_class <> 'recovery'
        AND recovery_kind IS NULL AND recovery_person IS NULL AND recovery_allocations IS NULL)
    OR (
        transaction_class = 'recovery'
        AND type = 'income'
        AND recovery_kind IN ('settlement', 'refund')
        AND (recovery_person IS NULL OR char_length(recovery_person) <= 40)
        AND recovery_allocations IS NOT NULL
        AND jsonb_typeof(recovery_allocations) = 'array'
    )
);

CREATE INDEX IF NOT EXISTS idx_expenses_split_person
    ON public.expenses (user_id, lower(split_person)) WHERE split_person IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_recovery
    ON public.expenses (user_id, expense_date DESC) WHERE transaction_class = 'recovery';

-- ═══ Part 3: Performance — indexes, expense change version, one-call reads (OPT-65..OPT-69, 29 Oct 2026) ═══
-- Same content as supabase/migrations/20261029120000_performance_sync_version_bootstrap.sql.

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
