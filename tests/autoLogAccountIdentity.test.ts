import { describe, it, expect, beforeEach, vi } from 'vitest';

// AUT-005: only the account's own bank can create an account. Real engine/service/db on Node SQLite.
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

import { resetEnv, ledger, remote, receiveSms } from './helpers/autoLogTestEnv';
import { resolveBank, resolveEmailSender, parseSms } from '../src/features/autoLog/parser';
import { canonicalAccountKey } from '../src/features/autoLog/senders';
import * as service from '../src/features/autoLog/service';
import * as db from '../src/features/autoLog/db';
import type { AutoLogEvent } from '../src/features/autoLog/types';

const U = 'user-1';
const DAY = 86400_000;

const HDFC = 'VM-HDFCBK-S';
const SBI_MF = 'JD-SBIMFS-S';
const SLICE_BANK = 'JD-SLCBNK-S';
const SLICE_APP = 'AX-SLICEIT-S';

const hdfcDebit = (amt: number, to: string, ref: string) =>
  `Sent Rs.${amt}.00 From HDFC Bank A/C *1213 To ${to} On 05/10/26 Ref ${ref} Not You? Call 18002586161`;
const sipDebit = (amt: number) =>
  `Your SIP instalment of Rs.${amt}.00 in SBI Bluechip Fund has been debited from your bank A/c XX1213 on 05-10-26. -SBI Mutual Fund`;
const sliceDebit = (amt: number, ref: string) => `Rs ${amt} debited from your slice A/c XX4391 to ZOMATO via UPI. Ref ${ref}`;

const keys = async () => (await db.listAccounts()).map((a) => a.key).sort();

