import { describe, it, expect } from 'vitest';
import { groupNotificationsByDate, stackRepeatedNotifications, notificationTimeLabel } from '../src/lib/notificationGroups';

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

describe('stackRepeatedNotifications: routine Gullak savings fold into one row', () => {
  const r = (id: string, type = 'savings_rollover') => ({ id, type });

  it('folds 3 or more Gullak savings in a row into one stack, in order', () => {
    const out = stackRepeatedNotifications([r('a'), r('b'), r('c'), r('d')]);
    expect(out).toEqual([{ kind: 'stack', key: 'stack-a', items: [r('a'), r('b'), r('c'), r('d')] }]);
  });

  it('leaves one or two in a row as they are', () => {
    const out = stackRepeatedNotifications([r('a'), r('b'), r('x', 'budget_exceeded'), r('c')]);
    expect(out.map((e) => e.kind)).toEqual(['single', 'single', 'single', 'single']);
  });

  it('never folds alerts: a budget alert breaks the run and stays on its own', () => {
    const out = stackRepeatedNotifications([r('a'), r('b'), r('c'), r('x', 'budget_exceeded'), r('d')]);
    expect(out.map((e) => (e.kind === 'stack' ? `stack:${e.items.length}` : e.item.id))).toEqual(['stack:3', 'x', 'd']);
  });

  it('never folds budget alerts even when there are many', () => {
    const out = stackRepeatedNotifications([r('a', 'budget_exceeded'), r('b', 'budget_exceeded'), r('c', 'budget_exceeded')]);
    expect(out.every((e) => e.kind === 'single')).toBe(true);
  });
});

describe('notificationTimeLabel: the time under a date heading never repeats the heading', () => {
  // NOW = Friday 20 Nov 2026, 10:00 local
  const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m, d, h, min, 0).toISOString();

  it('very recent: "Just now", then minutes', () => {
    expect(notificationTimeLabel(at(2026, 10, 20, 9, 59, ), NOW)).toBe('1m ago');
    expect(notificationTimeLabel(new Date(NOW.getTime() - 20_000).toISOString(), NOW)).toBe('Just now');
  });

  it('earlier today and yesterday show the clock time (the heading already says the day)', () => {
    expect(notificationTimeLabel(at(2026, 10, 20, 7, 5), NOW)).toBe('7:05 AM');
    expect(notificationTimeLabel(at(2026, 10, 19, 16, 28), NOW)).toBe('4:28 PM');
  });

  it('earlier this week shows the weekday, older shows the date', () => {
    expect(notificationTimeLabel(at(2026, 10, 17, 9), NOW)).toBe('Tue');
    expect(notificationTimeLabel(at(2026, 9, 27, 9), NOW)).toBe('27 Oct');
  });
});
