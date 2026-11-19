import { create } from 'zustand';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { OtaUpdateInfo } from '../components/OtaUpdateModal';

export type OtaStatus = 'idle' | 'checking' | 'available' | 'upToDate';

interface OtaState {
  visible: boolean;
  status: OtaStatus;
  info: OtaUpdateInfo | null;
  isDownloading: boolean;
  downloadText: string;
  error: string | null;
  showUpdateModal: (info?: OtaUpdateInfo, status?: OtaStatus) => void;
  hideUpdateModal: () => void;
  applyUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  checkStatusFromProfile: () => Promise<void>;
}

const resolveOtaInfo = (manifest?: any): OtaUpdateInfo => {
  const ota = (manifest?.extra?.expoClient?.extra || manifest?.extra || Constants.expoConfig?.extra)?.otaUpdate;
  return {
    version: ota?.version || manifest?.runtimeVersion || Constants.expoConfig?.version || '2.1.0',
    title: ota?.title || 'Clearer Text, Calmer Errors & Tactile Saves ✨',
    highlights: Array.isArray(ota?.highlights) && ota.highlights.length > 0
      ? ota.highlights
      : [
          'Opens Fast, Even Offline: The app now opens from the data saved on your phone, so it starts quickly on any network and keeps working without internet',
          'Budget Mode Starts Properly: When you switch Smart Budget & Gullak back on, your daily budget now starts right away on the first day with auto-save on, instead of showing ₹0',
          'Nothing Lost Offline: Budget changes, Gullak deposits and categories you save offline now always reach the server',
          'Self-Transfers Offline: Remembered transfer notes now work without internet',
          'Full Text, No More ...: Names, notes, titles and buttons now wrap or shrink to fit instead of being cut off',
          'Clear Error Messages: Short, simple messages instead of technical text',
          'Tactile Saves: A soft success buzz when you save an expense, deposit to Gullak or update your budget',
          'Safe Daily Spending Pace Precision: Today is now accurately counted as an active day in Weekly and Monthly Insights',
          'Insights Briefing Dock: Unified dual-tile financial summary for Safe Daily Pace and Auto-Saved Gullak with instant one-tap navigation to Savings',
          'History Gesture Polish: Eliminated button underlay blink during screen transitions for buttery-smooth swipe-to-delete',
          'Split an expense with a friend and see exactly what they owe you',
          'When a friend pays you back, it is no longer counted as income',
        ],
  };
};

export const useOtaStore = create<OtaState>((set, get) => ({
  visible: false,
  status: 'idle',
  info: null,
  isDownloading: false,
  downloadText: 'Downloading update...',
  error: null,

  showUpdateModal: (info, status = 'available') => set({
    visible: true,
    status,
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
          status: 'available',
          info: resolveOtaInfo(update.manifest),
          isDownloading: false,
          error: null,
        });
      } else {
        set({ status: 'upToDate' });
      }
    } catch (e) {
      if (__DEV__) console.log('Update check failed:', e);
    }
  },

  checkStatusFromProfile: async () => {
    if (get().isDownloading || get().status === 'checking') return;

    set({ status: 'checking', error: null });

    if (!Updates.isEnabled) {
      set({
        visible: true,
        status: 'upToDate',
        info: resolveOtaInfo(),
        isDownloading: false,
        error: null,
      });
      return;
    }

    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        set({
          visible: true,
          status: 'available',
          info: resolveOtaInfo(update.manifest),
          isDownloading: false,
          error: null,
        });
      } else {
        set({
          visible: true,
          status: 'upToDate',
          info: resolveOtaInfo(),
          isDownloading: false,
          error: null,
        });
      }
    } catch (e) {
      if (__DEV__) console.log('Update check failed:', e);
      set({
        visible: true,
        status: 'upToDate',
        info: resolveOtaInfo(),
        isDownloading: false,
        error: null,
      });
    }
  },
}));
