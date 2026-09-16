import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkState {
  isOffline: boolean;
  bannerVisible: boolean;
  bannerMessage: string;
  isSyncing: boolean;
  setOffline: (offline: boolean, message?: string) => void;
  triggerOfflineAlert: (message?: string) => void;
  dismissBanner: () => void;
  checkConnectivity: () => Promise<boolean>;
  initNetworkListener: () => () => void;
}

const DEFAULT_OFFLINE_MSG = 'You are offline, changes will sync when connected';

let syncPendingCallback: (() => Promise<void>) | null = null;
export const registerSyncCallback = (callback: () => Promise<void>) => {
  syncPendingCallback = callback;
};

let toastTimeout: any = null;

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOffline: false,
  bannerVisible: false,
  bannerMessage: DEFAULT_OFFLINE_MSG,
  isSyncing: false,

  setOffline: (offline: boolean, message?: string) => {
    const wasOffline = get().isOffline;
    if (offline) {
      if (!wasOffline) {
        // Newly went offline: show banner
        set({
          isOffline: true,
          bannerVisible: true,
          bannerMessage: message || DEFAULT_OFFLINE_MSG,
        });
      } else {
        // Already offline: update status, but don't force re-open if dismissed unless explicit message provided
        if (message) {
          set({
            isOffline: true,
            bannerVisible: true,
            bannerMessage: message,
          });
        } else {
          set({ isOffline: true });
        }
      }
    } else {
      if (wasOffline) {
        // Just came back online! Trigger sync
        set({
          isOffline: false,
          isSyncing: true,
          bannerVisible: true,
          bannerMessage: 'Back online! Syncing changes...',
        });

        if (toastTimeout) clearTimeout(toastTimeout);

        if (syncPendingCallback) {
          syncPendingCallback()
            .catch((e) => {
              if (__DEV__) console.log('Auto-sync error:', e);
            })
            .finally(() => {
              set({ isSyncing: false });
              toastTimeout = setTimeout(() => {
                set({ bannerVisible: false });
              }, 2500);
            });
        } else {
          set({ isSyncing: false });
          toastTimeout = setTimeout(() => {
            set({ bannerVisible: false });
          }, 2500);
        }
      } else {
        set({ isOffline: false, bannerVisible: false });
      }
    }
  },

  triggerOfflineAlert: (message?: string) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    set({
      isOffline: true,
      bannerVisible: true,
      bannerMessage: message || DEFAULT_OFFLINE_MSG,
    });
    // Auto-dismiss toast banner after 4 seconds
    toastTimeout = setTimeout(() => {
      set({ bannerVisible: false });
    }, 4000);
  },

  dismissBanner: () => {
    if (toastTimeout) clearTimeout(toastTimeout);
    set({ bannerVisible: false });
  },

  checkConnectivity: async () => {
    const state = await NetInfo.fetch();
    const isOnline = Boolean(state.isConnected && state.isInternetReachable);
    get().setOffline(!isOnline);
    return isOnline;
  },

  initNetworkListener: () => {
    const handleNetworkChange = (state: NetInfoState) => {
      // If connected but reachability is still undetermined (null), wait for reachability test to avoid false offline flash
      if (state.isInternetReachable === null && state.isConnected) {
        return;
      }
      const isOnline = Boolean(state.isConnected && state.isInternetReachable);
      get().setOffline(!isOnline);
    };

    // Initial state check
    NetInfo.fetch().then(handleNetworkChange);

    // Subscribe to native OS-level network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    return () => {
      unsubscribe();
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  },
}));
