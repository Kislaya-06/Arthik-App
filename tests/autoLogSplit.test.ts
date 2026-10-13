import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { resetEnv, ledger, receiveSms, receiveEmail } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { resolveSplitRepayment, classifyEvent, classifyEventAndSplit, setCategoryAndSplit } from '../src/features/autoLog/reviews';

/**
 * A credit that is exactly what a friend still owes on an unsettled split is asked ONCE:
 * "Is this your friend's share of a split?"  Yes -> reimbursement linked to that split (money goes back where it came from).
 */
const U = 'user-1';
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const HDFC = 'VM-HDFCBK';
const HDFC_EMAIL = 'HDFC Bank InstaAlerts';

const ymd = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const share = (amount = 500) => ({
  share: { id: 'sh1', user_id: U, expense_id: 'exp-1', friend_label: 'Rahul', amount_owed: amount },
  expenseDate: ymd(Date.now() - 2 * DAY),
  expenseAmount: 1000,
});
const credit = (amt: number, ref: string) =>
  `Rs.${amt}.00 credited to HDFC Bank A/c XX1234 on 05-10-26 by VPA friend@ybl UPI Ref ${ref}`;

const goLive = async () => {
  receiveSms(HDFC, 'Sent Rs.10.00 From HDFC Bank A/C *1234 To OLD On 05/10/26 Ref 600000000001 Not You? Call 1', Date.now() - 10 * DAY);
  await service.runDiscovery(U);
  await service.completeSetup(U, { trackedKeys: ['HDFC:1234'], keepAccounts: [] });
  await service.setEmailEnabled(U, true);
};
const run = () => service.processQueue(U, { notify: false });
const txs = () => [...ledger.txs.values()];
const pending = () => db.findEvents("status = 'pending'");

beforeEach(async () => {
  await db.closeDb();
  resetEnv();
});

describe('credit equal to an open split share: ask once', () => {
  it('asks "friend paid back?" and logs nothing until the user answers', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    receiveSms(HDFC, credit(500, '628700000501'), Date.now());
    await run();
    expect(txs()).toHaveLength(0);
    const p = await pending();
    expect(p).toHaveLength(1);
    expect(p[0].reviewReason).toBe('split_repayment');
  });

  it('YES: logged as a reimbursement linked to that share, note names the friend', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    receiveSms(HDFC, credit(500, '628700000502'), Date.now());
    await run();
    const [p] = await pending();
    await resolveSplitRepayment(p, 'sh1', 'Rahul');
    expect(txs()).toHaveLength(1);
    expect(txs()[0]).toMatchObject({ amount: 500, type: 'income', transactionClass: 'reimbursement', reimbursesShareId: 'sh1' });
    expect(txs()[0].note).toBe('Split repayment · Rahul');
    expect((await pending())).toHaveLength(0);
  });

  it('NO: becomes the normal "Income or Expense?" question, nothing is logged yet', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    receiveSms(HDFC, credit(500, '628700000503'), Date.now());
    await run();
    const [p] = await pending();
    await resolveSplitRepayment(p, null);
    expect(txs()).toHaveLength(0);
    const [again] = await pending();
    expect(again.reviewReason).toBe('type');
    await classifyEvent(again, 'income', null, false);
    expect(txs()).toHaveLength(1);
    expect(txs()[0].transactionClass).toBeUndefined();
  });

  it('a different amount is never asked about', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    receiveSms(HDFC, credit(499, '628700000504'), Date.now());
    await run();
    expect((await pending())[0].reviewReason).toBe('type');
  });

  it('a split that is already settled is not asked again', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    ledger.reimbursed = { sh1: 500 };
    receiveSms(HDFC, credit(500, '628700000505'), Date.now());
    await run();
    expect((await pending())[0].reviewReason).toBe('type');
  });

  it('a salary credit with the same amount is never mistaken for a split', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    receiveSms(HDFC, 'Rs.500.00 credited to HDFC Bank A/c XX1234 on 05-10-26 salary from ACME. Ref 628700000506', Date.now());
    await run();
    expect(txs()).toHaveLength(1);
    expect(txs()[0].transactionClass).toBeUndefined();
  });

  it('a debit is never asked', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    receiveSms(HDFC, 'Sent Rs.500.00 From HDFC Bank A/C *1234 To SHOP On 05/10/26 Ref 628700000507 Not You? Call 1', Date.now());
    await run();
    expect(txs()).toHaveLength(1);
    expect((await pending()).length).toBe(0);
  });

  it('works for a bank EMAIL too (email is a first-class source)', async () => {
    await goLive();
    ledger.splitShares = [share(500)];
    receiveEmail(HDFC_EMAIL, 'Rs. 500.00 has been credited to your account XX1234 by RAHUL on 05-10-2026. UPI Ref 628700000508.', Date.now());
    await run();
    expect(txs()).toHaveLength(0);
    expect((await pending())[0].reviewReason).toBe('split_repayment');
  });

  it('two friends owe the same amount: the question is still asked once, the user picks who', async () => {
    await goLive();
    ledger.splitShares = [
      share(500),
      { share: { id: 'sh2', user_id: U, expense_id: 'exp-2', friend_label: 'Priya', amount_owed: 500 }, expenseDate: ymd(Date.now() - 3 * DAY), expenseAmount: 900 },
    ];
    receiveSms(HDFC, credit(500, '628700000509'), Date.now());
    await run();
    expect((await pending())).toHaveLength(1);
    const [p] = await pending();
    await resolveSplitRepayment(p, 'sh2', 'Priya');
    expect(txs()[0].reimbursesShareId).toBe('sh2');
  });
});


