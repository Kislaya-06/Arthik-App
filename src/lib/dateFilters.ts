import { format, parseISO, isSameWeek, isSameMonth, isSameYear } from 'date-fns';

export type FilterPeriod = 'day' | 'week' | 'month' | 'all';

/**
 * Pure predicate to determine whether a given date string falls within a target period,
 * relative to an explicit reference date, optionally bounded by account creation date.
 *
 * Invariants:
 * - Sanitizes ISO timestamp strings (splits on 'T' and trims).
 * - Week period strictly starts on Monday ({ weekStartsOn: 1 }).
 * - Month period strictly verifies both same month AND same year.
 * - Safely returns false for malformed or empty date strings.
 * - If userCreatedAtStr is provided, dates strictly prior to userCreatedAtStr return false.
 */
export const isDateInPeriod = (
  dateStr: string | undefined | null,
  period: FilterPeriod,
  referenceDate: Date,
  userCreatedAtStr?: string
): boolean => {
  if (!dateStr) return false;

  const cleanDate = dateStr.split('T')[0]?.trim();
  if (!cleanDate) return false;

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

  try {
    const d = parseISO(cleanDate);
    if (isNaN(d.getTime())) {
      return false;
    }
    if (period === 'week') {
      return isSameWeek(d, referenceDate, { weekStartsOn: 1 });
    }
    if (period === 'month') {
      return isSameMonth(d, referenceDate) && isSameYear(d, referenceDate);
    }
  } catch {
    return false;
  }

  return false;
};
