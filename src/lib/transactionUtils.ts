/**
 * Transaction classification (canonical rules TXN-001..TXN-004, see docs/ARTHIK_CANONICAL_RULES.md).
 * A row is either an expense or an income (explicit `type`). The other classes never count as spent or earned:
 *  - 'self_transfer': money moved between the user's own accounts (TXN-003).
 *  - 'recovery': money that came BACK for an expense the user already paid (a friend's share or a refund).
 *    It is stored as an income-direction row so it shows in History, but it is not income: it reduces the
 *    counted amount of the expenses it points at instead (SPL-003, src/lib/splitLedger.ts).
 */
export type TransactionClass = 'normal' | 'self_transfer' | 'recovery';

/** Fixed note prefix identifying auto-balanced Pure Mode deficit income transactions (PUR-001). */
export const PURE_DEFICIT_NOTE = 'Auto-balance (Pure Mode deficit)';

/** Structured classification. Missing/unknown values (including the retired 'reimbursement') behave as 'normal'. */
export const getTransactionClass = (item?: { transaction_class?: string | null } | null): TransactionClass =>
  item?.transaction_class === 'self_transfer'
    ? 'self_transfer'
    : item?.transaction_class === 'recovery'
    ? 'recovery'
    : 'normal';
export const isSelfTransferClass = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) === 'self_transfer';
/** True for a "money back" row (friend paid back / refund). Never income, never expense (SPL-003). */
export const isRecoveryClass = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) === 'recovery';
/** True for rows that are real cash movements but must never count as income OR expense. */
export const isExcludedFromTotals = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) !== 'normal';

/** Counts as income in totals/charts/analytics. Self-transfers never do. */
export const isCountedIncome = (
  item?: { type?: string; transaction_class?: string | null } | null
): boolean => classifyTransaction(item) === 'income';

/** Counts as money spent. Self-transfers (either leg) never do. */
export const isCountedExpense = (
  item?: { type?: string; transaction_class?: string | null } | null
): boolean => classifyTransaction(item) === 'spending';

/**
 * What a row IS, from the money point of view. Exactly one answer per row (canonical rules TXN-001..TXN-004):
 *  - 'spending'      : counts as money spent.
 *  - 'income'        : counts as money earned.
 *  - 'moneyBack'     : a friend's payback or a refund (class 'recovery'). Never income, never spending (SPL-003).
 *  - 'selfTransfer'  : money moved between the user's own accounts. Never income, never spending (TXN-003).
 * Every screen should ask THIS function (or isCountedExpense / isCountedIncome, which are built on it) instead of
 * combining isIncomeTransaction and isExcludedFromTotals by hand.
 */
export type TransactionKind = 'spending' | 'income' | 'moneyBack' | 'selfTransfer';

export const classifyTransaction = (
  item?: { type?: string; transaction_class?: string | null } | null
): TransactionKind => {
  const transactionClass = getTransactionClass(item);
  if (transactionClass === 'self_transfer') return 'selfTransfer';
  if (transactionClass === 'recovery') return 'moneyBack';
  return isIncomeTransaction(item) ? 'income' : 'spending';
};

/**
 * Is this row incoming money? (TXN-001) The explicit `type` is the only authority. A row without `type`
 * is an expense, the same as the database default (TXN-002 retired, ADR 0023). This is the row's direction
 * only (display sign and colour); totals use classifyTransaction / isCountedIncome / isCountedExpense.
 */
export const isIncomeTransaction = (item?: { type?: string } | null): boolean => item?.type === 'income';
