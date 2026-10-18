-- Arthik — Multi-person split expenses (SPL-001 update).
-- Adds split_allocations jsonb to expenses for tracking multiple persons and individual shares.
-- Maintains split_person and split_amount for backward compatibility and fast indexing.

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS split_allocations JSONB;

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
