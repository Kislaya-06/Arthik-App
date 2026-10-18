/**
 * Database columns added by the Split / Money back feature (SPL-001..SPL-006).
 *
 * They are included ONLY when a row really uses them. A normal expense is sent exactly as before, so the app
 * keeps working for everyone even before the new SQL (supabase/migrations/20261018_split_and_money_back.sql)
 * has been run; only the new features need the new columns.
 */
import type { Expense } from './types';

type SplitAndRecoveryFields = Pick<
  Expense,
  'split_person' | 'split_amount' | 'split_allocations' | 'recovery_kind' | 'recovery_person' | 'recovery_allocations'
>;

export const extraColumnsFor = (item: Partial<SplitAndRecoveryFields>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (item.split_person && item.split_amount && item.split_amount > 0) {
    out.split_person = item.split_person;
    out.split_amount = item.split_amount;
    if (Array.isArray(item.split_allocations) && item.split_allocations.length > 0) {
      out.split_allocations = item.split_allocations;
    }
  }
  if (item.recovery_kind) {
    out.recovery_kind = item.recovery_kind;
    out.recovery_person = item.recovery_person ?? null;
    out.recovery_allocations = item.recovery_allocations ?? [];
  }
  return out;
};

/** The class that is stored. A queued 'reimbursement' from an older app version is plain income (TXN-004). */
export const storedTransactionClass = (value: string | null | undefined): 'normal' | 'self_transfer' | 'recovery' =>
  value === 'self_transfer' ? 'self_transfer' : value === 'recovery' ? 'recovery' : 'normal';
