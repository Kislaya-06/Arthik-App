import * as db from './db';
import { setTransactionCategory } from './ledger';
import { CATEGORY_ACTION_PREFIX, notificationIdFor, notifyCategoryNotSaved } from './notify';

/**
 * Handles a category button tapped inside an Automatic Logging notification.
 * Runs from the background notification task (app closed / in background) and from the app's own
 * notification listener (app open). The same function serves both, and it is safe to run twice.
 */

export interface CategoryActionTap {
  categoryId: string;
  eventId: string;
  expenseId: string | null;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** The notification data can arrive as an object or (on some paths) as a JSON string. */
const readData = (raw: unknown): Record<string, unknown> | null => {
  const obj = asRecord(raw);
  if (obj) return obj;
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Reads a notification response (either the object the app listener gets, or the payload the background task gets)
 * and returns the category tap, or null when it is anything else (plain tap, other notification, other button).
 */
export const parseCategoryTap = (payload: unknown): CategoryActionTap | null => {
  const p = asRecord(payload);
  if (!p) return null;
  const actionId = typeof p.actionIdentifier === 'string' ? p.actionIdentifier : '';
  if (!actionId.startsWith(CATEGORY_ACTION_PREFIX)) return null;
  const categoryId = actionId.slice(CATEGORY_ACTION_PREFIX.length);
  if (!categoryId) return null;

  const request = asRecord(asRecord(p.notification)?.request);
  const content = asRecord(request?.content);
  const data = readData(content?.data) ?? readData(content?.dataString) ?? readData(p.data);
  if (!data || data.type !== 'autolog') return null;
  const eventId = typeof data.eventId === 'string' ? data.eventId : '';
  if (!eventId) return null;
  return { categoryId, eventId, expenseId: typeof data.expenseId === 'string' ? data.expenseId : null };
};

const dismiss = async (eventId: string) => {
  try {
    const N = await import('expo-notifications');
    await N.dismissNotificationAsync(notificationIdFor(eventId));
  } catch {
    // best effort
  }
};

/**
 * Gives the transaction the chosen category, then removes the notification.
 * Only the category changes (same write the review screen uses). Amount, type, date and note are never touched.
 * Returns true when the category was saved (or was already set).
 */
export const applyCategoryTap = async (tap: CategoryActionTap): Promise<boolean> => {
  try {
    const event = await db.getEvent(tap.eventId);
    const expenseId = event?.expenseId ?? tap.expenseId;
    if (!expenseId) {
      await notifyCategoryNotSaved(tap.eventId, tap.expenseId ?? '');
      return false;
    }
    // Already categorised (second tap, or chosen in the app meanwhile): nothing to change.
    if (event && !event.needsCategory) {
      await dismiss(tap.eventId);
      return true;
    }
    const saved = await setTransactionCategory(expenseId, tap.categoryId);
    if (!saved) {
      await notifyCategoryNotSaved(tap.eventId, expenseId);
      return false;
    }
    if (event) await db.updateEvent(event.id, { needsCategory: false });
    await dismiss(tap.eventId);
    try {
      const { supabase } = await import('../../config/supabase');
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (userId) {
        const { useAutoLogStore } = await import('./store');
        await useAutoLogStore.getState().refresh(userId);
      }
    } catch {
      // The Review list refreshes itself the next time it is opened.
    }
    return true;
  } catch {
    return false;
  }
};

export const handleCategoryResponse = async (payload: unknown): Promise<boolean> => {
  const tap = parseCategoryTap(payload);
  if (!tap) return false;
  await applyCategoryTap(tap);
  return true;
};
