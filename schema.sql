-- Database schema for Arthik App

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT NOT NULL,
    daily_budget NUMERIC(12, 2) DEFAULT 500,
    is_auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile" 
ON public.profiles FOR DELETE 
USING (auth.uid() = id);


-- 2. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means default system category
    name TEXT NOT NULL,
    icon TEXT NOT NULL, -- Lucide icon name
    color TEXT NOT NULL, -- Hex color code
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view default categories and their own" 
ON public.categories FOR SELECT 
USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" 
ON public.categories FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Users can update their own categories" 
ON public.categories FOR UPDATE 
USING (auth.uid() = user_id AND user_id IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Users can delete their own categories" 
ON public.categories FOR DELETE 
USING (auth.uid() = user_id AND user_id IS NOT NULL);


-- 3. Create expenses table
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

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own expenses" 
ON public.expenses FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses" 
ON public.expenses FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses" 
ON public.expenses FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses" 
ON public.expenses FOR DELETE 
USING (auth.uid() = user_id);


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_profile_id UUID;
    extracted_name TEXT;
BEGIN
    -- Extract name from various possible fields (Google Auth uses name/full_name, our app uses full_name)
    extracted_name := COALESCE(
        new.raw_user_meta_data->>'first_name',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );

    -- Create user profile
    INSERT INTO public.profiles (id, first_name, last_name, email)
    VALUES (
        new.id,
        extracted_name,
        new.raw_user_meta_data->>'last_name',
        new.email
    );

    -- Insert default categories for this user
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

-- Trigger to call handle_new_user
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Migration for existing databases:
-- Run this in your Supabase SQL Editor to support the unified Add Transaction / Add Money feature:
-- ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income'));
-- ALTER TABLE public.expenses ALTER COLUMN category_id DROP NOT NULL;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_budget NUMERIC(12, 2) DEFAULT 500;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_auto_renew BOOLEAN DEFAULT TRUE;

-- 4. Create daily_savings_log table for streak tracking and historical savings calendar
CREATE TABLE IF NOT EXISTS public.daily_savings_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount_saved NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('saved', 'missed', 'even', 'unknown')),
    budget_amount NUMERIC(12, 2) DEFAULT 500,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_daily_savings UNIQUE (user_id, date)
);

-- Enable RLS on daily_savings_log
ALTER TABLE public.daily_savings_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily savings log" 
ON public.daily_savings_log FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily savings log" 
ON public.daily_savings_log FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily savings log" 
ON public.daily_savings_log FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily savings log" 
ON public.daily_savings_log FOR DELETE 
USING (auth.uid() = user_id);

-- Index for fast date range lookup per user
CREATE INDEX IF NOT EXISTS idx_daily_savings_log_user_date 
ON public.daily_savings_log (user_id, date);

-- Index for fast expense queries sorted by date per user
CREATE INDEX IF NOT EXISTS idx_expenses_user_date 
ON public.expenses (user_id, expense_date DESC);

-- 5. RPC function to allow users to permanently delete their own account and cascading data
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 6. Migration for Existing Databases: Ensure ON DELETE CASCADE and Profile DELETE Policy
-- Run this block in your Supabase SQL Editor to ensure existing databases have proper CASCADE and DELETE policies:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can delete their own profile'
  ) THEN
    CREATE POLICY "Users can delete their own profile" 
    ON public.profiles FOR DELETE 
    USING (auth.uid() = id);
  END IF;
END $$;

-- Verify/enforce ON DELETE CASCADE constraints on all user-linked tables
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_user_id_fkey,
  ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_user_id_fkey,
  ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.daily_savings_log
  DROP CONSTRAINT IF EXISTS daily_savings_log_user_id_fkey,
  ADD CONSTRAINT daily_savings_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Migration: Add budget_amount and support 'unknown' status in daily_savings_log (Fix #5)
-- Run this in your Supabase SQL Editor for existing databases:
ALTER TABLE public.daily_savings_log ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12, 2) DEFAULT 500;

DO $$
BEGIN
  ALTER TABLE public.daily_savings_log DROP CONSTRAINT IF EXISTS daily_savings_log_status_check;
  ALTER TABLE public.daily_savings_log ADD CONSTRAINT daily_savings_log_status_check CHECK (status IN ('saved', 'missed', 'even', 'unknown'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 8. Migration: Full RLS Security Hardening & Scope Fixes (Fix #7)
-- Run this in your Supabase SQL Editor to enforce strict RLS and RPC security on existing databases:

-- A. Profiles: Add WITH CHECK to UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- B. Categories: Enforce user_id IS NOT NULL on INSERT/UPDATE/DELETE & add WITH CHECK
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
CREATE POLICY "Users can insert their own categories" 
ON public.categories FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update their own categories" 
ON public.categories FOR UPDATE 
USING (auth.uid() = user_id AND user_id IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
CREATE POLICY "Users can delete their own categories" 
ON public.categories FOR DELETE 
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- C. Expenses: Add WITH CHECK to UPDATE policy (prevents user_id reassignment)
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
CREATE POLICY "Users can update their own expenses" 
ON public.expenses FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- D. Daily Savings Log: Add WITH CHECK to UPDATE policy (used during upsert)
DROP POLICY IF EXISTS "Users can update their own daily savings log" ON public.daily_savings_log;
CREATE POLICY "Users can update their own daily savings log" 
ON public.daily_savings_log FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- E. Set explicit search_path on handle_new_user trigger
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

    INSERT INTO public.profiles (id, first_name, last_name, email)
    VALUES (
        new.id,
        extracted_name,
        new.raw_user_meta_data->>'last_name',
        new.email
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

-- F. Guard delete_user_account RPC & restrict execution to authenticated users
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;


