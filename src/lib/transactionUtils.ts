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
  item?: { type?: string; status?: string; note?: string | null } | null,
  category?: { name?: string } | null
): boolean => {
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
  item?: { type?: string; status?: string; note?: string | null; category_id?: string | null } | null,
  category?: { name?: string } | null
): boolean => {
  if (isInternalTransfer(item, category)) return false;
  return isIncomeTransaction(item, category);
};
