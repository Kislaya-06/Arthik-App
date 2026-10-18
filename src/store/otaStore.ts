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
    version: ota?.version || manifest?.runtimeVersion || Constants.expoConfig?.version || '2.1.0',
    title: ota?.title || 'Split Expenses & Money Back 🤝',
    highlights: Array.isArray(ota?.highlights) && ota.highlights.length > 0
      ? ota.highlights
      : [
          'Split an expense with a friend and see exactly what they owe you',
          'When a friend pays you back, it is no longer counted as income',
          'Refunds go back to the expense they belong to',
          'New Ledger button on Home: see who owes you, what was paid back and what is settled',
          'Tap the Home card for a full breakdown of budget, money in and Gullak',
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
