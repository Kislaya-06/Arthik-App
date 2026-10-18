-- Arthik — Split expenses, money back and refunds (canonical rules SPL-001..SPL-006).
-- Run ONCE in Supabase → SQL Editor, BEFORE or together with the app release. Safe to re-run.
--
-- What this adds (nothing existing is changed or deleted):
--   expenses.split_person / split_amount      -> an expense shared with one person (their share of the amount paid)
--   expenses.recovery_kind / recovery_person  -> a "money back" row: 'settlement' (a person paid back) or 'refund'
--   expenses.recovery_allocations (jsonb)     -> which expenses that money went back to: [{ "expense_id": "...", "amount": 100 }]
--   expenses.transaction_class                -> may now also be 'recovery' (money back is never income, never an expense)
--
-- The amount a person still owes, and the counted amount of an expense, are DERIVED in the app from these
-- columns. Nothing is stored twice, so deleting a money-back row restores everything exactly.

BEGIN;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS split_person TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS split_amount NUMERIC(12, 2);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recovery_kind TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recovery_person TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recovery_allocations JSONB;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_transaction_class_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_transaction_class_valid
    CHECK (transaction_class IN ('normal', 'self_transfer', 'recovery'));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_split_valid;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_split_valid CHECK (
    (split_person IS NULL AND split_amount IS NULL)
    OR (
        split_person IS NOT NULL AND split_amount IS NOT NULL
        AND char_length(split_person) BETWEEN 1 AND 40
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

COMMIT;

-- Optional checks (each should return 0 rows):
--   SELECT id FROM public.expenses WHERE split_person IS NOT NULL AND split_amount > amount;
--   SELECT id FROM public.expenses WHERE transaction_class = 'recovery' AND type <> 'income';
