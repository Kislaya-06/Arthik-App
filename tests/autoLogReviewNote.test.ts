import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same test doubles as tests/autoLogReviewSplit.test.ts (tests/helpers/autoLogTestEnv.ts).
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

import { resetEnv, receiveSms, ledger } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { classifyEvent, setEventCategory } from '../src/features/autoLog/reviews';

const U = 'user-review-note';
const HDFC = 'VM-HDFCBK';
const CAT = '11111111-1111-4111-8111-111111111111';
const hdfcDebit = (amt: number, to: string, ref: string) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *1234 To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;

const pendingZomato = async () => {
  receiveSms(HDFC, hdfcDebit(500, 'Zomato', 'REF900'), Date.now());
  await service.processQueue(U, { notify: false });
  const [event] = await db.listPending();
  return event;
};

describe('AutoLog review: optional note', () => {
  beforeEach(async () => {
    await db.closeDb();
    resetEnv();
    const now = Date.now();
    receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '600000000001'), now - 10 * 86400_000);
    await service.runDiscovery(U);
    await service.completeSetup(U, { trackedKeys: ['HDFC:1234'], keepAccounts: [] });
  });

  it('saves the note the user typed', async () => {
    const event = await pendingZomato();
    const saved = await classifyEvent(event, 'expense', CAT, false, undefined, { note: '  Dinner with Ravi  ' });
    expect(ledger.txs.get(saved.expenseId!)?.note).toBe('Dinner with Ravi');
  });

  it('an empty or blank note falls back to the payee name, as before', async () => {
    const event = await pendingZomato();
    expect(event.merchant).toBeTruthy();
    const saved = await classifyEvent(event, 'expense', CAT, false, undefined, { note: '   ' });
    expect(ledger.txs.get(saved.expenseId!)?.note).toBe(event.merchant);
  });

  it('category-only review: a typed note replaces the saved one, an empty note keeps it', async () => {
    const event = await pendingZomato();
    expect(event.expenseId).toBeTruthy();
    const before = ledger.txs.get(event.expenseId!)?.note;

    await setEventCategory(event, CAT, false, '');
    expect(ledger.txs.get(event.expenseId!)?.note).toBe(before);

    await setEventCategory(event, CAT, false, 'Team lunch');
    expect(ledger.txs.get(event.expenseId!)?.note).toBe('Team lunch');
    expect(ledger.txs.get(event.expenseId!)?.categoryId).toBe(CAT);
  });
});
