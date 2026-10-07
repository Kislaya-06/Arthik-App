import { create } from 'zustand';
import { registerStoreResetCallback } from '../../store/authStore';
import * as db from './db';
import { getHealth, needsAttention } from './permissions';
import { isSupported, readLocalState } from './service';
import type { AutoLogEvent, AutoLogMode, HealthReport, TrackedAccount } from './types';

/** UI-facing snapshot of Automatic Logging. Source of truth is the on-device database. */

interface AutoLogState {
  supported: boolean;
  mode: AutoLogMode;
  attention: boolean;
  remoteEnabled: boolean;
  health: HealthReport | null;
  accounts: TrackedAccount[];
  pendingCount: number;
  today: { detected: number; matched: number; pending: number; logged: number };
  lastChecked: number | null;
  pausedAt: number | null;
  /** v2.1: email notifications turned on (separate opt-in). */
  emailEnabled: boolean;
  recent: AutoLogEvent[];
  loaded: boolean;
  /** Rollout (Beta): may this user see Automatic Logging at all? Set by AutoLogGate. */
  available: boolean;
  setAvailable: (v: boolean) => void;
  setRemoteEnabled: (v: boolean) => void;
  refresh: (userId: string | undefined | null) => Promise<void>;
  reset: () => void;
}

const empty = {
  supported: false,
  mode: 'off' as AutoLogMode,
  attention: false,
  remoteEnabled: false,
  health: null,
  accounts: [],
  pendingCount: 0,
  today: { detected: 0, matched: 0, pending: 0, logged: 0 },
  lastChecked: null,
  pausedAt: null,
  emailEnabled: false,
  recent: [],
  loaded: false,
  available: false,
};

let refreshing: Promise<void> | null = null;

export const useAutoLogStore = create<AutoLogState>((set, get) => ({
  ...empty,
  setRemoteEnabled: (v) => set({ remoteEnabled: v }),
  setAvailable: (v) => set({ available: v }),
  reset: () => set({ ...empty }),
  refresh: async (userId) => {
    if (!userId) return;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const supported = isSupported();
        if (!supported) {
          set({ ...empty, supported: false, loaded: true, available: false });
          return;
        }
        const local = await readLocalState(userId);
        if (!local.setupComplete) {
          set({
            ...empty,
            supported: true,
            available: get().available,
            remoteEnabled: get().remoteEnabled,
            mode: get().remoteEnabled ? 'setup_missing' : 'off',
            loaded: true,
          });
          return;
        }
        const accounts = await db.listAccounts();
        const tracked = accounts.filter((a) => a.tracked);
        const emailEnabled = (await db.getMeta('email_enabled')) === '1';
        const health = await getHealth(tracked.length, emailEnabled);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const mode: AutoLogMode = local.signedOutAt ? 'signed_out' : local.pausedAt ? 'paused' : 'live';
        set({
          supported: true,
          mode,
          attention: mode === 'live' && needsAttention(health),
          health,
          accounts,
          pendingCount: await db.countPending(),
          today: await db.statsSince(startOfDay.getTime()),
          lastChecked: local.lastChecked,
          pausedAt: local.pausedAt,
          emailEnabled,
          recent: await db.listRecent(12),
          remoteEnabled: true,
          loaded: true,
        });
      } catch {
        set({ loaded: true });
      }
    })();
    try {
      await refreshing;
    } finally {
      refreshing = null;
    }
  },
}));

// Signing out clears the UI snapshot (the on-device database stays, so Recovery can work).
registerStoreResetCallback(() => useAutoLogStore.getState().reset());
