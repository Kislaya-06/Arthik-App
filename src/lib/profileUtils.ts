/**
 * Profile Utilities & Name Guardrails
 *
 * Enforces business limits on user names:
 * - Maximum combined length across first and last name is 15 characters
 *   (benchmark: "Kislaya Agarwal" = 15 characters).
 * - Prevents UI overflow and font degradation on HomeScreen header greeting.
 */

export const MAX_PROFILE_NAME_LENGTH = 15;

/**
 * Calculates the combined character length of first and last name as displayed.
 * E.g. "Kislaya" + "Agarwal" -> "Kislaya Agarwal" = 15 chars.
 */
export function calculateNameLength(firstName?: string | null, lastName?: string | null): number {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l) {
    return f.length + 1 + l.length;
  }
  return (f || l).length;
}

/**
 * Returns the formatted display name for the user across the app.
 * Priority:
 * 1. Supabase profiles table (first_name + optional last_name)
 * 2. User metadata (full_name / name / first_name)
 * 3. Email username
 * 4. 'User' fallback
 */
export function getDisplayName(
  profile?: { first_name?: string | null; last_name?: string | null } | null,
  userMetadata?: Record<string, any> | null,
  email?: string | null
): string {
  const f = profile?.first_name?.trim();
  const l = profile?.last_name?.trim();
  if (f && f !== 'User') {
    return l ? `${f} ${l}` : f;
  }
  const metaName =
    userMetadata?.full_name?.trim() ||
    userMetadata?.name?.trim() ||
    userMetadata?.first_name?.trim();
  if (metaName && metaName !== 'User') {
    return metaName;
  }
  const emailName = email?.split('@')[0]?.trim();
  if (emailName) {
    return emailName;
  }
  return 'User';
}

/**
 * Clamps a text input for first or last name so the combined name cannot exceed MAX_PROFILE_NAME_LENGTH.
 * Returns the clamped text and whether the limit was reached/exceeded.
 */
export function clampNameInput(
  newText: string,
  otherFieldText: string,
  _field?: 'first' | 'last'
): { text: string; limitReached: boolean } {
  const otherTrimmed = (otherFieldText || '').trim();
  // Space is required between first and last name if other field is non-empty
  const spacePenalty = otherTrimmed.length > 0 ? 1 : 0;
  const maxAllowed = Math.max(0, MAX_PROFILE_NAME_LENGTH - (otherTrimmed.length + spacePenalty));

  if (newText.length > maxAllowed) {
    return {
      text: newText.slice(0, maxAllowed),
      limitReached: true,
    };
  }

  return {
    text: newText,
    limitReached: false,
  };
}

/**
 * Validates first and last name against business guardrails.
 */
export function validateProfileName(
  firstName: string,
  lastName: string
): { isValid: boolean; error: string | null } {
  const f = (firstName || '').trim();
  if (!f) {
    return { isValid: false, error: 'First name is required.' };
  }
  const totalLength = calculateNameLength(firstName, lastName);
  if (totalLength > MAX_PROFILE_NAME_LENGTH) {
    return {
      isValid: false,
      error: `Maximum ${MAX_PROFILE_NAME_LENGTH} characters allowed. Cannot write more.`,
    };
  }
  return { isValid: true, error: null };
}
