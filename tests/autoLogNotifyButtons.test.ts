import { describe, it, expect, vi, beforeEach } from 'vitest';

const scheduled: any[] = [];
const categories: Record<string, any[]> = {};
let saved: { id: string; name: string }[] = [];

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: async () => ({ status: 'granted' }),
  setNotificationChannelAsync: async () => {},
  setNotificationCategoryAsync: async (id: string, actions: any[]) => {
    categories[id] = actions;
  },
  scheduleNotificationAsync: async (req: any) => {
    scheduled.push(req);
  },
}));
vi.mock('../src/config/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } },
}));
vi.mock('../src/lib/quickCategories', () => ({ loadQuickCategories: async () => saved }));
vi.mock('../src/lib/formatters', () => ({ formatCurrency: (n: number) => `₹${n}` }));

import { notifyLogged, notifyPreview } from '../src/features/autoLog/notify';

beforeEach(() => {
  scheduled.length = 0;
  for (const k of Object.keys(categories)) delete categories[k];
  saved = [
    { id: 'food', name: 'Food' },
    { id: 'travel', name: 'Travel' },
    { id: 'bills', name: 'A very long category name' },
  ];
});

describe('Automatic Logging notification: category buttons', () => {
  it('adds one button per top category when an expense was logged without a category', async () => {
    await notifyLogged('ev1', 250, 'Zomato', 'ex1', false, null, true);
    const req = scheduled[0];
    expect(req.identifier).toBe('autolog-ev1');
    expect(req.content.data).toMatchObject({ type: 'autolog', eventId: 'ev1', expenseId: 'ex1', screen: 'ExpenseDetail' });
    const actions = categories[req.content.categoryIdentifier];
    expect(actions.map((a) => a.identifier)).toEqual(['cat:food', 'cat:travel', 'cat:bills']);
    expect(actions.every((a) => a.options.opensAppToForeground === false)).toBe(true);
    expect(actions[2].buttonTitle.length).toBeLessThanOrEqual(16);
    expect(req.content.body).toContain('Choose a category');
  });

  it('uses the same notification category for the same set and a different one for a different set', async () => {
    await notifyLogged('ev1', 10, null, 'ex1', false, null, true);
    await notifyLogged('ev2', 20, null, 'ex2', false, null, true);
    saved = [{ id: 'fun', name: 'Fun' }];
    await notifyLogged('ev3', 30, null, 'ex3', false, null, true);
    expect(scheduled[0].content.categoryIdentifier).toBe(scheduled[1].content.categoryIdentifier);
    expect(scheduled[2].content.categoryIdentifier).not.toBe(scheduled[0].content.categoryIdentifier);
  });

  it('adds no buttons when the category is already known', async () => {
    await notifyLogged('ev1', 250, 'Zomato', 'ex1', false, null, false);
    expect(scheduled[0].content.categoryIdentifier).toBeUndefined();
    expect(scheduled[0].content.body).toContain('Automatically detected');
  });

  it('adds no buttons for income or for a money-back question', async () => {
    await notifyLogged('ev1', 500, 'Raj', 'ex1', true, null, true);
    await notifyLogged('ev2', 500, 'Raj', 'ex2', true, 'Raj owes you ₹500. Is this their payment?', true);
    expect(scheduled[0].content.categoryIdentifier).toBeUndefined();
    expect(scheduled[1].content.categoryIdentifier).toBeUndefined();
  });

  it('keeps the old notification when there are no saved categories yet', async () => {
    saved = [];
    await notifyLogged('ev1', 250, 'Zomato', 'ex1', false, null, true);
    expect(scheduled[0].content.categoryIdentifier).toBeUndefined();
    expect(scheduled[0].content.body).toContain('Automatically detected');
  });

  it('leaves the "payment detected" preview unchanged', async () => {
    await notifyPreview('ev1', 250, 'Zomato');
    expect(scheduled[0].identifier).toBe('autolog-ev1');
    expect(scheduled[0].content.categoryIdentifier).toBeUndefined();
  });
});
