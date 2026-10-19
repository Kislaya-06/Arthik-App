import * as db from './db';
import { logEvent } from './engine';
import { deleteTransaction, setTransactionCategory, setTransactionType, saveSelfTransferRule } from './ledger';
import { identityScore, ownTransferStrength, TRANSFER_WINDOW_MS } from './matching';
import type { AutoLogEvent } from './types';

/**
 * Everything the user can do with a detection. Every choice also teaches future detection,
 * using narrow rules only (exact message, or this sender's exact format — never "every ₹20").
 */

export type IgnoreScope = 'message' | 'similar';

const quiet = { origin: 'live' as const, notify: false };

/** "What is this?" → Income / Expense (after the confirm step in the UI). */
export const classifyEvent = async (
  event: AutoLogEvent,
  type: 'expense' | 'income',
  categoryId: string | null,
  rememberMerchant: boolean,
  amountOverride?: number,
  options?: { clearNeedsCategory?: boolean }
) => {
  const e = { ...event };
  if (amountOverride && amountOverride > 0) e.amount = amountOverride;
  if (e.amount == null) throw new Error('Amount is missing');
  const acc = e.accountKey ? await db.getAccount(e.accountKey) : null;
  await logEvent(e, type, categoryId, acc?.kind ?? null, quiet);
  if (options?.clearNeedsCategory) {
    e.needsCategory = false;
  }
  await db.updateEvent(e.id, {
    status: e.status, reviewReason: null, expenseId: e.expenseId, needsCategory: e.needsCategory,
    direction: e.direction, amount: e.amount,
  });
  // Teach: this message format is a real transaction in this direction.
  await db.addRule({ kind: 'accept_template', sender: e.sender, template: e.template, fingerprint: null, direction: e.direction });
  await db.learnTemplate(e.template, e.sender, e.source);
  if (rememberMerchant && e.merchant) await db.setMerchantPref(e.merchant, categoryId, type);

  await reconcileAwaitingNotifications(e);
  return e;
};

/** Reconciles any AutoLog events linked to an expense when it is saved or edited. */
export const reconcileExpenseSaved = async (expenseId: string, userId?: string) => {
  try {
    const list = await db.getEventsForExpense(expenseId);
    let changed = false;
    for (const ev of list) {
      if (ev.needsCategory || ev.status === 'pending') {
        await db.updateEvent(ev.id, { needsCategory: false, status: 'logged', reviewReason: null });
        changed = true;
      }
    }
    if (changed && userId) {
      try {
        const { useAutoLogStore } = await import('./store');
        await useAutoLogStore.getState().refresh(userId);
      } catch {
        // UI refresh best-effort
      }
    }
  } catch {
    // Best-effort
  }
};

/** Immediately reconcile compatible awaiting_sms notifications for a newly confirmed transaction. */
const reconcileAwaitingNotifications = async (e: AutoLogEvent) => {
  if (e.status !== 'logged' && e.status !== 'queued') return;
  const awaitingNotifs = await db.findEvents(
    "source = 'notification' AND (status = 'awaiting_sms' OR (status = 'pending' AND review_reason = 'notification_only')) AND amount = ? AND direction = ?",
    e.amount, e.direction
  );
  for (const notif of awaitingNotifs) {
    const score = identityScore(notif as any, e as any);
    if (score !== null && (score >= 100 || score >= 3)) {
      await db.updateEvent(notif.id, { status: 'merged', matchedId: e.id, reviewReason: null });
      if (!e.merchant && notif.merchant) {
        e.merchant = notif.merchant;
        await db.updateEvent(e.id, { merchant: notif.merchant });
      }
    }
  }
};

/** Logged already; user picks the category. */
export const setEventCategory = async (event: AutoLogEvent, categoryId: string, rememberMerchant: boolean) => {
  if (event.expenseId) await setTransactionCategory(event.expenseId, categoryId);
  await db.updateEvent(event.id, { needsCategory: false });
  if (rememberMerchant && event.merchant) {
    await db.setMerchantPref(event.merchant, categoryId, event.direction === 'credit' ? 'income' : 'expense');
  }
};

/** Possible duplicate of a manual entry. */
export const resolveDuplicate = async (event: AutoLogEvent, isSame: boolean) => {
  if (isSame) {
    await db.updateEvent(event.id, { status: 'ignored', reviewReason: null });
    return;
  }
  await classifyEvent(event, event.direction === 'credit' ? 'income' : 'expense', null, false);
};

export const ignoreEvent = async (event: AutoLogEvent, scope: IgnoreScope) => {
  if (event.expenseId && (event.status === 'logged' || event.status === 'queued')) {
    await deleteTransaction(event.expenseId);
  }
  await db.updateEvent(event.id, { status: event.origin === 'discovery' ? 'discovery' : 'ignored', reviewReason: null, needsCategory: false });
  if (scope === 'message') {
    await db.addRule({ kind: 'ignore_message', sender: event.sender, template: null, fingerprint: event.fingerprint, direction: null });
  } else {
    await db.addRule({ kind: 'ignore_template', sender: event.sender, template: event.template, fingerprint: null, direction: null });
  }
};

/** Discards a single pending review item without creating permanent ignore rules. */
export const discardEvent = async (event: AutoLogEvent) => {
  if (event.expenseId && (event.status === 'logged' || event.status === 'queued')) {
    await deleteTransaction(event.expenseId);
  }
  await db.dismissPendingEvent(event.id);
};

/** Discards all pending review items. Removes any pre-logged transactions from ledger. */
export const discardAllPending = async () => {
  const pending = await db.listPending();
  for (const event of pending) {
    if (event.expenseId && (event.status === 'logged' || event.status === 'queued')) {
      await deleteTransaction(event.expenseId);
    }
  }
  await db.clearAllPending();
};

