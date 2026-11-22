import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Appearance: { getColorScheme: vi.fn(() => 'light'), addChangeListener: vi.fn() },
}));
vi.mock('lucide-react-native', () => ({}));
vi.mock('expo-notifications', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
}));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => '20000000-0000-4000-8000-000000000001') }));
vi.mock('../src/config/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), upsert: vi.fn().mockResolvedValue({ error: null }) })), auth: { getSession: vi.fn() } },
}));
// A weekly recap of the previous account is still in the tray.
vi.mock('../src/lib/notificationService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/notificationService')>()),
  collectDeliveredForInbox: async (onArchive: (item: any) => void) =>
    onArchive({ id: 'weekly_A', type: 'weekly_recap', title: 'Your week', message: 'You spent ₹4,200 of ₹5,000' }),
}));

import { archiveDeliveredNotifications } from '../src/lib/notificationSync';
import { useNotificationStore } from '../src/store/notificationStore';
import { useAuthStore } from '../src/store/authStore';

describe('notifications across logout (SEC-01)', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], ownerUserId: null } as any);
  });

  it('does not archive tray notifications into the bell while nobody is signed in', async () => {
    useAuthStore.setState({ user: null } as any);
    await archiveDeliveredNotifications();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('still archives delivered recaps for the signed-in user', async () => {
    useAuthStore.setState({ user: { id: 'A' } } as any);
    await archiveDeliveredNotifications();
    expect(useNotificationStore.getState().notifications.map((n) => n.id)).toEqual(['plan_weekly_A']);
  });
});
