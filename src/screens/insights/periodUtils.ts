import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subWeeks, subMonths, subYears, isBefore, startOfDay, format,
  isSameMonth, isSameYear,
} from 'date-fns';
import { CATEGORY_PALETTE } from '../../config/theme';

export type Period = 'Weekly' | 'Monthly' | 'Yearly';

export const CHART_COLORS = CATEGORY_PALETTE;

// Max dots shown in the navigator — prevents visual clutter for long-time users
export const MAX_NAV_DOTS = 5;

// ─── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the date interval (start/end) for a period shifted by `offset` steps from today.
 * offset=0 → current period, offset=-1 → previous period, offset=-2 → two periods back, etc.
 */
export function buildInterval(period: Period, offset: number): { start: Date; end: Date } {
  const now = new Date(), abs = Math.abs(offset);
  if (period === 'Weekly') {
    const ref = offset < 0 ? subWeeks(now, abs) : now;
    return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
  }
  if (period === 'Monthly') {
    const ref = offset < 0 ? subMonths(now, abs) : now;
    return { start: startOfMonth(ref), end: endOfMonth(ref) };
  }
  const ref = offset < 0 ? subYears(now, abs) : now;
  return { start: startOfYear(ref), end: endOfYear(ref) };
}

/**
 * Builds a human-readable label for the navigator header.
 *   offset=0  → "This Week" / "This Month" / "This Year"
 *   offset=-1 → "Last Week" / "Last Month" / "Last Year"
 *   older     → "15 – 21 Sep" / "Aug 2026" / "2025"
 */
export function buildDateLabel(period: Period, offset: number): string {
  if (offset === 0) return period === 'Weekly' ? 'This Week' : period === 'Monthly' ? 'This Month' : 'This Year';
  if (offset === -1) return period === 'Weekly' ? 'Last Week' : period === 'Monthly' ? 'Last Month' : 'Last Year';
  const { start, end } = buildInterval(period, offset);
  if (period === 'Weekly') {
    if (isSameMonth(start, end) && isSameYear(start, end)) {
      return `${format(start, 'd')} – ${format(end, 'd MMM yyyy')}`;
    }
    if (isSameYear(start, end)) {
      return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
    }
    return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
  }
  return period === 'Monthly' ? format(start, 'MMMM yyyy') : format(start, 'yyyy');
}

/**
 * Computes the furthest back (most negative) offset the user is allowed to navigate to,
 * based on the earliest recorded expense date. Returns 0 if no expenses exist yet.
 */
export function computeMinOffset(period: Period, earliestDate: Date | null): number {
  if (!earliestDate) return 0;
  let offset = 0;
  const earliestDay = startOfDay(earliestDate);
  // Walk backward until the previous interval ended strictly before the earliest expense
  while (offset > -60) {
    const { end } = buildInterval(period, offset - 1);
    if (isBefore(startOfDay(end), earliestDay)) break;
    offset--;
  }
  return offset;
}
