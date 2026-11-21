import * as db from './db';
import { mentionsBalance } from './parser';
import { bankNameOf, canonicalBankCode, isBankCode, resolveBank, SenderRole } from './senders';
import type { AutoLogEvent, ParsedMessage, TrackedAccount } from './types';

/**
 * Account identity (AUT-005): only the account's own bank can create an account.
 *
 *  - Layer 2 (`messageAccountRole`): decides, per message, whether its sender may own the account it names.
 *  - Layer 3 (`tidyAccounts`): cleans accounts that older versions saved from the wrong senders.
 * Money already logged is never touched here; only which account a message belongs to.
 */

export type AccountRole = 'owner' | 'evidence';

/**
 * May this message create / update the account it names?
 *  - the bank itself → owner
 *  - a fund, insurer, broker or lender → evidence (never an account, never a transaction)
 *  - an unknown header → owner only if it already owns this account, shows the balance (only the account's
 *    own bank knows it), or no other account has these digits (a small bank Arthik does not know yet).
 */
export const messageAccountRole = async (p: Pick<ParsedMessage, 'senderRole' | 'last4' | 'bankCode' | 'showsBalance'>): Promise<AccountRole> => {
  if (p.senderRole === 'third_party') return 'evidence';
  if (p.senderRole !== 'unknown' || !p.last4) return 'owner';
  if (p.showsBalance) return 'owner';
  if (await db.getAccount(`${p.bankCode}:${p.last4}`)) return 'owner';
  const sameDigits = (await db.listAccounts()).filter((a) => a.last4 === p.last4);
  return sameDigits.length ? 'evidence' : 'owner';
};

/** The account a message quoting these digits refers to: the one tracked account, else the one known account. */
export const accountForDigits = async (last4: string | undefined, exceptKey?: string): Promise<string | null> => {
  if (!last4) return null;
  const same = (await db.listAccounts()).filter((a) => a.last4 === last4 && a.key !== exceptKey);
  const tracked = same.filter((a) => a.tracked);
  if (tracked.length === 1) return tracked[0].key;
  if (same.length === 1) return same[0].key;
  return null;
};

/**
 * AUT-006: the account a bank's own message without account digits must be: the user's only visible account of
 * that kind at that bank, and only if it is tracked. Otherwise null (the user is asked).
 */
export const soleBankAccount = async (bankCode: string, kind: string): Promise<string | null> => {
  const same = (await db.listAccounts()).filter((a) => a.bankCode === bankCode && a.kind === kind);
  return same.length === 1 && same[0].tracked ? same[0].key : null;
};

/**
 * Accounts worth suggesting in setup: one that showed its balance (only its own bank knows it) or was seen in
 * at least 3 messages. Only a suggestion: nothing is selected or tracked by itself (trust rule 4).
 */
export const recommendedAccountKeys = async (): Promise<string[]> => {
  const keys: string[] = [];
  for (const a of await db.listAccounts()) {
    if (a.msgCount >= 3) {
      keys.push(a.key);
      continue;
    }
    const events = await db.findEvents("account_key = ? AND source = 'sms'", a.key);
    if (events.some((e) => mentionsBalance(e.body))) keys.push(a.key);
  }
  return keys;
};

/** Sender header an SMS event came from. The template keeps it in front of the '|' ("SBIMFS|1x9k"). */
const smsSenderRole = (e: AutoLogEvent): SenderRole => resolveBank(e.template.split('|')[0] || '').role;

/** An account whose saved messages all came from companies that are not a bank (only SMS can tell). */
const onlyNonBankSenders = (events: AutoLogEvent[]) => events.length > 0 && events.every((e) => smsSenderRole(e) === 'third_party');

const isKnownBank = (a: TrackedAccount) => isBankCode(a.bankCode);

/**
 * One pass over every saved account. Returns true when anything changed (the caller re-syncs the tracked
 * list to the server). Safe to run again and again: a clean list stays as it is.
 *
 *  1. The same bank saved under an old code ("SLCBNK:4391" next to "SLICE:4391") → one account.
 *  2. An account only funds / insurers / brokers ever named ("SBI ••1213" from SBI Mutual Fund) → removed,
 *     even if it was turned on: it is not a bank account and could only log the same debit twice.
 *  3. An account from an unknown header that shares its digits with a known bank's account, never showed a
 *     balance and is not turned on → removed. A tracked one stays (the user chose it; "Not my account" hides it).
 * Removed accounts' messages move to the account with the same digits, if there is exactly one.
 */
export const tidyAccounts = async (): Promise<boolean> => {
  let changed = false;

  for (const a of await db.listAllAccounts()) {
    const code = canonicalBankCode(a.bankCode);
    if (code === a.bankCode) continue;
    await db.moveAccount(a.key, { key: `${code}:${a.last4}`, bank: bankNameOf(code), bankCode: code });
    changed = true;
  }

  for (const a of await db.listAllAccounts()) {
    if (a.hidden) continue;
    const sms = await db.findEvents("account_key = ? AND source = 'sms'", a.key);
    let junk = onlyNonBankSenders(sms);
    if (!junk && !a.tracked && !isKnownBank(a) && sms.length > 0 && !sms.some((e) => mentionsBalance(e.body))) {
      const others = (await db.listAccounts()).filter((o) => o.key !== a.key && o.last4 === a.last4 && isKnownBank(o));
      junk = others.length > 0;
    }
    if (!junk) continue;
    await db.removeAccount(a.key);
    await db.reassignEvents(a.key, await accountForDigits(a.last4, a.key));
    changed = true;
  }
  return changed;
};
