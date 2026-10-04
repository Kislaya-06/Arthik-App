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

const resolveOtaInfo = (manifest?: any): OtaUpdateInfo => {
  const ota = (manifest?.extra?.expoClient?.extra || manifest?.extra || Constants.expoConfig?.extra)?.otaUpdate;
  return {
    version: ota?.version || manifest?.runtimeVersion || Constants.expoConfig?.version || '1.2.4',
    title: ota?.title || 'Smart Notifications & Ambient Polish ✨',
    highlights: Array.isArray(ota?.highlights) && ota.highlights.length > 0
      ? ota.highlights
      : [
          "Smart notification redesign: quiet evening nudges, Gullak rewards, and weekly/monthly recaps",
          "Tactile vertical rolling-digit animations across balances, allowances, and charts",
          "Ambient Background v4: organic header glow and gentle wind draft effects",
          "Butter-smooth 60fps Donut & Dual Ring chart sweeps on screen focus",
          "Enhanced SegmentedControl touch reach and tap responsiveness",
        ],
  };
};

export const useOtaStore = create<OtaState>((set, get) => ({
  visible: false,
  info: null,
  isDownloading: false,
  downloadText: 'Downloading update...',
  error: null,

  showUpdateModal: (info) => set({
    visible: true,
    info: info || resolveOtaInfo(),
    isDownloading: false,
    error: null,
  }),

  hideUpdateModal: () => {
    if (!get().isDownloading) set({ visible: false, error: null });
  },

  applyUpdate: async () => {
    try {
      set({ isDownloading: true, downloadText: 'Downloading update...', error: null });
      if (!__DEV__ && Updates.isEnabled) {
        await Updates.fetchUpdateAsync();
        set({ downloadText: 'Restarting Arthik...' });
        await Updates.reloadAsync();
      } else {
        await new Promise((r) => setTimeout(r, 1000));
        set({ downloadText: 'Restarting Arthik...' });
        await new Promise((r) => setTimeout(r, 800));
        set({ visible: false, isDownloading: false });
      }
    } catch {
      set({ isDownloading: false, error: 'Could not apply update. Please check connection and try again.' });
    }
  },

  checkForUpdates: async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        set({
          visible: true,
          info: resolveOtaInfo(update.manifest),
          isDownloading: false,
          error: null,
        });
      }
    } catch (e) {
      if (__DEV__) console.log('Update check failed:', e);
    }
  },
}));
