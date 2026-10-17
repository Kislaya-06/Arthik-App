-- Arthik — retire Split Expenses / Reimbursements (canonical rules TXN-004 and REF-001..REF-005).
-- Run ONCE in Supabase → SQL Editor, BEFORE or together with the app release that removes the feature.
-- Safe to re-run.
--
-- What this does
--   1. Every old 'reimbursement' row becomes a normal income row (a friend paying back is just Income).
--      The money itself is never deleted. NOTE: these rows now count as income, so lifetime income totals
--      (and "available income") for users who used Split will go UP by the repaid amounts.
--   2. expenses.transaction_class may now only be 'normal' or 'self_transfer'.
--
-- What this deliberately does NOT do (so nothing is lost; can be dropped later in a separate, explicit step)
--   * expense_shares table and expenses.reimburses_share_id column are left in place, unused by the app.

BEGIN;

UPDATE public.expenses
   SET transaction_class = 'normal',
       reimburses_share_id = NULL
 WHERE transaction_class = 'reimbursement';

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_transaction_class_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_transaction_class_valid
    CHECK (transaction_class IN ('normal', 'self_transfer'));

COMMIT;

-- Optional check (should return 0 rows):
--   SELECT id FROM public.expenses WHERE transaction_class NOT IN ('normal', 'self_transfer');
