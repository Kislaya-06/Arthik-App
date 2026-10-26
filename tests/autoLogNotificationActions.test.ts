import { describe, it, expect, vi, beforeEach } from 'vitest';

const getEvent = vi.fn();
const updateEvent = vi.fn(async () => {});
const setTransactionCategory = vi.fn(async () => true);
const notifyCategoryNotSaved = vi.fn(async () => {});
const dismissNotificationAsync = vi.fn(async () => {});

vi.mock('../src/features/autoLog/db', () => ({ getEvent: (...a: unknown[]) => getEvent(...a), updateEvent: (...a: unknown[]) => updateEvent(...(a as [])) }));
vi.mock('../src/features/autoLog/ledger', () => ({ setTransactionCategory: (...a: unknown[]) => setTransactionCategory(...(a as [])) }));
vi.mock('../src/features/autoLog/notify', () => ({
  CATEGORY_ACTION_PREFIX: 'cat:',
  notificationIdFor: (k: string) => `autolog-${k}`,
  notifyCategoryNotSaved: (...a: unknown[]) => notifyCategoryNotSaved(...(a as [])),
}));
vi.mock('expo-notifications', () => ({ dismissNotificationAsync: (...a: unknown[]) => dismissNotificationAsync(...(a as [])) }));
vi.mock('../src/config/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

import { parseCategoryTap, applyCategoryTap, handleCategoryResponse } from '../src/features/autoLog/notificationActions';

const response = (actionIdentifier: string, data: unknown = { type: 'autolog', eventId: 'ev1', expenseId: 'ex1' }) => ({
  actionIdentifier,
  notification: { request: { identifier: 'autolog-ev1', content: { data } } },
});

beforeEach(() => {
  vi.clearAllMocks();
  setTransactionCategory.mockResolvedValue(true);
});

describe('parseCategoryTap', () => {
  it('reads a category button tap', () => {
    expect(parseCategoryTap(response('cat:food'))).toEqual({ categoryId: 'food', eventId: 'ev1', expenseId: 'ex1' });
  });
  it('reads data that arrives as a JSON string', () => {
    const r = response('cat:food', JSON.stringify({ type: 'autolog', eventId: 'ev1', expenseId: 'ex1' }));
    expect(parseCategoryTap(r)?.eventId).toBe('ev1');
  });
  it('ignores a normal tap, other buttons and other notifications', () => {
    expect(parseCategoryTap(response('expo.modules.notifications.actions.DEFAULT'))).toBeNull();
    expect(parseCategoryTap(response('snooze'))).toBeNull();
    expect(parseCategoryTap(response('cat:food', { type: 'log_nudge' }))).toBeNull();
    expect(parseCategoryTap(response('cat:food', { type: 'autolog' }))).toBeNull();
    expect(parseCategoryTap(response('cat:'))).toBeNull();
    expect(parseCategoryTap(null)).toBeNull();
    expect(parseCategoryTap('x')).toBeNull();
  });
});

describe('applyCategoryTap', () => {
  const tap = { categoryId: 'food', eventId: 'ev1', expenseId: 'ex1' };

  it('sets only the category, clears "needs category" and removes the notification', async () => {
    getEvent.mockResolvedValue({ id: 'ev1', expenseId: 'ex1', needsCategory: true });
    expect(await applyCategoryTap(tap)).toBe(true);
    expect(setTransactionCategory).toHaveBeenCalledWith('ex1', 'food');
    expect(updateEvent).toHaveBeenCalledWith('ev1', { needsCategory: false });
    expect(dismissNotificationAsync).toHaveBeenCalledWith('autolog-ev1');
    expect(notifyCategoryNotSaved).not.toHaveBeenCalled();
  });

  it('does nothing to the transaction when it already has a category, but still removes the notification', async () => {
    getEvent.mockResolvedValue({ id: 'ev1', expenseId: 'ex1', needsCategory: false });
    expect(await applyCategoryTap(tap)).toBe(true);
    expect(setTransactionCategory).not.toHaveBeenCalled();
    expect(dismissNotificationAsync).toHaveBeenCalledWith('autolog-ev1');
  });

  it('keeps the event waiting and tells the user when saving fails (for example offline)', async () => {
    getEvent.mockResolvedValue({ id: 'ev1', expenseId: 'ex1', needsCategory: true });
    setTransactionCategory.mockResolvedValue(false);
    expect(await applyCategoryTap(tap)).toBe(false);
    expect(updateEvent).not.toHaveBeenCalled();
    expect(dismissNotificationAsync).not.toHaveBeenCalled();
    expect(notifyCategoryNotSaved).toHaveBeenCalledWith('ev1', 'ex1');
  });

  it('falls back to the expense id in the notification when the event row is gone', async () => {
    getEvent.mockResolvedValue(null);
    expect(await applyCategoryTap(tap)).toBe(true);
    expect(setTransactionCategory).toHaveBeenCalledWith('ex1', 'food');
  });

  it('never throws', async () => {
    getEvent.mockRejectedValue(new Error('db locked'));
    expect(await applyCategoryTap(tap)).toBe(false);
  });
});

describe('handleCategoryResponse', () => {
  it('returns false and does nothing for responses that are not category taps', async () => {
    expect(await handleCategoryResponse(response('default'))).toBe(false);
    expect(setTransactionCategory).not.toHaveBeenCalled();
  });
  it('handles a category tap', async () => {
    getEvent.mockResolvedValue({ id: 'ev1', expenseId: 'ex1', needsCategory: true });
    expect(await handleCategoryResponse(response('cat:food'))).toBe(true);
    expect(setTransactionCategory).toHaveBeenCalledTimes(1);
  });
});
