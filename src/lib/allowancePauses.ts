/**
 * Allowance pause history (INS-004, owner decision 2026-11-25).
 *
 * A pause is the stretch of days the daily allowance was off (auto-save off), `to: null` while it still runs.
 * Insights read it so a paused day adds no budget money, even when nothing was spent that day.
 * Saved in `profiles.allowance_pauses` (store: `src/store/dailyBudget/allowancePauseSync.ts`).
 */
import { DateKey, addDaysToDateKey } from '../money/dateKeys';

export interface AllowancePause {
  from: DateKey;
  to: DateKey | null;
  /** Skipped only until the user answers the "you were away" question (ROL-004). */
  ask?: true;
}

// Matches the database limit (profiles_allowance_pauses_small).
const MAX_PAUSES = 500;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The pause list after auto-save was turned on or off today. Returns the same array when nothing changes.
 * Turning off opens a pause from today. Turning on closes the open pause on yesterday (today gets its allowance
 * again); a pause that would end before it starts (off and on the same day) is dropped.
 */
export function recordAutoRenewChange(pauses: AllowancePause[], turnedOn: boolean, todayKey: DateKey): AllowancePause[] {
  const hasOpen = pauses.some((p) => p.to === null);
  if (!turnedOn) {
    return hasOpen ? pauses : [...pauses, { from: todayKey, to: null }].slice(-MAX_PAUSES);
  }
  if (!hasOpen) return pauses;
  const yesterday = addDaysToDateKey(todayKey, -1);
  return pauses
    .map((p) => (p.to === null ? { from: p.from, to: yesterday } : p))
    .filter((p) => p.to === null || p.to >= p.from);
}

/** True when `dateKey` falls inside a pause (both ends included; an open pause runs on). */
export function isPausedOn(pauses: AllowancePause[] | undefined, dateKey: DateKey): boolean {
  if (!pauses) return false;
  return pauses.some((p) => p.from <= dateKey && (p.to === null || dateKey <= p.to));
}

/** Reads a stored / downloaded list. Bad entries are skipped; anything that is not a list gives null. */
export function parseAllowancePauses(raw: unknown): AllowancePause[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AllowancePause[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const { from, to } = p as { from?: unknown; to?: unknown };
    if (typeof from !== 'string' || !DATE_KEY.test(from)) continue;
    if (to !== null && (typeof to !== 'string' || !DATE_KEY.test(to))) continue;
    out.push((p as { ask?: unknown }).ask === true ? { from, to, ask: true } : { from, to });
  }
  return out;
}
