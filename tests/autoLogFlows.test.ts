import { describe, it, expect, beforeEach, vi } from 'vitest';

// Everything below the real engine/service/db is replaced by test doubles (tests/helpers/autoLogTestEnv.ts).
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

import { resetEnv, native, ledger, remote, receiveSms, receiveNotification, wipeAllLocalFiles } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { flushQueued } from '../src/features/autoLog/engine';
import { classifyEvent, setEventCategory, ignoreEvent, resolveDuplicate, reportProblem } from '../src/features/autoLog/reviews';

const U = 'user-1';
const MIN = 60_000;
const DAY = 86400_000;

const HDFC = 'VM-HDFCBK';
const SBI = 'JD-SBIUPI';
const hdfcDebit = (amt: number, to: string, ref: string) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *1234 To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;
const hdfcCredit = (amt: number, from: string, ref: string) =>
  `Rs.${amt}.00 credited to HDFC Bank A/c XX1234 on 05-10-26 from VPA ${from}@okaxis (UPI ${ref})`;
const sbiDebit = (amt: number, to: string, ref: string) =>
  `Dear UPI user A/C X7821 debited by ${amt}.0 on date 05Oct26 trf to ${to} Refno ${ref}. If not u? call 1800111109. -SBI`;
const sbiCredit = (amt: number, ref: string) => `Your A/C X7821 is credited with Rs ${amt} on 05Oct26 by transfer from HDFC Ref ${ref} -SBI`;

/** Seeds history, runs Discovery, selects accounts → Live. Returns the live boundary time. */
const goLive = async (trackedKeys = ['HDFC:1234']) => {
  const now = Date.now();
  receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '600000000001'), now - 10 * DAY);
  receiveSms(SBI, sbiDebit(50, 'OLD STORE', '600000000002'), now - 9 * DAY);
  await service.runDiscovery(U);
  await service.completeSetup(U, { trackedKeys, keepAccounts: [] });
  return (await db.getMetaNum('live_since')) as number;
};

const events = (where = '1=1') => db.findEvents(where);

beforeEach(async () => {
  await db.closeDb();
  resetEnv();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Discovery (spec §5, §10, §40)', () => {
  it('learns accounts and formats but never creates a transaction', async () => {
    const now = Date.now();
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000001'), now - 3 * DAY);
    receiveSms(HDFC, hdfcCredit(2000, 'rahul.k', '628700000002'), now - 2 * DAY);
    receiveSms(SBI, sbiDebit(500, 'RAHUL', '528100000003'), now - DAY);
    receiveSms('+919876543210', 'Hey, sent you Rs 500 for dinner', now - DAY); // personal → never read
    receiveSms(HDFC, '123456 is your OTP for txn of Rs 500', now - DAY);      // OTP → never read

    const s = await service.runDiscovery(U);

    expect(ledger.txs.size).toBe(0);
    expect(s.scanned).toBe(5);
    expect(s.financial).toBe(3);
    const accounts = await db.listAccounts();
    expect(accounts.map((a) => a.key).sort()).toEqual(['HDFC:1234', 'SBI:7821']);
    expect(accounts.every((a) => !a.tracked)).toBe(true); // user must choose
    expect(s.formatsLearned).toBeGreaterThan(0);
  });

  it('flags financial-looking messages it cannot read as "need your help"', async () => {
    receiveSms(HDFC, 'Your A/c XX1234 has a transaction of Rs 750 kindly check', Date.now() - DAY);
    const s = await service.runDiscovery(U);
    expect(s.suspicious).toHaveLength(1);
    expect(ledger.txs.size).toBe(0);
  });

  it('respects the 90-day window', async () => {
    receiveSms(HDFC, hdfcDebit(10, 'X', '600000000009'), Date.now() - 120 * DAY);
    const s = await service.runDiscovery(U);
    expect(s.scanned).toBe(0);
  });
});

