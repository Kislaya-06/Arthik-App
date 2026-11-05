import { isNetworkFailure } from './networkUtils';

const OFFLINE_MESSAGE = 'No internet connection. Please check it and try again.';

/** Words that only appear in database / server / code errors, never in a sentence written for a person. */
const TECHNICAL = /(violates|constraint|row-level|rls|policy|jwt|pgrst|postgres|duplicate key|relation "|column "|syntax|schema|fetch|undefined|null|typeerror|referenceerror|json|sqlite|stack|exception|\bhttp\b|\b[45]\d\d\b|[{}<>])/i;

/**
 * Turns any thrown value into a short, plain message for the user.
 * - No internet / timeout / server down -> one clear offline line.
 * - Technical text (database, server, code) -> the given fallback.
 * - A short message already written for people (thrown by Arthik itself) -> kept as is.
 */
export function toFriendlyMessage(error: unknown, fallback: string): string {
  if (isNetworkFailure(error)) return OFFLINE_MESSAGE;
  const raw =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';
  const msg = raw.trim();
  if (!msg || msg.length > 120 || TECHNICAL.test(msg)) return fallback;
  return msg;
}
