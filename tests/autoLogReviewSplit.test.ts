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

import { resetEnv, receiveSms } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { classifyEvent, reconcileExpenseSaved } from '../src/features/autoLog/reviews';

const U = 'user-review-split';
const HDFC = 'VM-HDFCBK';
const hdfcDebit = (amt: number, to: string, ref: string) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *1234 To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;

const goLive = async (trackedKeys = ['HDFC:1234']) => {
  const now = Date.now();
  receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '600000000001'), now - 10 * 86400_000);
  await service.runDiscovery(U);
  await service.completeSetup(U, { trackedKeys, keepAccounts: [] });
};

describe('AutoLog: Review & Split Instant Clearance', () => {
  beforeEach(async () => {
    await db.closeDb();
    resetEnv();
    await goLive();
  });

  it('clears needsCategory when classifyEvent is called with clearNeedsCategory: true (Save and Split)', async () => {
    // 1. Receive SMS while live
    receiveSms(HDFC, hdfcDebit(500, 'Zomato', 'REF123'), Date.now());
    await service.processQueue(U, { notify: false });

    // The event was logged but needs category (pending review)
    const pendingBefore = await db.listPending();
    expect(pendingBefore.length).toBe(1);
    expect(pendingBefore[0].amount).toBe(500);

    const event = pendingBefore[0];

    // 2. User taps "Save and split with friends" which calls classifyEvent with clearNeedsCategory: true
    const classified = await classifyEvent(
      event,
      'expense',
      null, // category not chosen yet in sheet, to be chosen in main form
      false,
      undefined,
      { clearNeedsCategory: true }
    );

    expect(classified.status).toBe('logged');
    expect(classified.needsCategory).toBe(false);

    // 3. SQLite events table reflects needs_category = 0
    const evInDb = await db.getEvent(event.id);
    expect(evInDb?.needsCategory).toBe(false);
    expect(evInDb?.status).toBe('logged');

    // 4. Pending reviews list and pending count are now 0 (banner disappears from Home)
    const pendingAfter = await db.listPending();
    expect(pendingAfter.length).toBe(0);

    const count = await db.countPending();
    expect(count).toBe(0);
  });

  it('reconcileExpenseSaved clears any pending AutoLog events when expense is edited and saved', async () => {
    // 1. Receive SMS while live
    receiveSms(HDFC, hdfcDebit(600, 'Swiggy', 'REF456'), Date.now());
    await service.processQueue(U, { notify: false });

    const pendingBefore = await db.listPending();
    expect(pendingBefore.length).toBe(1);
    const event = pendingBefore[0];
    expect(event.expenseId).toBeTruthy();

    // 2. User edits and saves expense on ExpenseFormScreen -> triggers reconcileExpenseSaved
    await reconcileExpenseSaved(event.expenseId!, U);

    // 3. Event is updated to needsCategory: false
    const ev = await db.getEvent(event.id);
    expect(ev?.needsCategory).toBe(false);

    const pendingAfter = await db.countPending();
    expect(pendingAfter).toBe(0);
  });
});
