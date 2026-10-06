import { supabase } from '../../config/supabase';

/**
 * The ONLY Automatic Logging data that leaves the device:
 * whether it is enabled, a few timestamps, and tracked accounts as bank + last 4 digits.
 * No SMS text, no notification text, no amounts. Used to detect re-installs (spec §31–34).
 */

export interface RemoteAccount { bank: string; bankCode: string; last4: string; kind: string }

export interface RemoteProfile {
  enabled: boolean;
  setup_at: string | null;
  last_active_at: string | null;
  signed_out_at: string | null;
  tracked_accounts: RemoteAccount[];
}

export const fetchRemoteProfile = async (userId: string): Promise<{ ok: boolean; profile: RemoteProfile | null }> => {
  try {
    const { data, error } = await supabase
      .from('autolog_profiles')
      .select('enabled, setup_at, last_active_at, signed_out_at, tracked_accounts')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { ok: false, profile: null };
    return { ok: true, profile: (data as RemoteProfile | null) ?? null };
  } catch {
    return { ok: false, profile: null };
  }
};

export const upsertRemoteProfile = async (userId: string, patch: Partial<RemoteProfile>) => {
  try {
    await supabase
      .from('autolog_profiles')
      .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } catch {
    // Best effort: the feature keeps working locally without it.
  }
};
