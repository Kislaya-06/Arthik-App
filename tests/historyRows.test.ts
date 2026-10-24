import { describe, it, expect } from 'vitest';
import { buildHistoryRows, buildHeaderRowIndexes } from '../src/lib/historyRows';
import type { HistorySection, HistoryItem } from '../src/lib/historyRows';

const expenseItem = (id: string, date = '2026-10-20'): HistoryItem =>
  ({ kind: 'expense', data: { id } as never, date, created_at: `${date}T10:00:00Z` });
const gullakItem = (id: string, date = '2026-10-20'): HistoryItem =>
  ({ kind: 'gullak', data: { id } as never, date, created_at: `${date}T10:00:00Z` });

const section = (dateStr: string, data: HistoryItem[]): HistorySection => ({
  title: dateStr,
  dateStr,
  totalSpent: 0,
  totalIncome: 0,
  data,
});

const sections: HistorySection[] = [
  section('2026-10-24', [expenseItem('a'), gullakItem('g1'), expenseItem('b')]),
  section('2026-10-23', [expenseItem('c')]),
  section('2026-10-22', [gullakItem('g2'), expenseItem('d')]),
];

describe('OPT-30: buildHistoryRows', () => {
  it('puts one header row before the items of every day, in the same order', () => {
    const rows = buildHistoryRows(sections);
    expect(rows.map((r) => r.type)).toEqual([
      'header', 'expense', 'gullak', 'expense',
      'header', 'expense',
      'header', 'gullak', 'expense',
    ]);
  });

  it('keeps the old item keys (kind-id) and uses a separate header key per day', () => {
    const rows = buildHistoryRows(sections);
    expect(rows.map((r) => r.key)).toEqual([
      'header-2026-10-24', 'expense-a', 'gullak-g1', 'expense-b',
      'header-2026-10-23', 'expense-c',
      'header-2026-10-22', 'gullak-g2', 'expense-d',
    ]);
  });

  it('has unique keys even if an expense and a gullak deposit share an id', () => {
    const rows = buildHistoryRows([section('2026-10-24', [expenseItem('x'), gullakItem('x')])]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('returns no rows for no days (empty state)', () => {
    expect(buildHistoryRows([])).toEqual([]);
  });

  it('a day without items still has its header row', () => {
    const rows = buildHistoryRows([section('2026-10-24', [])]);
    expect(rows.map((r) => r.type)).toEqual(['header']);
  });

  it('header rows carry their whole day so totals can be drawn', () => {
    const rows = buildHistoryRows(sections);
    const header = rows[4];
    expect(header.type).toBe('header');
    if (header.type === 'header') expect(header.section).toBe(sections[1]);
  });

  it('item rows carry the very same item object (no copies)', () => {
    const rows = buildHistoryRows(sections);
    const row = rows[1];
    if (row.type !== 'header') expect(row.item).toBe(sections[0].data[0]);
  });
});

describe('OPT-30: buildHeaderRowIndexes (date jump target)', () => {
  it('gives the row index of each day header', () => {
    expect(buildHeaderRowIndexes(sections)).toEqual([0, 4, 6]);
  });

  it('points at a header row for every day', () => {
    const rows = buildHistoryRows(sections);
    for (const idx of buildHeaderRowIndexes(sections)) expect(rows[idx].type).toBe('header');
  });

  it('is the same inside a paginated prefix (See More window) as in the full list', () => {
    const full = buildHeaderRowIndexes(sections);
    for (let n = 1; n <= sections.length; n++) {
      const prefixRows = buildHistoryRows(sections.slice(0, n));
      for (let k = 0; k < n; k++) {
        expect(prefixRows[full[k]].type).toBe('header');
        const header = prefixRows[full[k]];
        if (header.type === 'header') expect(header.section.dateStr).toBe(sections[k].dateStr);
      }
    }
  });

  it('a day beyond the visible window has no row yet (jump must wait for See More)', () => {
    const full = buildHeaderRowIndexes(sections);
    const visibleRows = buildHistoryRows(sections.slice(0, 1));
    expect(full[2]).toBeGreaterThanOrEqual(visibleRows.length);
  });

  it('is empty for no days', () => {
    expect(buildHeaderRowIndexes([])).toEqual([]);
  });
});
