import { describe, it, expect } from 'vitest';
import { pickQuickCategories } from '../src/lib/quickCategoryPick';

const cats = [
  { id: 'food', name: 'Food' },
  { id: 'travel', name: 'Travel' },
  { id: 'bills', name: 'Bills' },
  { id: 'fun', name: 'Fun' },
  { id: 'salary', name: 'Salary', kind: 'income' },
  { id: 'ph', name: 'Loading', isPlaceholder: true },
];
const exp = (category_id: string | null, date = '2026-10-01', extra: Record<string, unknown> = {}) => ({
  category_id,
  expense_date: date,
  type: 'expense' as const,
  ...extra,
});

describe('quick categories (notification buttons)', () => {
  it('ranks by how often the user picked each category', () => {
    const list = pickQuickCategories(
      [exp('travel'), exp('food'), exp('food'), exp('food'), exp('bills'), exp('bills')],
      cats
    );
    expect(list.map((c) => c.id)).toEqual(['food', 'bills', 'travel']);
  });

  it('breaks ties with the most recently used category', () => {
    const list = pickQuickCategories([exp('food', '2026-09-01'), exp('travel', '2026-10-05')], cats, 2);
    expect(list.map((c) => c.id)).toEqual(['travel', 'food']);
  });

  it('never offers income categories, placeholders or unknown ids', () => {
    const list = pickQuickCategories(
      [exp('salary'), exp('salary'), exp('ph'), exp('ghost'), exp('food')],
      cats
    );
    const ids = list.map((c) => c.id);
    expect(ids).not.toContain('salary');
    expect(ids).not.toContain('ph');
    expect(ids).not.toContain('ghost');
    expect(ids[0]).toBe('food');
  });

  it('ignores income rows, self transfers and money-back rows when counting', () => {
    const list = pickQuickCategories(
      [
        { category_id: 'travel', type: 'income' as const, expense_date: '2026-10-01' },
        exp('travel', '2026-10-01', { transaction_class: 'self_transfer' }),
        exp('travel', '2026-10-01', { transaction_class: 'recovery' }),
        exp('bills'),
      ],
      cats,
      1
    );
    expect(list.map((c) => c.id)).toEqual(['bills']);
  });

  it('fills up to the limit from the category list for a new user', () => {
    expect(pickQuickCategories([], cats).map((c) => c.id)).toEqual(['food', 'travel', 'bills']);
    expect(pickQuickCategories([exp('fun')], cats).map((c) => c.id)).toEqual(['fun', 'food', 'travel']);
  });

  it('returns fewer than the limit when the user has fewer usable categories', () => {
    expect(pickQuickCategories([], [{ id: 'a', name: 'A' }])).toEqual([{ id: 'a', name: 'A' }]);
    expect(pickQuickCategories([], [])).toEqual([]);
  });
});
