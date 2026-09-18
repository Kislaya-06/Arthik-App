import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  formatAmountWithCommas,
  cleanAmountString,
  formatDate,
} from '../src/lib/formatters';

describe('formatCurrency', () => {
  it('formats a whole number with Indian Rupee symbol and commas', () => {
    expect(formatCurrency(52000)).toBe('₹52,000');
  });

  it('formats a number with two decimal places', () => {
    expect(formatCurrency(52000.75)).toBe('₹52,000.75');
  });

  it('rounds numbers with more than two decimal places to two decimal places', () => {
    // 52000.756 rounds up to .76
    expect(formatCurrency(52000.756)).toBe('₹52,000.76');
    // 52000.754 rounds down to .75
    expect(formatCurrency(52000.754)).toBe('₹52,000.75');
  });

  it('formats zero as ₹0', () => {
    expect(formatCurrency(0)).toBe('₹0');
  });

  it('places the minus sign before the Indian Rupee symbol for negative amounts', () => {
    expect(formatCurrency(-52000)).toBe('-₹52,000');
    expect(formatCurrency(-52000.75)).toBe('-₹52,000.75');
  });

  it('falls back to ₹0 when input is NaN or invalid non-number at runtime', () => {
    expect(formatCurrency(NaN)).toBe('₹0');
    expect(formatCurrency(undefined as unknown as number)).toBe('₹0');
    expect(formatCurrency('invalid' as unknown as number)).toBe('₹0');
    expect(formatCurrency(null as unknown as number)).toBe('₹0');
  });

  it('formats large numbers according to the Indian grouping system (lakhs and crores)', () => {
    // 1 crore = 1,00,00,000
    expect(formatCurrency(10000000)).toBe('₹1,00,00,000');
  });
});

describe('formatAmountWithCommas', () => {
  it('returns an empty string when given an empty string', () => {
    expect(formatAmountWithCommas('')).toBe('');
  });

  it('formats thousands (1,000) and lakhs (1,00,000) with Indian grouping', () => {
    expect(formatAmountWithCommas('1000')).toBe('1,000');
    expect(formatAmountWithCommas('100000')).toBe('1,00,000');
  });

  it('preserves trailing dot when user is mid-typing', () => {
    expect(formatAmountWithCommas('1000.')).toBe('1,000.');
  });

  it('preserves decimal fractions in progress', () => {
    expect(formatAmountWithCommas('1000.5')).toBe('1,000.5');
    expect(formatAmountWithCommas('1000.55')).toBe('1,000.55');
  });

  it('handles leading zeros correctly', () => {
    expect(formatAmountWithCommas('007')).toBe('7');
    expect(formatAmountWithCommas('0')).toBe('0');
    expect(formatAmountWithCommas('0.5')).toBe('0.5');
    expect(formatAmountWithCommas('00.5')).toBe('0.5');
  });

  it('strips non-numeric junk characters and formats the remaining digits', () => {
    expect(formatAmountWithCommas('12a3')).toBe('123');
    expect(formatAmountWithCommas('₹100000')).toBe('1,00,000');
    expect(formatAmountWithCommas('abc')).toBe('');
  });

  it('prepends a 0 when input is solely a dot', () => {
    expect(formatAmountWithCommas('.')).toBe('0.');
  });

  it('formats very short single-digit numbers without commas', () => {
    expect(formatAmountWithCommas('5')).toBe('5');
  });

  it('preserves multiple decimal dots if entered in raw input (characterizing quirk)', () => {
    // Current behavior: indexOf('.') splits at first dot, but remaining dots remain in decimalPart
    expect(formatAmountWithCommas('1000.5.5')).toBe('1,000.5.5');
  });
});

describe('cleanAmountString', () => {
  it('round-trips a formatted comma-separated amount back to pure numeric string', () => {
    expect(cleanAmountString('1,00,000.50')).toBe('100000.50');
  });

  it('leaves a string with no commas unchanged', () => {
    expect(cleanAmountString('500')).toBe('500');
    expect(cleanAmountString('1000.5')).toBe('1000.5');
    expect(cleanAmountString('')).toBe('');
  });

  it('only strips commas and does not strip currency symbols (characterizing quirk)', () => {
    // Current behavior: replaces /\,/g only, non-comma characters like currency symbol remain
    expect(cleanAmountString('₹52,000')).toBe('₹52000');
  });
});

describe('formatDate', () => {
  // Freezing time to 2026-09-18 12:00:00 local time
  const FROZEN_TODAY_ISO = '2026-09-18T12:00:00';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FROZEN_TODAY_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns relative label "Today, d MMM" when showRelative=true on today', () => {
    const today = new Date(FROZEN_TODAY_ISO);
    expect(formatDate(today, true)).toBe('Today, 18 Sep');
  });

  it('returns relative label "Yesterday, d MMM" when showRelative=true on yesterday', () => {
    const yesterday = new Date('2026-09-17T15:30:00');
    expect(formatDate(yesterday, true)).toBe('Yesterday, 17 Sep');
  });

  it('falls through to absolute "d MMM, yyyy" when showRelative=true on an older date', () => {
    const olderDate = new Date('2026-09-15T10:00:00');
    expect(formatDate(olderDate, true)).toBe('15 Sep, 2026');
  });

  it('returns absolute format "d MMM, yyyy" on today when showRelative=false (must not say Today)', () => {
    const today = new Date(FROZEN_TODAY_ISO);
    expect(formatDate(today, false)).toBe('18 Sep, 2026');
    expect(formatDate(today)).toBe('18 Sep, 2026');
  });

  it('gives identical output for ISO string vs Date object input for the same timestamp', () => {
    const isoString = '2026-09-18T12:00:00';
    const dateObj = new Date(isoString);
    expect(formatDate(isoString)).toBe(formatDate(dateObj));
    expect(formatDate(isoString, true)).toBe(formatDate(dateObj, true));
  });

  it('correctly parses date-only string (e.g. "2025-07-15") without timezone day-shift', () => {
    // In Arthik, dates are stored as 'yyyy-MM-dd'.
    // parseISO('2025-07-15') ensures it parses at midnight local time, preventing day shift.
    expect(formatDate('2025-07-15')).toBe('15 Jul, 2025');
  });
});
