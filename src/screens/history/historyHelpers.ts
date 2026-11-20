import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';
import { isYesterday } from 'date-fns/isYesterday';
import { parseISO } from 'date-fns/parseISO';
import type { HistoryRow } from '../../lib/historyRows';

export const historyKeyExtractor = (row: HistoryRow): string => row.key;

/** Header rows and the two item kinds are recycled separately (they look different). */
export const historyItemType = (row: HistoryRow): string => row.type;

export const dateHeaderCache = new Map<string, { day: string; title: string }>();

export function getDateHeaderTitle(dateStr: string, todayKey: string): string {
  const cached = dateHeaderCache.get(dateStr);
  if (cached && cached.day === todayKey) return cached.title;
  const dateObj = parseISO(dateStr);
  const dayName = format(dateObj, 'EEEE');
  const dateFormatted = format(dateObj, 'd MMM');
  let title = `${dayName}, ${dateFormatted}`.toUpperCase();
  if (isToday(dateObj)) {
    title = `TODAY · ${dayName.toUpperCase()}, ${dateFormatted.toUpperCase()}`;
  } else if (isYesterday(dateObj)) {
    title = `YESTERDAY · ${dayName.toUpperCase()}, ${dateFormatted.toUpperCase()}`;
  }
  dateHeaderCache.set(dateStr, { day: todayKey, title });
  return title;
}
