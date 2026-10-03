import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHANNELS,
  ChannelKey,
  LEGACY_CHANNEL_ID,
  PlannedNotification,
  planSignature,
} from './notificationPolicy';

/**
 * Thin wrapper over expo-notifications. All decisions (what / when / how often) live in
 * notificationPolicy.ts; this file only talks to the OS:
 *  - channels (created lazily, one per kind of message, so users can mute each separately)
 *  - the foreground rule (nothing pops up while the user is looking at the app, except "over the limit")
 *  - scheduling the plan, one-time cleanup of the old repeating reminder, and tap routing
 */

export const NOTIFICATIONS_ENABLED_KEY = '@arthik_notifications_enabled';
const SCHEMA_KEY = '@arthik_notif_schema';
const SCHEMA_VERSION = '2';

// Safely attempt to load expo-notifications
let Notifications: typeof import('expo-notifications') | null = null;
let isNativeModuleAvailable = false;

try {
  Notifications = require('expo-notifications');
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // The handler only runs while the app is OPEN. Show a banner there only if the message asked for it
        // ("over the limit"); everything else is already visible on screen or goes to the in-app bell.
        const showInForeground = notification.request.content.data?.presentation === 'always';
        return {
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: showInForeground,
          shouldShowList: showInForeground,
        };
      },
    });
    isNativeModuleAvailable = true;
  }
} catch (error) {
  if (__DEV__) {
    console.log('[NotificationService] Native module not found in the installed binary.');
  }
  isNativeModuleAvailable = false;
}

/** Check if the native notification module is available in the current binary. */
export function isDeviceNotificationSupported(): boolean {
  return isNativeModuleAvailable && Notifications !== null;
}

export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)) !== 'false';
  } catch {
    return true;
  }
}

// ─── Channels ────────────────────────────────────────────────────────────────

const createdChannels = new Set<ChannelKey>();

async function ensureChannel(key: ChannelKey): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications || createdChannels.has(key)) return;
  const spec = CHANNELS[key];
  const importance =
    spec.importance === 'HIGH'
      ? Notifications.AndroidImportance.HIGH
      : spec.importance === 'LOW'
        ? Notifications.AndroidImportance.LOW
        : Notifications.AndroidImportance.DEFAULT;
  await Notifications.setNotificationChannelAsync(spec.id, {
    name: spec.name,
    description: spec.description,
    importance,
    enableVibrate: spec.vibrate,
    ...(spec.vibrate ? { vibrationPattern: [0, 200, 150, 200] } : {}),
    lightColor: '#B8E0C8',
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
  createdChannels.add(key);
}

/** Request notification permission (call after login). */
export async function setupNotifications(): Promise<boolean> {
  if (!isDeviceNotificationSupported() || !Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (error) {
    if (__DEV__) console.log('Error initializing notifications:', error);
    return false;
  }
}

async function hasPermission(): Promise<boolean> {
  if (!isDeviceNotificationSupported() || !Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Immediate (in-app event) notification ───────────────────────────────────

/**
 * Show a notification right now. `data.presentation` decides whether it may appear while the app is open
 * ('always') or only when the app is in the background ('background', the default).
 */
export async function triggerDeviceNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  channel: ChannelKey = 'alerts'
): Promise<string | null> {
  if (!(await areNotificationsEnabled())) return null;
  if (!isDeviceNotificationSupported() || !Notifications) return null;

  try {
    await ensureChannel(channel);
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: false,
        ...(Platform.OS === 'android' ? { channelId: CHANNELS[channel].id } : {}),
      },
      trigger: null,
    });
  } catch (error) {
    if (__DEV__) console.log('Error triggering device notification:', error);
    return null;
  }
}

// ─── Scheduled plan ──────────────────────────────────────────────────────────

let lastAppliedSignature: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Serialise calls so two syncs can never interleave their cancel/schedule steps. */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

async function cancelPlanned(): Promise<void> {
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.source === 'plan') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/** Replace everything we scheduled before with `plan`. Skips work if nothing changed. */
export function applyNotificationPlan(plan: PlannedNotification[]): Promise<void> {
  return enqueue(async () => {
    if (!isDeviceNotificationSupported() || !Notifications) return;
    if (!(await areNotificationsEnabled()) || !(await hasPermission())) {
      await cancelPlanned();
      lastAppliedSignature = null;
      return;
    }

    const signature = planSignature(plan);
    if (signature === lastAppliedSignature) return;

    try {
      await cancelPlanned();
      for (const item of plan) {
        await ensureChannel(item.channel);
        await Notifications.scheduleNotificationAsync({
          identifier: `plan_${item.id}`,
          content: {
            title: item.title,
            body: item.body,
            sound: false,
            data: {
              source: 'plan',
              type: item.type,
              screen: item.screen,
              planId: item.id,
              inbox: item.inbox,
              presentation: 'background',
            },
            ...(Platform.OS === 'android' ? { channelId: CHANNELS[item.channel].id } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.fireAt,
            ...(Platform.OS === 'android' ? { channelId: CHANNELS[item.channel].id } : {}),
          },
        });
      }
      lastAppliedSignature = signature;
    } catch (error) {
      lastAppliedSignature = null;
      if (__DEV__) console.log('Error scheduling notification plan:', error);
    }
  });
}

/** Cancel every scheduled notification this app created (toggle off / sign-out). */
export function cancelAllPlanned(): Promise<void> {
  return enqueue(async () => {
    if (!isDeviceNotificationSupported() || !Notifications) return;
    try {
      await cancelPlanned();
      lastAppliedSignature = null;
    } catch (error) {
      if (__DEV__) console.log('Error cancelling planned notifications:', error);
    }
  });
}

/**
 * One-time upgrade cleanup: the old version scheduled a repeating 20:00 "Daily Expense Reminder" at the OS level
 * (it keeps firing forever) on a single MAX-importance channel. Remove both, once.
 */
export function migrateLegacyNotifications(): Promise<void> {
  return enqueue(async () => {
    if (!isDeviceNotificationSupported() || !Notifications) return;
    try {
      if ((await AsyncStorage.getItem(SCHEMA_KEY)) === SCHEMA_VERSION) return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (Platform.OS === 'android') {
        await Notifications.deleteNotificationChannelAsync(LEGACY_CHANNEL_ID).catch(() => {});
      }
      await AsyncStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
      lastAppliedSignature = null;
    } catch (error) {
      if (__DEV__) console.log('Error migrating legacy notifications:', error);
    }
  });
}

/**
 * Notifications that were delivered while the app was closed (recaps, rewards) and are still in the tray:
 * hand them to `onArchive` so they can also be kept in the in-app bell.
 */
export async function collectDeliveredForInbox(
  onArchive: (item: { id: string; type: string; title: string; message: string; screen?: string }) => void
): Promise<void> {
  if (!isDeviceNotificationSupported() || !Notifications) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const p of presented) {
      const c = p.request.content;
      if (c.data?.source === 'plan' && c.data?.inbox === true && c.data?.planId) {
        onArchive({
          id: String(c.data.planId),
          type: String(c.data.type),
          title: c.title ?? '',
          message: c.body ?? '',
          screen: c.data.screen as string | undefined,
        });
      }
    }
  } catch {
    // best effort
  }
}

/** Listen for the user tapping a notification. */
export function registerNotificationResponseListener(onResponse: (data: any) => void): () => void {
  if (!isDeviceNotificationSupported() || !Notifications) return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      onResponse(response?.notification?.request?.content?.data);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
