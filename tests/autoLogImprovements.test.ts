import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Real engine / service / db / notificationActions on Node SQLite; native, ledger, server and notifications are doubles.
vi.mock('expo-sqlite', async () => (await import('./helpers/autoLogTestEnv')).fakeSqlite);
vi.mock('expo-secure-store', async () => (await import('./helpers/autoLogTestEnv')).fakeSecureStore);
vi.mock('expo-crypto', async () => (await import('./helpers/autoLogTestEnv')).fakeCrypto);
vi.mock('../modules/arthik-autolog', async () => {
  const env = await import('./helpers/autoLogTestEnv');
  return { ArthikAutoLog: env.fakeNative, isAutoLogNativeAvailable: () => true };
});
vi.mock('../src/features/autoLog/ledger', async () => (await import('./helpers/autoLogTestEnv')).fakeLedger);
vi.mock('../src/features/autoLog/remote', async () => (await import('./helpers/autoLogTestEnv')).fakeRemote);
const notifyMock = vi.hoisted(() => ({
  notifyPreview: vi.fn(async () => {}),
  notifyLogged: vi.fn(async () => {}),
  notifyNeedsReview: vi.fn(async () => {}),
  notifyCategoryNotSaved: vi.fn(async () => {}),
  notifyUndoFailed: vi.fn(async () => {}),
  notifyWeeklyDigest: vi.fn(async () => {}),
  CATEGORY_ACTION_PREFIX: 'cat:',
  UNDO_ACTION_ID: 'autolog:undo',
  notificationIdFor: (k: string) => `autolog-${k}`,
}));
vi.mock('../src/features/autoLog/notify', () => notifyMock);
vi.mock('../src/features/autoLog/permissions', () => ({ hasSmsPermission: async () => true }));
vi.mock('../src/features/autoLog/background', () => ({ registerBackground: async () => {}, unregisterBackground: async () => {} }));
vi.mock('../src/features/autoLog/store', () => ({ useAutoLogStore: { getState: () => ({ refresh: async () => {} }) } }));
vi.mock('../src/config/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

import { resetEnv, ledger, receiveSms, fakeSqlite } from './helpers/autoLogTestEnv';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import { handleNotificationAction } from '../src/features/autoLog/notificationActions';
import { accountLabel } from '../src/features/autoLog/copy';

const U = 'user-1';
const DAY = 86400_000;
const HDFC = 'VM-HDFCBK-S';
const hdfcDebit = (amt: number, to: string, ref: string, last4 = '1213') =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *${last4} To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;

const goLive = async (tracked = ['HDFC:1213'], extra: Array<[string, string]> = []) => {
  receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '600000000001'), Date.now() - 10 * DAY);
  for (const [s, b] of extra) receiveSms(s, b, Date.now() - 9 * DAY);
  await service.runDiscovery(U);
  await service.completeSetup(U, { trackedKeys: tracked, keepAccounts: [] });
};

const tap = (actionIdentifier: string, eventId: string, expenseId: string | null) => ({
  actionIdentifier,
  notification: { request: { content: { data: { type: 'autolog', eventId, expenseId } } } },
});

