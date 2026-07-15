-- Database schema for Arthik App

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT NOT NULL,
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
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
ON public.categories FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
ON public.categories FOR DELETE 
USING (auth.uid() = user_id);


-- 3. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
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
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses" 
ON public.expenses FOR DELETE 
USING (auth.uid() = user_id);


-- 4. Function to automatically create a profile and default categories on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_profile_id UUID;
BEGIN
    -- Create user profile
    INSERT INTO public.profiles (id, first_name, last_name, email)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'first_name', 'User'),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
