import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBatchedPersistStorage, removeBatchedItem } from '../lib/batchedStorage';
import { registerStoreResetCallback } from './authStore';

export type NotificationType =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'savings_rollover'
  | 'daily_reminder'
  | 'weekly_recap'
  | 'monthly_recap'
  | 'gullak_reward'
  | 'pure_deficit_balanced'
  | 'general';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string; // ISO string
  read: boolean;
  data?: {
    date?: string;
    amount?: number;
    remaining?: number;
    screen?: string;
    [key: string]: any;
  };
}

interface NotificationState {
  ownerUserId: string | null;
  notifications: AppNotification[];
  setOwnerUserId: (userId: string | null) => void;
  addNotification: (
    notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string; createdAt?: string }
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      notifications: [],

      setOwnerUserId: (userId: string | null) => {
        if (userId && get().ownerUserId && get().ownerUserId !== userId) {
          set({ notifications: [], ownerUserId: userId });
        } else {
          set({ ownerUserId: userId });
        }
      },

      addNotification: (notif) => {
        const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newNotif: AppNotification = {
          ...notif,
          id,
          createdAt: notif.createdAt || new Date().toISOString(),
          read: false,
        };

        // Don't add duplicate notifications if same id already exists
        const current = get().notifications;
        if (current.some((n) => n.id === id)) return;

        // Keep most recent 50 notifications
        set({ notifications: [newNotif, ...current].slice(0, 50) });
      },

      markAsRead: (id: string) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      removeNotification: (id: string) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },
    }),
    {
      name: 'arthik-notifications-storage-v2',
      storage: createBatchedPersistStorage<NotificationState>(),
    }
  )
);

registerStoreResetCallback(() => {
  useNotificationStore.getState().clearNotifications();
  useNotificationStore.setState({ ownerUserId: null });
  removeBatchedItem('arthik-notifications-storage-v2').catch(() => {});
});


