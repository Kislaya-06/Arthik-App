import { describe, it, expect } from 'vitest';
import { groupNotificationsByDate } from '../src/lib/notificationGroups';

// Friday 20 Nov 2026, 10:00 local (week Mon 16 – Sun 22)
const NOW = new Date(2026, 10, 20, 10, 0, 0);
const n = (id: string, y: number, m: number, d: number, h = 9) => ({
  id,
  createdAt: new Date(y, m, d, h, 0, 0).toISOString(),
});

describe('groupNotificationsByDate (Notifications screen sections)', () => {
  it('today, yesterday, this week, this month, then month names; newest-first order kept', () => {
    const list = [
      n('a', 2026, 10, 20, 8),
      n('b', 2026, 10, 19),
      n('c', 2026, 10, 17),
      n('d', 2026, 10, 16, 0),
      n('e', 2026, 10, 15),
      n('f', 2026, 10, 2),
      n('g', 2026, 9, 27),
      n('h', 2026, 9, 1),
      n('i', 2025, 11, 31),
    ];
    const groups = groupNotificationsByDate(list, NOW);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['TODAY', ['a']],
      ['YESTERDAY', ['b']],
      ['THIS WEEK', ['c', 'd']],
      ['THIS MONTH', ['e', 'f']],
      ['OCTOBER', ['g', 'h']],
      ['DECEMBER 2025', ['i']],
    ]);
  });

  it('on a Monday "this week" has nothing older than yesterday, so last week falls into this month', () => {
    const monday = new Date(2026, 10, 16, 10, 0, 0);
    const groups = groupNotificationsByDate([n('y', 2026, 10, 15), n('x', 2026, 10, 14)], monday);
    expect(groups.map((g) => g.label)).toEqual(['YESTERDAY', 'THIS MONTH']);
    expect(groups.find((g) => g.items.some((i) => i.id === 'y'))!.label).toBe('YESTERDAY');
    expect(groups.find((g) => g.items.some((i) => i.id === 'x'))!.label).toBe('THIS MONTH');
  });

  it('a bad date never crashes the screen (goes to the oldest group)', () => {
    const groups = groupNotificationsByDate([n('a', 2026, 10, 20), { id: 'bad', createdAt: 'not a date' }], NOW);
    expect(groups.map((g) => g.label)).toEqual(['TODAY', 'EARLIER']);
  });

  it('empty list → no groups', () => {
    expect(groupNotificationsByDate([], NOW)).toEqual([]);
  });
});
