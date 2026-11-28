/**
 * Money that came in from outside the transaction list (MNY-001).
 * Pure functions only. No React, no stores.
 */
import { round2 } from '../lib/formatters';
import { DateKey, isDateKeyWithin, toDateKey } from './dateKeys';

/** "New money" Gullak deposits (source 'external') between two date keys, both included. */
export function externalDepositsBetween(
  deposits: ReadonlyArray<{ amount: number | string; date?: string | null; source?: string }>,
  startDateKey: DateKey,
  endDateKey: DateKey
): number {
  let sum = 0;
  for (const deposit of deposits) {
    const dateKey = toDateKey(deposit.date);
    if (deposit.source === 'external' && dateKey && isDateKeyWithin(dateKey, startDateKey, endDateKey)) {
      sum += Number(deposit.amount) || 0;
    }
  }
  return round2(sum);
}