describe('Live boundary & tracked accounts', () => {
  it('starts capture and logs only events after the boundary', async () => {
    const liveSince = await goLive();
    expect(native.capture).toBe(true);
    // An event that somehow carries an older timestamp must not be logged.
    native.queue.push(JSON.stringify({ type: 'sms', address: HDFC, body: hdfcDebit(999, 'BEFORE', '611111111111'), date: liveSince - MIN }));
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000001'), Date.now());
    await service.processQueue(U, { notify: false });
    const amounts = [...ledger.txs.values()].map((t) => t.amount);
    expect(amounts).toEqual([349]);
  });

  it('never logs an untracked account', async () => {
    await goLive(['HDFC:1234']);
    receiveSms(SBI, sbiDebit(500, 'SHOP', '528100000099'), Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    expect((await events("status = 'untracked'")).length).toBe(1);
  });

  it('marks a brand-new live account as "New account found", untracked', async () => {
    await goLive(['HDFC:1234']);
    receiveSms('AX-ICICIT', 'ICICI Bank Acct XX567 debited for Rs 80.00 on 05-Oct-26; Chai credited. UPI:628799999999.', Date.now());
    await service.processQueue(U, { notify: false });
    const icici = await db.getAccount('ICICI:567');
    expect(icici?.isNew).toBe(true);
    expect(icici?.tracked).toBe(false);
    expect(ledger.txs.size).toBe(0);
  });
});

describe('Matching & duplicates (spec §16, §38)', () => {
  it('notification first, then bank SMS → one transaction with both sources', async () => {
    await goLive();
    const t = Date.now();
    receiveNotification('PhonePe', 'Paid ₹349 to Zomato', 'Payment successful', t);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0); // preview only
    expect((await events("status = 'awaiting_sms'")).length).toBe(1);

    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000001'), t + 30_000);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(1);
    const [tx] = [...ledger.txs.values()];
    expect(tx.note).toBe('Zomato');
    const linked = await db.getEventsForExpense(tx.id);
    expect(linked.map((e) => e.source).sort()).toEqual(['notification', 'sms']);
  });

  it('bank SMS first, then notification → still one transaction', async () => {
    await goLive();
    const t = Date.now();
    receiveSms(HDFC, hdfcDebit(120, 'SWIGGY', '628700000005'), t);
    await service.processQueue(U, { notify: false });
    receiveNotification('Google Pay', '₹120 paid to Swiggy', '', t + 20_000);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(1);
    expect((await events("status = 'merged'")).length).toBe(1);
  });

  it('two genuine ₹20 payments 4 minutes apart stay two transactions', async () => {
    await goLive();
    const t = Date.now();
    receiveSms(HDFC, hdfcDebit(20, 'CHAI POINT', '628700000011'), t);
    receiveSms(HDFC, hdfcDebit(20, 'CHAI POINT', '628700000012'), t + 4 * MIN);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(2);
  });

  it('the same SMS seen twice (receiver + inbox catch-up) is logged once', async () => {
    await goLive();
    receiveSms(HDFC, hdfcDebit(75, 'METRO', '628700000020'), Date.now());
    await service.processQueue(U, { notify: false }); // queue + catch-up both see it
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(1);
  });

  it('a notification without a bank SMS goes to Pending Review after 20 min — never logged', async () => {
    await goLive();
    receiveNotification('Paytm', 'Paid Rs.499 to Myntra', '', Date.now());
    await service.processQueue(U, { notify: false });
    expect((await events("status = 'awaiting_sms'")).length).toBe(1);
    const realNow = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(realNow + 25 * MIN); // 25 minutes pass, no SMS
    await service.processQueue(U, { notify: false });
    spy.mockRestore();
    expect(ledger.txs.size).toBe(0);
    const pending = await db.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].reviewReason).toBe('notification_only');
  });

  it('a manual entry with the same amount on the same day → asks instead of double counting', async () => {
    await goLive();
    ledger.manual.push({ id: 'manual-1', amount: 500, type: 'expense', occurredAt: Date.now() });
    receiveSms(HDFC, hdfcDebit(500, 'DMART', '628700000030'), Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    const [p] = await db.listPending();
    expect(p.reviewReason).toBe('possible_duplicate');
    await resolveDuplicate(p, true);
    expect(ledger.txs.size).toBe(0);
    expect(await db.countPending()).toBe(0);
  });
});

