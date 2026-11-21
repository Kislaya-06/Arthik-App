import { Platform } from 'react-native';
import { formatCurrency } from '../../lib/formatters';
import { loadQuickCategories, QuickCategory } from '../../lib/quickCategories';

/**
 * Local notifications for Automatic Logging (preview → logged → needs review).
 * The preview and the final result share one identifier, so the same notification updates in place.
 */

const CHANNEL_ID = 'arthik-autolog';
let channelReady = false;

const getNotifications = async (): Promise<typeof import('expo-notifications') | null> => {
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
};

const ensureChannel = async () => {
  const N = await getNotifications();
  if (!N || channelReady || Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Automatic Logging',
    description: 'Detected payments, logged transactions and items that need your review',
    importance: N.AndroidImportance.DEFAULT,
    vibrationPattern: [0],
    enableVibrate: false,
    showBadge: true,
  });
  channelReady = true;
};

/** Action button ids look like `cat:<categoryId>`. Used by background.ts and App.tsx to recognise a category tap. */
export const CATEGORY_ACTION_PREFIX = 'cat:';
/** "Undo" on a logged notification: removes that transaction without opening the app. */
export const UNDO_ACTION_ID = 'autolog:undo';
/** Android shows at most 3 buttons: up to 2 categories + Undo. */
const MAX_CATEGORY_BUTTONS = 2;

/** True for every button Automatic Logging puts on its notifications (category or Undo). */
export const isAutoLogActionId = (id: unknown): boolean =>
  typeof id === 'string' && (id.startsWith(CATEGORY_ACTION_PREFIX) || id === UNDO_ACTION_ID);

/** Notification id of an event (the same id is reused so the notification updates in place). */
export const notificationIdFor = (eventKey: string) => `autolog-${eventKey}`;

const BUTTON_TITLE_MAX = 16;
const buttonTitle = (name: string) => (name.length > BUTTON_TITLE_MAX ? `${name.slice(0, BUTTON_TITLE_MAX - 1).trimEnd()}…` : name);

/** Small stable hash so the same set of buttons always uses the same notification category id. */
const hashIds = (ids: string[]) => {
  let h = 5381;
  const text = ids.join('|');
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/**
 * Registers the buttons (categories, then Undo) and returns the notification category id to attach.
 * Android builds the buttons from the category when the notification is posted, so every distinct set of
 * buttons gets its own id (a later change to the user's top categories never alters one already on screen).
 */
const prepareButtons = async (list: QuickCategory[], withUndo: boolean): Promise<string | null> => {
  const N = await getNotifications();
  if (!N || Platform.OS !== 'android' || (list.length === 0 && !withUndo)) return null;
  try {
    const ids = [...list.map((c) => c.id), ...(withUndo ? [UNDO_ACTION_ID] : [])];
    const categoryId = `arthik-autolog-cat-${hashIds(ids)}`;
    await N.setNotificationCategoryAsync(categoryId, [
      ...list.map((c) => ({
        identifier: `${CATEGORY_ACTION_PREFIX}${c.id}`,
        buttonTitle: buttonTitle(c.name),
        // The whole point: choosing a category must not open the app.
        options: { opensAppToForeground: false },
      })),
      ...(withUndo ? [{ identifier: UNDO_ACTION_ID, buttonTitle: 'Undo', options: { opensAppToForeground: false } }] : []),
    ]);
    return categoryId;
  } catch {
    return null;
  }
};

const currentUserId = async (): Promise<string | null> => {
  try {
    const { supabase } = await import('../../config/supabase');
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
};

const present = async (
  identifier: string,
  title: string,
  body: string,
  data: Record<string, string>,
  categoryButtons?: QuickCategory[],
  withUndo = false
) => {
  const N = await getNotifications();
  if (!N) return;
  try {
    const perm = await N.getPermissionsAsync();
    if (perm.status !== 'granted') return;
    await ensureChannel();
    const categoryIdentifier = categoryButtons?.length || withUndo ? await prepareButtons(categoryButtons ?? [], withUndo) : null;
    await N.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data: { type: 'autolog', ...data },
        ...(categoryIdentifier ? { categoryIdentifier } : {}),
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch {
    // Notifications are a convenience; detection never depends on them.
  }
};

const amt = (n: number | null) => (n == null ? '' : formatCurrency(n));

export const notifyPreview = (key: string, amount: number | null, merchant: string | null) =>
  present(notificationIdFor(key), 'Payment detected', `${amt(amount)}${merchant ? ` · ${merchant}` : ''}\nWaiting for bank confirmation…`, {
    screen: 'AutoLogCenter',
  });

export const notifyLogged = (
  key: string,
  amount: number | null,
  merchant: string | null,
  expenseId: string,
  isIncome: boolean,
  /** Money from someone who owes the user: asked instead of the plain "Income" line (SPL-005). */
  moneyBackQuestion?: string | null,
  /** True when the expense was logged without a category: the notification then offers the user's top categories as buttons. */
  needsCategory?: boolean
) => {
  const wantsButtons = !!needsCategory && !isIncome && !moneyBackQuestion;
  return (async () => {
    let buttons: QuickCategory[] = [];
    if (wantsButtons) {
      const userId = await currentUserId();
      if (userId) buttons = (await loadQuickCategories(userId)).slice(0, MAX_CATEGORY_BUTTONS);
    }
    await present(
      notificationIdFor(key),
      `✓ ${amt(amount)} logged`,
      moneyBackQuestion
        ? `${merchant ? `${merchant} · ` : ''}${moneyBackQuestion} Tap to answer.`
        : `${merchant ? `${merchant} · ` : ''}${isIncome ? 'Income' : 'Expense'} · ${
            buttons.length ? 'Choose a category' : 'Automatically detected'
          }`,
      { screen: 'ExpenseDetail', expenseId, eventId: key },
      buttons,
      true
    );
  })();
};

/** Shown when "Undo" was tapped but the transaction could not be removed (for example no internet). */
export const notifyUndoFailed = (key: string, expenseId: string) =>
  present(notificationIdFor(key), 'Could not undo', 'Tap to remove it in Arthik.', { screen: 'ExpenseDetail', expenseId, eventId: key });

/** Weekly summary (service.processQueue, once per new week). Also kept in the in-app bell. */
export const notifyWeeklyDigest = async (title: string, body: string, weekKey: string) => {
  await present(`autolog-digest-${weekKey}`, title, body, { screen: 'AutoLogCenter' });
  try {
    const { useNotificationStore } = await import('../../store/notificationStore');
    useNotificationStore.getState().addNotification({
      id: `autolog_digest_${weekKey}`,
      title,
      message: body,
      type: 'autolog_digest',
      data: { screen: 'AutoLogCenter' },
    });
  } catch {
    // The bell is a convenience; the summary was still shown.
  }
};

/** Shown when a category button was tapped but the change could not be saved (for example no internet). */
export const notifyCategoryNotSaved = (key: string, expenseId: string) =>
  present(notificationIdFor(key), 'Category not saved', 'Tap to choose it in Arthik.', { screen: 'ExpenseDetail', expenseId, eventId: key });

export const notifyNeedsReview = (key: string, amount: number | null, merchant: string | null, question: string) =>
  present(notificationIdFor(key), `${amt(amount)}${merchant ? ` · ${merchant}` : ''}`, `${question} Tap to review.`, {
    screen: 'AutoLogReview',
  });
