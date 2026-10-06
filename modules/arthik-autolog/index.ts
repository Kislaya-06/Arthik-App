import { Platform } from 'react-native';

/**
 * JS face of the local native module (modules/arthik-autolog, Android only).
 * Every call is safe: on iOS / Expo Go / missing module it returns a neutral value.
 */
export interface NativeSms {
  id: string;
  address: string;
  body: string;
  date: number;
}

export interface SmsPage {
  messages: NativeSms[];
  scanned: number;
  oldest: number;
  done: boolean;
}

interface ArthikAutoLogNative {
  isAvailable(): boolean;
  setCaptureEnabled(enabled: boolean): void;
  isCaptureEnabled(): boolean;
  getLastEventAt(): number;
  drainQueue(): string[];
  getQueueSize(): number;
  clearQueue(): void;
  countSms(sinceMs: number, untilMs: number): Promise<number>;
  readSmsPage(sinceMs: number, beforeMs: number, pageSize: number): Promise<SmsPage>;
  isNotificationListenerEnabled(): boolean;
  openNotificationListenerSettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
  openAppDetails(): void;
  openBatteryOptimizationList(): void;
}

let native: ArthikAutoLogNative | null = null;
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireOptionalNativeModule } = require('expo');
    native = requireOptionalNativeModule('ArthikAutoLog');
  } catch {
    native = null;
  }
}

export const ArthikAutoLog = native;
export const isAutoLogNativeAvailable = (): boolean => {
  try {
    return !!native && native.isAvailable();
  } catch {
    return false;
  }
};
