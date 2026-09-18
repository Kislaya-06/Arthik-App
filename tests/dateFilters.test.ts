import { describe, it, expect } from 'vitest';
import { isDateInPeriod } from '../src/lib/dateFilters';

describe('isDateInPeriod - Pure Date Predicate', () => {
  // Reference date: Friday, 18 September 2026 at 15:30:00
  // Week: Monday 2026-09-14 through Sunday 2026-09-20
  // Month: 2026-09-01 through 2026-09-30
  const REF_DATE = new Date(2026, 8, 18, 15, 30, 0); // Month is 0-indexed: 8 = Sept

  describe('day boundary', () => {
    it('returns true for the exact reference day', () => {
      expect(isDateInPeriod('2026-09-18', 'day', REF_DATE)).toBe(true);
    });

    it('returns false for yesterday and tomorrow', () => {
      expect(isDateInPeriod('2026-09-17', 'day', REF_DATE)).toBe(false);
      expect(isDateInPeriod('2026-09-19', 'day', REF_DATE)).toBe(false);
    });
  });

  describe('week boundary (Monday start: weekStartsOn: 1)', () => {
    it('returns true for Monday through Sunday of reference week', () => {
      expect(isDateInPeriod('2026-09-14', 'week', REF_DATE)).toBe(true); // Monday (start)
      expect(isDateInPeriod('2026-09-16', 'week', REF_DATE)).toBe(true); // Wednesday
      expect(isDateInPeriod('2026-09-18', 'week', REF_DATE)).toBe(true); // Friday
      expect(isDateInPeriod('2026-09-20', 'week', REF_DATE)).toBe(true); // Sunday (end)
    });

    it('returns false for previous Sunday and next Monday', () => {
      expect(isDateInPeriod('2026-09-13', 'week', REF_DATE)).toBe(false); // Previous Sunday
      expect(isDateInPeriod('2026-09-21', 'week', REF_DATE)).toBe(false); // Next Monday
    });

    it('handles reference date on Monday boundary', () => {
      const mondayRef = new Date(2026, 8, 14, 8, 0, 0);
      expect(isDateInPeriod('2026-09-14', 'week', mondayRef)).toBe(true);
      expect(isDateInPeriod('2026-09-20', 'week', mondayRef)).toBe(true);
      expect(isDateInPeriod('2026-09-13', 'week', mondayRef)).toBe(false);
    });

    it('handles reference date on Sunday boundary', () => {
      const sundayRef = new Date(2026, 8, 20, 23, 59, 59);
      expect(isDateInPeriod('2026-09-14', 'week', sundayRef)).toBe(true);
      expect(isDateInPeriod('2026-09-20', 'week', sundayRef)).toBe(true);
      expect(isDateInPeriod('2026-09-21', 'week', sundayRef)).toBe(false);
    });
  });

  describe('month boundary', () => {
    it('returns true for all dates within the reference month and year', () => {
      expect(isDateInPeriod('2026-09-01', 'month', REF_DATE)).toBe(true); // 1st
      expect(isDateInPeriod('2026-09-15', 'month', REF_DATE)).toBe(true); // Mid
      expect(isDateInPeriod('2026-09-30', 'month', REF_DATE)).toBe(true); // Last
    });

    it('returns false for previous and next months', () => {
      expect(isDateInPeriod('2026-08-31', 'month', REF_DATE)).toBe(false);
      expect(isDateInPeriod('2026-10-01', 'month', REF_DATE)).toBe(false);
    });

    it('returns false for the same month in a different year', () => {
      expect(isDateInPeriod('2025-09-18', 'month', REF_DATE)).toBe(false);
      expect(isDateInPeriod('2027-09-18', 'month', REF_DATE)).toBe(false);
    });
  });

  describe('registration boundary (userCreatedAtStr)', () => {
    const USER_CREATED = '2026-09-16'; // Registered on Wednesday

    it('excludes dates strictly before registration date', () => {
      expect(isDateInPeriod('2026-09-14', 'week', REF_DATE, USER_CREATED)).toBe(false); // Mon < Wed
      expect(isDateInPeriod('2026-09-15', 'week', REF_DATE, USER_CREATED)).toBe(false); // Tue < Wed
    });

    it('includes dates on or after registration date within period', () => {
      expect(isDateInPeriod('2026-09-16', 'week', REF_DATE, USER_CREATED)).toBe(true); // Wed == Wed
      expect(isDateInPeriod('2026-09-18', 'week', REF_DATE, USER_CREATED)).toBe(true); // Fri > Wed
    });

    it('applies registration boundary to period: all', () => {
      expect(isDateInPeriod('2026-09-15', 'all', REF_DATE, USER_CREATED)).toBe(false);
      expect(isDateInPeriod('2026-09-16', 'all', REF_DATE, USER_CREATED)).toBe(true);
      expect(isDateInPeriod('2026-09-25', 'all', REF_DATE, USER_CREATED)).toBe(true);
    });

    it('allows dates prior to today when userCreatedAtStr is undefined', () => {
      expect(isDateInPeriod('2026-09-14', 'week', REF_DATE, undefined)).toBe(true);
      expect(isDateInPeriod('2026-08-01', 'all', REF_DATE, undefined)).toBe(true);
    });
  });

  describe('date-only string vs ISO timestamp', () => {
    it('correctly matches clean yyyy-MM-dd strings', () => {
      expect(isDateInPeriod('2026-09-18', 'day', REF_DATE)).toBe(true);
    });

    it('correctly matches ISO 8601 strings with T and timestamp', () => {
      expect(isDateInPeriod('2026-09-18T10:30:00.000Z', 'day', REF_DATE)).toBe(true);
      expect(isDateInPeriod('2026-09-18T23:59:59+05:30', 'day', REF_DATE)).toBe(true);
    });

    it('handles leading and trailing whitespace safely', () => {
      expect(isDateInPeriod('  2026-09-18  ', 'day', REF_DATE)).toBe(true);
    });
  });

  describe('malformed dates and edge cases', () => {
    it('returns false for null and undefined', () => {
      expect(isDateInPeriod(null, 'day', REF_DATE)).toBe(false);
      expect(isDateInPeriod(undefined, 'day', REF_DATE)).toBe(false);
    });

    it('returns false for empty and whitespace-only strings', () => {
      expect(isDateInPeriod('', 'day', REF_DATE)).toBe(false);
      expect(isDateInPeriod('   ', 'day', REF_DATE)).toBe(false);
    });

    it('returns false for non-date garbage strings without throwing', () => {
      expect(isDateInPeriod('invalid-date', 'day', REF_DATE)).toBe(false);
      expect(isDateInPeriod('not-a-date', 'week', REF_DATE)).toBe(false);
      expect(isDateInPeriod('garbage', 'month', REF_DATE)).toBe(false);
    });

    it('returns false for out-of-range dates like 2026-99-99', () => {
      expect(isDateInPeriod('2026-99-99', 'month', REF_DATE)).toBe(false);
    });
  });

  describe('period: all', () => {
    it('returns true for any valid date when userCreatedAtStr is not provided', () => {
      expect(isDateInPeriod('2020-01-01', 'all', REF_DATE)).toBe(true);
      expect(isDateInPeriod('2026-09-18', 'all', REF_DATE)).toBe(true);
      expect(isDateInPeriod('2030-12-31', 'all', REF_DATE)).toBe(true);
    });
  });
});
