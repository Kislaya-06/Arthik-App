import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * PUR-001 on a cold start: a "Pure -> Budget Mode" switch that matured while the app was closed is applied by the
 * start-up hydration. The deficit auto-balance (income that covers Pure Mode overspending) must then run ONCE, but only
 * when the expense list comes from the server (a stale saved list could invent a deficit and add real money that was
 * never missing). So hydration leaves a durable "check pending" marker here and the next rollover that sees
 * server-fresh expenses consumes it.
 *
 * The marker is per user and stored on the phone, so it survives an app restart. It is a pending action, not a copy of
 * server data, so sign-out keeps it like the offline queues.
 */
const getDeficitCheckKey = (userId: string) => `@arthik_pending_deficit_check_${userId}`;

const pendingByUser = new Map<string, string>();

/** Remembers that the switch effective on `activationDate` still needs its deficit check. */
export const markDeficitCheckPending = async (userId: string, activationDate: string): Promise<void> => {
  pendingByUser.set(userId, activationDate);
  try {
    await AsyncStorage.setItem(getDeficitCheckKey(userId), activationDate);
  } catch {}
};

/** Reads a marker left by an earlier app run (called once per hydration). */
export const restoreDeficitCheckPending = async (userId: string): Promise<void> => {
  if (pendingByUser.has(userId)) return;
  try {
    const stored = await AsyncStorage.getItem(getDeficitCheckKey(userId));
    if (stored) pendingByUser.set(userId, stored);
  } catch {}
};

export const hasDeficitCheckPending = (userId: string): boolean => pendingByUser.has(userId);

export const clearDeficitCheckPending = async (userId: string): Promise<void> => {
  pendingByUser.delete(userId);
  try {
    await AsyncStorage.removeItem(getDeficitCheckKey(userId));
  } catch {}
};