/** Discovery review: "This is relevant" → learn the format only. Never creates a transaction (spec §10). */
export const learnFromDiscovery = async (event: AutoLogEvent, direction: 'debit' | 'credit') => {
  await db.addRule({ kind: 'accept_template', sender: event.sender, template: event.template, fingerprint: null, direction });
  await db.learnTemplate(event.template, event.sender, event.source);
  await db.updateEvent(event.id, { reviewReason: null, direction });
};

export type ProblemReason = 'wrong_amount' | 'wrong_type' | 'duplicate' | 'wrong_account' | 'not_transaction' | 'other';

/** "Report a problem" on an automatically logged transaction (spec §38.6). */
export const reportProblem = async (
  event: AutoLogEvent,
  reason: ProblemReason,
  opts: { ignoreSimilar?: boolean } = {}
): Promise<'deleted' | 'type_flipped' | 'recorded'> => {
  await db.addFeedback(event.id, event.expenseId, reason);
  if (reason === 'duplicate' || reason === 'not_transaction') {
    if (event.expenseId) await deleteTransaction(event.expenseId);
    await db.updateEvent(event.id, { status: reason === 'duplicate' ? 'duplicate' : 'ignored', needsCategory: false });
    if (reason === 'not_transaction') {
      await db.addRule(
        opts.ignoreSimilar
          ? { kind: 'ignore_template', sender: event.sender, template: event.template, fingerprint: null, direction: null }
          : { kind: 'ignore_message', sender: event.sender, template: null, fingerprint: event.fingerprint, direction: null }
      );
    }
    return 'deleted';
  }
  if (reason === 'wrong_type' && event.expenseId) {
    const next = event.direction === 'credit' ? 'expense' : 'income';
    await setTransactionType(event.expenseId, next);
    await db.updateEvent(event.id, { direction: next === 'income' ? 'credit' : 'debit' });
    if (event.merchant) await db.setMerchantPref(event.merchant, null, next);
    return 'type_flipped';
  }
  return 'recorded';
};

/**
 * "Possible own-account transfer" answer.
 *  - Yes: the debit side is removed from expenses (if it was logged) and both sides are marked as a transfer.
 *  - No : it is a separate payment, logged normally.
 * Nothing is ever deleted unless the user said yes.
 */
export const resolveTransfer = async (event: AutoLogEvent, isTransfer: boolean) => {
  if (!isTransfer) {
    await classifyEvent(event, event.direction === 'credit' ? 'income' : 'expense', null, false);
    return;
  }
  const opposite = await db.findEvents(
    "source = ? AND direction = ? AND amount = ? AND occurred_at BETWEEN ? AND ? AND status IN ('logged','queued') AND id != ?",
    event.source, event.direction === 'debit' ? 'credit' : 'debit', event.amount, event.occurredAt - TRANSFER_WINDOW_MS, event.occurredAt + TRANSFER_WINDOW_MS, event.id
  );
  const other = opposite.find((o) => {
    const debit = event.direction === 'debit' ? event : o;
    const credit = event.direction === 'debit' ? o : event;
    return ownTransferStrength(debit as any, credit as any) !== 'no';
  });
  if (other) {
    // `event` is the pending one (never logged); the other side was already logged and is removed now.
    if (other.expenseId && other.status === 'logged') await deleteTransaction(other.expenseId);
    await db.updateEvent(other.id, { status: 'transfer', reviewReason: null, matchedId: event.id, needsCategory: false });
  }
  await db.updateEvent(event.id, { status: 'transfer', reviewReason: null, matchedId: other?.id ?? null, needsCategory: false });
};

/**
 * User explicitly marks this transaction / review as a self-transfer (TXN-003).
 * - Real money invariant: self transfers are never expenses and never income.
 * - If an expense was logged, it is purged from the expense ledger / Supabase.
 * - The event status is updated to 'transfer' (reviewReason = null, needsCategory = false).
 * - If remember is true and merchant exists, merchant preference is saved as 'transfer'
 *   and registered in transferRulesStore so future transactions from this merchant
 *   are automatically classified as transfers.
 */
export const markAsSelfTransfer = async (event: AutoLogEvent, remember = true) => {
  if (event.expenseId && (event.status === 'logged' || event.status === 'queued')) {
    await deleteTransaction(event.expenseId);
  }
  let matchedOtherId: string | null = null;
  if (event.amount != null) {
    const opposite = await db.findEvents(
      "direction = ? AND amount = ? AND occurred_at BETWEEN ? AND ? AND status IN ('logged','queued','pending') AND id != ?",
      event.direction === 'debit' ? 'credit' : 'debit',
      event.amount,
      event.occurredAt - TRANSFER_WINDOW_MS,
      event.occurredAt + TRANSFER_WINDOW_MS,
      event.id
    );
    for (const other of opposite) {
      if (other.expenseId && (other.status === 'logged' || other.status === 'queued')) {
        await deleteTransaction(other.expenseId);
      }
      await db.updateEvent(other.id, { status: 'transfer', reviewReason: null, expenseId: null, needsCategory: false, matchedId: event.id });
      if (!matchedOtherId) matchedOtherId = other.id;
    }
  }
  await db.updateEvent(event.id, {
    status: 'transfer',
    reviewReason: null,
    expenseId: null,
    needsCategory: false,
    matchedId: matchedOtherId ?? event.matchedId,
  });
  if (remember && event.merchant) {
    await db.setMerchantPref(event.merchant, null, 'transfer');
    await saveSelfTransferRule(event.merchant);
  }
};

