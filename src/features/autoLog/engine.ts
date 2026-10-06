import * as Crypto from 'expo-crypto';
import { hash, maskSensitive, parseNotification, parseSms } from './parser';
import {
  CROSS_SOURCE_WINDOW_MS,
  NOTIFICATION_WAIT_MS,
  TRANSFER_WINDOW_MS,
  isCrossSourceMatch,
  isOwnTransferPair,
  isSameSourceDuplicate,
} from './matching';
import * as db from './db';
import { createTransaction, deleteTransaction, findManualLookalike, paymentModeFor } from './ledger';
import { notifyLogged, notifyNeedsReview, notifyPreview } from './notify';
import type { AutoLogEvent, EventOrigin, EventStatus, ParsedMessage, ReviewReason } from './types';

/**
 * The decision pipeline (spec §49):
 *   parse → privacy/noise filter → user rules → tracked-account filter → dedupe
 *   → transfers → cross-source match → confidence → log | Pending Review
 */

export interface RawSms { address: string; body: string; date: number }
export interface RawNotification { app: string; title: string; body: string; date: number }

export interface ProcessOptions {
  origin: EventOrigin;
  /** Show local notifications (live only, not recovery/discovery). */
  notify: boolean;
}

export interface ProcessResult {
  status: EventStatus | 'skipped';
  eventId?: string;
  reviewReason?: ReviewReason | null;
  accountKey?: string | null;
  isNewAccount?: boolean;
  learnedTemplate?: boolean;
}

const normalizeBody = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const accountKeyOf = (p: ParsedMessage) => (p.last4 ? `${p.bankCode}:${p.last4}` : null);

const baseEvent = (
  p: ParsedMessage,
  sender: string,
  body: string,
  occurredAt: number,
  fingerprint: string,
  origin: EventOrigin
): AutoLogEvent => ({
  id: `${p.source === 'sms' ? 'sms' : 'ntf'}:${fingerprint}:${Math.floor(occurredAt / 1000)}`,
  source: p.source,
  origin,
  sender,
  body: maskSensitive(body).slice(0, 600),
  fingerprint,
  occurredAt,
  amount: p.amount ?? null,
  direction: p.direction ?? null,
  accountKey: accountKeyOf(p),
  merchant: p.merchant ?? null,
  ref: p.ref ?? null,
  template: p.template,
  kind: p.kind,
  status: 'ignored',
  reviewReason: null,
  expenseId: null,
  matchedId: null,
  needsCategory: false,
  createdAt: Date.now(),
});

const ruleVerdict = async (e: AutoLogEvent): Promise<'ignore' | { accept: 'debit' | 'credit' } | null> => {
  const rules = await db.listRules();
  for (const r of rules) {
    if (r.kind === 'ignore_message' && r.fingerprint === e.fingerprint) return 'ignore';
    if (r.kind === 'ignore_template' && r.template === e.template) return 'ignore';
  }
  const accept = rules.find((r) => r.kind === 'accept_template' && r.template === e.template);
  if (accept && (accept.direction === 'debit' || accept.direction === 'credit')) return { accept: accept.direction };
  return null;
};

