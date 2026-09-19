import { describe, it, expect } from 'vitest';
import { getNoteSuggestions } from '../src/lib/noteSuggestions';
import { Expense } from '../src/store/expenseStore';

describe('getNoteSuggestions', () => {
  const mockExpenses: Expense[] = [
    {
      id: '1',
      user_id: 'u1',
      amount: 50,
      category_id: 'cat-travel',
      note: 'College Rapido',
      payment_mode: 'upi',
      expense_date: '2026-09-18',
    },
    {
      id: '2',
      user_id: 'u1',
      amount: 120,
      category_id: 'cat-food',
      note: 'Lunch at Canteen',
      payment_mode: 'upi',
      expense_date: '2026-09-18',
    },
    {
      id: '3',
      user_id: 'u1',
      amount: 50,
      category_id: 'cat-travel',
      note: 'college rapido', // duplicate with different casing
      payment_mode: 'upi',
      expense_date: '2026-09-17',
    },
    {
      id: '4',
      user_id: 'u1',
      amount: 30,
      category_id: 'cat-food',
      note: 'Chai sutta',
      payment_mode: 'cash',
      expense_date: '2026-09-17',
    },
    {
      id: '5',
      user_id: 'u1',
      amount: 500,
      category_id: 'cat-groceries',
      note: 'Blinkit Groceries',
      payment_mode: 'card',
      expense_date: '2026-09-16',
    },
    {
      id: '6',
      user_id: 'u1',
      amount: 45,
      category_id: 'cat-travel',
      note: 'Rapido auto',
      payment_mode: 'upi',
      expense_date: '2026-09-15',
    },
  ];

  it('returns empty array when query is blank or whitespace (0 extra space on initial form load)', () => {
    expect(getNoteSuggestions(mockExpenses, '')).toEqual([]);
    expect(getNoteSuggestions(mockExpenses, '   ')).toEqual([]);
  });

  it('matches prefix case-insensitively (e.g. "col" -> "College Rapido")', () => {
    const suggestions = getNoteSuggestions(mockExpenses, 'col');
    expect(suggestions).toContain('College Rapido');
    expect(suggestions[0]).toBe('College Rapido');
  });

  it('matches substring case-insensitively and prioritizes prefix match', () => {
    const suggestions = getNoteSuggestions(mockExpenses, 'rapido');
    // Both 'College Rapido' and 'Rapido auto' contain 'rapido'
    expect(suggestions).toContain('College Rapido');
    expect(suggestions).toContain('Rapido auto');
    // 'Rapido auto' starts with 'rapido', so it ranks first
    expect(suggestions[0]).toBe('Rapido auto');
  });

  it('deduplicates case-insensitively and preserves canonical capitalization', () => {
    const suggestions = getNoteSuggestions(mockExpenses, 'college');
    const collegeMatches = suggestions.filter((s) => s.toLowerCase() === 'college rapido');
    expect(collegeMatches).toHaveLength(1);
    expect(collegeMatches[0]).toBe('College Rapido');
  });

  it('suppresses exact case-insensitive match when already fully typed', () => {
    const suggestions = getNoteSuggestions(mockExpenses, 'College Rapido');
    expect(suggestions).not.toContain('College Rapido');
  });

  it('boosts suggestions matching the current category', () => {
    // When query is 'c', matches 'College Rapido' (cat-travel) and 'Chai sutta' (cat-food)
    const suggestions = getNoteSuggestions(mockExpenses, 'c', { currentCategoryId: 'cat-food' });
    expect(suggestions[0]).toBe('Chai sutta');
  });

  it('caps results at limit (default 4)', () => {
    const suggestions = getNoteSuggestions(mockExpenses, 'a'); // matches Canteen, Chai, Blinkit, Rapido
    expect(suggestions.length).toBeLessThanOrEqual(4);
  });
});
