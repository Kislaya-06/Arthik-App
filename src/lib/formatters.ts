import { format, isToday, isYesterday } from 'date-fns';

/**
 * Formats a number as Indian Rupee currency string (rounded to whole number).
 * e.g. 52000.75 → "₹52,001"
 */
export const formatCurrency = (n: number): string =>
  '₹' + Math.round(n).toLocaleString('en-IN');

/**
 * Formats a date for display with optional relative labels.
 * showRelative = true → "Today, 15 Jul" | "Yesterday, 14 Jul"
 * otherwise → "15 Jul, 2025"
 */
export const formatDate = (
  date: Date | string,
  showRelative = false,
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (showRelative) {
    if (isToday(d)) return `Today, ${format(d, 'd MMM')}`;
    if (isYesterday(d)) return `Yesterday, ${format(d, 'd MMM')}`;
  }
  return format(d, 'd MMM, yyyy');
};
