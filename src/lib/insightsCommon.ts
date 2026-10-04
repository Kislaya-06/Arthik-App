/**
 * insightsCommon.ts
 *
 * Shared types and pure utility functions across Weekly, Monthly, and Yearly Insights.
 * Invariant: Real money only. Pure functions only. No React or side-effects.
 */

import { parseISO, format } from 'date-fns';

export interface ExpenseLike {
  id: string;
  amount: number;
  expense_date: string;
  category_id?: string | null;
  payment_mode?: string;
  notes?: string | null;
  type?: 'expense' | 'income' | string;
}

export type InsightTakeawayStatus = 'coral' | 'mint' | 'mintGreen' | 'neutral';

/**
 * Normalizes Date, number timestamp, or ISO string into a canonical 'yyyy-MM-dd' string.
 */
export function toDateStr(d: Date | number | string): string {
  if (typeof d === 'number') {
    return format(new Date(d), 'yyyy-MM-dd');
  }
  if (typeof d === 'string') {
    return d.split('T')[0]?.trim() || '';
  }
  return format(d, 'yyyy-MM-dd');
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
export function isDateInBounds(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}
