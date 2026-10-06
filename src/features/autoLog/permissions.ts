import { PermissionsAndroid, Platform } from 'react-native';
import { ArthikAutoLog, isAutoLogNativeAvailable } from '../../../modules/arthik-autolog';
import type { HealthReport } from './types';

const SMS_PERMS = [PermissionsAndroid.PERMISSIONS.READ_SMS, PermissionsAndroid.PERMISSIONS.RECEIVE_SMS];

export const hasSmsPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const results = await Promise.all(SMS_PERMS.map((p) => PermissionsAndroid.check(p)));
    return results.every(Boolean);
  } catch {
    return false;
  }
};

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

export const requestSmsPermission = async (): Promise<PermissionOutcome> => {
  if (Platform.OS !== 'android') return 'denied';
  try {
    const res = await PermissionsAndroid.requestMultiple(SMS_PERMS);
    const values = Object.values(res);
    if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
    if (values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) return 'blocked';
    return 'denied';
  } catch {
    return 'denied';
  }
};

export const hasNotificationAccess = (): boolean => {
  try {
    return !!ArthikAutoLog?.isNotificationListenerEnabled();
  } catch {
    return false;
  }
};

export const isBatteryUnrestricted = (): boolean => {
  try {
    return !!ArthikAutoLog?.isIgnoringBatteryOptimizations();
  } catch {
    return false;
  }
};

export const openNotificationAccess = () => {
  try { ArthikAutoLog?.openNotificationListenerSettings(); } catch {}
};
export const openAppDetails = () => {
  try { ArthikAutoLog?.openAppDetails(); } catch {}
};
export const openBatterySettings = () => {
  try { ArthikAutoLog?.openAppDetails(); } catch {
    try { ArthikAutoLog?.openBatteryOptimizationList(); } catch {}
  }
};

export const getHealth = async (trackedCount: number): Promise<HealthReport> => ({
  nativeAvailable: isAutoLogNativeAvailable(),
  sms: await hasSmsPermission(),
  notifications: hasNotificationAccess(),
  battery: isBatteryUnrestricted(),
  accounts: trackedCount > 0,
});

/** Notification access is a "fast preview" bonus; SMS, battery and accounts are required. */
export const needsAttention = (h: HealthReport) => !h.sms || !h.battery || !h.accounts;
