import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same test doubles as autoLogFlows.test.ts: REAL db + engine + service, fake native/ledger/server.
vi.mock('expo-sqlite', async () => (await import('./helpers/autoLogTestEnv')).fakeSqlite);
vi.mock('expo-secure-store', async () => (await import('./helpers/autoLogTestEnv')).fakeSecureStore);
vi.mock('expo-crypto', async () => (await import('./helpers/autoLogTestEnv')).fakeCrypto);
vi.mock('../modules/arthik-autolog', async () => {
  const env = await import('./helpers/autoLogTestEnv');
  return { ArthikAutoLog: env.fakeNative, isAutoLogNativeAvailable: () => true };
});
vi.mock('../src/features/autoLog/ledger', async () => (await import('./helpers/autoLogTestEnv')).fakeLedger);
vi.mock('../src/features/autoLog/remote', async () => (await import('./helpers/autoLogTestEnv')).fakeRemote);
vi.mock('../src/features/autoLog/notify', () => ({
  notifyPreview: vi.fn(async () => {}),
  notifyLogged: vi.fn(async () => {}),
  notifyNeedsReview: vi.fn(async () => {}),
}));
vi.mock('../src/features/autoLog/permissions', () => ({ hasSmsPermission: async () => true }));
vi.mock('../src/features/autoLog/background', () => ({ registerBackground: async () => {}, unregisterBackground: async () => {} }));

import { resetEnv, native, ledger, receiveSms, receiveNotification, receiveEmail } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { parseEmail, extractTxnTime, resolveEmailSender } from '../src/features/autoLog/parser';
import { decideIdentity, identityScore } from '../src/features/autoLog/matching';
import { classifyEvent } from '../src/features/autoLog/reviews';
import { sweepAwaiting } from '../src/features/autoLog/engine';

const U = 'user-1';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const HDFC = 'VM-HDFCBK';
const HDFC_EMAIL = 'HDFC Bank InstaAlerts';

