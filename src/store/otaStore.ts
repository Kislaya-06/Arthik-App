import { create } from 'zustand';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { OtaUpdateInfo } from '../components/OtaUpdateModal';

interface OtaState {
  visible: boolean;
  info: OtaUpdateInfo | null;
  isDownloading: boolean;
  downloadText: string;
  error: string | null;
  showUpdateModal: (info?: OtaUpdateInfo) => void;
  hideUpdateModal: () => void;
  applyUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

export const useOtaStore = create<OtaState>((set, get) => ({
  visible: false,
  info: null,
  isDownloading: false,
  downloadText: 'Downloading update...',
  error: null,

  showUpdateModal: (info) => {
    const otaExtra = Constants.expoConfig?.extra?.otaUpdate;
    const defaultInfo: OtaUpdateInfo = {
      version: otaExtra?.version || Constants.expoConfig?.version || '1.2.4',
      title: otaExtra?.title || 'New Update Available 🎉',
      highlights: otaExtra?.highlights || [
        'Swipe-to-dismiss keypad on Add Expense',
        'Smooth scrolling & jitter-free category chips',
        'Biometric App Lock & security fixes',
      ],
    };
    set({
      visible: true,
      info: info || defaultInfo,
      isDownloading: false,
      error: null,
    });
  },

  hideUpdateModal: () => {
    if (!get().isDownloading) {
      set({ visible: false, error: null });
    }
  },

  applyUpdate: async () => {
    try {
      set({ isDownloading: true, downloadText: 'Downloading update...', error: null });
      if (!__DEV__ && Updates.isEnabled) {
        await Updates.fetchUpdateAsync();
        set({ downloadText: 'Restarting Arthik...' });
        await Updates.reloadAsync();
      } else {
        // Simulated progress for UI testing in __DEV__
        await new Promise((resolve) => setTimeout(resolve, 1000));
        set({ downloadText: 'Restarting Arthik...' });
        await new Promise((resolve) => setTimeout(resolve, 800));
        set({ visible: false, isDownloading: false });
      }
    } catch {
      set({
        isDownloading: false,
        error: 'Could not apply update. Please check your connection and try again.',
      });
    }
  },

  checkForUpdates: async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        const manifest: any = update.manifest;
        const extra = manifest?.extra?.expoClient?.extra || manifest?.extra;
        const ota = extra?.otaUpdate;
        set({
          visible: true,
          info: {
            version: ota?.version || manifest?.runtimeVersion || undefined,
            title: ota?.title || 'New Update Available 🎉',
            highlights: Array.isArray(ota?.highlights) && ota.highlights.length > 0
              ? ota.highlights
              : [
                  'Performance enhancements and smoother animations',
                  'UI polish and overall stability fixes',
                ],
          },
          isDownloading: false,
          error: null,
        });
      }
    } catch (e) {
      if (__DEV__) console.log('Update check failed:', e);
    }
  },
}));
