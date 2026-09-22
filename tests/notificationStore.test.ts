import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AsyncStorage
const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(async () => {
      storageMap.clear();
    }),
  },
}));

// Mock AuthStore
vi.mock('../src/store/authStore', () => ({
  registerStoreResetCallback: vi.fn(),
}));

import { useNotificationStore } from '../src/store/notificationStore';

describe('notificationStore (Seam: useNotificationStore)', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    useNotificationStore.getState().clearNotifications();
    useNotificationStore.setState({ ownerUserId: null });
  });

  describe('Slice 1: Adding Notifications & Deduplication', () => {
    it('adds notification with read=false and default timestamp', () => {
      useNotificationStore.getState().addNotification({
        id: 'notif_1',
        title: 'Budget Alert',
        message: '80% reached',
        type: 'budget_warning',
      });

      const list = useNotificationStore.getState().notifications;
      expect(list.length).toBe(1);
      expect(list[0]).toMatchObject({
        id: 'notif_1',
        title: 'Budget Alert',
        message: '80% reached',
        type: 'budget_warning',
        read: false,
      });
      expect(list[0].createdAt).toBeDefined();
    });

    it('ignores duplicate notifications with identical id', () => {
      const notif = {
        id: 'duplicate_alert_today',
        title: 'Warning',
        message: 'Over budget',
        type: 'budget_exceeded' as const,
      };

      useNotificationStore.getState().addNotification(notif);
      useNotificationStore.getState().addNotification(notif);

      expect(useNotificationStore.getState().notifications.length).toBe(1);
    });

    it('caps notifications to the most recent 50 items', () => {
      for (let i = 1; i <= 60; i++) {
        useNotificationStore.getState().addNotification({
          id: `notif_${i}`,
          title: `Alert ${i}`,
          message: `Message ${i}`,
          type: 'general',
        });
      }

      const list = useNotificationStore.getState().notifications;
      expect(list.length).toBe(50);
      expect(list[0].id).toBe('notif_60'); // Most recent first
    });
  });

  describe('Slice 2: Read Status & Unread Count', () => {
    it('marks individual notification as read', () => {
      useNotificationStore.getState().addNotification({
        id: 'notif_read_1',
        title: 'Title',
        message: 'Msg',
        type: 'general',
      });
      expect(useNotificationStore.getState().getUnreadCount()).toBe(1);

      useNotificationStore.getState().markAsRead('notif_read_1');

      expect(useNotificationStore.getState().notifications[0].read).toBe(true);
      expect(useNotificationStore.getState().getUnreadCount()).toBe(0);
    });

    it('marks all notifications as read', () => {
      useNotificationStore.getState().addNotification({ id: 'n1', title: 'T1', message: 'M1', type: 'general' });
      useNotificationStore.getState().addNotification({ id: 'n2', title: 'T2', message: 'M2', type: 'general' });
      expect(useNotificationStore.getState().getUnreadCount()).toBe(2);

      useNotificationStore.getState().markAllAsRead();

      expect(useNotificationStore.getState().getUnreadCount()).toBe(0);
      expect(useNotificationStore.getState().notifications.every((n) => n.read)).toBe(true);
    });
  });

  describe('Slice 3: Multi-User Isolation & Clear', () => {
    it('wipes notifications when switching to a different user account', () => {
      useNotificationStore.getState().setOwnerUserId('user_alice');
      useNotificationStore.getState().addNotification({ id: 'alice_notif', title: 'T', message: 'M', type: 'general' });

      expect(useNotificationStore.getState().notifications.length).toBe(1);

      // Switch to Bob: notifications must be purged!
      useNotificationStore.getState().setOwnerUserId('user_bob');

      expect(useNotificationStore.getState().ownerUserId).toBe('user_bob');
      expect(useNotificationStore.getState().notifications.length).toBe(0);
    });

    it('clears all notifications via clearNotifications', () => {
      useNotificationStore.getState().addNotification({ id: 'n1', title: 'T', message: 'M', type: 'general' });
      useNotificationStore.getState().clearNotifications();
      expect(useNotificationStore.getState().notifications.length).toBe(0);
    });
  });
});
