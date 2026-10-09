import * as Crypto from 'expo-crypto';
import { hash, maskSensitive, parseEmail, parseNotification, parseSms } from './parser';
import {
  CROSS_SOURCE_WINDOW_MS,
  NOTIFICATION_WAIT_MS,
  TRANSFER_WINDOW_MS,
  IDENTITY_WINDOW_MS,
  IdentitySource,
  decideIdentity,
  identityScore,
  STRONG_SCORE,
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
/** Email-app notification: title = sender display name, body = subject + preview. */
export interface RawEmail { app: string; title: string; body: string; date: number }

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
  id: `${p.source === 'sms' ? 'sms' : p.source === 'email' ? 'eml' : 'ntf'}:${fingerprint}:${Math.floor(occurredAt / 1000)}`,
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

// ─── Source-agnostic identity (v2.1) ─────────────────────────────────────────

const ROOT_STATUSES = ['logged', 'queued', 'pending', 'awaiting_sms'];

/** Does this transaction (root event) already have a source of this type? One email per transaction, etc. */
const rootHasSource = async (root: AutoLogEvent, source: IdentitySource): Promise<boolean> => {
  if (root.source === source) return true;
  return (await db.findEvents('matched_id = ? AND source = ?', root.id, source)).length > 0;
};

interface IdentityResult {
  kind: 'none' | 'match' | 'ambiguous' | 'weak';
  root?: AutoLogEvent;
  evidence?: AutoLogEvent;
  byReference?: boolean;
}

/**
 * "Does this new event describe a transaction we already have?" — for any source.
 * Looks at events of `sources`, follows merged → root, scores each root once.
 */
const findIdentity = async (e: AutoLogEvent, sources: IdentitySource[]): Promise<IdentityResult> => {
  if (e.amount == null || !e.direction) return { kind: 'none' };
  const rows = await db.findEvents(
    `source IN (${sources.map(() => '?').join(',')}) AND id != ? AND direction = ? AND amount = ?
     AND status IN ('logged','queued','pending','awaiting_sms','merged')
     AND ((occurred_at BETWEEN ? AND ?) OR (ref IS NOT NULL AND ref = ?))`,
    ...sources, e.id, e.direction, e.amount, e.occurredAt - IDENTITY_WINDOW_MS, e.occurredAt + IDENTITY_WINDOW_MS, e.ref ?? '\u0000'
  );
  // Best evidence per root transaction.
  const perRoot = new Map<string, { root: AutoLogEvent; evidence: AutoLogEvent; score: number }>();
  for (const r of rows) {
    let root = r;
    if (r.status === 'merged') {
      const t = r.matchedId ? await db.getEvent(r.matchedId) : null;
      if (!t) continue;
      root = t;
    }
    if (!ROOT_STATUSES.includes(root.status)) continue;
    const s = identityScore(e as any, r as any);
    if (s === null) continue;
    // Without a shared reference, a transaction that already has this kind of source can't take another one.
    if (s < 100 && (await rootHasSource(root, e.source))) continue;
    const prev = perRoot.get(root.id);
    if (!prev || s > prev.score) perRoot.set(root.id, { root, evidence: r, score: s });
  }
  const reps = Array.from(perRoot.values());
  const decision = decideIdentity(e as any, reps.map((x) => ({ ...x.evidence, __root: x.root }) as any));
  if (decision.kind === 'match') {
    const t = decision.target as any;
    return { kind: 'match', root: t.__root, evidence: t, byReference: decision.byReference };
  }
  return { kind: decision.kind };
};

/** Statuses where a stronger, account-backed source should take over as the main record. */
const canTakeOver = (root: AutoLogEvent) =>
  root.status === 'awaiting_sms' ||
  (root.status === 'pending' && (root.reviewReason === 'notification_only' || root.reviewReason === 'no_account' || root.reviewReason === 'unknown_sender'));

const reviewQuestion: Record<ReviewReason, string> = {
  type: 'Is this income or an expense?',
  category: 'Choose a category.',
  possible_duplicate: 'Looks like something you already added.',
  unrecognized: 'Arthik could not read this message safely.',
  notification_only: 'Bank confirmation did not arrive.',
  no_account: 'Which account was this?',
  ambiguous_match: 'This may already be logged. Please check.',
  unknown_sender: 'Financial email from a new sender.',
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

  // ── v2.1: does an EMAIL already describe this payment? (email may have arrived first) ──
  let takeOverRoot: AutoLogEvent | null = null;
  const viaEmail = await findIdentity(e, ['email']);
  if (viaEmail.kind === 'match' && viaEmail.root) {
    const root = viaEmail.root;
    if (root.status === 'logged' || root.status === 'queued' || !canTakeOver(root)) {
      e.status = 'merged';
      e.matchedId = root.id;
      await db.insertEvent(e);
      if (!root.merchant && e.merchant) await db.updateEvent(root.id, { merchant: e.merchant });
      return { status: 'merged', eventId: e.id, accountKey: e.accountKey, isNewAccount };
    }
    takeOverRoot = root; // the bank SMS confirms a pending email → SMS becomes the main record below
  } else if (viaEmail.kind === 'ambiguous' || viaEmail.kind === 'weak') {
    return { ...(await finalizePending(e, 'ambiguous_match', opts)), isNewAccount };
  }

  // ── Cross-source match with a payment notification (spec §16, §38.1) ──
  const notifs = await db.findEvents(
    "source = 'notification' AND status IN ('awaiting_sms','pending') AND ((occurred_at BETWEEN ? AND ?) OR (ref IS NOT NULL AND ref = ?))",
    e.occurredAt - CROSS_SOURCE_WINDOW_MS, e.occurredAt + CROSS_SOURCE_WINDOW_MS, e.ref ?? '\u0000'
  );
  const match = notifs
    .filter((n) => {
      const sc = identityScore(n as any, e as any);
      return sc !== null && sc >= STRONG_SCORE;
    })
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
  if (takeOverRoot) await db.updateEvent(takeOverRoot.id, { status: 'merged', matchedId: e.id, reviewReason: null });
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
    "source = 'sms' AND status IN ('logged','pending','queued') AND ((occurred_at BETWEEN ? AND ?) OR (ref IS NOT NULL AND ref = ?))",
    e.occurredAt - CROSS_SOURCE_WINDOW_MS, e.occurredAt + CROSS_SOURCE_WINDOW_MS, e.ref ?? '\u0000'
  );
  for (const s of smsEvents) {
    const sc = identityScore(s as any, e as any);
    if (sc === null || sc < STRONG_SCORE) continue;
    const already = await db.findEvents("matched_id = ? AND source = 'notification'", s.id);
    if (already.length) continue;
    e.status = 'merged';
    e.matchedId = s.id;
    await db.insertEvent(e);
    if (!s.merchant && e.merchant) await db.updateEvent(s.id, { merchant: e.merchant });
    return { status: 'merged', eventId: e.id };
  }

  // v2.1: an email may already describe this payment.
  const viaEmail = await findIdentity(e, ['email']);
  if (viaEmail.kind === 'match' && viaEmail.root) {
    e.status = 'merged';
    e.matchedId = viaEmail.root.id;
    await db.insertEvent(e);
    if (!viaEmail.root.merchant && e.merchant) await db.updateEvent(viaEmail.root.id, { merchant: e.merchant });
    return { status: 'merged', eventId: e.id };
  }

  e.status = 'awaiting_sms';
  await db.insertEvent(e);
  if (opts.notify) await notifyPreview(e.id, e.amount, e.merchant);
  return { status: 'awaiting_sms', eventId: e.id };
};

