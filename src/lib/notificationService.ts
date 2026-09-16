import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHANNEL_ID = 'daily-budget-alerts';

// Safely attempt to load expo-notifications
let Notifications: typeof import('expo-notifications') | null = null;
let isNativeModuleAvailable = false;

try {
  Notifications = require('expo-notifications');
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    isNativeModuleAvailable = true;
  }
} catch (error) {
  if (__DEV__) {
    console.log(
      '[NotificationService] Native module not found in currently installed binary. ' +
      'Run "eas build -p android --profile preview" to compile new native modules into APK.'
    );
  }
  isNativeModuleAvailable = false;
}

/**
 * Check if the native notification module is available in the current APK binary.
 */
export function isDeviceNotificationSupported(): boolean {
  return isNativeModuleAvailable && Notifications !== null;
}

/**
 * Request notification permissions and create Android notification channel with MAX priority.
 */
export async function setupNotifications(): Promise<boolean> {
  if (!isDeviceNotificationSupported() || !Notifications) {
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily Budget & Savings Alerts',
        description: 'Alerts for remaining daily allowance, warnings, and savings rollover',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B8E0C8',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
    }

    return finalStatus === 'granted';
  } catch (error) {
    if (__DEV__) console.log('Error initializing notifications:', error);
    return false;
  }
}

/**
 * Trigger an immediate notification that appears in the phone system tray (heads-up banner).
 */
export async function triggerDeviceNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string | null> {
  try {
    const enabled = await AsyncStorage.getItem('@arthik_notifications_enabled');
    if (enabled === 'false') {
      return null;
    }
  } catch {
    // proceed if read fails
  }

  if (!isDeviceNotificationSupported() || !Notifications) {
    if (__DEV__) console.log('[NotificationService] Device notification skipped: native binary missing expo-notifications.');
    return null;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily Budget & Savings Alerts',
        description: 'Alerts for remaining daily allowance, warnings, and savings rollover',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B8E0C8',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null, // triggers immediately
    });
    return id;
  } catch (error) {
    if (__DEV__) console.log('Error triggering device notification:', error);
    return null;
  }
}

/**
 * Schedule a daily evening reminder to check remaining budget and savings.
 */
export async function scheduleDailyReminder(hour = 20, minute = 0): Promise<void> {
  try {
    const enabled = await AsyncStorage.getItem('@arthik_notifications_enabled');
    if (enabled === 'false') {
      return;
    }
  } catch {
    // proceed
  }

  if (!isDeviceNotificationSupported() || !Notifications) {
    return;
  }

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'daily_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 Daily Budget Check-in',
        body: 'Check your spending today and see how much you saved in your Gullak!',
        data: { type: 'daily_reminder', screen: 'Savings' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });
  } catch (error) {
    if (__DEV__) console.log('Error scheduling daily reminder:', error);
  }
}

/**
 * Cancel the scheduled daily reminder.
 */
export async function cancelDailyReminder(): Promise<void> {
  if (!isDeviceNotificationSupported() || !Notifications) {
    return;
  }
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'daily_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    if (__DEV__) console.log('Error cancelling daily reminder:', error);
  }
}

/**
 * Listen for user tapping on a device notification.
 */
export function registerNotificationResponseListener(
  onResponse: (data: any) => void
): () => void {
  if (!isDeviceNotificationSupported() || !Notifications) {
    return () => {};
  }

  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      onResponse(data);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
