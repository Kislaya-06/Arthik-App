import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';

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

export const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    // GET on generate_204 returns HTTP 204 with 0-byte body across all mobile networks
    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return response.status >= 200 && response.status < 400;
  } catch {
    // Fallback ping if google_204 is unreachable
    try {
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), 3000);
      const fallbackRes = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
        method: 'GET',
        signal: fallbackController.signal,
      });
      clearTimeout(fallbackTimeout);
      return fallbackRes.status >= 200 && fallbackRes.status < 400;
    } catch {
      return false;
    }
  }
};

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
            .catch((e) => console.log('Auto-sync error:', e))
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
    const online = await checkOnlineStatus();
    get().setOffline(!online);
    return online;
  },

  initNetworkListener: () => {
    // Initial check
    get().checkConnectivity();

    // Periodic heartbeat every 45 seconds while active to conserve mobile battery
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        get().checkConnectivity();
      }
    }, 45000);

    // App state listener (check when app comes to foreground)
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        get().checkConnectivity();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  },
}));