/** Fallback amount for a user-accepted template the parser could not read. */
const looseAmount = (text: string): number | null => {
  const m = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const autoExpenseIds = async (): Promise<Set<string>> => {
  const rows = await db.findEvents("expense_id IS NOT NULL AND occurred_at > ?", Date.now() - 3 * 86400_000);
  return new Set(rows.map((r) => r.expenseId as string));
};

const reviewQuestion: Record<ReviewReason, string> = {
  type: 'Is this income or an expense?',
  category: 'Choose a category.',
  possible_duplicate: 'Looks like something you already added.',
  unrecognized: 'Arthik could not read this message safely.',
  notification_only: 'Bank confirmation did not arrive.',
  no_account: 'Which account was this?',
};

const finalizePending = async (e: AutoLogEvent, reason: ReviewReason, opts: ProcessOptions) => {
  e.status = 'pending';
  e.reviewReason = reason;
  await db.insertEvent(e);
  if (opts.notify) await notifyNeedsReview(e.id, e.amount, e.merchant, reviewQuestion[reason]);
  return { status: e.status, eventId: e.id, reviewReason: reason, accountKey: e.accountKey };
};

/** Creates the transaction for a decided event. Falls back to `queued` if it cannot be written now. */
export const logEvent = async (
  e: AutoLogEvent,
  type: 'expense' | 'income',
  categoryId: string | null,
  accountKind: string | null,
  opts: ProcessOptions
) => {
  const id = e.expenseId || Crypto.randomUUID();
  const note = e.merchant || (type === 'income' ? 'Income (auto)' : 'Expense (auto)');
  const created = await createTransaction(
    { amount: e.amount as number, type, categoryId, note, paymentMode: paymentModeFor(accountKind, type), occurredAt: e.occurredAt },
    id
  );
  e.expenseId = id;
  e.needsCategory = !categoryId;
  e.status = created ? 'logged' : 'queued';
  e.direction = type === 'income' ? 'credit' : 'debit';
  e.reviewReason = null;
  if (created && opts.notify) await notifyLogged(e.id, e.amount, e.merchant, id, type === 'income');
};

// ─── SMS ────────────────────────────────────────────────────────────────────

export const processSms = async (raw: RawSms, opts: ProcessOptions): Promise<ProcessResult> => {
  const parsed = parseSms(raw.address, raw.body);
  if (parsed.kind === 'otp') return { status: 'skipped' }; // never stored

  const fingerprint = hash(`${raw.address}|${normalizeBody(raw.body)}`);
  const e = baseEvent(parsed, parsed.bank, raw.body, raw.date, fingerprint, opts.origin);
  if (await db.getEvent(e.id)) return { status: 'duplicate', eventId: e.id };

  // Noise: future / failed / balance / promo are never transactions (spec §39).
  if (parsed.kind === 'future' || parsed.kind === 'failed' || parsed.kind === 'balance' || parsed.kind === 'promo') {
    if (opts.origin !== 'discovery') {
      e.status = 'ignored';
      await db.insertEvent(e);
    }
    return { status: 'ignored' };
  }

  // Account bookkeeping. New accounts are always UNtracked until the user chooses (trust rule 4).
  let isNewAccount = false;
  if (e.accountKey && parsed.last4) {
    const existing = await db.getAccount(e.accountKey);
    isNewAccount = !existing;
    await db.touchAccount(
      { key: e.accountKey, bank: parsed.bank, bankCode: parsed.bankCode, last4: parsed.last4, kind: parsed.accountKind || 'bank' },
      raw.date,
      opts.origin !== 'discovery' && isNewAccount
    );
  }

  const verdict = await ruleVerdict(e);
  if (verdict === 'ignore') {
    e.status = 'ignored';
    if (opts.origin !== 'discovery') await db.insertEvent(e);
    return { status: 'ignored', accountKey: e.accountKey, isNewAccount };
  }
  if (verdict && parsed.kind === 'unknown') {
    const amount = looseAmount(raw.body);
    if (amount) {
      e.kind = 'txn';
      e.amount = amount;
      e.direction = verdict.accept;
    }
  }

  // ── Discovery: learn only, never log (spec §5, §10, §40) ──
  if (opts.origin === 'discovery') {
    e.status = 'discovery';
    let learnedTemplate = false;
    if (e.kind === 'txn' && e.accountKey) {
      learnedTemplate = !(await db.templateExists(e.template));
      await db.learnTemplate(e.template, parsed.bank, 'sms');
    } else if (!verdict) {
      e.reviewReason = 'unrecognized'; // "A few messages need your help"
    }
    await db.insertEvent(e);
    return { status: 'discovery', eventId: e.id, reviewReason: e.reviewReason, accountKey: e.accountKey, isNewAccount, learnedTemplate };
  }

  if (e.kind !== 'txn' || e.amount == null || !e.direction) {
    return { ...(await finalizePending(e, 'unrecognized', opts)), isNewAccount };
  }

  // ── Tracked-account filter ──
  if (!e.accountKey) return { ...(await finalizePending(e, 'no_account', opts)), isNewAccount };
  const account = await db.getAccount(e.accountKey);
  if (!account || !account.tracked) {
    e.status = 'untracked';
    await db.insertEvent(e);
    return { status: 'untracked', accountKey: e.accountKey, isNewAccount };
  }

  // ── Same-source dedupe (never fuzzy) ──
  const near = await db.findEvents(
    "source = 'sms' AND amount = ? AND occurred_at BETWEEN ? AND ? AND status NOT IN ('duplicate')",
    e.amount, e.occurredAt - 2 * 86400_000, e.occurredAt + 2 * 86400_000
  );
  if (near.some((n) => isSameSourceDuplicate(n, e))) {
    e.status = 'duplicate';
    await db.insertEvent(e);
    return { status: 'duplicate' };
  }

  // ── Card bill / own transfers never become expenses (spec §38.4) ──
  if (parsed.isCardBill) {
    e.status = 'transfer';
    await db.insertEvent(e);
    return { status: 'transfer', eventId: e.id };
  }
  const opposite = await db.findEvents(
    "source = 'sms' AND direction = ? AND amount = ? AND occurred_at BETWEEN ? AND ? AND status IN ('logged','pending','queued')",
    e.direction === 'debit' ? 'credit' : 'debit', e.amount, e.occurredAt - TRANSFER_WINDOW_MS, e.occurredAt + TRANSFER_WINDOW_MS
  );
  for (const o of opposite) {
    const otherAcc = o.accountKey ? await db.getAccount(o.accountKey) : null;
    if (!otherAcc?.tracked) continue;
    const pair = e.direction === 'debit' ? isOwnTransferPair(e, o) : isOwnTransferPair(o, e);
    if (!pair) continue;
    if (o.expenseId && o.status === 'logged') await deleteTransaction(o.expenseId);
    await db.updateEvent(o.id, { status: 'transfer', reviewReason: null, matchedId: e.id, needsCategory: false });
    e.status = 'transfer';
    e.matchedId = o.id;
    await db.insertEvent(e);
    return { status: 'transfer', eventId: e.id };
  }

  // ── Cross-source match with a payment notification (spec §16, §38.1) ──
  const notifs = await db.findEvents(
    "source = 'notification' AND status IN ('awaiting_sms','pending') AND occurred_at BETWEEN ? AND ?",
    e.occurredAt - CROSS_SOURCE_WINDOW_MS, e.occurredAt + CROSS_SOURCE_WINDOW_MS
  );
  const match = notifs
    .filter((n) => isCrossSourceMatch(n, e))
    .sort((a, b) => Math.abs(a.occurredAt - e.occurredAt) - Math.abs(b.occurredAt - e.occurredAt))[0];
  if (match) {
    await db.updateEvent(match.id, { status: 'merged', matchedId: e.id, reviewReason: null });
    if (match.merchant) e.merchant = match.merchant; // payment apps usually name the merchant better
  }

  // ── Confidence & type ──
  const pref = await db.getMerchantPref(e.merchant);
  let type: 'expense' | 'income' | null = null;
  if (e.direction === 'debit') type = 'expense';
  else if (parsed.creditKind === 'salary' || parsed.creditKind === 'interest' || parsed.creditKind === 'refund') type = 'income';
  else if (pref?.type === 'income' || pref?.type === 'expense') type = pref.type;

  if (!type) return { ...(await finalizePending(e, 'type', opts)), isNewAccount };

  // A manual entry that looks the same → ask, don't double count.
  const lookalike = findManualLookalike(e.amount, type, e.occurredAt, await autoExpenseIds());
  if (lookalike) return { ...(await finalizePending(e, 'possible_duplicate', opts)), isNewAccount };

  await logEvent(e, type, pref?.category_id ?? null, account.kind, opts);
  await db.insertEvent(e);
  return { status: e.status, eventId: e.id, accountKey: e.accountKey, isNewAccount };
};

// ─── Notifications (live only — fast preview, never logged alone) ──────────

export const processNotification = async (raw: RawNotification, opts: ProcessOptions): Promise<ProcessResult> => {
  if (opts.origin !== 'live') return { status: 'skipped' };
  const parsed = parseNotification(raw.app, raw.title, raw.body);
  if (parsed.kind !== 'txn' || parsed.amount == null) return { status: 'skipped' };

  const text = `${raw.title} ${raw.body}`.trim();
  const fingerprint = hash(`${raw.app}|${normalizeBody(text)}`);
  const e = baseEvent(parsed, raw.app, text, raw.date, fingerprint, 'live');
  if (await db.getEvent(e.id)) return { status: 'duplicate' };
  // Payment apps re-post the same notification; identical text within 5 min is the same payment.
  const same = await db.findEvents(
    "source = 'notification' AND fingerprint = ? AND occurred_at BETWEEN ? AND ?",
    fingerprint, raw.date - 5 * 60_000, raw.date + 5 * 60_000
  );
  if (same.length) return { status: 'duplicate' };

  if ((await ruleVerdict(e)) === 'ignore') {
    e.status = 'ignored';
    await db.insertEvent(e);
    return { status: 'ignored' };
  }

  // Bank SMS may have arrived first.
  const smsEvents = await db.findEvents(
    "source = 'sms' AND status IN ('logged','pending','queued') AND occurred_at BETWEEN ? AND ?",
    e.occurredAt - CROSS_SOURCE_WINDOW_MS, e.occurredAt + CROSS_SOURCE_WINDOW_MS
  );
  for (const s of smsEvents) {
    if (!isCrossSourceMatch(s, e)) continue;
    const already = await db.findEvents("matched_id = ? AND source = 'notification'", s.id);
    if (already.length) continue;
    e.status = 'merged';
    e.matchedId = s.id;
    await db.insertEvent(e);
    if (!s.merchant && e.merchant) await db.updateEvent(s.id, { merchant: e.merchant });
    return { status: 'merged', eventId: e.id };
  }

  e.status = 'awaiting_sms';
  await db.insertEvent(e);
  if (opts.notify) await notifyPreview(e.id, e.amount, e.merchant);
  return { status: 'awaiting_sms', eventId: e.id };
};

/** Previews whose bank SMS never came → Pending Review (never auto-logged). */
export const sweepAwaiting = async (now: number, notify: boolean) => {
  const stale = await db.findEvents("status = 'awaiting_sms' AND occurred_at < ?", now - NOTIFICATION_WAIT_MS);
  for (const e of stale) {
    await db.updateEvent(e.id, { status: 'pending', reviewReason: 'notification_only' });
    if (notify) await notifyNeedsReview(e.id, e.amount, e.merchant, reviewQuestion.notification_only);
  }
  return stale.length;
};

/** Retries transactions that could not be written earlier (offline / app closed). */
export const flushQueued = async () => {
  const queued = await db.findEvents("status = 'queued'");
  for (const e of queued) {
    const acc = e.accountKey ? await db.getAccount(e.accountKey) : null;
    const pref = await db.getMerchantPref(e.merchant);
    const type = e.direction === 'credit' ? 'income' : 'expense';
    await logEvent(e, type, pref?.category_id ?? null, acc?.kind ?? null, { origin: e.origin, notify: false });
    await db.updateEvent(e.id, { status: e.status, expenseId: e.expenseId, needsCategory: e.needsCategory });
  }
};