describe('Review: "Split this expense" while choosing the category', () => {
  const debit = (amt: number, ref: string) =>
    `Sent Rs.${amt}.00 From HDFC Bank A/C *1234 To SHOP On 05/10/26 Ref ${ref} Not You? Call 1`;
  const friends = [{ friendLabel: 'Rahul', amount: 300 }, { friendLabel: 'Priya', amount: 200 }];

  it('a logged expense that only needs its category: the split is attached to THAT expense', async () => {
    await goLive();
    receiveSms(HDFC, debit(1000, '628700000601'), Date.now());
    await run();
    const [ev] = await db.findEvents("status = 'logged'");
    expect(ev.expenseId).toBeTruthy();
    await setCategoryAndSplit(ev, 'cat-food', false, friends);
    expect(ledger.savedShares).toHaveLength(1);
    expect(ledger.savedShares[0]).toMatchObject({ expenseId: ev.expenseId, total: 1000 });
    expect(ledger.savedShares[0].drafts).toEqual(friends);
  });

  it('no split chosen: nothing is saved', async () => {
    await goLive();
    receiveSms(HDFC, debit(1000, '628700000602'), Date.now());
    await run();
    const [ev] = await db.findEvents("status = 'logged'");
    await setCategoryAndSplit(ev, 'cat-food', false, []);
    await setCategoryAndSplit(ev, 'cat-food', false, undefined);
    expect(ledger.savedShares).toHaveLength(0);
  });

  it('a pending item confirmed as an EXPENSE with a split: transaction first, then its shares', async () => {
    await goLive();
    receiveSms(HDFC, credit(700, '628700000603'), Date.now());      // asks "Income or Expense?"
    await run();
    const [p] = await pending();
    const e = await classifyEventAndSplit(p, 'expense', 'cat-food', false, undefined, friends);
    expect(txs()).toHaveLength(1);
    expect(ledger.savedShares[0]).toMatchObject({ expenseId: e.expenseId, total: 700 });
  });

  it('INCOME is never split, even if shares were passed', async () => {
    await goLive();
    receiveSms(HDFC, credit(700, '628700000604'), Date.now());
    await run();
    const [p] = await pending();
    await classifyEventAndSplit(p, 'income', null, false, undefined, friends);
    expect(txs()).toHaveLength(1);
    expect(ledger.savedShares).toHaveLength(0);
  });
});
