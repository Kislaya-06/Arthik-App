import { describe, it, expect, beforeEach, vi } from 'vitest';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => storage.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void storage.set(k, v)),
    removeItem: vi.fn(async (k: string) => void storage.delete(k)),
  },
}));
vi.mock('../src/store/authStore', () => ({ registerStoreResetCallback: vi.fn() }));

const device = vi.hoisted(() => ({ triggerDeviceNotification: vi.fn() }));
vi.mock('../src/lib/notificationService', () => device);

import { notifyBudgetUpdated, notifyLimit, notifyRollover } from '../src/lib/budgetAlerts';
import { budgetUpdatedCopy, limitCopy, rolloverCopy } from '../src/lib/notificationPolicy';
import { useNotificationStore } from '../src/store/notificationStore';

const list = () => useNotificationStore.getState().notifications;

describe('budgetAlerts (notifications caused by the user\'s own actions inside the app)', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    useNotificationStore.getState().clearNotifications();
    useNotificationStore.setState({ ownerUserId: null });
  });

  describe('notifyLimit: "80% used" (warning)', () => {
    const warning = { id: 'w1', date: '2026-10-04', kind: 'warning' as const, cadence: 'daily' as const, spent: 400, budget: 500, remaining: 100 };

    it('goes to the in-app bell with the policy wording', () => {
      notifyLimit(warning);
      const expected = limitCopy(warning);
      expect(list()).toHaveLength(1);
      expect(list()[0]).toMatchObject({
        id: 'w1',
        title: expected.title,
        message: expected.body,
        type: 'budget_warning',
        read: false,
      });
      expect(list()[0].data).toMatchObject({ date: '2026-10-04', amount: 400, remaining: 100, screen: 'Savings' });
    });

    it('is shown on the phone only in the BACKGROUND (the user is already looking at the app)', () => {
      notifyLimit(warning);
      expect(device.triggerDeviceNotification).toHaveBeenCalledTimes(1);
      const [title, body, data, channel] = device.triggerDeviceNotification.mock.calls[0];
      expect(title).toBe(limitCopy(warning).title);
      expect(body).toBe(limitCopy(warning).body);
      expect(data).toMatchObject({ type: 'budget_warning', screen: 'Savings', presentation: 'background' });
      expect(channel).toBe('alerts');
    });
  });

  describe('notifyLimit: "over the limit" (exceeded)', () => {
    const exceeded = { id: 'x1', date: '2026-10-04', kind: 'exceeded' as const, cadence: 'weekly' as const, spent: 7500, budget: 7000, remaining: -500, periodKey: '2026-W40' };

    it('goes to the bell as budget_exceeded and keeps the period key', () => {
      notifyLimit(exceeded);
      expect(list()[0]).toMatchObject({ id: 'x1', type: 'budget_exceeded', title: limitCopy(exceeded).title });
      expect(list()[0].data).toMatchObject({ periodKey: '2026-W40', amount: 7500, remaining: -500 });
    });

    it('is the one moment that shows on the phone even while the app is open ("always")', () => {
      notifyLimit(exceeded);
      const [, , data, channel] = device.triggerDeviceNotification.mock.calls[0];
      expect(data).toMatchObject({ type: 'budget_exceeded', presentation: 'always' });
      expect(channel).toBe('alerts');
    });
  });

  it('the same event id is stored in the bell only once (no duplicates on re-sync)', () => {
    const e = { id: 'dup', date: '2026-10-04', kind: 'warning' as const, cadence: 'daily' as const, spent: 400, budget: 500, remaining: 100 };
    notifyLimit(e);
    notifyLimit(e);
    expect(list()).toHaveLength(1);
  });

  describe('notifyRollover', () => {
    it('adds a savings_rollover entry to the bell and does NOT buzz the phone', () => {
      notifyRollover({ id: 'r1', cadence: 'weekly', amount: 850, date: '2026-10-04', periodId: 'p1' });
      const expected = rolloverCopy('weekly', 850);
      expect(list()[0]).toMatchObject({ id: 'r1', type: 'savings_rollover', title: expected.title, message: expected.body });
      expect(list()[0].data).toMatchObject({ cadence: 'weekly', amount: 850, periodId: 'p1', screen: 'Savings' });
      expect(device.triggerDeviceNotification).not.toHaveBeenCalled();
    });
  });

  describe('notifyBudgetUpdated', () => {
    it('adds a general entry to the bell and does NOT buzz the phone', () => {
      notifyBudgetUpdated('b1', 600, '2026-10-04');
      const expected = budgetUpdatedCopy(600);
      expect(list()[0]).toMatchObject({ id: 'b1', type: 'general', title: expected.title, message: expected.body });
      expect(list()[0].data).toMatchObject({ amount: 600, date: '2026-10-04', screen: 'Savings' });
      expect(device.triggerDeviceNotification).not.toHaveBeenCalled();
    });
  });

  it('every in-app event opens the Savings screen when tapped', () => {
    notifyLimit({ id: 'a', date: 'd', kind: 'warning', cadence: 'daily', spent: 1, budget: 2, remaining: 1 });
    notifyRollover({ id: 'b', cadence: 'daily', amount: 5 });
    notifyBudgetUpdated('c', 5, 'd');
    expect(list().map((n) => (n.data as { screen?: string }).screen)).toEqual(['Savings', 'Savings', 'Savings']);
  });
});
