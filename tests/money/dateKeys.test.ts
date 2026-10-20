import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  todayDateKey,
  daysInMonthOfDateKey,
  addDaysToDateKey,
  countDaysInclusive,
  monthBoundsOfDateKey,
  isDateKeyWithin,
} from '../../src/money/dateKeys';

describe('src/money/dateKeys', () => {
  describe('toDateKey', () => {
    it('cuts date text at the T (what expense_date.split("T")[0] used to do)', () => {
      expect(toDateKey('2026-10-05T10:30:00Z')).toBe('2026-10-05');
      expect(toDateKey('  2026-10-05 ')).toBe('2026-10-05');
    });
    it('uses the LOCAL calendar day of a Date or a timestamp', () => {
      expect(toDateKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
      expect(toDateKey(new Date(2026, 9, 5, 0, 1).getTime())).toBe('2026-10-05');
    });
    it('returns an empty key for nothing usable, so callers can write `if (!dateKey) continue`', () => {
      expect(toDateKey(undefined)).toBe('');
      expect(toDateKey(null)).toBe('');
      expect(toDateKey('')).toBe('');
      expect(toDateKey(new Date('not a date'))).toBe('');
    });
  });

  it('todayDateKey follows the given clock', () => {
    expect(todayDateKey(new Date(2026, 0, 9, 8, 0))).toBe('2026-01-09');
  });

  describe('daysInMonthOfDateKey', () => {
    it('knows 28, 29, 30 and 31 day months', () => {
      expect(daysInMonthOfDateKey('2026-10-15')).toBe(31);
      expect(daysInMonthOfDateKey('2026-11-01')).toBe(30);
      expect(daysInMonthOfDateKey('2026-02-10')).toBe(28);
      expect(daysInMonthOfDateKey('2028-02-10')).toBe(29);
    });
  });

  describe('addDaysToDateKey', () => {
    it('crosses month and year ends in both directions', () => {
      expect(addDaysToDateKey('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
      expect(addDaysToDateKey('2026-10-05', 0)).toBe('2026-10-05');
    });
    it('is not fooled by daylight saving change days', () => {
      expect(addDaysToDateKey('2026-03-28', 1)).toBe('2026-03-29');
      expect(addDaysToDateKey('2026-10-24', 1)).toBe('2026-10-25');
      expect(addDaysToDateKey('2026-10-25', 1)).toBe('2026-10-26');
    });
  });

  describe('countDaysInclusive', () => {
    it('counts both end days', () => {
      expect(countDaysInclusive('2026-10-05', '2026-10-05')).toBe(1);
      expect(countDaysInclusive('2026-10-05', '2026-10-11')).toBe(7);
      expect(countDaysInclusive('2026-10-01', '2026-10-31')).toBe(31);
      expect(countDaysInclusive('2026-10-28', '2026-11-03')).toBe(7);
    });
    it('is 0 when the end is before the start', () => {
      expect(countDaysInclusive('2026-10-06', '2026-10-05')).toBe(0);
    });
  });

  it('monthBoundsOfDateKey gives the first and last day', () => {
    expect(monthBoundsOfDateKey('2026-02-14')).toEqual({ firstDateKey: '2026-02-01', lastDateKey: '2026-02-28' });
    expect(monthBoundsOfDateKey('2026-12-31')).toEqual({ firstDateKey: '2026-12-01', lastDateKey: '2026-12-31' });
  });

  it('isDateKeyWithin includes both ends', () => {
    expect(isDateKeyWithin('2026-10-05', '2026-10-05', '2026-10-11')).toBe(true);
    expect(isDateKeyWithin('2026-10-11', '2026-10-05', '2026-10-11')).toBe(true);
    expect(isDateKeyWithin('2026-10-12', '2026-10-05', '2026-10-11')).toBe(false);
    expect(isDateKeyWithin('2026-10-04', '2026-10-05', '2026-10-11')).toBe(false);
  });
});
