/**
 * insightsCommon.ts
 *
 * Shared types and pure utility functions across Weekly, Monthly, and Yearly Insights.
 * Invariant: Real money only. Pure functions only. No React or side-effects.
 */

import { parseISO } from 'date-fns';
import { toDateKey, isDateKeyWithin } from '../money/dateKeys';

export interface ExpenseLike {
  id: string;
  amount: number;
  expense_date: string;
  category_id?: string | null;
  payment_mode?: string;
  notes?: string | null;
  type?: 'expense' | 'income' | string;
  transaction_class?: string | null;
}

export type InsightTakeawayStatus = 'coral' | 'mint' | 'mintGreen' | 'neutral';

/**
 * Normalizes Date, number timestamp, or ISO string into a canonical 'yyyy-MM-dd' string.
 */
export function toDateStr(d: Date | number | string): string {
  return toDateKey(d);
}

/**
 * Normalizes Date, number timestamp, or ISO string into a Date object.
 */
export function toDateObj(d?: Date | number | string): Date {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d === 'number') return new Date(d);
  return parseISO(d);
}

/**
 * Checks if a 'yyyy-MM-dd' date string falls within [start, end] inclusive.
 */
export const isDateInBounds = isDateKeyWithin;
export { isDateKeyWithin };