beforeEach(async () => {
  await db.closeDb();
  resetEnv();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Sender identity (who sent the SMS)', () => {
  it('a mutual fund / insurer named after a bank is not the bank', () => {
    expect(resolveBank(SBI_MF)).toMatchObject({ role: 'third_party', name: 'SBI Mutual Fund' });
    expect(resolveBank('VM-HDFCLI-S')).toMatchObject({ role: 'third_party', name: 'HDFC Life' });
    expect(resolveBank('VM-SBIGEN-S').role).toBe('third_party');
    expect(resolveBank('VM-AXISMF-S').role).toBe('third_party');
    expect(resolveBank('VM-CAMSPY-S').role).toBe('third_party');
  });

  it('every SBI bank header is still SBI the bank', () => {
    for (const h of ['JD-SBIUPI-S', 'AD-SBIINB-S', 'BZ-CBSSBI-S', 'VM-ATMSBI-S', 'VM-SBMSMS']) {
      expect(resolveBank(h)).toMatchObject({ code: 'SBI', role: 'bank' });
    }
    expect(resolveBank(HDFC)).toMatchObject({ code: 'HDFC', role: 'bank' });
  });

  it('one bank sending from several headers is one bank', () => {
    expect(resolveBank(SLICE_BANK)).toMatchObject({ code: 'SLICE', role: 'bank' });
    expect(resolveBank(SLICE_APP)).toMatchObject({ code: 'SLICE', role: 'bank' });
  });

  it('a header Arthik does not know is "unknown", never guessed as a bank', () => {
    expect(resolveBank('XY-FOOBNK')).toMatchObject({ code: 'FOOBNK', role: 'unknown' });
  });

  it('SMS knows whether the message shows the account balance', () => {
    expect(parseSms('XY-COOPBK', 'Rs 500 debited from A/c XX7777 to SHOP. Avl Bal Rs 2,000.00').showsBalance).toBe(true);
    expect(parseSms('XY-COOPBK', 'Rs 500 debited from A/c XX7777 to SHOP. Ref 628700000301').showsBalance).toBe(false);
  });

  it('emails from a fund or insurer are not bank emails', () => {
    expect(resolveEmailSender('SBI Mutual Fund').kind).not.toBe('bank');
    expect(resolveEmailSender('HDFC Life Insurance').kind).not.toBe('bank');
    expect(resolveEmailSender('HDFC Bank InstaAlerts').kind).toBe('bank');
  });

  it('old account codes map to the bank they really are', () => {
    expect(canonicalAccountKey('SLCBNK', '4391')).toBe('SLICE:4391');
    expect(canonicalAccountKey('HDFC', '1213')).toBe('HDFC:1213');
    expect(canonicalAccountKey('FOOBNK', '1213')).toBe('FOOBNK:1213');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Discovery finds only real accounts', () => {
  it('a SIP debit quoting the HDFC account does not create an "SBI" account', async () => {
    const now = Date.now();
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000001'), now - 3 * DAY);
    receiveSms(SBI_MF, sipDebit(500), now - 2 * DAY);
    await service.runDiscovery(U);
    expect(await keys()).toEqual(['HDFC:1213']);
  });

  it('slice from two headers is one account', async () => {
    const now = Date.now();
    receiveSms(SLICE_BANK, sliceDebit(250, '628700000201'), now - 3 * DAY);
    receiveSms(SLICE_APP, sliceDebit(90, '628700000202'), now - 2 * DAY);
    await service.runDiscovery(U);
    const accounts = await db.listAccounts();
    expect(accounts.map((a) => a.key)).toEqual(['SLICE:4391']);
    expect(accounts[0].bank).toBe('slice');
  });

  it('an unknown small bank still gets its account when no other account has those digits', async () => {
    receiveSms('XY-COOPBK-S', 'Rs 500 debited from A/c XX7777 to SHOP. Ref 628700000301', Date.now() - DAY);
    await service.runDiscovery(U);
    expect(await keys()).toEqual(['COOPBK:7777']);
  });

  it('an unknown sender quoting a known account\'s digits does not create a second account', async () => {
    const now = Date.now();
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000001'), now - 3 * DAY);
    receiveSms('XY-BILLDK-S', 'Rs 500 debited from A/c XX1213 towards ELECTRICITY BILL. Ref 628700000302', now - 2 * DAY);
    await service.runDiscovery(U);
    expect(await keys()).toEqual(['HDFC:1213']);
  });

  it('an unknown sender that shows the balance is the account\'s own bank', async () => {
    const now = Date.now();
    receiveSms(HDFC, hdfcDebit(349, 'ZOMATO', '628700000001'), now - 3 * DAY);
    receiveSms('XY-COOPBK-S', 'Rs 500 debited from A/c XX1213 to SHOP. Avl Bal Rs 2,000.00', now - 2 * DAY);
    await service.runDiscovery(U);
    expect(await keys()).toEqual(['COOPBK:1213', 'HDFC:1213']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Live: other senders never double count', () => {
  const goLive = async () => {
    receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '600000000001'), Date.now() - 10 * DAY);
    await service.runDiscovery(U);
    await service.completeSetup(U, { trackedKeys: ['HDFC:1213'], keepAccounts: [] });
  };

  it('a SIP SMS and the bank SMS for the same debit log ONE expense (either order)', async () => {
    await goLive();
    receiveSms(SBI_MF, sipDebit(500), Date.now());
    receiveSms(HDFC, hdfcDebit(500, 'SBI MUTUAL FUND', '628700000401'), Date.now() + 1000);
    await service.processQueue(U, { notify: false });
    expect([...ledger.txs.values()].map((t) => t.amount)).toEqual([500]);
    expect(await keys()).toEqual(['HDFC:1213']);
  });

  it('a non-bank SMS alone never creates a transaction or a review', async () => {
    await goLive();
    receiveSms(SBI_MF, sipDebit(700), Date.now());
    receiveSms(SBI_MF, 'Your SIP of Rs.700 in folio 1234567/89 is registered successfully. -SBI Mutual Fund', Date.now() + 1000);
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    expect(await db.countPending()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cleanup of accounts saved by older versions', () => {
  const legacyAccount = async (code: string, bank: string, last4: string, tracked: boolean, sender: string, body: string, at: number) => {
    await db.touchAccount({ key: `${code}:${last4}`, bank, bankCode: code, last4, kind: 'bank' }, at, false);
    if (tracked) await db.setAccountTracked(`${code}:${last4}`, true);
    const e: AutoLogEvent = {
      id: `sms:${code}${at}:${Math.floor(at / 1000)}`, source: 'sms', origin: 'live', sender: bank, body, fingerprint: `${code}${at}`,
      occurredAt: at, amount: 250, direction: 'debit', accountKey: `${code}:${last4}`, merchant: null, ref: null,
      template: `${sender}|abc`, kind: 'txn', status: tracked ? 'logged' : 'untracked', reviewReason: null,
      expenseId: tracked ? `exp-${code}` : null, matchedId: null, needsCategory: false, createdAt: at,
    };
    await db.insertEvent(e);
  };

  it('merges the same slice account saved under two names and keeps it tracked', async () => {
    await db.openDb(U);
    await db.setMeta('setup_complete', '1'); // the tracked list is synced only for a finished setup
    const now = Date.now();
    await legacyAccount('SLCBNK', 'Slcbnk', '4391', true, 'SLCBNK', sliceDebit(250, '1'), now - 5 * DAY);
    await legacyAccount('SLICE', 'slice', '4391', false, 'SLICEIT', sliceDebit(90, '2'), now - DAY);
    await service.tidyAccounts(U);
    const accounts = await db.listAccounts();
    expect(accounts.map((a) => [a.key, a.tracked])).toEqual([['SLICE:4391', true]]);
    expect((await db.findEvents("account_key = 'SLCBNK:4391'")).length).toBe(0);
    expect((await db.findEvents("account_key = 'SLICE:4391'")).length).toBe(2);
    expect(remote.row.tracked_accounts).toEqual([{ bank: 'slice', bankCode: 'SLICE', last4: '4391', kind: 'bank' }]);
  });

  it('removes an "SBI" account that only a mutual fund ever mentioned, and keeps its events on the real account', async () => {
    await db.openDb(U);
    const now = Date.now();
    await legacyAccount('HDFC', 'HDFC Bank', '1213', true, 'HDFCBK', hdfcDebit(349, 'X', '1'), now - 3 * DAY);
    await legacyAccount('SBI', 'SBI', '1213', false, 'SBIMFS', sipDebit(500), now - 2 * DAY);
    await service.tidyAccounts(U);
    expect(await keys()).toEqual(['HDFC:1213']);
    expect((await db.findEvents("account_key = 'SBI:1213'")).length).toBe(0);
  });

  it('removes such an account even if it was turned on (it can only double count)', async () => {
    await db.openDb(U);
    await legacyAccount('HDFC', 'HDFC Bank', '1213', true, 'HDFCBK', hdfcDebit(349, 'X', '1'), Date.now() - 3 * DAY);
    await legacyAccount('SBI', 'SBI', '1213', true, 'SBIMFS', sipDebit(500), Date.now() - 2 * DAY);
    await service.tidyAccounts(U);
    expect(await keys()).toEqual(['HDFC:1213']);
    expect(ledger.txs.size).toBe(0); // money already in history is never touched
  });

  it('keeps a real SBI account that SBI itself messaged', async () => {
    await db.openDb(U);
    await legacyAccount('HDFC', 'HDFC Bank', '1213', true, 'HDFCBK', hdfcDebit(349, 'X', '1'), Date.now() - 3 * DAY);
    await legacyAccount('SBI', 'SBI', '1213', false, 'SBIUPI', 'Dear UPI user A/C X1213 debited by 50.0', Date.now() - 2 * DAY);
    await service.tidyAccounts(U);
    expect(await keys()).toEqual(['HDFC:1213', 'SBI:1213']);
  });

  it('removes an untracked unknown-sender account that shares a known account\'s digits, keeps a tracked one', async () => {
    await db.openDb(U);
    await legacyAccount('HDFC', 'HDFC Bank', '1213', true, 'HDFCBK', hdfcDebit(349, 'X', '1'), Date.now() - 3 * DAY);
    await legacyAccount('BILLDK', 'Billdk', '1213', false, 'BILLDK', 'Rs 500 debited from A/c XX1213', Date.now() - 2 * DAY);
    await legacyAccount('COOPBK', 'Coopbk', '1213', true, 'COOPBK', 'Rs 500 debited from A/c XX1213', Date.now() - 2 * DAY);
    await service.tidyAccounts(U);
    expect(await keys()).toEqual(['COOPBK:1213', 'HDFC:1213']);
  });

  it('restoring tracked accounts from an older backup uses the real bank', async () => {
    receiveSms(SLICE_BANK, sliceDebit(250, '628700000201'), Date.now() - DAY);
    await service.runDiscovery(U);
    await service.completeSetup(U, {
      trackedKeys: [],
      keepAccounts: [{ bank: 'Slcbnk', bankCode: 'SLCBNK', last4: '4391', kind: 'bank' }],
    });
    expect((await db.listAccounts()).map((a) => [a.key, a.tracked])).toEqual([['SLICE:4391', true]]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('"Not my account" (user control)', () => {
  it('hides the account for good: never listed, never logged, never re-added', async () => {
    receiveSms('XY-COOPBK-S', 'Rs 500 debited from A/c XX7777 to SHOP. Ref 628700000301', Date.now() - DAY);
    receiveSms(HDFC, hdfcDebit(100, 'OLD SHOP', '600000000001'), Date.now() - DAY);
    await service.runDiscovery(U);
    await service.completeSetup(U, { trackedKeys: ['HDFC:1213', 'COOPBK:7777'], keepAccounts: [] });

    await service.hideAccount(U, 'COOPBK:7777');
    expect(await keys()).toEqual(['HDFC:1213']);
    expect(remote.row.tracked_accounts.map((a: any) => a.bankCode)).toEqual(['HDFC']);

    receiveSms('XY-COOPBK-S', 'Rs 800 debited from A/c XX7777 to SHOP. Ref 628700000302', Date.now());
    await service.processQueue(U, { notify: false });
    expect(ledger.txs.size).toBe(0);
    expect(await keys()).toEqual(['HDFC:1213']);
    expect((await service.listHiddenAccounts(U)).map((a) => a.key)).toEqual(['COOPBK:7777']);
  });

  it('can be shown again (untracked until the user turns it on)', async () => {
    receiveSms('XY-COOPBK-S', 'Rs 500 debited from A/c XX7777 to SHOP. Ref 628700000301', Date.now() - DAY);
    await service.runDiscovery(U);
    await service.hideAccount(U, 'COOPBK:7777');
    await service.unhideAccount(U, 'COOPBK:7777');
    const accounts = await db.listAccounts();
    expect(accounts.map((a) => [a.key, a.tracked])).toEqual([['COOPBK:7777', false]]);
    expect(await service.listHiddenAccounts(U)).toEqual([]);
  });
});
