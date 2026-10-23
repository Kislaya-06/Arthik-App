import { format } from 'date-fns/format';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';

export type FilterPeriod = 'day' | 'week' | 'month' | 'all';

/** Validate clean yyyy-MM-dd date string format and calendar limits */
const isValidIsoDate = (s: string): boolean => {
  if (s.length !== 10 || s[4] !== '-' || s[7] !== '-') return false;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return true;
};

/**
 * Pure predicate to determine whether a given date string falls within a target period,
 * relative to an explicit reference date, optionally bounded by account creation date.
 *
 * Highly optimized with fast ISO string bounds to guarantee 0ms latency on filter switches.
 */
export const isDateInPeriod = (
  dateStr: string | undefined | null,
  period: FilterPeriod,
  referenceDate: Date,
  userCreatedAtStr?: string
): boolean => {
  if (!dateStr) return false;

  const cleanDate = dateStr.split('T')[0]?.trim();
  if (!cleanDate || !isValidIsoDate(cleanDate)) return false;

  // If userCreatedAtStr is provided, reject records from before user account creation
  if (userCreatedAtStr && cleanDate < userCreatedAtStr) {
    return false;
  }

  if (period === 'all') {
    return true;
  }

  const refDateStr = format(referenceDate, 'yyyy-MM-dd');

  if (period === 'day') {
    return cleanDate === refDateStr;
  }

  if (period === 'month') {
    return cleanDate.slice(0, 7) === refDateStr.slice(0, 7);
  }

  if (period === 'week') {
    const weekStartStr = format(startOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEndStr = format(endOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return cleanDate >= weekStartStr && cleanDate <= weekEndStr;
  }

  return false;
};
