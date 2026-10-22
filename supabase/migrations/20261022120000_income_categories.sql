-- Arthik — Income categories (CAT-004, TXN-002 update, approved by owner 2026-10-22).
-- 1. categories.kind: 'expense' | 'income' (existing rows become 'expense').
-- 2. Every existing user gets the 5 default income categories (only if they have none yet). Safe to run twice.
-- 3. New users get them from handle_new_user().
-- No transaction amount, type or class is touched. Existing incomes keep their category_id as is.

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense';
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_kind_valid;
ALTER TABLE public.categories ADD CONSTRAINT categories_kind_valid CHECK (kind IN ('expense', 'income'));

INSERT INTO public.categories (user_id, name, icon, color, is_default, kind)
SELECT p.id, d.name, d.icon, d.color, true, 'income'
FROM public.profiles p
CROSS JOIN (VALUES
    ('Salary', 'Briefcase', '#10B981'),
    ('Freelance', 'Laptop', '#6366F1'),
    ('Interest', 'Percent', '#F59E0B'),
    ('Gift', 'Gift', '#F472B6'),
    ('Other Income', 'Wallet', '#14B8A6')
) AS d(name, icon, color)
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories c WHERE c.user_id = p.id AND c.kind = 'income'
);

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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
