/** Year story slides (Yearly tab): built from the year's numbers, empty slides left out. */
import { describe, it, expect } from 'vitest';
import { buildYearStory } from '../src/lib/insights/yearStory';
import type { HabitRow } from '../src/lib/insights/habits';

const spend = (date: string, amount: number, extra: Partial<HabitRow> = {}): HabitRow => ({
  amount, expense_date: date, type: 'expense', transaction_class: 'expense', ...extra,
});
const dayKey = (i: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  return d.toISOString().slice(0, 10);
};

describe('buildYearStory', () => {
  // 40 spending days in 2026: every other day from Jan 1, food 100 each, plus two Zomato visits of 500
  const rows: HabitRow[] = [
    ...Array.from({ length: 40 }, (_, i) => spend(dayKey(i * 2), 100, { category_id: 'food' })),
    spend('2026-03-01', 500, { category_id: 'fun', note: 'Zomato' }),
    spend('2026-03-03', 500, { category_id: 'fun', note: 'Zomato' }),
  ];

  it('builds every slide that has something to say, in order', () => {
    const slides = buildYearStory({
      year: 2026,
      rows,
      todayKey: '2026-04-01',
      inflow: 10000,
      bestWorst: {
        best: { monthKey: '2026-02-01', inflow: 5000, spent: 1400, moneyLeft: 3600 },
        worst: { monthKey: '2026-01-01', inflow: 3000, spent: 1600, moneyLeft: 1400 },
        worstReason: null,
      },
      gullakAdded: 1200,
    })!;
    expect(slides.map((s) => s.kind)).toEqual(['totals', 'topCategory', 'topPlace', 'noSpend', 'bestMonth', 'gullak', 'closing']);
    expect(slides[0]).toEqual({ kind: 'totals', spent: 5000, inflow: 10000, entries: 42 });
    expect(slides[1]).toMatchObject({ kind: 'topCategory', categoryId: 'food', amount: 4000 });
    expect(slides[2]).toEqual({ kind: 'topPlace', name: 'Zomato', total: 1000, count: 2 });
  });

  it('skips empty slides (Pure Mode has no Gullak slide)', () => {
    const slides = buildYearStory({ year: 2026, rows, todayKey: '2026-04-01', inflow: 0, bestWorst: null, gullakAdded: null })!;
    expect(slides.map((s) => s.kind)).toEqual(['totals', 'topCategory', 'topPlace', 'noSpend', 'closing']);
  });

  it('null with fewer than 30 days of data', () => {
    const few = Array.from({ length: 29 }, (_, i) => spend(dayKey(i), 100));
    expect(buildYearStory({ year: 2026, rows: few, todayKey: '2026-04-01', inflow: 0, bestWorst: null, gullakAdded: null })).toBeNull();
  });
});
