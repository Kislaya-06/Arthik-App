/**
 * BUD-008 (canonical status unification): the only budget status strings are
 * 'saved' | 'missed' | 'even' | 'unknown' (plus 'active' for today while it is still in progress, never saved to DB).
 * Older app versions kept 'exceeded' in the on-device cache. This turns any such leftover into 'missed'
 * so streaks, calendars and insights read old cached days correctly.
 */
export function normalizeLegacyRecordStatuses<T extends { status?: string }>(
  records: Record<string, T> | undefined | null
): Record<string, T> {
  if (!records || typeof records !== 'object') return {};
  const out: Record<string, T> = {};
  for (const [date, rec] of Object.entries(records)) {
    out[date] = rec && (rec.status as string) === 'exceeded' ? ({ ...rec, status: 'missed' } as T) : rec;
  }
  return out;
}
