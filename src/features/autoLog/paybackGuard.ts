import type { CreditKind } from './types';

/**
 * SPL-005: a remembered "income" must not swallow a friend's payback.
 *
 * "Remember this preference" saves "income" for a sender. Without this guard the next credit from that sender is
 * written straight in as income, even when the sender is a person who still owes the user money, so a payback would
 * count as income until someone noticed. With it, such a credit goes to review instead (where the settle choice
 * lives).
 *
 * Only the REMEMBERED shortcut is held back. Credits the parser already knows (salary, interest, refund) and
 * credits from people who owe nothing keep their automatic behaviour.
 */
export interface PaybackGuardInput {
  direction: 'credit' | 'debit' | null | undefined;
  /** What "Remember this preference" saved for this sender (null when nothing is saved). */
  prefType: string | null | undefined;
  creditKind?: CreditKind;
  /** The sender matches a person who still owes money (name first, SPL-005). */
  hasOwingMatch: boolean;
}

const AUTOMATIC_KINDS: CreditKind[] = ['salary', 'interest', 'refund'];

export function shouldHoldCreditForPayback(p: PaybackGuardInput): boolean {
  if (p.direction !== 'credit') return false;
  if (p.prefType !== 'income') return false;
  if (p.creditKind && AUTOMATIC_KINDS.includes(p.creditKind)) return false;
  return p.hasOwingMatch;
}
