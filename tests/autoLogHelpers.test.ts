import { describe, it, expect } from 'vitest';
import { merchantKey, legacyMerchantKey, categoryFromHistory } from '../src/features/autoLog/merchants';
import { weekStartOf, weeklyDigestCopy } from '../src/features/autoLog/digest';
import { autostartGuide } from '../src/features/autoLog/autostart';

describe('Merchant names: one key for one merchant', () => {
  it('drops company words, payment gateways and web endings', () => {
    for (const name of ['Zomato', 'ZOMATO LTD', 'Zomato Payu', 'zomato.payu', 'Zomato Private Limited', 'Zomato India Pvt Ltd', 'www.zomato.com']) {
      expect(merchantKey(name)).toBe('zomato');
    }
    expect(merchantKey('Swiggy Instamart')).toBe('swiggyinstamart');
    expect(merchantKey('Amazon Pay India')).toBe('amazonpay');
    expect(merchantKey('Uber India Systems Pvt Ltd')).toBe('ubersystems');
  });

  it('never returns an empty key and keeps the old key for short or generic names', () => {
    expect(merchantKey('Ltd')).toBe('ltd');
    expect(merchantKey('Payu')).toBe('payu');
    expect(merchantKey('')).toBe('');
  });

  it('legacy key is the old lowercase letters-and-digits form', () => {
    expect(legacyMerchantKey('Zomato Ltd')).toBe('zomatoltd');
  });

  it('category from history needs at least 2 agreeing entries of the same type', () => {
    const rows = [
      { note: 'Zomato', category_id: 'food', type: 'expense' },
      { note: 'ZOMATO LTD', category_id: 'food', type: 'expense' },
      { note: 'zomato', category_id: 'fun', type: 'expense' },
      { note: 'Zomato', category_id: 'salary', type: 'income' },
    ];
    expect(categoryFromHistory(rows, 'Zomato Payu', 'expense')).toBe('food');
    expect(categoryFromHistory(rows, 'Zomato', 'income')).toBeNull(); // only one income row
    expect(categoryFromHistory(rows.slice(0, 1), 'Zomato', 'expense')).toBeNull();
    expect(categoryFromHistory(rows, null, 'expense')).toBeNull();
  });

  it('category from history needs a clear majority', () => {
    const rows = [
      { note: 'Amazon', category_id: 'shopping', type: 'expense' },
      { note: 'Amazon', category_id: 'shopping', type: 'expense' },
      { note: 'Amazon', category_id: 'groceries', type: 'expense' },
      { note: 'Amazon', category_id: 'groceries', type: 'expense' },
    ];
    expect(categoryFromHistory(rows, 'Amazon', 'expense')).toBeNull(); // 50/50 → ask
    expect(categoryFromHistory([...rows, { note: 'Amazon', category_id: 'shopping', type: 'expense' }, { note: 'amazon', category_id: 'shopping', type: 'expense' }], 'Amazon', 'expense')).toBe('shopping');
    expect(categoryFromHistory([{ note: 'Amazon', category_id: null, type: 'expense' }, { note: 'Amazon', category_id: null, type: 'expense' }], 'Amazon', 'expense')).toBeNull();
  });
});

describe('Weekly Automatic Logging summary', () => {
  it('weeks start on Monday 00:00 local time (DAT-004)', () => {
    const sunday = new Date(2026, 10, 22, 21, 0).getTime();
    const monday = new Date(2026, 10, 23, 0, 30).getTime();
    expect(new Date(weekStartOf(sunday))).toEqual(new Date(2026, 10, 16, 0, 0, 0, 0));
    expect(new Date(weekStartOf(monday))).toEqual(new Date(2026, 10, 23, 0, 0, 0, 0));
  });

  it('says what was logged and what needs review', () => {
    expect(weeklyDigestCopy({ logged: 18, pending: 2 })).toEqual({
      title: 'Your week with Automatic Logging',
      body: '18 payments logged for you · 2 need your review.',
    });
    expect(weeklyDigestCopy({ logged: 1, pending: 1 })?.body).toBe('1 payment logged for you · 1 needs your review.');
    expect(weeklyDigestCopy({ logged: 5, pending: 0 })?.body).toBe('5 payments logged for you. Nothing to review.');
    expect(weeklyDigestCopy({ logged: 0, pending: 3 })?.body).toBe('3 payments need your review.');
  });

  it('stays quiet on an empty week', () => {
    expect(weeklyDigestCopy({ logged: 0, pending: 0 })).toBeNull();
  });
});

describe('Autostart guide for phone makers', () => {
  it('gives steps for the brands that stop background apps', () => {
    for (const m of ['Xiaomi', 'Redmi', 'POCO', 'OPPO', 'realme', 'OnePlus', 'vivo', 'iQOO', 'samsung', 'HUAWEI', 'HONOR', 'asus']) {
      const g = autostartGuide(m);
      expect(g, m).not.toBeNull();
      expect(g!.steps.length).toBeGreaterThanOrEqual(2);
    }
    expect(autostartGuide('Xiaomi')!.brand).toBe('Xiaomi, Redmi or POCO');
  });

  it('returns null for phones that need nothing extra', () => {
    expect(autostartGuide('Google')).toBeNull();
    expect(autostartGuide('motorola')).toBeNull();
    expect(autostartGuide(undefined)).toBeNull();
    expect(autostartGuide('')).toBeNull();
  });
});
