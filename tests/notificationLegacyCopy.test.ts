import { describe, it, expect, vi } from 'vitest';

// Same mocks as tests/budgetAlerts.test.ts (the notification store needs AsyncStorage and the auth reset hook).
const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => storage.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void storage.set(k, v)),
    removeItem: vi.fn(async (k: string) => void storage.delete(k)),
  },
}));
vi.mock('../src/store/authStore', () => ({ registerStoreResetCallback: vi.fn() }));
import { fixLegacyZeroOverCopy, limitCopy } from '../src/lib/notificationPolicy';

const base = { id: 'alert_exceeded_2026-10-18', type: 'budget_exceeded', createdAt: '2026-10-18T10:00:00.000Z', read: true } as const;

describe('fixLegacyZeroOverCopy (saved "₹0 over" alerts get the new "used up" wording, NOT-001)', () => {
  it('daily: rewritten exactly like a new alert', () => {
    const old = { ...base, title: "Over today's limit", message: "₹250 spent of ₹250 — ₹0 over. Today won't add to your Gullak." };
    const fixed = fixLegacyZeroOverCopy(old);
    const fresh = limitCopy({ kind: 'exceeded', cadence: 'daily', spent: 250, budget: 250, remaining: 0 });
    expect(fixed.title).toBe(fresh.title);
    expect(fixed.message).toBe(fresh.body);
    // everything else is kept (id, read state, date)
    expect({ ...fixed, title: old.title, message: old.message }).toEqual(old);
  });

  it('weekly / monthly with Indian grouping and paise', () => {
    const w = fixLegacyZeroOverCopy({ ...base, title: "Over this week's budget", message: '₹7,000 of ₹7,000 — ₹0 over.' });
    expect(w).toMatchObject(
      (({ title, body }) => ({ title, message: body }))(limitCopy({ kind: 'exceeded', cadence: 'weekly', spent: 7000, budget: 7000, remaining: 0 }))
    );
    const m = fixLegacyZeroOverCopy({ ...base, title: "Over this month's budget", message: '₹30,000.50 of ₹30,000.50 — ₹0 over.' });
    expect(m.title).toBe("This month's budget is used up");
    expect(m.message).toBe('₹30,000.50 spent of ₹30,000.50. Nothing left for your Gullak this month.');
  });

  it('store migration rewrites only the old alerts and keeps the rest of the saved state', async () => {
    const { migrateNotificationState } = await import('../src/store/notificationStore');
    const zero = { ...base, title: "Over today's limit", message: "₹250 spent of ₹250 — ₹0 over. Today won't add to your Gullak." };
    const other = { ...base, id: 'x', type: 'savings_rollover', title: '₹250 added to your Gullak', message: "From yesterday's unspent allowance." };
    const out = migrateNotificationState({ ownerUserId: 'u1', notifications: [zero, other] });
    expect(out.ownerUserId).toBe('u1');
    expect(out.notifications[0].title).toBe("Today's budget is used up");
    expect(out.notifications[1]).toBe(other);
    expect(migrateNotificationState(undefined)).toBeUndefined();
  });

  it('real overspends and every other notification stay untouched (same object)', () => {
    const real = { ...base, title: "Over today's limit", message: "₹1,100 spent of ₹450 — ₹650 over. Today won't add to your Gullak." };
    expect(fixLegacyZeroOverCopy(real)).toBe(real);
    const other = { ...base, type: 'savings_rollover', title: '₹250 added to your Gullak', message: "From yesterday's unspent allowance." } as any;
    expect(fixLegacyZeroOverCopy(other)).toBe(other);
  });
});
