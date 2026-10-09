import type { Direction } from './types';

/**
 * Pure matching rules (spec §38–39). Kept free of storage so they are unit-tested.
 */

export const CROSS_SOURCE_WINDOW_MS = 15 * 60 * 1000;
export const NOTIFICATION_WAIT_MS = 20 * 60 * 1000;
export const TRANSFER_WINDOW_MS = 15 * 60 * 1000;
export const SAME_MESSAGE_WINDOW_MS = 5 * 60 * 1000;
export const MAX_RECOVERY_DAYS = 30;
export const DISCOVERY_DAYS = 90;
export const DISCOVERY_MAX_MESSAGES = 5000;

export interface Matchable {
  amount: number | null;
  direction: Direction | null;
  occurredAt: number;
  ref: string | null;
}

const sameAmount = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) < 0.01;

/** Notification + bank SMS describing the same payment → one transaction. */
export const isCrossSourceMatch = (a: Matchable, b: Matchable): boolean => {
  if (!sameAmount(a.amount, b.amount)) return false;
  if (!a.direction || a.direction !== b.direction) return false;
  // Same reference = same payment, however late one of them arrived (spec email §15, §45).
  if (a.ref && b.ref) return a.ref === b.ref;
  if (Math.abs(a.occurredAt - b.occurredAt) > CROSS_SOURCE_WINDOW_MS) return false;
  return true;
};

/**
 * Same-source events are NEVER fuzzy-merged. Two ₹20 SMS at 10:30 and 10:34 stay separate.
 * Only an exact reference, or the literally identical message seen twice, is a duplicate.
 */
export const isSameSourceDuplicate = (
  a: Matchable & { fingerprint: string },
  b: Matchable & { fingerprint: string }
): boolean => {
  if (a.ref && b.ref) return a.ref === b.ref;
  return a.fingerprint === b.fingerprint && Math.abs(a.occurredAt - b.occurredAt) <= SAME_MESSAGE_WINDOW_MS;
};

/** Debit on one tracked account + credit on another tracked account = own transfer. */
export const isOwnTransferPair = (
  debit: Matchable & { accountKey: string | null },
  credit: Matchable & { accountKey: string | null }
): boolean =>
  debit.direction === 'debit' &&
  credit.direction === 'credit' &&
  !!debit.accountKey &&
  !!credit.accountKey &&
  debit.accountKey !== credit.accountKey &&
  sameAmount(debit.amount, credit.amount) &&
  Math.abs(debit.occurredAt - credit.occurredAt) <= TRANSFER_WINDOW_MS;

/** Human duration: "2 days, 2 hours" / "35 minutes". */
export const formatGap = (ms: number): string => {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (days > 0) return hours > 0 ? `${part(days, 'day')}, ${part(hours, 'hour')}` : part(days, 'day');
  if (hours > 0) return m > 0 ? `${part(hours, 'hour')}, ${part(m, 'minute')}` : part(hours, 'hour');
  return part(Math.max(1, m), 'minute');
};

// ─── Source-agnostic identity (v2.1, email) ─────────────────────────────────
//
// Question asked: "does this new event describe a transaction we already have?"
// Strongest proof: same reference. Without it, several independent details must agree.
// Time only supports a match; it never defines identity (emails can arrive hours later).

/** How far apart two descriptions of one payment may be when no reference is available. */
export const IDENTITY_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Same reference may still match this long after (very delayed SMS / email). */
export const REFERENCE_WINDOW_MS = 30 * 86400_000;
export const STRONG_SCORE = 3;

export type IdentitySource = 'sms' | 'notification' | 'email';

export interface IdentityEvidence extends Matchable {
  source: IdentitySource;
  accountKey: string | null;
  merchant: string | null;
}

const last4Of = (key: string | null) => (key ? key.split(':').pop() || null : null);
const normMerchant = (m: string | null) => {
  if (!m) return '';
  let s = m.toLowerCase();
  s = s.replace(/^(?:upi\/(?:\d+\/)?|vpa\s+|trf\s+to\s+|paid\s+to\s+|info:?\s*)+/i, '');
  if (s.includes('@')) s = s.split('@')[0];
  return s.replace(/[^a-z0-9]/g, '');
};

export const merchantsAgree = (a: string | null, b: string | null): boolean | null => {
  const x = normMerchant(a);
  const y = normMerchant(b);
  if (x.length < 3 || y.length < 3) return null; // unknown, not a contradiction
  return x.includes(y) || y.includes(x) || x.slice(0, 5) === y.slice(0, 5);
};

/**
 * Score of "a and b are the same payment". `null` = cannot be the same (contradiction).
 * 100 = same reference. Otherwise: amount+direction (1) + account (2) + merchant (2) + same day (1) + within 30 min (1).
 */
export const identityScore = (a: IdentityEvidence, b: IdentityEvidence): number | null => {
  if (!sameAmount(a.amount, b.amount) || !a.direction || a.direction !== b.direction) return null;
  if (a.ref && b.ref) {
    return a.ref === b.ref && Math.abs(a.occurredAt - b.occurredAt) <= REFERENCE_WINDOW_MS ? 100 : null;
  }
  if (a.source === b.source) return null; // same-source protection: never fuzzy-merge (two real ₹20 payments)
  const dt = Math.abs(a.occurredAt - b.occurredAt);
  if (dt > IDENTITY_WINDOW_MS) return null;
  const la = last4Of(a.accountKey);
  const lb = last4Of(b.accountKey);
  if (la && lb && la !== lb) return null; // different accounts
  const m = merchantsAgree(a.merchant, b.merchant);
  if (m === false) return null; // different merchants
  let score = 1;
  const accountAgrees = !!(la && lb && la === lb);
  if (accountAgrees) score += 2;
  if (m === true) score += 2;
  if (new Date(a.occurredAt).toDateString() === new Date(b.occurredAt).toDateString()) score += 1;
  if (dt <= 30 * 60_000) score += 1;
  // Amount + direction + time alone is never enough: another independent detail (same account
  // or same merchant) must agree. Otherwise it stays "weak" and goes to review, never auto-merged.
  if (!accountAgrees && m !== true) return Math.min(score, STRONG_SCORE - 1);
  return score;
};

export type IdentityDecision<T> =
  | { kind: 'none' }
  | { kind: 'match'; target: T; byReference: boolean }
  | { kind: 'ambiguous'; candidates: T[] }   // two or more strong candidates → review
  | { kind: 'weak'; candidates: T[] };       // only weak candidates → review (never auto-merge, never silently duplicate)

/** Picks what a new event should do against existing transactions (spec email §14–24, §40). */
export const decideIdentity = <T extends IdentityEvidence>(event: IdentityEvidence, existing: T[]): IdentityDecision<T> => {
  const scored = existing
    .map((c) => ({ c, s: identityScore(event, c) }))
    .filter((x): x is { c: T; s: number } => x.s !== null);
  const byRef = scored.filter((x) => x.s >= 100);
  if (byRef.length) return { kind: 'match', target: byRef[0].c, byReference: true };
  const strong = scored.filter((x) => x.s >= STRONG_SCORE);
  if (strong.length === 1) return { kind: 'match', target: strong[0].c, byReference: false };
  if (strong.length > 1) return { kind: 'ambiguous', candidates: strong.map((x) => x.c) };
  if (scored.length) return { kind: 'weak', candidates: scored.map((x) => x.c) };
  return { kind: 'none' };
};
