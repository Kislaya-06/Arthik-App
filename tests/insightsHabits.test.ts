/**
 * Insights habits (owner decisions 2026-11-25, CONTEXT.md "11. Insights Language"):
 * no-spend days, small leaks, category vs own average, time of day, top places.
 */
import { describe, it, expect } from 'vitest';
import {
  computeNoSpendDays,
  computeSmallLeaks,
  computeCategoryVsAverage,
  computeTimeOfDay,
  computeTopPlaces,
  formatRise,
  dayPartOf,
  HabitRow,
} from '../src/lib/insights/habits';

const spend = (date: string, amount: number, extra: Partial<HabitRow> = {}): HabitRow => ({
  amount,
  expense_date: date,
  type: 'expense',
  transaction_class: 'expense',
  ...extra,
});

describe('computeNoSpendDays', () => {
  const range = { start: '2026-11-01', end: '2026-11-30' };

  it('counts finished days with no spending, never today', () => {
    const r = computeNoSpendDays({ '2026-11-02': 100, '2026-11-04': 50 }, range, '2026-11-06');
    // finished days: 1..5 → spent on 2 and 4 → no-spend 1, 3, 5
    expect(r).toEqual({ count: 3, daysCounted: 5, longest: { length: 1, start: '2026-11-01', end: '2026-11-01' } });
  });

  it('skips days before sign-up and finds the longest run', () => {
    const r = computeNoSpendDays({ '2026-11-12': 100 }, range, '2026-11-16', '2026-11-08');
    // 8..15: spent on 12 → runs 8-11 (4) and 13-15 (3)
    expect(r?.count).toBe(7);
    expect(r?.daysCounted).toBe(8);
    expect(r?.longest).toEqual({ length: 4, start: '2026-11-08', end: '2026-11-11' });
  });

  it('null when no finished day is in range (first day of the month)', () => {
    expect(computeNoSpendDays({}, range, '2026-11-01')).toBeNull();
  });

  it('a past range is counted whole', () => {
    expect(computeNoSpendDays({}, { start: '2026-10-01', end: '2026-10-31' }, '2026-11-20')?.count).toBe(31);
  });
});

describe('computeSmallLeaks', () => {
  const range = { start: '2026-11-01', end: '2026-11-30' };

  it('null with fewer than 5 small expenses', () => {
    const rows = [1, 2, 3, 4].map((d) => spend(`2026-11-0${d}`, 50));
    expect(computeSmallLeaks(rows, range)).toBeNull();
  });

  it('sums expenses under ₹200; transfers, money back and income never count', () => {
    const rows: HabitRow[] = [
      ...[1, 2, 3, 4, 5].map((d) => spend(`2026-11-0${d}`, 60, { category_id: 'tea' })),
      spend('2026-11-06', 150, { category_id: 'snacks' }),
      spend('2026-11-07', 200, { category_id: 'food' }), // not under 200
      spend('2026-11-08', 50, { transaction_class: 'self_transfer' }),
      spend('2026-11-08', 50, { transaction_class: 'recovery' }),
      { amount: 50, expense_date: '2026-11-08', type: 'income' },
      spend('2026-10-31', 50), // outside
    ];
    const r = computeSmallLeaks(rows, range)!;
    expect(r.count).toBe(6);
    expect(r.total).toBe(450);
    expect(r.shareOfSpending).toBeCloseTo(450 / 650);
    expect(r.topCategoryId).toBe('tea');
  });
});

describe('computeCategoryVsAverage', () => {
  const cur = { start: '2026-11-01', end: '2026-11-30' };
  const base = [
    { start: '2026-08-01', end: '2026-08-31' },
    { start: '2026-09-01', end: '2026-09-30' },
    { start: '2026-10-01', end: '2026-10-31' },
  ];

  it('flags categories at 1.5x or 0.5x of their own average, strongest first', () => {
    const rows = [
      // food: avg 1000, now 2000 → 2x
      spend('2026-08-10', 1000, { category_id: 'food' }),
      spend('2026-09-10', 1000, { category_id: 'food' }),
      spend('2026-10-10', 1000, { category_id: 'food' }),
      spend('2026-11-10', 2000, { category_id: 'food' }),
      // travel: avg 1200, now 300 → 0.25x (stronger)
      spend('2026-08-10', 1200, { category_id: 'travel' }),
      spend('2026-09-10', 1200, { category_id: 'travel' }),
      spend('2026-10-10', 1200, { category_id: 'travel' }),
      spend('2026-11-10', 300, { category_id: 'travel' }),
      // bills: avg 1000, now 1100 → normal
      ...['08', '09', '10'].map((m) => spend(`2026-${m}-05`, 1000, { category_id: 'bills' })),
      spend('2026-11-05', 1100, { category_id: 'bills' }),
    ];
    const r = computeCategoryVsAverage(rows, cur, base);
    expect(r.map((s) => s.categoryId)).toEqual(['travel', 'food']);
    expect(r[1]).toMatchObject({ current: 2000, average: 1000, ratio: 2 });
  });

  it('skips small amounts and categories seen in fewer than 2 base periods', () => {
    const rows = [
      // tiny: avg 100 now 400 (4x) but under ₹500
      ...['08', '09', '10'].map((m) => spend(`2026-${m}-05`, 100, { category_id: 'tiny' })),
      spend('2026-11-05', 400, { category_id: 'tiny' }),
      // once: only in one base month
      spend('2026-10-05', 3000, { category_id: 'once' }),
      spend('2026-11-05', 9000, { category_id: 'once' }),
    ];
    expect(computeCategoryVsAverage(rows, cur, base)).toEqual([]);
  });

  it('at most 3 rows', () => {
    const rows = ['a', 'b', 'c', 'd'].flatMap((id) => [
      ...['08', '09', '10'].map((m) => spend(`2026-${m}-05`, 1000, { category_id: id })),
      spend('2026-11-05', 3000, { category_id: id }),
    ]);
    expect(computeCategoryVsAverage(rows, cur, base)).toHaveLength(3);
  });
});

