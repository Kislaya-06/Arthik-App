-- OPT-65 (31 Oct 2026): index that matches the app's expense list query exactly.
--
-- The app reads expenses with:
--   WHERE user_id = ? ORDER BY expense_date DESC, created_at DESC   (pages of 1,000)
-- The old index idx_expenses_user_date (user_id, expense_date DESC) does not cover created_at,
-- so Postgres had to sort every page. This index lets it read rows already in order.
--
-- SAFETY: adds an index only. No row, column, constraint, policy, trigger or function is changed.
-- Idempotent: safe to run more than once. The old index is kept on purpose.
CREATE INDEX IF NOT EXISTS idx_expenses_user_date_created
ON public.expenses (user_id, expense_date DESC, created_at DESC);