const pad = (n: number) => String(n).padStart(2, '0');
const dmy = (t: number) => { const d = new Date(t); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`; };
const hm = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const smsDebit = (amt: number, to: string, ref: string, opts: { account?: string } = {}) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *${opts.account ?? '1234'} To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;
const emailDebit = (amt: number, to: string, at: number, opts: { ref?: string; account?: string } = {}) =>
  `Transaction alert. Rs. ${amt}.00 has been debited from your account ${opts.account ?? 'XX1234'} for a UPI payment to ${to} on ${dmy(at)} at ${hm(at)}.` +
  (opts.ref ? ` UPI Ref ${opts.ref}.` : '') +
  ' Never share your OTP or password with anyone.';

/** Live with HDFC ••••1234 tracked and email detection ON. */
const goLive = async (emailOn = true, trackedKeys = ['HDFC:1234']) => {
  receiveSms(HDFC, smsDebit(10, 'OLD SHOP', '600000000001'), Date.now() - 10 * DAY);
  await service.runDiscovery(U);
  await service.completeSetup(U, { trackedKeys, keepAccounts: [] });
  if (emailOn) await service.setEmailEnabled(U, true);
};
const run = () => service.processQueue(U, { notify: false });
const txs = () => [...ledger.txs.values()];
const sourcesOf = async (expenseId: string) => (await db.getEventsForExpense(expenseId)).map((e) => e.source).sort();

beforeEach(async () => {
  await db.closeDb();
  resetEnv();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('parseEmail', () => {
  const now = Date.now();
  it('reads a bank alert email, ignoring the "never share your OTP" footer', () => {
    const p = parseEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', now - 5 * MIN, { ref: '839201928311' }), now);
    expect(p.source).toBe('email');
    expect(p.kind).toBe('txn');
    expect(p.amount).toBe(500);
    expect(p.direction).toBe('debit');
    expect(p.last4).toBe('1234');
    expect(p.bankCode).toBe('HDFC');
    expect(p.merchant).toBe('Zomato');
    expect(p.ref).toBe('839201928311');
    expect(p.senderRecognized).toBe(true);
  });
  it.each([
    ['OTP mail', '123456 is your OTP for a transaction of Rs 500 at Amazon'],
    ['login alert', 'Security alert: new sign-in to your NetBanking from Chrome on Windows. Rs 0 charged'],
    ['password reset', 'Reset your password for HDFC NetBanking'],
  ])('%s → never a transaction', (_l, body) => {
    expect(parseEmail(HDFC_EMAIL, body, now).kind).toBe('otp');
  });
  it.each([
    ['future debit', 'Rs 499 will be debited from your account XX1234 on 10-Oct for NETFLIX'],
    ['failed', 'Your payment of Rs 300 from account XX1234 has failed'],
    ['statement', 'Your credit card statement is generated. Total amount due Rs 4,500'],
  ])('%s → not a transaction', (_l, body) => {
    expect(parseEmail(HDFC_EMAIL, body, now).kind).not.toBe('txn');
  });
  it('a payment provider email (only last 4 known) uses the tracked account with those digits', async () => {
    await goLive();
    receiveEmail('Paytm', 'Paid Rs. 150.00 to SWIGGY using your card XX1234. Order ID 4567.', Date.now());
    await run();
    expect(txs().map((t) => t.amount)).toEqual([150]);
  });
  it('unknown sender is marked unrecognised', () => {
    expect(resolveEmailSender('Some Shop Billing').recognized).toBe(false);
    expect(resolveEmailSender('ICICI Bank').recognized).toBe(true);
    expect(resolveEmailSender('Paytm').recognized).toBe(true);
  });
  it('transaction time comes from the email text, not the arrival time', () => {
    const happened = new Date(); happened.setHours(10, 30, 0, 0);
    const arrived = happened.getTime() + 3 * HOUR;
    const t = extractTxnTime(`debited on ${dmy(happened.getTime())} at 10:30 AM`, arrived);
    expect(t).toBe(happened.getTime());
  });
  it('ignores a time in the future or older than a week', () => {
    const now2 = Date.now();
    expect(extractTxnTime(`on ${dmy(now2 + 2 * DAY)} at 10:30`, now2)).toBeUndefined();
    expect(extractTxnTime(`on ${dmy(now2 - 10 * DAY)} at 10:30`, now2)).toBeUndefined();
  });
});

describe('identity rules (pure)', () => {
  const t = Date.UTC(2026, 9, 5, 10, 30);
  const ev = (o: any) => ({ amount: 500, direction: 'debit' as const, occurredAt: t, ref: null, source: 'email' as const, accountKey: null, merchant: null, ...o });
  it('same reference = same transaction even hours later', () => {
    expect(identityScore(ev({ ref: 'R1' }), ev({ source: 'sms', ref: 'R1', occurredAt: t + 6 * HOUR }))).toBe(100);
  });
  it('different accounts or merchants never match', () => {
    expect(identityScore(ev({ accountKey: 'HDFC:1234' }), ev({ source: 'sms', accountKey: 'HDFC:5678' }))).toBeNull();
    expect(identityScore(ev({ merchant: 'Zomato' }), ev({ source: 'sms', merchant: 'Swiggy' }))).toBeNull();
  });
  it('same source without a reference never fuzzy-merges', () => {
    expect(identityScore(ev({ merchant: 'Rahul' }), ev({ merchant: 'Rahul' }))).toBeNull();
  });
  it('two equally good candidates → ambiguous (review)', () => {
    const a = ev({ source: 'sms', merchant: 'Zomato', occurredAt: t - 30 * MIN });
    const b = ev({ source: 'sms', merchant: 'Zomato', occurredAt: t + 7 * HOUR });
    expect(decideIdentity(ev({ merchant: 'Zomato' }), [a, b]).kind).toBe('ambiguous');
  });
});

describe('Email-only transactions (spec §7, §28, §42)', () => {
  it('recognised sender + tracked account → logged automatically, source = email', async () => {
    await goLive();
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', Date.now(), { ref: '839201928311' }), Date.now());
    await run();
    expect(txs()).toHaveLength(1);
    expect(txs()[0].note).toBe('Zomato');
    expect(await sourcesOf(txs()[0].id)).toEqual(['email']);
  });

  it('account not tracked → not logged (spec §33)', async () => {
    await goLive();
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', Date.now(), { account: 'XX5678' }), Date.now());
    await run();
    expect(txs()).toHaveLength(0);
    expect((await db.findEvents("status = 'untracked'")).length).toBe(1);
  });

  it('unknown sender → Pending Review, not logged (spec §32)', async () => {
    await goLive();
    receiveEmail('Billing Team', emailDebit(500, 'ZOMATO', Date.now()), Date.now());
    await run();
    expect(txs()).toHaveLength(0);
    expect((await db.listPending())[0].reviewReason).toBe('unknown_sender');
  });

  it('money from a person → What is this? (spec §26)', async () => {
    await goLive();
    receiveEmail(HDFC_EMAIL, `Rs. 2,000.00 has been credited to your account XX1234 by VPA rahul.k@okaxis on ${dmy(Date.now())}.`, Date.now());
    await run();
    expect(txs()).toHaveLength(0);
    expect((await db.listPending())[0].reviewReason).toBe('type');
  });

  it('OTP / login emails are never stored; promos and reminders never log', async () => {
    await goLive();
    receiveEmail(HDFC_EMAIL, '123456 is your OTP for a transaction of Rs 500', Date.now());
    receiveEmail(HDFC_EMAIL, 'Rs 499 will be debited from your account XX1234 on 10-Oct for NETFLIX', Date.now());
    await run();
    expect(txs()).toHaveLength(0);
    expect(await db.countPending()).toBe(0);
  });

  it('the same email shown twice is logged once', async () => {
    await goLive();
    const body = emailDebit(250, 'UBER', Date.now(), { ref: '839201928399' });
    receiveEmail(HDFC_EMAIL, body, Date.now());
    receiveEmail(HDFC_EMAIL, body, Date.now() + 2 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
  });

  it('two genuine ₹20 emails to the same person stay two transactions (spec §23)', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, emailDebit(20, 'RAHUL', t - 10 * MIN), t);
    receiveEmail(HDFC_EMAIL, emailDebit(20, 'RAHUL', t - 2 * MIN), t + MIN);
    await run();
    expect(txs()).toHaveLength(2);
  });
});

describe('Multiple sources, one transaction (spec §8–10, §15, §41, §45)', () => {
  it('SMS then email with the same reference → one transaction, sources SMS + email', async () => {
    await goLive();
    const t = Date.now();
    receiveSms(HDFC, smsDebit(500, 'ZOMATO', '839201928311'), t);
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', t, { ref: '839201928311' }), t + 3 * HOUR);
    await run();
    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(txs()[0].id)).toEqual(['email', 'sms']);
  });

  it('delayed email without a reference still merges when account + merchant agree', async () => {
    await goLive();
    const t = Date.now() - 4 * HOUR;
    receiveSms(HDFC, smsDebit(799, 'AMAZON', '839201928320'), t);
    await run();
    receiveEmail(HDFC_EMAIL, emailDebit(799, 'AMAZON', t), Date.now());
    await run();
    expect(txs()).toHaveLength(1);
  });

  it('email first, bank SMS later → SMS joins the email transaction', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, emailDebit(350, 'SWIGGY', t), t);
    await run();
    receiveSms(HDFC, smsDebit(350, 'SWIGGY', '839201928330'), t + 40 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(txs()[0].id)).toEqual(['email', 'sms']);
  });

  it('notification + email, no SMS → the email confirms it (SMS is not mandatory)', async () => {
    await goLive();
    const t = Date.now();
    receiveNotification('PhonePe', 'Paid ₹500 to Zomato', 'Payment successful', t);
    await run();
    expect(txs()).toHaveLength(0); // still waiting
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', t), t + 10 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(txs()[0].id)).toEqual(['email', 'notification']);
  });

  it('notification → SMS → email: all three sources, one transaction', async () => {
    await goLive();
    const t = Date.now();
    receiveNotification('Google Pay', '₹500 paid to Zomato', '', t);
    receiveSms(HDFC, smsDebit(500, 'ZOMATO', '839201928340'), t + 4 * MIN);
    await run();
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', t, { ref: '839201928340' }), t + 50 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(txs()[0].id)).toEqual(['email', 'notification', 'sms']);
  });

  it('two ₹500 Zomato transactions + an email that could be either → Pending Review (spec §21, §44)', async () => {
    await goLive();
    const morning = Date.now() + MIN; // both after the live boundary
    const evening = morning + 8 * HOUR;
    const now = evening + MIN;
    receiveSms(HDFC, smsDebit(500, 'ZOMATO', '839201928350'), morning);
    receiveSms(HDFC, smsDebit(500, 'ZOMATO', '839201928351'), evening);
    await run();
    expect(txs()).toHaveLength(2);
    // Email with no reference and no time → could be either one.
    receiveEmail(HDFC_EMAIL, 'Rs. 500.00 has been debited from your account XX1234 for a UPI payment to ZOMATO.', now);
    await run();
    expect(txs()).toHaveLength(2);
    expect((await db.listPending()).some((p) => p.reviewReason === 'ambiguous_match')).toBe(true);
  });
});

describe('Independent sources (spec §38–39)', () => {
  it('email OFF → email events are ignored, SMS keeps working', async () => {
    await goLive(false);
    native.email = true; // even if something queued an email…
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', Date.now()), Date.now());
    receiveSms(HDFC, smsDebit(120, 'SWIGGY', '839201928360'), Date.now());
    await run();
    expect(txs().map((t) => t.amount)).toEqual([120]);
  });

  it('turning email on/off sets the native switch and survives sign-out → sign-in', async () => {
    await goLive();
    expect(native.email).toBe(true);
    await service.onBeforeSignOut(U);
    native.email = false;
    await service.evaluateEntry(U);
    await service.resumeLive(U);
    expect(native.email).toBe(true);
    await service.setEmailEnabled(U, false);
    expect(native.email).toBe(false);
  });

  it('old emails (before setup) are never imported', async () => {
    await goLive();
    const liveSince = (await db.getMetaNum('live_since')) as number;
    native.queue.push(JSON.stringify({ type: 'email', app: 'Gmail', title: HDFC_EMAIL, body: emailDebit(900, 'OLD', liveSince - HOUR), date: liveSince - HOUR }));
    await run();
    expect(txs()).toHaveLength(0);
  });

  it('dev tool: bank SMS then bank email → one transaction', async () => {
    await goLive();
    await service.devSimulate(U, 'sms_debit');
    expect(await service.devSimulate(U, 'email_debit')).toContain('merged');
    expect(txs()).toHaveLength(1);
  });

  it('notification → email confirms immediately (takeOverRoot) → late SMS merges into existing transaction', async () => {
    await goLive();
    const t = Date.now();
    receiveNotification('Google Pay', '₹450 paid to Swiggy', '', t);
    await run();
    expect(txs()).toHaveLength(0); // awaiting bank confirmation

    // Bank email arrives 2 minutes later and immediately confirms
    receiveEmail(HDFC_EMAIL, emailDebit(450, 'SWIGGY', t, { ref: '987654321000' }), t + 2 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    const expenseId = txs()[0].id;
    expect(await sourcesOf(expenseId)).toEqual(['email', 'notification']);

    // Bank SMS arrives 15 minutes later and joins the existing transaction
    receiveSms(HDFC, smsDebit(450, 'SWIGGY', '987654321000'), t + 15 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(expenseId)).toEqual(['email', 'notification', 'sms']);
  });
});

describe('Email-First Transaction Confirmation & Source Reconciliation', () => {
  it('1. Email only → user confirms → no SMS ever arrives → terminal, exactly 1 transaction, zero future reviews', async () => {
    await goLive();
    const t = Date.now();
    // Unknown sender email (e.g. merchant invoice) goes to review
    receiveEmail('Coffee Shop', emailDebit(150, 'Blue Tokai', t), t);
    await run();
    expect(txs()).toHaveLength(0);
    const pending = await db.findEvents("status = 'pending'");
    expect(pending).toHaveLength(1);

    // User explicitly confirms the email transaction
    await classifyEvent(pending[0], 'expense', null, false);
    expect(txs()).toHaveLength(1);
    expect(txs()[0].amount).toBe(150);
    expect((await db.findEvents("status = 'pending'")).length).toBe(0);

    // Background jobs and sweepers run hours later
    await sweepAwaiting(t + 4 * HOUR, true);
    await run();
    expect(txs()).toHaveLength(1);
    expect((await db.findEvents("status = 'pending'")).length).toBe(0);
  });

  it('2. Email → confirm → late SMS arrives without exact RRN → merges into single transaction with two sources', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, emailDebit(350, 'SWIGGY', t), t);
    await run();
    expect(txs()).toHaveLength(1);
    const expenseId = txs()[0].id;

    // Late SMS arrives 40 minutes later with its own bank reference
    receiveSms(HDFC, smsDebit(350, 'SWIGGY', '839201928330'), t + 40 * MIN);
    await run();

    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(expenseId)).toEqual(['email', 'sms']);
    expect((await db.findEvents("status = 'pending'")).length).toBe(0);
  });

  it('3. Notification first → email confirmed → sweepAwaiting runs → notification merged cleanly without review', async () => {
    await goLive();
    const t = Date.now();
    receiveNotification('PhonePe', 'Paid ₹500 to Zomato', 'Payment successful', t);
    await run();
    expect(txs()).toHaveLength(0); // sitting in awaiting_sms

    // Email arrives and confirms the transaction
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', t), t + 3 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    const expenseId = txs()[0].id;

    // 25 minutes later, sweepAwaiting runs
    await sweepAwaiting(t + 25 * MIN, true);
    await run();

    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(expenseId)).toEqual(['email', 'notification']);
    expect((await db.findEvents("status = 'pending'")).length).toBe(0);
  });

  it('4. Email → confirm → SMS delayed by hours → still one transaction with two sources', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, emailDebit(1250, 'AMAZON', t), t);
    await run();
    expect(txs()).toHaveLength(1);
    const expenseId = txs()[0].id;

    // SMS arrives 6 hours later on the same day
    receiveSms(HDFC, smsDebit(1250, 'AMAZON', '998877665544'), t + 6 * HOUR);
    await run();

    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(expenseId)).toEqual(['email', 'sms']);
    expect((await db.findEvents("status = 'pending'")).length).toBe(0);
  });

  it('5. Two separate same-source ₹20 transactions → remain two distinct transactions', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, emailDebit(20, 'TEA STALL', t - 10 * MIN), t);
    receiveEmail(HDFC_EMAIL, emailDebit(20, 'TEA STALL', t - 2 * MIN), t + MIN);
    await run();

    expect(txs()).toHaveLength(2);
    expect(txs()[0].amount).toBe(20);
    expect(txs()[1].amount).toBe(20);
  });

  it('6. Email + SMS with exact RRN/UTR → exact reference merge', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', t, { ref: '839201928311' }), t);
    receiveSms(HDFC, smsDebit(500, 'ZOMATO', '839201928311'), t + 30 * MIN);
    await run();

    expect(txs()).toHaveLength(1);
    expect(await sourcesOf(txs()[0].id)).toEqual(['email', 'sms']);
  });

  it('7. Conflicting account SMS does NOT silently merge into unrelated email transaction', async () => {
    receiveSms(HDFC, smsDebit(10, 'OLD SHOP 1', '600000000001', { account: '1234' }), Date.now() - 10 * DAY);
    receiveSms(HDFC, smsDebit(10, 'OLD SHOP 2', '600000000002', { account: '5678' }), Date.now() - 9 * DAY);
    await service.runDiscovery(U);
    await service.completeSetup(U, { trackedKeys: ['HDFC:1234', 'HDFC:5678'], keepAccounts: [] });
    await service.setEmailEnabled(U, true);

    const t = Date.now();
    // Email on account 1234
    receiveEmail(HDFC_EMAIL, emailDebit(500, 'ZOMATO', t, { account: 'XX1234' }), t);
    await run();
    expect(txs()).toHaveLength(1);

    // SMS on a different tracked account 5678
    receiveSms(HDFC, smsDebit(500, 'ZOMATO', '839201928399', { account: '5678' }), t + 5 * MIN);
    await run();

    // Two different accounts = two separate transactions, never silently merged
    expect(txs()).toHaveLength(2);
  });
});


