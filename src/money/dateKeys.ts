/**
 * Date keys: the ONE way the money code names a calendar day (canonical rules DAT-001 / DAT-004).
 *
 * A "date key" is a plain 'yyyy-MM-dd' string in the phone's LOCAL timezone. It is used for grouping, comparing
 * and looping over days. String comparison works on it ('2026-10-05' < '2026-10-12'), so no Date objects are
 * needed once a day has been turned into a key.
 *
 * Before this file existed, "today as text" had three copies (getTodayDateStr, todayString, toDateStr) and
 * `expense_date.split('T')[0]` was written 45 times. New code uses the functions below.
 * The old names still exist and now point here, so nothing that already works is affected.
 */
import { format } from 'date-fns';

/** 'yyyy-MM-dd'. Example: '2026-10-20'. */
export type DateKey = string;

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Turns a Date, a timestamp, or any date text ('2026-10-05' or '2026-10-05T10:30:00Z') into a date key.
 * Text is cut at the 'T' (exactly what the old `split('T')[0]` did); a Date or number uses the LOCAL calendar day.
 * Returns '' when there is nothing usable, so callers can write `if (!dateKey) continue`.
 */
export function toDateKey(value: Date | number | string | null | undefined): DateKey {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.split('T')[0]?.trim() || '';
  const asDate = typeof value === 'number' ? new Date(value) : value;
  return Number.isNaN(asDate.getTime()) ? '' : format(asDate, 'yyyy-MM-dd');
}

/** Today's date key in the phone's local timezone. */
export function todayDateKey(now: Date = new Date()): DateKey {
  return format(now, 'yyyy-MM-dd');
}

interface DateParts {
  year: number;
  /** 1 to 12 */
  month: number;
  day: number;
}

function splitDateKey(dateKey: DateKey): DateParts {
  const [yearText, monthText, dayText] = dateKey.split('-');
  return { year: Number(yearText), month: Number(monthText), day: Number(dayText) };
}

/** UTC-based day number, so daylight-saving shifts can never add or remove a day. */
function dayNumberOf(dateKey: DateKey): number {
  const { year, month, day } = splitDateKey(dateKey);
  return Math.round(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
}

/** How many days the calendar month of this date key has: 28, 29, 30 or 31. */
export function daysInMonthOfDateKey(dateKey: DateKey): number {
  const { year, month } = splitDateKey(dateKey);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The date key one day after / before (use a negative number to go back). */
export function addDaysToDateKey(dateKey: DateKey, numberOfDays: number): DateKey {
  const { year, month, day } = splitDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + numberOfDays));
  const shiftedMonth = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const shiftedDay = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${shiftedMonth}-${shiftedDay}`;
}

/** Number of calendar days from startDateKey to endDateKey, BOTH included. Returns 0 when end is before start. */
export function countDaysInclusive(startDateKey: DateKey, endDateKey: DateKey): number {
  const difference = dayNumberOf(endDateKey) - dayNumberOf(startDateKey) + 1;
  return difference > 0 ? difference : 0;
}

/** First and last date key of the calendar month that contains this date key. */
export function monthBoundsOfDateKey(dateKey: DateKey): { firstDateKey: DateKey; lastDateKey: DateKey } {
  const { year, month } = splitDateKey(dateKey);
  const monthText = String(month).padStart(2, '0');
  const lastDayText = String(daysInMonthOfDateKey(dateKey)).padStart(2, '0');
  return { firstDateKey: `${year}-${monthText}-01`, lastDateKey: `${year}-${monthText}-${lastDayText}` };
}

/** True when startDateKey <= dateKey <= endDateKey. */
export function isDateKeyWithin(dateKey: DateKey, startDateKey: DateKey, endDateKey: DateKey): boolean {
  return dateKey >= startDateKey && dateKey <= endDateKey;
}
