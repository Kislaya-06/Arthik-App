import { withTimeout } from './networkUtils';

export const DEFAULT_RELEASE_URL = 'https://github.com/Kislaya-06/Arthik-App/releases/latest';

export interface VersionCheckResult {
  isRequired: boolean;
  minVersion: string;
  releaseUrl: string;
  /** v2.0+: direct .apk link for in-app download + install. Old clients ignore it. */
  apkUrl?: string;
  /** v2.0+: optional server-driven copy for the update screen. */
  title?: string;
  highlights?: string[];
}

/** Picks the direct APK link: explicit `apk_url`, else `release_url` if it already points at an .apk. */
export function resolveApkUrl(result: Pick<VersionCheckResult, 'apkUrl' | 'releaseUrl'>): string | null {
  const isApk = (u?: string) => !!u && /^https:\/\/.+\.apk(\?.*)?$/i.test(u.trim());
  if (isApk(result.apkUrl)) return (result.apkUrl as string).trim();
  if (isApk(result.releaseUrl)) return result.releaseUrl.trim();
  return null;
}

/**
 * Parses a semver string (e.g. "1.2.3", "v1.2.4", "1.2.4-beta") into [major, minor, patch] numbers.
 */
export function parseSemverParts(version: string): [number, number, number] {
  if (!version || typeof version !== 'string') {
    return [0, 0, 0];
  }
  // Strip leading 'v' or 'V' and any pre-release/build suffix like '-beta' or '+123'
  const cleaned = version.trim().replace(/^[vV]/, '').split(/[-+]/)[0];
  const parts = cleaned.split('.').map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });

  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Pure numeric comparison of two semver strings.
 * Returns:
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *   1 if v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
  const [maj1, min1, pat1] = parseSemverParts(v1);
  const [maj2, min2, pat2] = parseSemverParts(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;

  return 0;
}

/**
 * Returns true if currentVersion is strictly lower than minSupportedVersion.
 */
export function isVersionOutdated(currentVersion: string, minSupportedVersion: string): boolean {
  if (!currentVersion || !minSupportedVersion) return false;
  return compareSemver(currentVersion, minSupportedVersion) < 0;
}

/**
 * Evaluates whether a user should be blocked from using the app.
 * Returns true ONLY if:
 * 1. Force update is enabled on server
 * 2. Both versions are valid strings
 * 3. currentVersion < minSupportedVersion
 */
export function shouldBlockForUpdate(params: {
  currentVersion: string;
  minSupportedVersion: string;
  forceUpdateEnabled: boolean;
}): boolean {
  if (!params.forceUpdateEnabled) return false;
  if (!params.currentVersion || !params.minSupportedVersion) return false;
  return isVersionOutdated(params.currentVersion, params.minSupportedVersion);
}

/**
 * Pure evaluation of the server config payload against current version.
 */
export function evaluateVersionRequirement(
  config: any,
  currentVersion: string
): VersionCheckResult {
  if (!config || typeof config !== 'object') {
    return {
      isRequired: false,
      minVersion: '',
      releaseUrl: DEFAULT_RELEASE_URL,
    };
  }

  const minSupportedVersion: string = config.min_supported_version || '';
  const forceUpdateEnabled: boolean = Boolean(config.force_update_enabled);
  const releaseUrl: string = config.release_url || DEFAULT_RELEASE_URL;
  const apkUrl: string | undefined = typeof config.apk_url === 'string' && config.apk_url ? config.apk_url : undefined;
  const title: string | undefined = typeof config.update_title === 'string' && config.update_title ? config.update_title : undefined;
  const highlights: string[] | undefined = Array.isArray(config.update_highlights)
    ? config.update_highlights.filter((h: unknown) => typeof h === 'string' && h.trim()).slice(0, 5)
    : undefined;

  const isRequired = shouldBlockForUpdate({
    currentVersion,
    minSupportedVersion,
    forceUpdateEnabled,
  });

  return {
    isRequired,
    minVersion: minSupportedVersion,
    releaseUrl,
    apkUrl,
    title,
    highlights: highlights && highlights.length ? highlights : undefined,
  };
}

/**
 * Fetches version control configuration from Supabase 'app_config' table.
 * Fail-open design:
 * - If device is offline -> returns isRequired: false
 * - If request times out or network/supabase errors out -> returns isRequired: false
 * - If server says force_update_enabled is false -> returns isRequired: false
 */
export async function checkAppVersionStatus(
  supabaseClient: any,
  isOffline: boolean,
  currentVersion: string = '1.2.3',
  timeoutMs: number = 2500
): Promise<VersionCheckResult> {
  const defaultResult: VersionCheckResult = {
    isRequired: false,
    minVersion: '',
    releaseUrl: DEFAULT_RELEASE_URL,
  };

  try {
    // 1. Offline check: fail-open immediately if offline
    if (isOffline) {
      return defaultResult;
    }

    if (!supabaseClient || typeof supabaseClient.from !== 'function') {
      return defaultResult;
    }

    // 2. Fetch remote config with strict timeout
    const fetchPromise = supabaseClient
      .from('app_config')
      .select('value')
      .eq('key', 'version_control')
      .single();

    const { data, error } = (await withTimeout(
      fetchPromise,
      timeoutMs,
      'Version check timed out'
    )) as any;

    if (error || !data || !data.value) {
      return defaultResult;
    }

    return evaluateVersionRequirement(data.value, currentVersion);
  } catch {
    // Fail-open: Never block user on network/parse failure
    return defaultResult;
  }
}
