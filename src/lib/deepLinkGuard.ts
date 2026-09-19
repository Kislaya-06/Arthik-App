/**
 * Pure decision and verification helper for deep link authentication flows.
 * Protects against session fixation and Login CSRF attacks where an external
 * or unverified deep link could silently overwrite the active session.
 */

function base64UrlDecode(str: string): string {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string!');
  }

  if (typeof atob === 'function') {
    return atob(output);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(output, 'base64').toString('binary');
  }
  return '';
}

export interface DecodedJwtPayload {
  sub?: string;
  email?: string;
  [key: string]: any;
}

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

/**
 * Parses JWT payload (middle component) without verifying signature.
 * Used for inspecting principal identity (user ID / email) from incoming tokens before applying them.
 */
export function parseJwtPayload(token?: string | null): DecodedJwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const decoded = base64UrlDecode(parts[1]);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export type DeepLinkAction =
  | { type: 'APPLY_IMMEDIATELY' }
  | { type: 'PROMPT_SWITCH'; incomingEmail?: string; incomingUserId?: string }
  | { type: 'EXCHANGE_AND_VERIFY' }
  | { type: 'IGNORE' };

export interface EvaluateDeepLinkParams {
  currentUser: { id: string; email?: string } | null;
  isRecovery: boolean;
  accessToken?: string | null;
  code?: string | null;
}

/**
 * Pure decision function: determines whether an incoming deep link authentication payload
 * should be applied immediately, prompted to the user for confirmation (if switching accounts),
 * exchanged first via PKCE to inspect identity, or ignored.
 */
export function evaluateDeepLinkSessionAction(params: EvaluateDeepLinkParams): DeepLinkAction {
  const { currentUser, accessToken, code } = params;

  // 1. If there is no token or code to authenticate with, ignore
  if (!accessToken && !code) {
    return { type: 'IGNORE' };
  }

  // 2. If no user is logged in, any valid incoming link can be applied immediately
  if (!currentUser) {
    return { type: 'APPLY_IMMEDIATELY' };
  }

  // 3. User is already logged in:
  // If we have an access_token, inspect who it belongs to before setting session
  if (accessToken) {
    const payload = parseJwtPayload(accessToken);
    const incomingUserId = payload?.sub;
    const incomingEmail = payload?.email;

    const isSameUser = isSameUserIdentity(currentUser, { id: incomingUserId, email: incomingEmail });

    if (isSameUser) {
      // Same user re-authenticating or resetting own password -> seamless bypass
      return { type: 'APPLY_IMMEDIATELY' };
    }

    // Different user or unparseable payload -> prompt before switching accounts
    return {
      type: 'PROMPT_SWITCH',
      incomingEmail: incomingEmail,
      incomingUserId: incomingUserId,
    };
  }

  // 4. If only a PKCE code exists and user is logged in:
  // We must exchange the code to verify identity. If the exchanged identity matches currentUser,
  // it is seamlessly applied. If it belongs to a different account, user is prompted.
  return {
    type: 'EXCHANGE_AND_VERIFY',
  };
}
