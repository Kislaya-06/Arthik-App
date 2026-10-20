import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same test doubles as autoLogReviewSplit.test.ts (real engine + db, fake ledger / native / remote).
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

import { resetEnv, receiveSms } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { classifyEvent, reconcileExpenseSaved } from '../src/features/autoLog/reviews';

const U = 'user-settle-review';
const HDFC = 'VM-HDFCBK';
const hdfcDebit = (amt: number, to: string, ref: string) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *1234 To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;
const hdfcCredit = (amt: number, from: string, ref: string) =>
  `Rs.${amt}.00 credited to HDFC Bank A/c XX1234 on 05-10-26 from VPA ${from}@okaxis (UPI ${ref})`;

describe('AutoLog: a friend\'s payback must not come back for review', () => {
  beforeEach(async () => {
    await db.closeDb();
    resetEnv();
    receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '600000000001'), Date.now() - 10 * 86400_000);
    await service.runDiscovery(U);
    await service.completeSetup(U, { trackedKeys: ['HDFC:1234'], keepAccounts: [] });
  });

  it('BUG (before the fix): income saved without a category stays in review as "choose a category"', async () => {
    receiveSms(HDFC, hdfcCredit(300, 'aditya', 'REF900'), Date.now());
    await service.processQueue(U, { notify: false });
    const [event] = await db.listPending();
    expect(event).toBeDefined();

    // What the review sheet used to do when a person was tapped: no clearNeedsCategory.
    const classified = await classifyEvent(event, 'income', null, false);
    expect(classified.needsCategory).toBe(true);
    expect(await db.countPending()).toBeGreaterThan(0);
  });

  it('tapping a person: the review is finished and the pending count is 0', async () => {
    receiveSms(HDFC, hdfcCredit(300, 'aditya', 'REF901'), Date.now());
    await service.processQueue(U, { notify: false });
    const [event] = await db.listPending();

    // What the review sheet does now (settleWith).
    const classified = await classifyEvent(event, 'income', null, false, undefined, { clearNeedsCategory: true });
    expect(classified.status).toBe('logged');
    expect(classified.needsCategory).toBe(false);
    expect((await db.getEvent(event.id))?.needsCategory).toBe(false);
    expect(await db.countPending()).toBe(0);
  });

  it('settling from the transaction screen (no review sheet) also ends the review: reconcileExpenseSaved', async () => {
    receiveSms(HDFC, hdfcCredit(250, 'aditya', 'REF902'), Date.now());
    await service.processQueue(U, { notify: false });
    const [event] = await db.listPending();
    const logged = await classifyEvent(event, 'income', null, false);
    expect(logged.needsCategory).toBe(true);

    // convertIncomeToMoneyBack calls this with the money-back row's id (same id as the income it replaced).
    await reconcileExpenseSaved(logged.expenseId!, U);
    expect((await db.getEvent(event.id))?.needsCategory).toBe(false);
    expect(await db.countPending()).toBe(0);
  });
});
