/**
 * Saving the allowance pause list (INS-004) to `profiles.allowance_pauses`, offline first.
 *
 * The list is queued on the phone before it is sent (OPT-60) and the queue is removed only when the server took
 * exactly that list. It is read and written in its OWN requests, never inside the main profile query / update: until
 * the owner runs the migration the column does not exist, and that must only fail this sync, never the profile.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { runExclusive } from '../../lib/queueLock';
import { AllowancePause, parseAllowancePauses } from '../../lib/allowancePauses';

export const getPendingAllowancePausesKey = (userId: string) => `@arthik_pending_allowance_pauses_${userId}`;

/** Queues the whole list (last one wins: it is always the full history). */
export async function queueAllowancePauses(userId: string, pauses: AllowancePause[]): Promise<void> {
  const key = getPendingAllowancePausesKey(userId);
  await runExclusive(key, async () => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(pauses));
    } catch (e) {
      if (__DEV__) console.log('Error queueing allowance pauses:', e);
    }
  });
}

/** Sends the queued list. The queue is cleared only if nothing newer was queued while it was being sent. */
export async function syncAllowancePauses(userId: string): Promise<void> {
  const key = getPendingAllowancePausesKey(userId);
  let sent: string | null = null;
  try {
    sent = await AsyncStorage.getItem(key);
    if (!sent) return;
    const { error } = await supabase
      .from('profiles')
      .update({ allowance_pauses: JSON.parse(sent) })
      .eq('id', userId);
    if (error) return;
  } catch {
    return; // offline, or the column is not there yet: try again on the next sync
  }
  await runExclusive(key, async () => {
    try {
      if ((await AsyncStorage.getItem(key)) === sent) await AsyncStorage.removeItem(key);
    } catch {
      // keep the queue; the next sync sends it again (same list, safe)
    }
  });
}

/** The list to use after sign-in: the unsent queue first, else the server's. null = nothing known (keep local). */
export async function loadAllowancePauses(userId: string): Promise<AllowancePause[] | null> {
  try {
    const queued = await AsyncStorage.getItem(getPendingAllowancePausesKey(userId));
    if (queued) return parseAllowancePauses(JSON.parse(queued));
  } catch {
    // fall through to the server
  }
  try {
    const { data, error } = await supabase.from('profiles').select('allowance_pauses').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return parseAllowancePauses((data as { allowance_pauses?: unknown }).allowance_pauses);
  } catch {
    return null;
  }
}
