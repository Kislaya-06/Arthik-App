-- SEC-11 (security audit, 22 Nov 2026). Safe to re-run. Owner runs this once in the Supabase SQL editor.
-- 1. An expense may only point at the caller's own transfer rule, money-back share and category
--    (before: another user's row id was accepted, giving an existence check on their rows).
-- 2. A share may only belong to the caller's own expense.
-- 3. Automatic Logging profile policies apply to signed-in users only.
-- 4. The sign-up trigger (SECURITY DEFINER) runs with an empty search_path; every name in it is schema-qualified.
-- No existing own data is affected: the checks only refuse references to rows of OTHER users.

DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses; -- SEC-11
CREATE POLICY "Users can insert their own expenses"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (
    (select auth.uid()) = user_id
    AND (category_id IS NULL OR EXISTS (
        SELECT 1 FROM public.categories c WHERE c.id = expenses.category_id AND (c.user_id IS NULL OR c.user_id = (select auth.uid()))
    ))
    AND (transfer_rule_id IS NULL OR EXISTS (
        SELECT 1 FROM public.self_transfer_rules r WHERE r.id = expenses.transfer_rule_id AND r.user_id = (select auth.uid())
    ))
    AND (reimburses_share_id IS NULL OR EXISTS (
        SELECT 1 FROM public.expense_shares s WHERE s.id = expenses.reimburses_share_id AND s.user_id = (select auth.uid())
    ))
);

DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
CREATE POLICY "Users can update their own expenses"
ON public.expenses FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
    (select auth.uid()) = user_id
    AND (category_id IS NULL OR EXISTS (
        SELECT 1 FROM public.categories c WHERE c.id = expenses.category_id AND (c.user_id IS NULL OR c.user_id = (select auth.uid()))
    ))
    AND (transfer_rule_id IS NULL OR EXISTS (
        SELECT 1 FROM public.self_transfer_rules r WHERE r.id = expenses.transfer_rule_id AND r.user_id = (select auth.uid())
    ))
    AND (reimburses_share_id IS NULL OR EXISTS (
        SELECT 1 FROM public.expense_shares s WHERE s.id = expenses.reimburses_share_id AND s.user_id = (select auth.uid())
    ))
);

DROP POLICY IF EXISTS "expense_shares_insert_own" ON public.expense_shares;
CREATE POLICY "expense_shares_insert_own" ON public.expense_shares
FOR INSERT TO authenticated
WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_shares.expense_id AND e.user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "expense_shares_update_own" ON public.expense_shares;
CREATE POLICY "expense_shares_update_own" ON public.expense_shares
FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_shares.expense_id AND e.user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "autolog_select_own" ON public.autolog_profiles;
CREATE POLICY "autolog_select_own" ON public.autolog_profiles
FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "autolog_insert_own" ON public.autolog_profiles;
CREATE POLICY "autolog_insert_own" ON public.autolog_profiles
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "autolog_update_own" ON public.autolog_profiles;
CREATE POLICY "autolog_update_own" ON public.autolog_profiles
FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "autolog_delete_own" ON public.autolog_profiles;
CREATE POLICY "autolog_delete_own" ON public.autolog_profiles
FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

ALTER FUNCTION public.handle_new_user() SET search_path = '';
