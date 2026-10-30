/**
 * OPT-07: hold on money writes while Home is shown from cache (canonical rule `ROL-005`).
 *
 * When Splash shows Home straight from the cached stores, the server copy of the budget data is still being fetched
 * in the background. Until that finishes, nothing may finalize a day, activate a scheduled plan, auto-renew, or write
 * to Supabase (`daily_savings_log`, `budget_periods`, `gullak_deposits`) from the cached copy: it could be older than
 * what another device already saved.
 *
 * This is plain memory (never persisted): `hydratedForUserId` cannot do this job because it is saved to disk with the
 * rest of the store, so after a restart it already says "hydrated" before any fetch has happened.
 *
 * Not held (the default) = every guard below is a no-op, i.e. exactly the behaviour before OPT-07.
 */
let heldUserId: string | null = null;

export const holdMoneyWrites = (userId: string): void => {
  heldUserId = userId;
};

export const isMoneyWritesHeld = (userId: string | null | undefined): boolean => !!userId && heldUserId === userId;

/** Returns true when a hold was really released (so the caller runs the work that was held back, once). */
export const releaseMoneyWrites = (userId: string): boolean => {
  if (heldUserId !== userId) return false;
  heldUserId = null;
  return true;
};

/** Sign-out / account switch. */
export const resetMoneyWritesHold = (): void => {
  heldUserId = null;
};
