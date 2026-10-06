import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Who can see Automatic Logging (Beta), controlled from the server without a new APK.
 *
 * app_config row  key = 'feature_flags'  value = { "autolog": { "audience": "existing", "existing_before": "<ISO>" } }
 *   audience 'existing' → only people who used Arthik before v2.0 (default — beta is paused for new users)
 *   audience 'all'      → everyone
 *   audience 'none'     → hidden for anyone who has not set it up yet (kill switch)
 * People who already set it up always keep access (never yank a working feature).
 *
 * "Existing user" = this phone upgraded from an older Arthik (install time ≠ last update time)
 *                   OR the account was created before `existing_before` (covers reinstalls / new phones).
 */

export type RolloutAudience = 'none' | 'existing' | 'all';
export interface AutoLogRollout {
  audience: RolloutAudience;
  existingBefore: string | null;
}
export type InstallCohort = 'existing' | 'new';

export const DEFAULT_ROLLOUT: AutoLogRollout = { audience: 'existing', existingBefore: null };

const FLAG_CACHE_KEY = 'arthik_flag_autolog_v1';
const COHORT_KEY = 'arthik_install_cohort_v1';
const introKey = (userId: string) => `arthik_autolog_intro_seen_${userId}`;
const UPGRADE_GAP_MS = 2 * 60_000;

// ─── Pure rules (unit-tested) ───────────────────────────────────────────────

export const parseRollout = (value: unknown): AutoLogRollout => {
  const v = (value as any)?.autolog ?? value;
  const audience: RolloutAudience = v?.audience === 'all' || v?.audience === 'none' || v?.audience === 'existing' ? v.audience : DEFAULT_ROLLOUT.audience;
  const existingBefore = typeof v?.existing_before === 'string' && !Number.isNaN(Date.parse(v.existing_before)) ? v.existing_before : null;
  return { audience, existingBefore };
};

/** Same install, different update time ⇒ the app was updated from an older version on this phone. */
export const cohortFromInstallTimes = (installedAt: number | null, lastUpdatedAt: number | null): InstallCohort =>
  installedAt && lastUpdatedAt && lastUpdatedAt - installedAt > UPGRADE_GAP_MS ? 'existing' : 'new';

export const isExistingUser = (p: { cohort: InstallCohort; accountCreatedAt: string | null | undefined; rollout: AutoLogRollout }): boolean => {
  if (p.cohort === 'existing') return true;
  if (p.rollout.existingBefore && p.accountCreatedAt) {
    const created = Date.parse(p.accountCreatedAt);
    return !Number.isNaN(created) && created < Date.parse(p.rollout.existingBefore);
  }
  return false;
};

export const isAutoLogAvailable = (p: {
  rollout: AutoLogRollout;
  existingUser: boolean;
  alreadyUsing: boolean;
}): boolean => {
  if (p.alreadyUsing) return true;
  if (p.rollout.audience === 'all') return true;
  if (p.rollout.audience === 'existing') return p.existingUser;
  return false;
};

/** The one-time "New: Automatic Logging (Beta)" screen. Never for new users. */
export const shouldShowIntro = (p: { available: boolean; existingUser: boolean; alreadyUsing: boolean; introSeen: boolean }): boolean =>
  p.available && p.existingUser && !p.alreadyUsing && !p.introSeen;

// ─── I/O ────────────────────────────────────────────────────────────────────

export const fetchRollout = async (supabase: any): Promise<AutoLogRollout> => {
  try {
    const { data, error } = await Promise.race([
      supabase.from('app_config').select('value').eq('key', 'feature_flags').maybeSingle(),
      new Promise<{ data: null; error: Error }>((r) => setTimeout(() => r({ data: null, error: new Error('timeout') }), 3000)),
    ]);
    if (!error && data?.value) {
      const parsed = parseRollout(data.value);
      await AsyncStorage.setItem(FLAG_CACHE_KEY, JSON.stringify(parsed));
      return parsed;
    }
  } catch {}
  try {
    const cached = await AsyncStorage.getItem(FLAG_CACHE_KEY);
    if (cached) {
      const c = JSON.parse(cached) as AutoLogRollout;
      return parseRollout({ audience: c.audience, existing_before: c.existingBefore });
    }
  } catch {}
  return DEFAULT_ROLLOUT;
};

/** Decided once, on the first v2 launch, then remembered (later updates must not flip it). */
export const getInstallCohort = async (): Promise<InstallCohort> => {
  try {
    const stored = await AsyncStorage.getItem(COHORT_KEY);
    if (stored === 'existing' || stored === 'new') return stored;
    const Application = require('expo-application') as typeof import('expo-application');
    const [installed, updated] = await Promise.all([
      Application.getInstallationTimeAsync().catch(() => null),
      Application.getLastUpdateTimeAsync().catch(() => null),
    ]);
    const cohort = cohortFromInstallTimes(installed ? installed.getTime() : null, updated ? updated.getTime() : null);
    await AsyncStorage.setItem(COHORT_KEY, cohort);
    return cohort;
  } catch {
    return 'new';
  }
};

export const isIntroSeen = async (userId: string) => (await AsyncStorage.getItem(introKey(userId))) === '1';
export const markIntroSeen = async (userId: string) => {
  await AsyncStorage.setItem(introKey(userId), '1');
};