describe('computeTimeOfDay', () => {
  const range = { start: '2026-11-01', end: '2026-11-30' };

  it('day parts', () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21, 23].map(dayPartOf)).toEqual([
      'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ]);
  });

  it('uses only entries logged on the day they happened', () => {
    const rows = [
      spend('2026-11-02', 100, { created_at: '2026-11-02T09:00:00' }),
      spend('2026-11-03', 100, { created_at: '2026-11-03T13:00:00' }),
      spend('2026-11-04', 300, { created_at: '2026-11-04T22:00:00' }),
      spend('2026-11-05', 200, { created_at: '2026-11-05T22:30:00' }),
      spend('2026-11-06', 100, { created_at: '2026-11-06T18:00:00' }),
      spend('2026-11-07', 999, { created_at: '2026-11-09T22:00:00' }), // logged later: skipped
      spend('2026-11-08', 999), // no time: skipped
    ];
    const r = computeTimeOfDay(rows, range)!;
    expect(r.amounts).toEqual({ morning: 100, afternoon: 100, evening: 100, night: 500 });
    expect(r.top).toBe('night');
    expect(r.topShare).toBeCloseTo(500 / 800);
    expect(r.usedEntries).toBe(5);
    expect(r.totalEntries).toBe(7);
  });

  it('null with fewer than 5 usable entries', () => {
    const rows = [1, 2, 3, 4].map((d) => spend(`2026-11-0${d}`, 100, { created_at: `2026-11-0${d}T10:00:00` }));
    expect(computeTimeOfDay(rows, range)).toBeNull();
  });
});

describe('computeTopPlaces', () => {
  const range = { start: '2026-11-01', end: '2026-11-30' };

  it('groups notes like merchant names, newest spelling wins, rows without a note skipped', () => {
    const rows = [
      spend('2026-11-01', 200, { note: 'Zomato' }),
      spend('2026-11-05', 300, { note: 'zomato.payu' }),
      spend('2026-11-03', 400, { note: 'Big Bazaar' }),
      spend('2026-11-04', 50, { note: 'Chai' }),
      spend('2026-11-04', 50, { note: 'chai' }),
      spend('2026-11-04', 5000), // no note
      spend('2026-11-04', 999, { note: 'Rent', transaction_class: 'self_transfer' }),
    ];
    expect(computeTopPlaces(rows, range)).toEqual([
      { name: 'zomato.payu', total: 500, count: 2 },
      { name: 'chai', total: 100, count: 2 },
    ]);
  });

  it('a one-time buy is not a place; places rank by visits, then money', () => {
    const rows = [
      spend('2026-11-01', 3500, { note: 'Wildcraft bag' }),
      spend('2026-11-02', 60, { note: 'Chai' }),
      spend('2026-11-03', 60, { note: 'Chai' }),
      spend('2026-11-04', 60, { note: 'Chai' }),
      spend('2026-11-05', 500, { note: 'Swiggy' }),
      spend('2026-11-06', 500, { note: 'Swiggy' }),
    ];
    expect(computeTopPlaces(rows, range)).toEqual([
      { name: 'Chai', total: 180, count: 3 },
      { name: 'Swiggy', total: 1000, count: 2 },
    ]);
  });
});

describe('formatRise', () => {
  it('reads as "x times" from 2x up, as a percent below', () => {
    expect(formatRise(4.03)).toBe('4x');
    expect(formatRise(2.46)).toBe('2.5x');
    expect(formatRise(2)).toBe('2x');
    expect(formatRise(1.5)).toBe('+50%');
  });
});
