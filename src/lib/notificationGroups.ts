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
  if (differenceInCalendarDays(d, startOfWeek(now, { weekStartsOn: 1 })) >= 0) return { key: 'week', label: 'THIS WEEK' };
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
