/**
 * Pure logic for friend shares, reimbursement matching and self-transfer rules (Part 1).
 * No React / Supabase imports so everything here is unit-testable.
 */
import { round2 } from './formatters';

export interface ExpenseShare {
  id: string;
  user_id: string;
  expense_id: string;
  friend_label: string;
  amount_owed: number;
  created_at?: string;
}

export interface ShareDraft {
  friendLabel: string;
  amount: number;
}

export interface SelfTransferRule {
  id: string;
  user_id: string;
  descriptor: string;
  label?: string | null;
}

export const MAX_FRIEND_LABEL = 80;
/** A repayment is only suggested within this many days after the original expense. */
export const REIMBURSEMENT_WINDOW_DAYS = 90;

// ─── Split validation ────────────────────────────────────────────────────────

export interface SplitBreakdown {
  total: number;
  friendsTotal: number;
  yourShare: number;
}

export const computeSplit = (total: number, shares: Array<{ amount: number }>): SplitBreakdown => {
  const friendsTotal = round2(shares.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  return { total: round2(total), friendsTotal, yourShare: round2(total - friendsTotal) };
};

/** Returns an error message, or null when the shares are valid for this expense total. */
export const validateShares = (total: number, shares: ShareDraft[]): string | null => {
  for (const s of shares) {
    if (!s.friendLabel.trim()) return 'Add a name for each share.';
    if (s.friendLabel.trim().length > MAX_FRIEND_LABEL) return 'Names can be up to 80 characters.';
    if (!(Number(s.amount) > 0)) return 'Each share needs an amount above ₹0.';
  }
  const { friendsTotal } = computeSplit(total, shares);
  if (friendsTotal > round2(total)) return "Friends' shares cannot be more than the amount paid.";
  return null;
};

// ─── Outstanding / settlement (always derived, never stored) ────────────────

/** shareId → total of confirmed reimbursement rows linked to it. */
export const reimbursedByShare = (
  expenses: Array<{ amount: number | string; transaction_class?: string | null; reimburses_share_id?: string | null }>
): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.transaction_class === 'reimbursement' && e.reimburses_share_id) {
      map[e.reimburses_share_id] = round2((map[e.reimburses_share_id] || 0) + (Number(e.amount) || 0));
    }
  }
  return map;
};

export const outstandingOf = (share: Pick<ExpenseShare, 'amount_owed'>, reimbursed: number = 0): number =>
  Math.max(0, round2((Number(share.amount_owed) || 0) - (Number(reimbursed) || 0)));

// ─── Reimbursement matching ──────────────────────────────────────────────────

export interface ShareWithExpense {
  share: ExpenseShare;
  expenseDate: string; // yyyy-MM-dd
  expenseAmount: number;
}

export interface ReimbursementCandidate extends ShareWithExpense {
  outstanding: number;
  exact: boolean;
}

const daysBetween = (fromStr: string, toStr: string): number => {
  const a = Date.parse(`${fromStr}T00:00:00Z`);
  const b = Date.parse(`${toStr}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
};

/**
 * Shares an incoming payment could plausibly repay. Returns [] when nothing is relevant,
 * so callers show NO question at all. A suggestion is never a confirmation.
 *  - share must still have an outstanding balance
 *  - payment cannot predate the expense, and must be within the window
 *  - payment must not exceed what is still owed on that share (no silent over-allocation;
 *    a payment spanning several shares is left for the user to record as normal income)
 * Exact-amount matches are listed first, then oldest expense first.
 */
export const findReimbursementCandidates = (
  shares: ShareWithExpense[],
  reimbursed: Record<string, number>,
  incoming: { amount: number; date: string }
): ReimbursementCandidate[] => {
  const amount = round2(incoming.amount);
  if (!(amount > 0)) return [];
  const out: ReimbursementCandidate[] = [];
  for (const item of shares) {
    const outstanding = outstandingOf(item.share, reimbursed[item.share.id] || 0);
    if (outstanding <= 0) continue;
    const gap = daysBetween(item.expenseDate, incoming.date);
    if (gap < 0 || gap > REIMBURSEMENT_WINDOW_DAYS) continue;
    if (amount > outstanding) continue;
    out.push({ ...item, outstanding, exact: amount === outstanding });
  }
  return out.sort((a, b) => Number(b.exact) - Number(a.exact) || a.expenseDate.localeCompare(b.expenseDate));
};

/** Exactly one plausible share → offer it directly; several → the user must choose. */
export const needsUserChoice = (candidates: ReimbursementCandidate[]): boolean => candidates.length > 1;

// ─── Self-transfer rules ─────────────────────────────────────────────────────

/** Stable, narrow descriptor. Never derived from the amount. Returns null when too weak to remember. */
export const normalizeTransferDescriptor = (text?: string | null): string | null => {
  const d = (text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // Need something identifying (e.g. "hdfc to sbi 1234"); bare words/numbers are too broad.
  if (d.length < 5 || !/[a-z]/.test(d)) return null;
  return d.slice(0, 120);
};

export const findMatchingTransferRule = (
  rules: SelfTransferRule[],
  text?: string | null
): SelfTransferRule | null => {
  const d = normalizeTransferDescriptor(text);
  if (!d) return null;
  return rules.find((r) => r.descriptor === d) ?? null;
};
