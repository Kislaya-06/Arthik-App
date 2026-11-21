import { startOfWeek } from 'date-fns/startOfWeek';

/**
 * Weekly Automatic Logging summary ("18 payments logged for you · 2 need your review").
 * Pure (unit-tested in tests/autoLogHelpers.test.ts); sent by service.processQueue once per new week.
 */

/** Monday 00:00 local time of the week `ms` falls in (DAT-004: weeks start on Monday). */
export const weekStartOf = (ms: number): number => startOfWeek(new Date(ms), { weekStartsOn: 1 }).getTime();

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Title and text of the summary, or null for a week with nothing to tell. */
export const weeklyDigestCopy = (s: { logged: number; pending: number }): { title: string; body: string } | null => {
  if (s.logged <= 0 && s.pending <= 0) return null;
  const review = s.pending === 1 ? '1 needs your review' : `${s.pending} need your review`;
  const body =
    s.logged <= 0
      ? `${plural(s.pending, 'payment needs', 'payments need')} your review.`
      : s.pending > 0
      ? `${plural(s.logged, 'payment', 'payments')} logged for you · ${review}.`
      : `${plural(s.logged, 'payment', 'payments')} logged for you. Nothing to review.`;
  return { title: 'Your week with Automatic Logging', body };
};
