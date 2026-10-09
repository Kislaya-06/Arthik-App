import * as db from './db';
import { logEvent } from './engine';
import { deleteTransaction, setTransactionCategory, setTransactionType } from './ledger';
import { identityScore } from './matching';
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

  // Immediately reconcile compatible awaiting_sms notifications for this newly confirmed transaction
  if (e.status === 'logged' || e.status === 'queued') {
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
  }

  return e;
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
