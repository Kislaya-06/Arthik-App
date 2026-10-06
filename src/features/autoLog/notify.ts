import { Platform } from 'react-native';
import { formatCurrency } from '../../lib/formatters';

/**
 * Local notifications for Automatic Logging (preview → logged → needs review).
 * The preview and the final result share one identifier, so the same notification updates in place.
 */

const CHANNEL_ID = 'arthik-autolog';
let channelReady = false;

const getNotifications = (): typeof import('expo-notifications') | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch {
    return null;
  }
};

const ensureChannel = async () => {
  const N = getNotifications();
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

const present = async (identifier: string, title: string, body: string, data: Record<string, string>) => {
  const N = getNotifications();
  if (!N) return;
  try {
    const perm = await N.getPermissionsAsync();
    if (perm.status !== 'granted') return;
    await ensureChannel();
    await N.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data: { type: 'autolog', ...data },
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
  present(`autolog-${key}`, 'Payment detected', `${amt(amount)}${merchant ? ` · ${merchant}` : ''}\nWaiting for bank confirmation…`, {
    screen: 'AutoLogCenter',
  });

export const notifyLogged = (key: string, amount: number | null, merchant: string | null, expenseId: string, isIncome: boolean) =>
  present(
    `autolog-${key}`,
    `✓ ${amt(amount)} logged`,
    `${merchant ? `${merchant} · ` : ''}${isIncome ? 'Income' : 'Expense'} · Automatically detected`,
    { screen: 'ExpenseDetail', expenseId }
  );

export const notifyNeedsReview = (key: string, amount: number | null, merchant: string | null, question: string) =>
  present(`autolog-${key}`, `${amt(amount)}${merchant ? ` · ${merchant}` : ''}`, `${question} Tap to review.`, {
    screen: 'AutoLogReview',
  });
