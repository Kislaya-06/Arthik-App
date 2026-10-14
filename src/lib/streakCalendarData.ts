export interface DayLogData {
  date: string;
  status: 'saved' | 'missed' | 'unknown';
  amount: number;
}

export interface RemoteSavingsRow {
  date: string;
  amount_saved?: number | string | null;
  status?: string | null;
}

/**
 * Converts raw Supabase `daily_savings_log` rows into a day-keyed dictionary of `DayLogData`.
 * 
 * Rules:
 * - status === 'unknown' -> { date, status: 'unknown', amount: 0 }
 * - status === 'saved' && Number(amount_saved) > 0 -> { date, status: 'saved', amount: Number(amount_saved) }
 * - otherwise -> { date, status: 'missed', amount: Number(amount_saved) || 0 }
 */
export function mapRemoteRowsToDayLog(
  rows: RemoteSavingsRow[] | null | undefined
): Record<string, DayLogData> {
  const remoteMap: Record<string, DayLogData> = {};
  if (!rows || rows.length === 0) {
    return remoteMap;
  }

  rows.forEach((row) => {
    if (row.status === 'unknown') {
      remoteMap[row.date] = {
        date: row.date,
        status: 'unknown',
        amount: 0,
      };
    } else {
      const isSaved = row.status === 'saved' && Number(row.amount_saved) > 0;
      remoteMap[row.date] = {
        date: row.date,
        status: isSaved ? 'saved' : 'missed',
        amount: Number(row.amount_saved) || 0,
      };
    }
  });

  return remoteMap;
}
