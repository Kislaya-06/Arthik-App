/**
 * Transaction classification (canonical rules TXN-001..TXN-004, see docs/ARTHIK_CANONICAL_RULES.md).
 * A row is either an expense or an income (explicit `type`). The ONLY other class is 'self_transfer'
 * (money moved between the user's own accounts), which never counts as spent or earned.
 * There is no reimbursement class: a friend paying back, or a refund, is simply Income (TXN-004).
 */
export type TransactionClass = 'normal' | 'self_transfer';

/** Fixed note prefix identifying auto-balanced Pure Mode deficit income transactions (PUR-001). */
export const PURE_DEFICIT_NOTE = 'Auto-balance (Pure Mode deficit)';

/** Structured classification. Missing/unknown values (including the retired 'reimbursement') behave as 'normal'. */
export const getTransactionClass = (item?: { transaction_class?: string | null } | null): TransactionClass =>
  item?.transaction_class === 'self_transfer' ? 'self_transfer' : 'normal';
export const isSelfTransferClass = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) === 'self_transfer';
/** True for rows that are real cash movements but must never count as income OR expense. */
export const isExcludedFromTotals = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) !== 'normal';

/** Counts as income in totals/charts/analytics. Self-transfers never do. */
export const isCountedIncome = (
  item?: { type?: string; transaction_class?: string | null } | null,
  category?: { name?: string } | null
): boolean => !isExcludedFromTotals(item) && isIncomeTransaction(item, category);

/** Counts as money spent. Self-transfers (either leg) never do. */
export const isCountedExpense = (
  item?: { type?: string; transaction_class?: string | null } | null,
  category?: { name?: string } | null
): boolean => !isExcludedFromTotals(item) && !isIncomeTransaction(item, category);

export const DEFAULT_INCOME_KEYWORDS = [
  'salary',
  'income',
  'freelance',
  'business',
  'dividend',
  'stipend',
  'rental',
  'bonus',
  'interest',
  'cashback',
  'refund',
  'pocket money',
  'gift',
  'sales',
];

/**
 * Is this transaction income? (TXN-001) The explicit `type` is the only authority.
 * The category-keyword fallback (TXN-002) is an inert, dormant path that only runs for historical rows
 * with no `type` at all; the database makes `type` NOT NULL, so active accounting never reaches it.
 */
export const isIncomeTransaction = (
  item?: { type?: 'expense' | 'income' | string } | null,
  category?: { name?: string } | null
): boolean => {
  if (item?.type === 'income') return true;
  if (item?.type === 'expense') return false;
  if (!category?.name) return false;
  const lower = category.name.toLowerCase();
  return DEFAULT_INCOME_KEYWORDS.some((kw) => lower.includes(kw));
};

/**
 * Is this incoming transaction eligible income? Direction comes from the explicit `type` (TXN-001);
 * self-transfers are excluded (TXN-003). Notes and category names are never used to guess a transfer.
 */
export const isEligibleIncome = (
  item?: { type?: string; transaction_class?: string | null } | null,
  category?: { name?: string } | null
): boolean => {
  if (isExcludedFromTotals(item)) return false;
  return isIncomeTransaction(item, category);
};