describe('Transfers & not-transactions (spec §38.4, §39)', () => {
  it('own transfer between two tracked accounts is not an expense', async () => {
    await goLive(['HDFC:1234', 'SBI:7821']);
    const t = Date.now();
    receiveSms(HDFC, hdfcDebit(10000, 'SELF SBI', '628700000040'), t);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(1); // debit seen alone first
    receiveSms(SBI, sbiCredit(10000, '628700000041'), t + 2 * MIN);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0); // removed once the matching credit arrived
    expect((await events("status = 'transfer'")).length).toBe(2);
  });

  it('credit-card bill payment is not an expense', async () => {
    await goLive();
    receiveSms(HDFC, 'Rs 12,500 debited from A/c XX1234 for HDFC Credit Card bill payment Ref 628700000050', Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
  });

  it.each([
    ['will be debited', 'Rs 499 will be debited from your a/c XX1234 on 10-Oct for NETFLIX mandate'],
    ['failed', 'Your txn of Rs 300 from a/c XX1234 has failed'],
    ['balance', 'Available balance in your a/c XX1234 is Rs 12,000.00'],
  ])('%s → never a transaction', async (_l, body) => {
    await goLive();
    receiveSms(HDFC, body, Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    expect(await db.countPending()).toBe(0);
  });
});

describe('Review & learning (spec §9, §11, §17–21)', () => {
  it('money from a person → What is this? → Income; remembering makes the next one automatic', async () => {
    await goLive();
    receiveSms(HDFC, hdfcCredit(2000, 'rahul.k', '628700000060'), Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    const [p] = await db.listPending();
    expect(p.reviewReason).toBe('type');

    await classifyEvent(p, 'income', null, true);
    expect([...ledger.txs.values()][0].type).toBe('income');

    receiveSms(HDFC, hdfcCredit(1500, 'rahul.k', '628700000061'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(2);
  });

  it('unknown merchant: logged, then category asked; "remember" applies next time', async () => {
    await goLive();
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000070'), Date.now());
    await service.processQueue(U, { notify: false });
    const [p] = await db.listPending();
    expect(p.status).toBe('logged');
    expect(p.needsCategory).toBe(true);

    await setEventCategory(p, '11111111-1111-4111-8111-111111111111', true);
    expect(await db.countPending()).toBe(0);

    receiveSms(HDFC, hdfcDebit(299, 'ZOMATO', '628700000071'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });
    const second = [...ledger.txs.values()].find((t) => t.amount === 299)!;
    expect(second.categoryId).toBe('11111111-1111-4111-8111-111111111111');
    expect(await db.countPending()).toBe(0);
  });

  it('"Ignore only this message" does not hide other messages of the same format', async () => {
    await goLive();
    receiveSms(HDFC, hdfcCredit(5, 'promo', '628700000080'), Date.now());
    await service.processQueue(U, { notify: false });
    const [p] = await db.listPending();
    await ignoreEvent(p, 'message');
    receiveSms(HDFC, hdfcCredit(700, 'amit', '628700000081'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });
    expect(await db.countPending()).toBe(1);
  });

  it('"Ignore similar" hides that format from that bank only — never "every ₹20"', async () => {
    await goLive(['HDFC:1234', 'SBI:7821']);
    receiveSms(HDFC, hdfcCredit(20, 'cashbackco', '628700000090'), Date.now());
    await service.processQueue(U, { notify: false });
    const [p] = await db.listPending();
    await ignoreEvent(p, 'similar');

    receiveSms(HDFC, hdfcCredit(20, 'someone', '628700000091'), Date.now() + MIN); // same format → ignored
    receiveSms(SBI, sbiDebit(20, 'CHAI', '528100000092'), Date.now() + 2 * MIN);   // ₹20 elsewhere → still logged
    await service.processQueue(U, { notify: false });
    expect(await db.countPending()).toBe(1); // only the SBI one (category)
    expect([...ledger.txs.values()].map((t) => t.amount)).toEqual([20]);
  });

  it('"Should not have been detected" deletes the transaction and teaches a rule', async () => {
    await goLive();
    receiveSms(HDFC, hdfcDebit(1, 'VERIFY', '628700000100'), Date.now());
    await service.processQueue(U, { notify: false });
    const [e] = await events("status = 'logged'");
    expect(await reportProblem(e, 'not_transaction', { ignoreSimilar: false })).toBe('deleted');
    expect(ledger.txs.size).toBe(0);
  });

  it('"Wrong type" flips expense ↔ income', async () => {
    await goLive();
    receiveSms(HDFC, hdfcDebit(60, 'REFUNDCO', '628700000110'), Date.now());
    await service.processQueue(U, { notify: false });
    const [e] = await events("status = 'logged'");
    expect(await reportProblem(e, 'wrong_type')).toBe('type_flipped');
    expect([...ledger.txs.values()][0].type).toBe('income');
  });
});

describe('Offline', () => {
  it('a decided transaction that cannot be written is queued and written later', async () => {
    await goLive();
    ledger.offline = true;
    receiveSms(HDFC, hdfcDebit(88, 'UBER', '628700000120'), Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    expect((await events("status = 'queued'")).length).toBe(1);
    ledger.offline = false;
    await flushQueued();
    expect(ledger.txs.size).toBe(1);
  });
});

describe('Sign-out, recovery, learn (spec §26–29, §41)', () => {
  it('sign-out stops logging; sign-in shows Welcome back; Recovery logs the gap', async () => {
    await goLive();
    await service.onBeforeSignOut(U);
    expect(native.capture).toBe(false);

    // While signed out the receiver captures nothing, but the SMS is in the inbox.
    const gapTime = Date.now() + MIN;
    receiveSms(HDFC, hdfcDebit(450, 'BIGBASKET', '628700000130'), gapTime);
    expect(native.queue).toHaveLength(0);
    expect(await service.processQueue(U, { notify: false })).toBe(false);
    expect(ledger.txs.size).toBe(0);

    const entry = await service.evaluateEntry(U);
    expect(entry.decision.kind).toBe('welcome_back');
    const d = entry.decision as { kind: 'welcome_back'; from: number; to: number };

    const r = await service.runRecovery(U, d.from, gapTime + MIN);
    expect(r.found).toBe(1);
    expect(ledger.txs.size).toBe(1);
    await service.resumeLive(U);
    expect(native.capture).toBe(true);
    expect((await service.evaluateEntry(U)).decision.kind).toBe('none');
  });

  it('"Learn from this period" adds nothing', async () => {
    await goLive();
    await service.onBeforeSignOut(U);
    const t = Date.now() + MIN;
    receiveSms(HDFC, hdfcDebit(450, 'BIGBASKET', '628700000140'), t);
    await service.runDiscovery(U, { from: t - MIN, to: t + MIN });
    await service.resumeLive(U);
    expect(ledger.txs.size).toBe(0);
  });

  it('pause stops logging until resumed', async () => {
    await goLive();
    await service.pause(U);
    receiveSms(HDFC, hdfcDebit(30, 'X', '628700000150'), Date.now());
    expect(await service.processQueue(U, { notify: false })).toBe(false);
    expect(ledger.txs.size).toBe(0);
  });
});

describe('Data loss, clear cache, turn off (spec §30–36)', () => {
  it('clear cache (local DB intact) → no popup, keeps working', async () => {
    await goLive();
    await db.closeDb();
    expect((await service.evaluateEntry(U)).decision.kind).toBe('none');
  });

  it('clear storage / reinstall → "setup no longer available", never silently restored', async () => {
    await goLive(['HDFC:1234']);
    await db.closeDb();
    wipeAllLocalFiles();
    native.capture = false;
    const entry = await service.evaluateEntry(U);
    expect(entry.decision.kind).toBe('data_loss');
    if (entry.decision.kind === 'data_loss') {
      expect(entry.decision.previous.map((a) => a.last4)).toEqual(['1234']);
    }
    expect(native.capture).toBe(false);
    await service.dismissDataLoss(U);
    expect((await service.evaluateEntry(U)).decision.kind).toBe('none');
  });

  it('a different account on the same phone starts clean', async () => {
    await goLive();
    await service.onBeforeSignOut(U);
    expect((await service.evaluateEntry('user-2')).decision.kind).toBe('none');
  });

  it('turn off removes local setup and disables the server flag', async () => {
    await goLive();
    await service.turnOff(U);
    expect(native.capture).toBe(false);
    expect(remote.row.enabled).toBe(false);
    expect((await service.readLocalState(U)).setupComplete).toBe(false);
  });
});

describe('Developer test tools (dev builds only)', () => {
  it('notification then SMS simulation merges into one transaction', async () => {
    await goLive(['HDFC:1234']);
    expect(await service.devSimulate(U, 'notification_debit')).toContain('awaiting_sms');
    expect(await service.devSimulate(U, 'sms_debit')).toContain('logged');
    expect(ledger.txs.size).toBe(1);
    expect(await service.devSimulate(U, 'sms_credit_person')).toContain('type');
    expect(await service.devSimulate(U, 'sms_unreadable')).toContain('unrecognized');
  });

  it('refuses when Automatic Logging is not active', async () => {
    expect(await service.devSimulate(U, 'sms_debit')).toMatch(/must be active/);
  });
});
