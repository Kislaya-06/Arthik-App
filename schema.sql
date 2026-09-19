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
    daily_budget NUMERIC(12, 2) DEFAULT 0,
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
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
CREATE POLICY "Users can update their own expenses" 
ON public.expenses FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

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
-- 5. Functions & Triggers
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

    INSERT INTO public.profiles (id, first_name, last_name, email, daily_budget, is_auto_renew)
    VALUES (
        new.id,
        extracted_name,
        new.raw_user_meta_data->>'last_name',
        new.email,
        0,
        false
    );

    INSERT INTO public.categories (user_id, name, icon, color, is_default) VALUES
    (new.id, 'Food & Drinks', 'Utensils', '#F4B8AE', true),
    (new.id, 'Shopping', 'ShoppingBag', '#B8E0C8', true),
    (new.id, 'Transport', 'Car', '#93C5FD', true),
    (new.id, 'Bills & Utilities', 'FileText', '#FCD34D', true),
    (new.id, 'Entertainment', 'Film', '#C084FC', true),
    (new.id, 'Health', 'HeartPulse', '#F87171', true),
    (new.id, 'Others', 'DollarSign', '#94A3B8', true);

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

CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_id);
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

