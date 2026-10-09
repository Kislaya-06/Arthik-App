export type TransactionClass = 'normal' | 'reimbursement' | 'self_transfer';

/** Structured classification (Part 1). Missing/unknown values behave as 'normal'. */
export const getTransactionClass = (item?: { transaction_class?: string | null } | null): TransactionClass => {
  const c = item?.transaction_class;
  return c === 'reimbursement' || c === 'self_transfer' ? c : 'normal';
};
export const isReimbursementClass = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) === 'reimbursement';
export const isSelfTransferClass = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) === 'self_transfer';
/** True for rows that are real cash movements but must never count as income OR expense. */
export const isExcludedFromTotals = (item?: { transaction_class?: string | null } | null): boolean =>
  getTransactionClass(item) !== 'normal';

/** Counts as income in totals/charts/analytics. Reimbursements and self-transfers never do. */
export const isCountedIncome = (
  item?: { type?: string; transaction_class?: string | null } | null,
  category?: { name?: string } | null
): boolean => !isExcludedFromTotals(item) && isIncomeTransaction(item, category);

/** Counts as money spent. Self-transfers (either leg) and reimbursements never do. */
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
 * Robust check if a transaction is income.
 * Prioritizes expense.type === 'income' first, then falls back to category keywords for legacy rows.
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

export const DEFAULT_TRANSFER_KEYWORDS = [
  'transfer',
  'self transfer',
  'account transfer',
  'card bill',
  'credit card payment',
  'credit card bill',
  'own account',
];

export const DEFAULT_REIMBURSEMENT_KEYWORDS = [
  'refund',
  'reimbursement',
  'reimburse',
  'friend repayment',
  'friend share',
  'split',
  'payback',
  'paid back',
  'settled',
];

/**
 * Checks if a transaction represents an internal account transfer or card bill payment
 * that should NOT inflate the spendable budget or income.
 */
export const isInternalTransfer = (
  item?: { type?: string; status?: string; note?: string | null; transaction_class?: string | null } | null,
  category?: { name?: string } | null
): boolean => {
  // Structured classification is authoritative when present. Keyword checks below remain only
  // as a legacy fallback for rows that predate transaction_class.
  if (isSelfTransferClass(item)) return true;
  if (isReimbursementClass(item)) return false;
  if (item?.status === 'transfer' || item?.type === 'transfer') return true;
  if (category?.name) {
    const catLower = category.name.toLowerCase();
    if (DEFAULT_TRANSFER_KEYWORDS.some((kw) => catLower.includes(kw))) return true;
  }
  if (item?.note) {
    const noteLower = item.note.toLowerCase();
    if (DEFAULT_TRANSFER_KEYWORDS.some((kw) => noteLower.includes(kw))) return true;
    if (noteLower.includes('->') || noteLower.includes('to sbi') || noteLower.includes('to hdfc') || noteLower.includes('to bank')) {
      if (noteLower.includes('transfer') || noteLower.includes('self') || noteLower.includes('bank a')) return true;
    }
  }
  return false;
};

/**
 * Checks if an incoming credit represents a reimbursement / refund of a past expense.
 */
export const isReimbursement = (
  item?: { type?: string; note?: string | null } | null,
  category?: { name?: string } | null
): boolean => {
  if (category?.name) {
    const catLower = category.name.toLowerCase();
    if (DEFAULT_REIMBURSEMENT_KEYWORDS.some((kw) => catLower.includes(kw))) return true;
  }
  if (item?.note) {
    const noteLower = item.note.toLowerCase();
    if (DEFAULT_REIMBURSEMENT_KEYWORDS.some((kw) => noteLower.includes(kw))) return true;
  }
  return false;
};

/**
 * Robust check if an incoming transaction is eligible income for spendable calculations.
 * Genuine earnings, salary, refunds, and reimbursements are eligible.
 * Transfers between user's own tracked accounts are excluded.
 */
export const isEligibleIncome = (
  item?: { type?: string; status?: string; note?: string | null; category_id?: string | null; transaction_class?: string | null } | null,
  category?: { name?: string } | null
): boolean => {
  // Reimbursements flow through their own channel (eligibleReimbursements), never as income.
  if (isExcludedFromTotals(item)) return false;
  if (isInternalTransfer(item, category)) return false;
  return isIncomeTransaction(item, category);
};

/**
 * Incoming money that restores spending power for money spent on behalf of others.
 * Real cash, NOT income. Only structured (user-confirmed) reimbursements qualify;
 * keyword guesses are intentionally not trusted here.
 */
export const isEligibleReimbursement = (
  item?: { type?: string; transaction_class?: string | null } | null
): boolean => isReimbursementClass(item) && item?.type !== 'expense';