beforeEach(async () => {
  await db.closeDb();
  resetEnv();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Bank SMS without an account number (AUT-006)', () => {
  const noDigits = (amt: number, ref: string) => `Rs ${amt}.00 debited via UPI to CHAI POINT. Ref ${ref} -HDFC Bank`;

  it('is logged on the only account the user has at that bank', async () => {
    await goLive();
    receiveSms(HDFC, noDigits(120, '628700000901'), Date.now());
    await service.processQueue(U, { notify: false });
    expect([...ledger.txs.values()].map((t) => t.amount)).toEqual([120]);
    const [e] = await db.findEvents("status = 'logged'");
    expect(e.accountKey).toBe('HDFC:1213');
  });

  it('still asks "Which account?" when the bank has two accounts (even if only one is tracked)', async () => {
    await goLive(['HDFC:1213'], [[HDFC, hdfcDebit(50, 'X', '600000000002', '5555')]]);
    receiveSms(HDFC, noDigits(120, '628700000902'), Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    expect((await db.findEvents("review_reason = 'no_account'")).length).toBe(1);
  });

  it('never puts a card spend on a bank account', async () => {
    await goLive();
    receiveSms(HDFC, 'Rs 120.00 spent on HDFC Bank Credit Card at CHAI POINT on 05-10-26', Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    expect((await db.findEvents("review_reason = 'no_account'")).length).toBe(1);
  });

  it('never guesses for an untracked account', async () => {
    await goLive([]);
    receiveSms(HDFC, noDigits(120, '628700000903'), Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Merchant memory', () => {
  it('a category remembered for "ZOMATO LTD" is used for "Zomato Payu"', async () => {
    await goLive();
    await db.setMerchantPref('ZOMATO LTD', 'cat-food', 'expense');
    receiveSms(HDFC, hdfcDebit(349, 'zomato.payu@hdfcbank', '628700000911'), Date.now());
    await service.processQueue(U, { notify: false });
    const [t] = [...ledger.txs.values()];
    expect(t.categoryId).toBe('cat-food');
  });

  it('preferences saved by older versions (old key) still work', async () => {
    await goLive();
    const raw = await fakeSqlite.openDatabaseAsync('autolog_user1.db');
    await raw.runAsync("INSERT INTO merchant_prefs (merchant, category_id, type, updated_at) VALUES ('swiggyltd', 'cat-food', 'expense', 1)");
    expect(await db.getMerchantPref('Swiggy Ltd')).toMatchObject({ category_id: 'cat-food' });
  });

  it('learns the category from the user\'s own entries', async () => {
    await goLive();
    ledger.history = [
      { note: 'Swiggy', category_id: 'cat-food', type: 'expense' },
      { note: 'SWIGGY', category_id: 'cat-food', type: 'expense' },
    ];
    receiveSms(HDFC, hdfcDebit(240, 'SWIGGY', '628700000912'), Date.now());
    await service.processQueue(U, { notify: false });
    const [t] = [...ledger.txs.values()];
    expect(t.categoryId).toBe('cat-food');
    const [e] = await db.findEvents("status = 'logged'");
    expect(e.needsCategory).toBe(false);
  });

  it('a remembered preference wins over history', async () => {
    await goLive();
    await db.setMerchantPref('Swiggy', 'cat-treats', 'expense');
    ledger.history = [
      { note: 'Swiggy', category_id: 'cat-food', type: 'expense' },
      { note: 'Swiggy', category_id: 'cat-food', type: 'expense' },
    ];
    receiveSms(HDFC, hdfcDebit(240, 'SWIGGY', '628700000913'), Date.now());
    await service.processQueue(U, { notify: false });
    expect([...ledger.txs.values()][0].categoryId).toBe('cat-treats');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Faster Discovery (one database transaction per batch)', () => {
  it('a large inbox gives the same result and still logs nothing', async () => {
    const now = Date.now();
    for (let i = 0; i < 320; i++) receiveSms(HDFC, hdfcDebit(10 + i, `SHOP ${i % 7}`, String(600000100000 + i)), now - DAY - i * 60_000);
    const s = await service.runDiscovery(U);
    expect(s.financial).toBe(320);
    expect(ledger.txs.size).toBe(0);
    expect((await db.listAccounts()).map((a) => [a.key, a.msgCount])).toEqual([['HDFC:1213', 320]]);
    expect((await db.findEvents("status = 'discovery'")).length).toBe(320);
  });

  it('a failed batch is rolled back, never half-written', async () => {
    await db.openDb(U);
    await expect(
      db.inTransaction(async () => {
        await db.setMeta('half', '1');
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await db.getMeta('half')).toBeNull();
    await db.inTransaction(async () => db.setMeta('whole', '1'));
    expect(await db.getMeta('whole')).toBe('1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Recommended accounts in setup', () => {
  it('recommends accounts that showed a balance or were seen often, never selects them', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) receiveSms(HDFC, hdfcDebit(10 + i, 'SHOP', String(600000200000 + i)), now - DAY - i * 60_000);
    receiveSms('JD-SBIUPI-S', 'Dear UPI user A/C X7821 debited by 50.0 on date 05Oct26 trf to RAHUL Refno 528112345678. Avl Bal Rs 900.00 -SBI', now - DAY);
    receiveSms('VK-KOTAKB-S', 'Rs.75.00 debited from Kotak Bank A/c XX4040 to CAFE on 05-10-26. UPI Ref 628700000921', now - DAY);
    await service.runDiscovery(U);
    expect((await service.recommendedAccountKeys(U)).sort()).toEqual(['HDFC:1213', 'SBI:7821']);
    expect((await db.listAccounts()).every((a) => !a.tracked)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Account nickname', () => {
  it('can be set, shown in labels, trimmed, limited and cleared', async () => {
    await goLive();
    await service.renameAccount(U, 'HDFC:1213', '  Salary account  ');
    let [a] = await db.listAccounts();
    expect(a.nickname).toBe('Salary account');
    expect(accountLabel(a)).toBe('Salary account ••••1213');
    await service.renameAccount(U, 'HDFC:1213', 'A very very long nickname for my account');
    [a] = await db.listAccounts();
    expect(a.nickname?.length).toBeLessThanOrEqual(24);
    await service.renameAccount(U, 'HDFC:1213', '   ');
    [a] = await db.listAccounts();
    expect(a.nickname).toBeNull();
    expect(accountLabel(a)).toBe('HDFC Bank ••••1213');
  });

  it('survives new messages from the bank', async () => {
    await goLive();
    await service.renameAccount(U, 'HDFC:1213', 'Salary');
    receiveSms(HDFC, hdfcDebit(99, 'CAFE', '628700000931'), Date.now());
    await service.processQueue(U, { notify: false });
    expect((await db.listAccounts())[0].nickname).toBe('Salary');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Undo from the "logged" notification', () => {
  const logOne = async () => {
    await goLive();
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000941'), Date.now());
    await service.processQueue(U, { notify: false });
    const [e] = await db.findEvents("status = 'logged'");
    return e;
  };

  it('removes the transaction and the event is never logged again', async () => {
    const e = await logOne();
    expect(await handleNotificationAction(tap('autolog:undo', e.id, e.expenseId))).toBe(true);
    expect(ledger.txs.size).toBe(0);
    expect((await db.getEvent(e.id))?.status).toBe('ignored');
    // The inbox catch-up sees the same SMS again: still nothing logged.
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
  });

  it('is safe to tap twice', async () => {
    const e = await logOne();
    await handleNotificationAction(tap('autolog:undo', e.id, e.expenseId));
    await handleNotificationAction(tap('autolog:undo', e.id, e.expenseId));
    expect(ledger.txs.size).toBe(0);
    expect(notifyMock.notifyUndoFailed).not.toHaveBeenCalled();
  });

  it('keeps everything and says so when the transaction cannot be removed (offline, app closed)', async () => {
    const e = await logOne();
    ledger.offline = true;
    await handleNotificationAction(tap('autolog:undo', e.id, e.expenseId));
    expect(ledger.txs.size).toBe(1);
    expect((await db.getEvent(e.id))?.status).toBe('logged');
    expect(notifyMock.notifyUndoFailed).toHaveBeenCalledWith(e.id, e.expenseId);
  });

  it('a queued (not yet written) transaction is simply never written', async () => {
    await goLive();
    ledger.offline = true;
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000942'), Date.now());
    await service.processQueue(U, { notify: false });
    const [e] = await db.findEvents("status = 'queued'");
    await handleNotificationAction(tap('autolog:undo', e.id, e.expenseId));
    ledger.offline = false;
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
  });

  it('category buttons still work through the same handler; other taps are not handled', async () => {
    const e = await logOne();
    await db.updateEvent(e.id, { needsCategory: true });
    expect(await handleNotificationAction(tap('cat:cat-food', e.id, e.expenseId))).toBe(true);
    expect(ledger.txs.get(e.expenseId as string)?.categoryId).toBe('cat-food');
    expect(await handleNotificationAction(tap('expo.modules.notifications.actions.DEFAULT', e.id, e.expenseId))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Autostart guide', () => {
  it('shows until the user taps Done, and stays done', async () => {
    expect(await service.isAutostartGuideDone(U)).toBe(false);
    await service.markAutostartGuideDone(U);
    expect(await service.isAutostartGuideDone(U)).toBe(true);
    await db.closeDb();
    expect(await service.isAutostartGuideDone(U)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Weekly summary notification', () => {
  it('is sent once on the first check of a new week, about the week before', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 18, 12, 0)); // Wednesday
    await goLive();
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000951'), Date.now());
    receiveSms(HDFC, hdfcDebit(120, 'CAFE', '628700000952'), Date.now() + 60_000);
    await service.processQueue(U, { notify: true });
    expect(notifyMock.notifyWeeklyDigest).not.toHaveBeenCalled(); // first week: nothing to sum up yet

    vi.setSystemTime(new Date(2026, 10, 23, 9, 0)); // next Monday
    await service.processQueue(U, { notify: true });
    expect(notifyMock.notifyWeeklyDigest).toHaveBeenCalledTimes(1);
    expect(notifyMock.notifyWeeklyDigest).toHaveBeenCalledWith('Your week with Automatic Logging', '2 payments logged for you · 2 need your review.', expect.any(String)); // logged without a category = still to review

    vi.setSystemTime(new Date(2026, 10, 24, 9, 0));
    await service.processQueue(U, { notify: true });
    expect(notifyMock.notifyWeeklyDigest).toHaveBeenCalledTimes(1);
  });

  it('stays quiet after an empty week and when notifications are off', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 18, 12, 0));
    await goLive();
    await service.processQueue(U, { notify: true });
    vi.setSystemTime(new Date(2026, 10, 23, 9, 0));
    await service.processQueue(U, { notify: true });
    expect(notifyMock.notifyWeeklyDigest).not.toHaveBeenCalled();

    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000953'), Date.now());
    await service.processQueue(U, { notify: false });
    vi.setSystemTime(new Date(2026, 10, 30, 9, 0));
    await service.processQueue(U, { notify: false });
    expect(notifyMock.notifyWeeklyDigest).not.toHaveBeenCalled();
  });
});
