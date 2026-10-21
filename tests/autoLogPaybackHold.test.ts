import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same test doubles as autoLogSettleReview.test.ts (real engine + db, fake ledger / native / remote).
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

import { resetEnv, ledger, receiveSms } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { classifyEvent } from '../src/features/autoLog/reviews';
import { notifyNeedsReview } from '../src/features/autoLog/notify';

const U = 'user-payback-hold';
const MIN = 60_000;
const HDFC = 'VM-HDFCBK';
const CAT = '11111111-1111-4111-8111-111111111111';
const hdfcDebit = (amt: number, to: string, ref: string) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *1234 To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;
const hdfcCredit = (amt: number, from: string, ref: string) =>
  `Rs.${amt}.00 credited to HDFC Bank A/c XX1234 on 05-10-26 from VPA ${from}@okaxis (UPI ${ref})`;

/** First credit from `sender` → review → "Save as Income" with a category + "Remember". Leaves "income" remembered. */
const rememberIncomeFor = async (sender: string, ref: string) => {
  receiveSms(HDFC, hdfcCredit(2000, sender, ref), Date.now());
  await service.processQueue(U, { notify: false });
  const [p] = await db.listPending();
  await classifyEvent(p, 'income', CAT, true);
};

describe('AutoLog: a remembered "income" must not swallow a friend\'s payback (SPL-005)', () => {
  beforeEach(async () => {
    await db.closeDb();
    resetEnv();
    vi.mocked(notifyNeedsReview).mockClear();
    receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '700000000001'), Date.now() - 10 * 86400_000);
    await service.runDiscovery(U);
    await service.completeSetup(U, { trackedKeys: ['HDFC:1234'], keepAccounts: [] });
  });

  it('BEFORE the guard: remembered income from a person is written straight in (control: nobody owes anything)', async () => {
    await rememberIncomeFor('rahul.k', '700000000010');
    const before = ledger.txs.size;

    receiveSms(HDFC, hdfcCredit(500, 'rahul.k', '700000000011'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });

    expect(ledger.txs.size).toBe(before + 1);
    expect([...ledger.txs.values()].find((t) => t.amount === 500)?.type).toBe('income');
    expect(await db.countPending()).toBe(0);
  });

  it('remembered income from a person who OWES money goes to review, not into income', async () => {
    await rememberIncomeFor('rahul.k', '700000000020');
    const before = ledger.txs.size;
    ledger.owing = [{ match: 'rahul', name: 'Rahul', owed: 500 }];

    receiveSms(HDFC, hdfcCredit(500, 'rahul.k', '700000000021'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });

    expect(ledger.txs.size).toBe(before); // nothing written as income
    const pending = await db.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].reviewReason).toBe('type');
    expect(pending[0].direction).toBe('credit');
    expect(pending[0].amount).toBe(500);
  });

  it('the review notification asks the settle question instead of "income or expense?"', async () => {
    await rememberIncomeFor('rahul.k', '700000000030');
    ledger.owing = [{ match: 'rahul', name: 'Rahul', owed: 500 }];

    receiveSms(HDFC, hdfcCredit(500, 'rahul.k', '700000000031'), Date.now() + MIN);
    await service.processQueue(U, { notify: true });

    expect(notifyNeedsReview).toHaveBeenCalledTimes(1);
    const question = vi.mocked(notifyNeedsReview).mock.calls[0][3];
    expect(question).toContain('Rahul');
    expect(question).toContain('Is this their payment?');
  });

  it('a person who owes nothing keeps the automatic remembered income', async () => {
    await rememberIncomeFor('rahul.k', '700000000040');
    const before = ledger.txs.size;
    ledger.owing = [{ match: 'priya', name: 'Priya', owed: 300 }]; // someone else owes, not Rahul

    receiveSms(HDFC, hdfcCredit(500, 'rahul.k', '700000000041'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });

    expect(ledger.txs.size).toBe(before + 1);
    expect(await db.countPending()).toBe(0);
  });

  it('a salary credit is never held, even if the sender name matches a person who owes money', async () => {
    await rememberIncomeFor('rahul.k', '700000000050');
    const before = ledger.txs.size;
    ledger.owing = [{ match: 'rahul', name: 'Rahul', owed: 500 }];

    receiveSms(HDFC, `Rs.50000.00 credited to HDFC Bank A/c XX1234 on 05-10-26 salary from VPA rahul.k@okaxis (UPI 700000000051)`, Date.now() + MIN);
    await service.processQueue(U, { notify: false });

    expect(ledger.txs.size).toBe(before + 1);
    expect(await db.countPending()).toBe(0);
  });

  it('a debit to the same person is never held', async () => {
    await rememberIncomeFor('rahul.k', '700000000060');
    const before = ledger.txs.size;
    ledger.owing = [{ match: 'rahul', name: 'Rahul', owed: 500 }];

    receiveSms(HDFC, hdfcDebit(250, 'rahul.k', '700000000061'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });

    expect(ledger.txs.size).toBe(before + 1);
  });

  it('after review the held credit can still be saved as plain income (the user decides)', async () => {
    await rememberIncomeFor('rahul.k', '700000000070');
    ledger.owing = [{ match: 'rahul', name: 'Rahul', owed: 500 }];
    receiveSms(HDFC, hdfcCredit(500, 'rahul.k', '700000000071'), Date.now() + MIN);
    await service.processQueue(U, { notify: false });
    const [p] = await db.listPending();

    const logged = await classifyEvent(p, 'income', null, false);
    expect(logged.status).toBe('logged');
    expect(ledger.txs.get(logged.expenseId!)?.type).toBe('income');
  });
});
