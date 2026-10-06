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
  if (Math.abs(a.occurredAt - b.occurredAt) > CROSS_SOURCE_WINDOW_MS) return false;
  if (a.ref && b.ref && a.ref !== b.ref) return false; // two different references = two payments
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
