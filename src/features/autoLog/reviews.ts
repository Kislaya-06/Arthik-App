import * as db from './db';
import { logEvent } from './engine';
import { deleteTransaction, setTransactionCategory, setTransactionType } from './ledger';
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
  amountOverride?: number
) => {
  const e = { ...event };
  if (amountOverride && amountOverride > 0) e.amount = amountOverride;
  if (e.amount == null) throw new Error('Amount is missing');
  const acc = e.accountKey ? await db.getAccount(e.accountKey) : null;
  await logEvent(e, type, categoryId, acc?.kind ?? null, quiet);
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
 * "Is this your friend's share of a split?"
 *  - shareId given: the money is logged as a REIMBURSEMENT linked to that share. The split is settled and the
 *    money goes back to where the expense was paid from (budget / income / Gullak), see moneyWaterfall.ts.
 *  - shareId null: it is not a split repayment; the normal "Income or Expense?" question follows.
 */
export const resolveSplitRepayment = async (event: AutoLogEvent, shareId: string | null, friendLabel?: string) => {
  if (!shareId) {
    await db.updateEvent(event.id, { reviewReason: 'type' });
    return;
  }
  const e = { ...event };
  if (e.amount == null) throw new Error('Amount is missing');
  const acc = e.accountKey ? await db.getAccount(e.accountKey) : null;
  await logEvent(e, 'income', null, acc?.kind ?? null, quiet, {
    reimbursesShareId: shareId,
    note: friendLabel ? `Split repayment · ${friendLabel}` : 'Split repayment',
  });
  await db.updateEvent(e.id, {
    status: e.status, reviewReason: null, expenseId: e.expenseId, needsCategory: false, direction: 'credit', amount: e.amount,
  });
  await reconcileAwaitingNotifications(e);
  return e;
};
