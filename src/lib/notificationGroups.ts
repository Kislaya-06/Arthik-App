import { WEEK_OPTIONS } from '../money/dateKeys';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfWeek } from 'date-fns/startOfWeek';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';

/**
 * Notifications screen sections: TODAY, YESTERDAY, THIS WEEK (Monday start), THIS MONTH, then month names
 * (year only when it is not this year). Newest-first order is kept; a bad date goes to EARLIER.
 */
export interface NotificationGroup<T> {
  key: string;
  label: string;
  items: T[];
}

function labelFor(createdAt: string, now: Date): { key: string; label: string } {
  const d = parseISO(createdAt);
  if (Number.isNaN(d.getTime())) return { key: 'earlier', label: 'EARLIER' };
  const days = differenceInCalendarDays(now, d);
  if (days <= 0) return { key: 'today', label: 'TODAY' };
  if (days === 1) return { key: 'yesterday', label: 'YESTERDAY' };
  if (differenceInCalendarDays(d, startOfWeek(now, WEEK_OPTIONS)) >= 0) return { key: 'week', label: 'THIS WEEK' };
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return { key: 'month', label: 'THIS MONTH' };
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${format(d, 'yyyy')}`;
  return { key: format(d, 'yyyy-MM'), label: `${format(d, 'MMMM')}${year}`.toUpperCase() };
}

export function groupNotificationsByDate<T extends { createdAt: string }>(items: T[], now: Date): NotificationGroup<T>[] {
  const groups: NotificationGroup<T>[] = [];
  const byKey = new Map<string, NotificationGroup<T>>();
  for (const item of items) {
    const { key, label } = labelFor(item.createdAt, now);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Routine "₹X added to your Gullak" messages. Only these fold; alerts and recaps always stand alone. */
const STACKABLE_TYPES = new Set(['savings_rollover']);
/** Fewer than this in a row are shown one by one. */
const MIN_STACK = 3;

export type NotificationEntry<T> =
  | { kind: 'single'; item: T }
  | { kind: 'stack'; key: string; items: T[] };

/**
 * Inside one date section, 3 or more Gullak savings in a row become ONE row ("8 savings added to your Gullak"),
 * which opens to show each of them. Nothing is hidden or removed: every notification stays in the bell. Order kept.
 */
export function stackRepeatedNotifications<T extends { id: string; type: string }>(items: T[]): NotificationEntry<T>[] {
  const out: NotificationEntry<T>[] = [];
  let run: T[] = [];
  const flush = () => {
    if (run.length >= MIN_STACK) out.push({ kind: 'stack', key: `stack-${run[0].id}`, items: run });
    else for (const item of run) out.push({ kind: 'single', item });
    run = [];
  };
  for (const item of items) {
    if (STACKABLE_TYPES.has(item.type)) {
      run.push(item);
    } else {
      flush();
      out.push({ kind: 'single', item });
    }
  }
  flush();
  return out;
}

/**
 * Right-hand time of a notification row. The date heading above it already names the day, so the row never repeats
 * it ("1d ago" under YESTERDAY): under an hour → "Just now" / "12m ago"; today or yesterday → the clock time;
 * earlier this week → the weekday; older → "27 Oct". A bad date shows nothing.
 */
export function notificationTimeLabel(createdAt: string, now: Date): string {
  const d = parseISO(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const days = differenceInCalendarDays(now, d);
  if (days <= 1) return format(d, 'h:mm a');
  if (differenceInCalendarDays(d, startOfWeek(now, WEEK_OPTIONS)) >= 0) return format(d, 'EEE');
  return format(d, 'd MMM');
}
