import { AppRegistry, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { supabase } from '../../config/supabase';
import { isAutoLogNativeAvailable } from '../../../modules/arthik-autolog';

/**
 * Two ways Arthik processes events while the app is closed:
 *  1. Headless task — started natively the moment a bank SMS / payment notification arrives.
 *  2. Periodic background task (~every 15+ min, Android decides) — safety net + "Last checked".
 * Both only drain the on-device queue; nothing heavy runs continuously.
 *
 * IMPORTANT: this file must be imported from index.ts (global scope) so the task is defined at startup.
 */

export const AUTOLOG_BG_TASK = 'arthik-autolog-periodic';
/** Runs when a category button inside an Automatic Logging notification is tapped while the app is closed / in background. */
export const AUTOLOG_NOTIFICATION_ACTION_TASK = 'arthik-autolog-notification-action';

const runHeadless = async () => {
  if (!isAutoLogNativeAvailable()) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return; // signed out → never log
  const { processQueue } = await import('./service');
  await processQueue(userId, { notify: true });
  const { useAutoLogStore } = await import('./store');
  useAutoLogStore.getState().refresh(userId);
};

TaskManager.defineTask(AUTOLOG_BG_TASK, async () => {
  try {
    await runHeadless();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

TaskManager.defineTask(AUTOLOG_NOTIFICATION_ACTION_TASK, async ({ data }: { data?: unknown }) => {
  try {
    // Only category buttons are handled; every other response is ignored here.
    const { handleCategoryResponse } = await import('./notificationActions');
    await handleCategoryResponse(data);
  } catch {}
});

AppRegistry.registerHeadlessTask('ArthikAutoLogTask', () => async () => {
  try {
    await runHeadless();
  } catch {}
});

const registerNotificationActionTask = async () => {
  if (Platform.OS !== 'android') return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(AUTOLOG_NOTIFICATION_ACTION_TASK)) return;
    const N = await import('expo-notifications');
    await N.registerTaskAsync(AUTOLOG_NOTIFICATION_ACTION_TASK);
  } catch {
    // Without it the buttons still work while the app is open; closed-app taps would just do nothing.
  }
};

export const registerBackground = async () => {
  // Registered before the periodic task's early return so users who already have it get this one too.
  await registerNotificationActionTask();
  if (await TaskManager.isTaskRegisteredAsync(AUTOLOG_BG_TASK)) return;
  await BackgroundTask.registerTaskAsync(AUTOLOG_BG_TASK, { minimumInterval: 15 });
};

export const unregisterBackground = async () => {
  try {
    if (await TaskManager.isTaskRegisteredAsync(AUTOLOG_NOTIFICATION_ACTION_TASK)) {
      const N = await import('expo-notifications');
      await N.unregisterTaskAsync(AUTOLOG_NOTIFICATION_ACTION_TASK);
    }
  } catch {}
  if (await TaskManager.isTaskRegisteredAsync(AUTOLOG_BG_TASK)) {
    await BackgroundTask.unregisterTaskAsync(AUTOLOG_BG_TASK);
  }
};
