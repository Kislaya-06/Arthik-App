-- ==============================================================================
-- Arthik App - Database Schema & Security Definition
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
    daily_budget NUMERIC(12, 2) DEFAULT 500,
    is_auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_expenses_user_date 
ON public.expenses (user_id, expense_date DESC);

-- ------------------------------------------------------------------------------
-- 4. Daily Savings Log Table
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_daily_savings_log_user_date 
ON public.daily_savings_log (user_id, date);

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

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- MIGRATIONS (For existing databases only)
-- Run the block below in your Supabase SQL Editor to upgrade an already-deployed
-- database without affecting existing user data.
-- ==============================================================================

-- 1. Schema Upgrades for Existing Databases
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income'));
ALTER TABLE public.expenses ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_budget NUMERIC(12, 2) DEFAULT 500;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_auto_renew BOOLEAN DEFAULT TRUE;
ALTER TABLE public.daily_savings_log ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12, 2) DEFAULT 500;

-- Ensure status check constraint allows 'unknown'
DO $$
BEGIN
  ALTER TABLE public.daily_savings_log DROP CONSTRAINT IF EXISTS daily_savings_log_status_check;
  ALTER TABLE public.daily_savings_log ADD CONSTRAINT daily_savings_log_status_check CHECK (status IN ('saved', 'missed', 'even', 'unknown'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Verify / Enforce ON DELETE CASCADE Constraints
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

-- 3. Policy Upgrades & Security Hardening
-- Profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile" 
ON public.profiles FOR DELETE 
USING (auth.uid() = id);

-- Categories
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

-- Expenses
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
CREATE POLICY "Users can update their own expenses" 
ON public.expenses FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Daily Savings Log
DROP POLICY IF EXISTS "Users can update their own daily savings log" ON public.daily_savings_log;
CREATE POLICY "Users can update their own daily savings log" 
ON public.daily_savings_log FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Clean up Legacy/Dead RPC Functions
-- The delete-user-account Edge Function (using auth.admin.deleteUser) has fully superseded this SQL RPC
DROP FUNCTION IF EXISTS public.delete_user_account();