// ─── Email notifications (v2.1, live only) ──────────────────────────────────

/**
 * Email is one more source of evidence, not a separate system (spec email §1, §40):
 * parse → filter → account check → identity against ALL sources → merge / review / new transaction.
 */
export const processEmail = async (raw: RawEmail, opts: ProcessOptions): Promise<ProcessResult> => {
  if (opts.origin !== 'live') return { status: 'skipped' }; // old emails are never imported
  const parsed = parseEmail(raw.title, raw.body, raw.date);
  if (parsed.kind === 'otp') return { status: 'skipped' }; // OTP / login / password mails: never stored

  const text = `${raw.title}: ${raw.body}`.trim();
  const fingerprint = hash(`email|${raw.title}|${normalizeBody(raw.body)}`);
  const occurredAt = parsed.txnTime ?? raw.date; // transaction time, not arrival time (spec email §17)
  const e = baseEvent(parsed, parsed.bank, text, occurredAt, fingerprint, 'live');
  if (await db.getEvent(e.id)) return { status: 'duplicate', eventId: e.id };
  // The same email shown again (notification updated / re-posted).
  const same = await db.findEvents(
    "source = 'email' AND fingerprint = ? AND occurred_at BETWEEN ? AND ?",
    fingerprint, occurredAt - 3 * 86400_000, occurredAt + 3 * 86400_000
  );
  if (same.length) return { status: 'duplicate' };

  if (parsed.kind === 'future' || parsed.kind === 'failed' || parsed.kind === 'balance' || parsed.kind === 'promo') {
    e.status = 'ignored';
    await db.insertEvent(e);
    return { status: 'ignored' };
  }

  // Which account? A bank's own email names it exactly (bank + last 4). A payment provider or an
  // unknown sender only knows the last 4 digits → use the tracked account with those digits, if exactly one.
  let isNewAccount = false;
  if (parsed.last4) {
    if (parsed.senderIsBank && e.accountKey) {
      isNewAccount = !(await db.getAccount(e.accountKey));
      await db.touchAccount(
        { key: e.accountKey, bank: parsed.bank, bankCode: parsed.bankCode, last4: parsed.last4, kind: parsed.accountKind || 'bank' },
        occurredAt,
        isNewAccount
      );
    } else {
      const sameDigits = (await db.listAccounts()).filter((a) => a.last4 === parsed.last4);
      const tracked = sameDigits.filter((a) => a.tracked);
      if (tracked.length === 1) e.accountKey = tracked[0].key;
      else if (sameDigits.length >= 1 && tracked.length === 0) e.accountKey = sameDigits[0].key; // known, untracked → filtered below
      else e.accountKey = null; // unknown or ambiguous → never guess the account (spec email §34)
    }
  }

  const verdict = await ruleVerdict(e);
  if (verdict === 'ignore') {
    e.status = 'ignored';
    await db.insertEvent(e);
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
  if (e.kind !== 'txn' || e.amount == null || !e.direction) {
    return { ...(await finalizePending(e, 'unrecognized', opts)), isNewAccount }; // no silent data loss
  }

  // Account filtering: an email that names an account the user did not select is never logged (spec email §33).
  const account = e.accountKey ? await db.getAccount(e.accountKey) : null;
  if (e.accountKey && !account?.tracked) {
    e.status = 'untracked';
    await db.insertEvent(e);
    return { status: 'untracked', accountKey: e.accountKey, isNewAccount };
  }

  // Identity against every source (spec email §14–24).
  const id = await findIdentity(e, ['sms', 'notification', 'email']);
  let takeOverRoot: AutoLogEvent | null = null;
  if (id.kind === 'match' && id.root) {
    const root = id.root;
    if (id.byReference && id.evidence?.source === 'email') {
      e.status = 'duplicate'; // the same email again
      await db.insertEvent(e);
      return { status: 'duplicate' };
    }
    if (root.status === 'logged' || root.status === 'queued' || !account || !canTakeOver(root)) {
      // Confirmation / enrichment of an existing transaction (spec email §8–10, §27).
      e.status = 'merged';
      e.matchedId = root.id;
      await db.insertEvent(e);
      if (!root.merchant && e.merchant) await db.updateEvent(root.id, { merchant: e.merchant });
      return { status: 'merged', eventId: e.id, accountKey: e.accountKey, isNewAccount };
    }
    takeOverRoot = root; // e.g. notification waiting for an SMS that never came — the email confirms it
    if (!e.merchant && root.merchant) e.merchant = root.merchant;
  } else if (id.kind === 'ambiguous' || id.kind === 'weak') {
    return { ...(await finalizePending(e, 'ambiguous_match', opts)), isNewAccount }; // spec email §21
  }

  const finishTakeOver = async () => {
    if (takeOverRoot) await db.updateEvent(takeOverRoot.id, { status: 'merged', matchedId: e.id, reviewReason: null });
  };

  // New transaction from email (email-only is valid, spec email §7, §28).
  if (!parsed.senderRecognized) {
    const r = await finalizePending(e, 'unknown_sender', opts); // spec email §32
    await finishTakeOver();
    return { ...r, isNewAccount };
  }
  if (!e.accountKey || !account) {
    const r = await finalizePending(e, 'no_account', opts);
    await finishTakeOver();
    return { ...r, isNewAccount };
  }
  if (parsed.isCardBill) {
    e.status = 'transfer';
    await db.insertEvent(e);
    await finishTakeOver();
    return { status: 'transfer', eventId: e.id };
  }

  const pref = await db.getMerchantPref(e.merchant);
  let type: 'expense' | 'income' | null = null;
  if (e.direction === 'debit') type = 'expense';
  else if (parsed.creditKind === 'salary' || parsed.creditKind === 'interest' || parsed.creditKind === 'refund') type = 'income';
  else if (pref?.type === 'income' || pref?.type === 'expense') type = pref.type;
  if (!type) {
    const r = await finalizePending(e, 'type', opts);
    await finishTakeOver();
    return { ...r, isNewAccount };
  }
  if (findManualLookalike(e.amount, type, e.occurredAt, await autoExpenseIds())) {
    const r = await finalizePending(e, 'possible_duplicate', opts);
    await finishTakeOver();
    return { ...r, isNewAccount };
  }

  await logEvent(e, type, pref?.category_id ?? null, account.kind, opts);
  await db.insertEvent(e);
  await finishTakeOver();
  return { status: e.status, eventId: e.id, accountKey: e.accountKey, isNewAccount };
};

/** Previews whose bank SMS never came → Pending Review (never auto-logged), unless an email/SMS already confirmed it. */
export const sweepAwaiting = async (now: number, notify: boolean) => {
  const stale = await db.findEvents("status = 'awaiting_sms' AND occurred_at < ?", now - NOTIFICATION_WAIT_MS);
  for (const e of stale) {
    const id = await findIdentity(e, ['email', 'sms']);
    if (id.kind === 'match' && id.root && (id.root.status === 'logged' || id.root.status === 'queued')) {
      await db.updateEvent(e.id, { status: 'merged', matchedId: id.root.id, reviewReason: null });
      if (!id.root.merchant && e.merchant) await db.updateEvent(id.root.id, { merchant: e.merchant });
      continue;
    }
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
