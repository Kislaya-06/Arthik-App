import * as db from './db';
import { deleteTransaction, setTransactionCategory } from './ledger';
import {
  CATEGORY_ACTION_PREFIX,
  UNDO_ACTION_ID,
  notificationIdFor,
  notifyCategoryNotSaved,
  notifyUndoFailed,
  notifyUnlockToChange,
} from './notify';

/**
 * Handles a button tapped inside an Automatic Logging notification (a category, or Undo).
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

/** The event a notification response belongs to, read from its data (null for anything not from Automatic Logging). */
const readTarget = (p: Record<string, unknown>): { eventId: string; expenseId: string | null } | null => {
  const request = asRecord(asRecord(p.notification)?.request);
  const content = asRecord(request?.content);
  const data = readData(content?.data) ?? readData(content?.dataString) ?? readData(p.data);
  if (!data || data.type !== 'autolog') return null;
  const eventId = typeof data.eventId === 'string' ? data.eventId : '';
  if (!eventId) return null;
  return { eventId, expenseId: typeof data.expenseId === 'string' ? data.expenseId : null };
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
  const target = readTarget(p);
  return target ? { categoryId, ...target } : null;
};

/** The Undo tap, or null when the response is anything else. */
export const parseUndoTap = (payload: unknown): { eventId: string; expenseId: string | null } | null => {
  const p = asRecord(payload);
  if (!p || p.actionIdentifier !== UNDO_ACTION_ID) return null;
  return readTarget(p);
};

const refreshUi = async () => {
  try {
    const { supabase } = await import('../../config/supabase');
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (userId) {
      const { useAutoLogStore } = await import('./store');
      await useAutoLogStore.getState().refresh(userId);
    }
  } catch {
    // The screens refresh themselves the next time they are opened.
  }
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
    await refreshUi();
    return true;
  } catch {
    return false;
  }
};

/**
 * "Undo" on a logged notification: removes that one transaction and keeps the message as ignored, so the inbox
 * catch-up never logs it again. A transaction still waiting to be written is simply never written. If it cannot
 * be removed now (offline with the app closed), nothing changes and the user is told to remove it in the app.
 * Safe to tap twice. Returns true when the transaction is gone.
 */
export const applyUndoTap = async (tap: { eventId: string; expenseId: string | null }): Promise<boolean> => {
  try {
    const event = await db.getEvent(tap.eventId);
    if (!event || (event.status !== 'logged' && event.status !== 'queued')) {
      await dismiss(tap.eventId); // already undone, or changed in the app meanwhile
      return true;
    }
    const expenseId = event.expenseId ?? tap.expenseId;
    if (event.status === 'logged' && expenseId && !(await deleteTransaction(expenseId))) {
      await notifyUndoFailed(tap.eventId, expenseId);
      return false;
    }
    await db.updateEvent(event.id, { status: 'ignored', reviewReason: null, needsCategory: false });
    await db.addFeedback(event.id, expenseId, 'undo');
    await dismiss(tap.eventId);
    await refreshUi();
    return true;
  } catch {
    return false;
  }
};

/**
 * Every Automatic Logging notification button. Returns true when the response was one of them.
 * While App Lock is locked a button changes nothing: the user is asked to open Arthik (AUT-007).
 */
export const handleNotificationAction = async (payload: unknown, opts: { locked?: boolean } = {}): Promise<boolean> => {
  const undo = parseUndoTap(payload);
  const target = undo ?? parseCategoryTap(payload);
  if (target && opts.locked) {
    await notifyUnlockToChange(target.eventId, target.expenseId ?? '');
    return true;
  }
  if (undo) {
    await applyUndoTap(undo);
    return true;
  }
  const tap = parseCategoryTap(payload);
  if (!tap) return false;
  await applyCategoryTap(tap);
  return true;
};

/** Older name, kept for callers that still use it. */
export const handleCategoryResponse = handleNotificationAction;
