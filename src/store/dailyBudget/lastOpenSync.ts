/**
 * The last day the app was opened, kept with the account (`profiles.last_open_day`) so the "days you were away"
 * question (ROL-004) survives a reinstall and is not asked when another phone was in use.
 *
 * Its own requests, never part of the main profile query: until the owner runs the migration the column does not
 * exist, and that must only fail this, never the profile. No queue: the next day's open sends a newer value.
 */
import { supabase } from '../../config/supabase';
import { withTimeout } from '../../lib/networkUtils';

export async function saveLastOpenDay(userId: string, day: string): Promise<void> {
  try {
    await supabase.from('profiles').update({ last_open_day: day }).eq('id', userId);
  } catch {
    // offline or no column yet
  }
}

/** The account's last opened day, or null when unknown (offline, no column, never saved). */
export async function loadLastOpenDay(userId: string): Promise<string | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.from('profiles').select('last_open_day').eq('id', userId).maybeSingle()),
      3500,
      { data: null, error: null } as never
    );
    const day = (data as { last_open_day?: unknown } | null)?.last_open_day;
    return !error && typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  } catch {
    return null;
  }
}

/**
 * Not persisted on purpose. A rollover can run on a cold start BEFORE hydration (the saved `hydratedForUserId`
 * lets it), when this phone only knows its own, possibly old, last opened day. Looking for a new gap then would
 * invent one for days another phone was in use, so gaps are looked for only after this app run has hydrated.
 */
let knownFor: string | null = null;
export const markOpenDayKnown = (userId: string | null): void => {
  knownFor = userId;
};
export const isOpenDayKnown = (userId: string | undefined): boolean => !!userId && knownFor === userId;

/** The later of the two known days (either may be unknown). */
export const latestDay = (a: string | null, b: string | null): string | null => (!a || (b && b > a) ? b : a);
