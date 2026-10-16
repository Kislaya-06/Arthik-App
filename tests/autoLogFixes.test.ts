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

import { resetEnv, native, ledger, receiveSms, receiveNotification, receiveEmail, fakeLedger, fakeSqlite } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { parseSms, parseNotification } from '../src/features/autoLog/parser';
import { isSameSourceDuplicate, ownTransferStrength } from '../src/features/autoLog/matching';
import { resolveTransfer } from '../src/features/autoLog/reviews';

const U = 'user-1';
const MIN = 60_000;
const SEC = 1000;
const DAY = 24 * 60 * MIN;
const HDFC = 'VM-HDFCBK';
const SBI = 'AX-SBIUPI';
const HDFC_EMAIL = 'HDFC Bank InstaAlerts';

const hdfcDebit = (amt: number, to: string, ref?: string) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *1234 To ${to} On 05/10/26${ref ? ` Ref ${ref}` : ''} Not You? Call 18002586161`;

const goLive = async (trackedKeys = ['HDFC:1234'], emailOn = true) => {
  receiveSms(HDFC, hdfcDebit(10, 'OLD SHOP', '600000000001'), Date.now() - 10 * DAY);
  receiveSms(SBI, 'Dear UPI user A/C X7821 debited by Rs 20.00 on 01Oct26 trf to OLDSHOP Refno 600000000002', Date.now() - 10 * DAY);
  await service.runDiscovery(U);
  await service.completeSetup(U, { trackedKeys, keepAccounts: [] });
  if (emailOn) await service.setEmailEnabled(U, true);
};
const run = () => service.processQueue(U, { notify: false });
const txs = () => [...ledger.txs.values()];
const events = (where: string, ...p: any[]) => db.findEvents(where, ...p);

beforeEach(async () => {
  await db.closeDb();
  resetEnv();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Fix 1: own transfer whose two SMS share one UPI reference', () => {
  it('the credit is NOT dropped as a duplicate of the debit', () => {
    const base = { amount: 500, occurredAt: 1000, fingerprint: 'x' };
    const debit: any = { ...base, direction: 'debit', ref: '628412345678', fingerprint: 'a' };
    const credit: any = { ...base, direction: 'credit', ref: '628412345678', fingerprint: 'b' };
    expect(isSameSourceDuplicate(debit, credit)).toBe(false);
    expect(isSameSourceDuplicate(debit, { ...debit, fingerprint: 'c' })).toBe(true); // same direction + same ref = same SMS
  });

  it('end to end: debit then credit with the same ref → one transfer, no expense', async () => {
    await goLive(['HDFC:1234', 'SBI:7821']);
    const t = Date.now();
    receiveSms(HDFC, hdfcDebit(5000, 'SBI ACCOUNT', '628700000099'), t);
    await run();
    expect(txs()).toHaveLength(1);
    receiveSms(SBI, 'Dear UPI user A/C X7821 credited by Rs 5000.00 on 05Oct26 by HDFC Refno 628700000099', t + 2 * MIN);
    await run();
    expect(txs()).toHaveLength(0);
    expect((await events("status = 'transfer'")).length).toBe(2);
  });
});

describe('Fix 5: two unrelated same-amount payments are never deleted on a guess', () => {
  const pay = async () => {
    await goLive(['HDFC:1234', 'SBI:7821']);
    const t = Date.now();
    receiveSms(HDFC, hdfcDebit(500, 'RAHUL FRIEND', '628700000101'), t);
    await run();
    receiveSms(SBI, 'Dear UPI user A/C X7821 credited by Rs 500.00 on 05Oct26 by PRIYA Refno 628700000202', t + 3 * MIN);
    await run();
    return t;
  };

  it('nothing is deleted; the credit waits for one question', async () => {
    await pay();
    expect(txs()).toHaveLength(1);                         // the ₹500 expense is still there
    const pending = await events("status = 'pending'");
    expect(pending).toHaveLength(1);
    expect(pending[0].reviewReason).toBe('possible_transfer');
  });

  it('"No, different payment" logs it as income and keeps the expense', async () => {
    await pay();
    const [p] = await events("status = 'pending'");
    await resolveTransfer(p, false);
    expect(txs().map((x) => x.type).sort()).toEqual(['expense', 'income']);
  });

  it('"Yes, my own transfer" removes the expense and marks both as a transfer', async () => {
    await pay();
    const [p] = await events("status = 'pending'");
    await resolveTransfer(p, true);
    expect(txs()).toHaveLength(0);
    expect((await events("status = 'transfer'")).length).toBe(2);
  });

  it('strength: self wording / other account digits / shared ref are certain, a bare amount is only likely', () => {
    const d = { amount: 500, direction: 'debit' as const, occurredAt: 0, ref: null, accountKey: 'HDFC:1234' };
    const c = { amount: 500, direction: 'credit' as const, occurredAt: 60_000, ref: null, accountKey: 'SBI:7821' };
    expect(ownTransferStrength(d, c)).toBe('likely');
    expect(ownTransferStrength({ ...d, body: 'Sent Rs.500 to SELF' }, c)).toBe('certain');
    expect(ownTransferStrength({ ...d, body: 'Sent Rs.500 to A/C XX7821' }, c)).toBe('certain');
    expect(ownTransferStrength({ ...d, ref: 'R1' }, { ...c, ref: 'R1' })).toBe('certain');
    expect(ownTransferStrength(d, { ...c, accountKey: 'HDFC:1234' })).toBe('no');
  });
});

describe('Fix 2: credit card bill is never an expense (any wording order)', () => {
  it.each([
    'Your payment of Rs 15,000 for HDFC Credit Card XX9999 has been received. Thank you',
    'Payment of Rs 8,200 received on your ICICI Credit Card XX4321',
    'Thank you for your payment of Rs 3,000 towards your credit card XX7777',
    'Rs 12,500 debited from A/c XX1234 for HDFC Credit Card bill payment Ref 628700000050',
  ])('%s', (body) => {
    expect(parseSms('VM-HDFCBK', body).isCardBill).toBe(true);
  });

  it('a real card PURCHASE is still an expense', () => {
    const p = parseSms('VK-ICICIB', 'Rs 250.00 spent on ICICI Bank Card XX9999 on 12-Oct-26 at ZOMATO. Avl Limit: Rs 50,000');
    expect(p.kind).toBe('txn');
    expect(p.direction).toBe('debit');
    expect(p.isCardBill).toBe(false);
  });

  it('end to end: not logged', async () => {
    await goLive();
    receiveSms(HDFC, 'Your payment of Rs 15,000 for HDFC Credit Card XX1234 has been received. Thank you', Date.now());
    await run();
    expect(txs()).toHaveLength(0);
  });
});

describe('Fix 3: payment-app notification direction', () => {
  it.each([
    ['Google Pay', 'You received ₹500', 'Rahul paid you ₹500', 'credit'],
    ['PhonePe', 'Received ₹250', 'Priya sent you ₹250', 'credit'],
    ['Google Pay', 'Rahul paid you ₹100', '', 'credit'],
    ['PhonePe', 'Paid ₹120', 'Paid ₹120 to Chai Point. Payment successful', 'debit'],
    ['Paytm', 'You paid ₹499', 'You paid ₹499 to Myntra', 'debit'],
  ])('%s: "%s" → %s', (app, title, body, dir) => {
    const p = parseNotification(app, title, body);
    expect(p.kind).toBe('txn');
    expect(p.direction).toBe(dir);
  });
});

describe('Fix 4: real debits are no longer ignored as "future" or "promo"', () => {
  it.each([
    ['e-mandate debit', 'Rs 799.00 debited from A/c XX1234 on 12-10-26 towards Netflix e-mandate. Ref 123'],
    ['SIP standing instruction', 'Rs 600 debited from A/c XX1234 for SIP standing instruction on 12-10-26'],
    ['merchant named Discount', 'Rs 250 paid to Discount Mart via UPI from A/c XX1234. Ref 99'],
    ['merchant named Voucher', 'Rs 1,000 spent on ICICI Card XX9999 at Voucher Hub on 12-Oct'],
  ])('%s is a transaction', (_l, body) => {
    const p = parseSms('VM-HDFCBK', body);
    expect(p.kind).toBe('txn');
    expect(p.direction).toBe('debit');
  });

  it.each([
    'Rs 499 will be debited from your a/c XX1234 on 10-Oct for NETFLIX mandate',
    'Your e-mandate of Rs 799 is scheduled for 15-Oct. Keep balance',
    'Reminder: Rs 600 standing instruction due on 15-Oct',
    'Rs 5000 requested by AMAZON on UPI. Approve on app. Ref 1234',
  ])('still not a transaction: %s', (body) => {
    expect(parseSms('VM-HDFCBK', body).kind).not.toBe('txn');
  });

  it('end to end: the e-mandate debit becomes an expense', async () => {
    await goLive();
    receiveSms(HDFC, 'Rs 799.00 debited from A/c XX1234 on 12-10-26 towards Netflix e-mandate. Ref 123', Date.now());
    await run();
    expect(txs().map((t) => t.amount)).toEqual([799]);
  });
});

describe('Fix 6: one failing event does not throw away the events behind it', () => {
  it('the remaining notification / SMS are still processed', async () => {
    await goLive();
    const t = Date.now();
    receiveSms(HDFC, hdfcDebit(111, 'SHOP A', '628700000301'), t);
    receiveSms(HDFC, hdfcDebit(222, 'SHOP B', '628700000302'), t + 5 * SEC);
    receiveSms(HDFC, hdfcDebit(333, 'SHOP C', '628700000303'), t + 10 * SEC);
    const real = fakeLedger.createTransaction;
    vi.spyOn(fakeLedger, 'createTransaction').mockImplementation(async (tx: any, id?: string) => {
      if (tx.amount === 222) throw new Error('boom');
      return real(tx, id);
    });
    await run();
    expect(txs().map((x) => x.amount).sort()).toEqual([111, 333]);
  });
});

describe('Fix 7: "Cashback" in an extra sentence does not turn a friend\'s transfer into income', () => {
  it('a person credit with a cashback line stays a person credit (asks), not auto "refund"', () => {
    const p = parseSms('VM-HDFCBK', 'Rs 100 credited to A/c XX1234 on 12-10-26 by VPA friend@okhdfc UPI Ref 1. Cashback Rs 5 credited');
    expect(p.creditKind).not.toBe('refund');
  });
  it('a real cashback credit is still a refund', () => {
    const p = parseSms('VM-HDFCBK', 'Cashback of Rs 25 credited to A/c XX1234 on 12-10-26');
    expect(p.creditKind).toBe('refund');
  });
});

describe('Fix 9: a temporary database error never wipes tracked accounts and rules', () => {
  it('"database is locked" is retried and the data survives', async () => {
    await goLive();
    expect((await db.listAccounts()).length).toBeGreaterThan(0);
    await db.closeDb();
    const real = fakeSqlite.openDatabaseAsync;
    let calls = 0;
    vi.spyOn(fakeSqlite, 'openDatabaseAsync').mockImplementation(async (name: string) => {
      calls++;
      if (calls === 1) throw new Error('database is locked');
      return real(name);
    });
    await db.openDb(U);
    expect(calls).toBe(2);
    expect((await db.listAccounts()).length).toBeGreaterThan(0);
  });

  it('only a real wrong-key error is treated as "start clean"', () => {
    expect(db.isWrongKeyError(new Error('file is not a database'))).toBe(true);
    expect(db.isWrongKeyError(new Error('SQLITE_NOTADB'))).toBe(true);
    expect(db.isWrongKeyError(new Error('database is locked'))).toBe(false);
    expect(db.isWrongKeyError(new Error('disk full'))).toBe(false);
  });
});

describe('Money arriving 2-3 times in quick succession: every one is counted', () => {
  it('three identical SMS (no reference) a few seconds apart → three transactions', async () => {
    await goLive();
    const t = Date.now();
    const body = 'Rs.100.00 debited from HDFC Bank A/C *1234 to CHAI POINT on 05/10/26';
    receiveSms(HDFC, body, t);
    receiveSms(HDFC, body, t + 6 * SEC);
    receiveSms(HDFC, body, t + 12 * SEC);
    await run();
    expect(txs()).toHaveLength(3);
  });

  it('the inbox safety net does not add them again (and does not lose a missed one)', async () => {
    await goLive();
    const t = Date.now();
    const body = 'Rs.100.00 debited from HDFC Bank A/C *1234 to CHAI POINT on 05/10/26';
    receiveSms(HDFC, body, t);
    receiveSms(HDFC, body, t + 6 * SEC);
    receiveSms(HDFC, body, t + 12 * SEC);
    await run();
    await run();
    await run();
    expect(txs()).toHaveLength(3);
    // a 4th arrives only in the inbox (the receiver missed it): the catch-up must pick up exactly that one
    native.inbox.push({ id: '99', address: HDFC, body, date: t + 18 * SEC });
    await run();
    expect(txs()).toHaveLength(4);
  });

  it('payment-app notifications are safely skipped (Option A: Bank SMS & Email only)', async () => {
    await goLive();
    const t = Date.now();
    receiveNotification('Google Pay', 'Rahul paid you ₹100', '', t);
    receiveNotification('Google Pay', 'Rahul paid you ₹100', '', t + 20 * SEC);
    await run();
    expect((await events("source = 'notification'")).length).toBe(0);
  });

  it('three identical bank emails (no reference) minutes apart → three transactions', async () => {
    await goLive();
    const t = Date.now();
    const body = 'Rs. 100.00 has been debited from your account XX1234 for a UPI payment to CHAI POINT.';
    receiveEmail(HDFC_EMAIL, body, t);
    receiveEmail(HDFC_EMAIL, body, t + 3 * MIN);
    receiveEmail(HDFC_EMAIL, body, t + 6 * MIN);
    await run();
    expect(txs()).toHaveLength(3);
  });
});

describe('Email is a first-class source (no waiting for the bank SMS)', () => {
  const body = (ref?: string) =>
    `Transaction alert. Rs. 640.00 has been debited from your account XX1234 for a UPI payment to ZOMATO.${ref ? ` UPI Ref ${ref}.` : ''}`;

  it('email alone logs immediately', async () => {
    await goLive();
    receiveEmail(HDFC_EMAIL, body('839201928400'), Date.now());
    await run();
    expect(txs()).toHaveLength(1);
    expect(await events("status = 'pending'")).toHaveLength(0);
  });

  it('a bank email that names no account number still logs when the user tracks exactly one account at that bank', async () => {
    await goLive();
    receiveEmail(HDFC_EMAIL, 'Rs. 640.00 has been debited from your HDFC Bank account for a UPI payment to ZOMATO.', Date.now());
    await run();
    expect(txs()).toHaveLength(1);
    expect(await events("status = 'pending'")).toHaveLength(0);
  });

  it('the bank SMS for the SAME transaction arrives later → no second transaction, SMS is added as a source', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, body('839201928401'), t);
    await run();
    expect(txs()).toHaveLength(1);
    receiveSms(HDFC, hdfcDebit(640, 'ZOMATO', '839201928401'), t + 4 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    const sources = (await db.getEventsForExpense(txs()[0].id)).map((e) => e.source).sort();
    expect(sources).toEqual(['email', 'sms']);
  });

  it('same, without a reference: matched by account + merchant + amount', async () => {
    await goLive();
    const t = Date.now();
    receiveEmail(HDFC_EMAIL, body(), t);
    await run();
    receiveSms(HDFC, hdfcDebit(640, 'ZOMATO'), t + 3 * MIN);
    await run();
    expect(txs()).toHaveLength(1);
    const sources = (await db.getEventsForExpense(txs()[0].id)).map((e) => e.source).sort();
    expect(sources).toEqual(['email', 'sms']);
  });
});
