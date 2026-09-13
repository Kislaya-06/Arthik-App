import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationType =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'savings_rollover'
  | 'daily_reminder'
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
  notifications: AppNotification[];
  addNotification: (
    notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (notif) => {
        const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newNotif: AppNotification = {
          ...notif,
          id,
          createdAt: new Date().toISOString(),
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

      clearNotifications: () => {
        set({ notifications: [] });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },
    }),
    {
      name: 'arthik-notifications-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
