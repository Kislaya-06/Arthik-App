/**
 * Identity check for deep-link account switching. Only server-issued sessions (from a PKCE code
 * exchange) are compared; raw tokens in a link are never decoded or trusted.
 */

/**
 * Checks whether two user identities match by ID or case-insensitive email.
 */
export function isSameUserIdentity(
  userA: { id?: string; email?: string } | null | undefined,
  userB: { id?: string; email?: string } | null | undefined
): boolean {
  if (!userA || !userB) return false;
  const sameId = Boolean(userA.id && userB.id && userA.id === userB.id);
  const sameEmail = Boolean(
    userA.email &&
      userB.email &&
      typeof userA.email === 'string' &&
      typeof userB.email === 'string' &&
      userA.email.toLowerCase() === userB.email.toLowerCase()
  );
  return sameId || sameEmail;
}
