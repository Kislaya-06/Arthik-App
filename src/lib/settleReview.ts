import { round2 } from './formatters';

/**
 * Review sheet: "Paid back by someone?" (SPL-005).
 *
 * Pure helpers (no React, no stores) so the numbers and the short texts can be unit-tested.
 * The person's row is only a CHOICE; the footer button does the saving. These helpers decide what that button and
 * the one-line note above it say, so the button can never overflow and the user always sees what will happen to
 * the money BEFORE confirming.
 */

/** How many characters of a person's name fit on the footer button before it is cut with an ellipsis. */
export const SETTLE_BUTTON_NAME_MAX = 14;

export interface SettleSummary {
  /** Part of the received amount that goes back against what the person owes (becomes a money-back row, SPL-003). */
  settles: number;
  /** Part that is more than they owed: it stays ordinary income (SPL-004). */
  extra: number;
  /** What the person still owes after this payment (they paid less than the total). */
  stillOwes: number;
}

/** What happens to `amount` when it is a payback from someone who owes `owed` in total. */
export function summarizeSettle(owed: number, amount: number | null | undefined): SettleSummary {
  const o = Math.max(0, round2(Number(owed) || 0));
  const a = Math.max(0, round2(Number(amount) || 0));
  const settles = round2(Math.min(o, a));
  return {
    settles,
    extra: round2(Math.max(0, a - o)),
    stillOwes: round2(Math.max(0, o - a)),
  };
}

/** "Rahul Kumar Sharma" → "Rahul Kumar Sh…" (never wider than `max` characters). */
export function shortPersonName(name: string, max = SETTLE_BUTTON_NAME_MAX): string {
  const clean = (name || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Footer button text while a person is chosen, e.g. "Settle with Rahul · ₹500". */
export function settleButtonLabel(name: string, settles: number | null, money: (n: number | null | undefined) => string): string {
  const who = shortPersonName(name);
  return settles && settles > 0 ? `Settle with ${who} · ${money(settles)}` : `Settle with ${who}`;
}

/** Text shown while the settle is being saved (SPL-005): "Saving Rahul's payback · ₹500". */
export function settlingButtonLabel(name: string, settles: number | null, money: (n: number | null | undefined) => string): string {
  const who = shortPersonName(name);
  return settles && settles > 0 ? `Saving ${who}'s payback · ${money(settles)}` : `Saving ${who}'s payback`;
}

/**
 * One short line above the footer button that explains anything the button text can not:
 *  - more money than owed → "₹200 extra stays as income"
 *  - less money than owed → "Rahul will still owe ₹300"
 *  - exactly what was owed → no note.
 */
export function settleNote(
  name: string,
  summary: SettleSummary,
  money: (n: number | null | undefined) => string
): string | null {
  if (summary.extra > 0) return `${money(summary.extra)} extra stays as income`;
  if (summary.stillOwes > 0) return `${shortPersonName(name)} will still owe ${money(summary.stillOwes)}`;
  return null;
}
