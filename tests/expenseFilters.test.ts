import { describe, it, expect } from 'vitest';
import { filterExpenses } from '../src/lib/expenseFilters';
import { Expense } from '../src/store/expenseStore';

describe('filterExpenses - Pure Expense Filter', () => {
  // Reference date: Friday, 18 September 2026
  // Week: Monday 2026-09-14 through Sunday 2026-09-20
  // Month: 2026-09-01 through 2026-09-30
  const REF_DATE = new Date(2026, 8, 18, 14, 0, 0);

  const mockExpenses: Expense[] = [
    { id: '1', user_id: 'u1', amount: 100, category_id: 'cat1', expense_date: '2026-09-18', payment_mode: 'upi', created_at: '' },
    { id: '2', user_id: 'u1', amount: 200, category_id: 'cat1', expense_date: '2026-09-18T15:30:00.000Z', payment_mode: 'upi', created_at: '' },
    { id: '3', user_id: 'u1', amount: 300, category_id: 'cat1', expense_date: '2026-09-16', payment_mode: 'cash', created_at: '' },
    { id: '4', user_id: 'u1', amount: 400, category_id: 'cat1', expense_date: '2026-09-14', payment_mode: 'card', created_at: '' },
    { id: '5', user_id: 'u1', amount: 500, category_id: 'cat1', expense_date: '2026-09-13', payment_mode: 'upi', created_at: '' }, // Prev Sunday
    { id: '6', user_id: 'u1', amount: 600, category_id: 'cat1', expense_date: '2026-09-01', payment_mode: 'upi', created_at: '' }, // 1st of month
    { id: '7', user_id: 'u1', amount: 700, category_id: 'cat1', expense_date: '2026-08-31', payment_mode: 'upi', created_at: '' }, // Prev month
  ];

  describe('Daily case', () => {
    it('returns only expenses for the reference day, matching both yyyy-MM-dd and ISO timestamps', () => {
      const result = filterExpenses(mockExpenses, 'Daily', REF_DATE);
      expect(result.map((e) => e.id)).toEqual(['1', '2']);
    });

    it('returns empty array if no expenses match today', () => {
      const pastRef = new Date(2026, 8, 25, 12, 0, 0);
      const result = filterExpenses(mockExpenses, 'Daily', pastRef);
      expect(result).toEqual([]);
    });
  });

  describe('Registration boundary', () => {
    const USER_CREATED = '2026-09-16'; // Registered on Wednesday

    it('excludes expenses on dates strictly before registration date', () => {
      // Weekly would normally include Monday 14 and Wednesday 16 and Friday 18.
      // But Monday 14 is before user created date (2026-09-16).
      const result = filterExpenses(mockExpenses, 'Weekly', REF_DATE, USER_CREATED);
      const ids = result.map((e) => e.id);

      expect(ids).toContain('1'); // Sept 18
      expect(ids).toContain('2'); // Sept 18 (ISO)
      expect(ids).toContain('3'); // Sept 16
      expect(ids).not.toContain('4'); // Sept 14 (pre-registration!)
      expect(ids).not.toContain('5'); // Sept 13 (pre-registration!)
    });
  });

  describe('ISO timestamp handling', () => {
    it('correctly extracts and matches date part from ISO string with T', () => {
      const isoExpense: Expense = {
        id: 'iso-1',
        user_id: 'u1',
        amount: 250,
        category_id: 'cat1',
        expense_date: '2026-09-18T23:59:59.999Z',
        payment_mode: 'upi',
        created_at: '',
      };

      const result = filterExpenses([isoExpense], 'Daily', REF_DATE);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('iso-1');
    });
  });

  describe('All-filter path', () => {
    it('returns all expenses when userCreatedAtStr is undefined', () => {
      const result = filterExpenses(mockExpenses, 'All', REF_DATE, undefined);
      expect(result).toHaveLength(mockExpenses.length);
    });

    it('filters out pre-registration expenses when userCreatedAtStr is provided', () => {
      const USER_CREATED = '2026-09-14';
      const result = filterExpenses(mockExpenses, 'All', REF_DATE, USER_CREATED);
      const ids = result.map((e) => e.id);

      // Sept 18 (1, 2), Sept 16 (3), Sept 14 (4) are included
      expect(ids).toContain('1');
      expect(ids).toContain('2');
      expect(ids).toContain('3');
      expect(ids).toContain('4');
      // Sept 13 (5), Aug 31 (7) are excluded
      expect(ids).not.toContain('5');
      expect(ids).not.toContain('7');
    });

    it('preserves dateless expenses in All filter when userCreatedAtStr is set', () => {
      const datelessExpense: Expense = {
        id: 'no-date',
        user_id: 'u1',
        amount: 50,
        category_id: 'cat1',
        expense_date: '',
        payment_mode: 'cash',
        created_at: '',
      };

      const result = filterExpenses([datelessExpense], 'All', REF_DATE, '2026-09-14');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('no-date');
    });
  });

  describe('Weekly and Monthly filters', () => {
    it('Weekly includes Monday through Sunday of reference week', () => {
      const result = filterExpenses(mockExpenses, 'Weekly', REF_DATE);
      const ids = result.map((e) => e.id);

      expect(ids).toContain('1'); // Sept 18
      expect(ids).toContain('2'); // Sept 18
      expect(ids).toContain('3'); // Sept 16
      expect(ids).toContain('4'); // Sept 14 (Monday)
      expect(ids).not.toContain('5'); // Sept 13 (prev Sunday)
      expect(ids).not.toContain('7'); // Aug 31
    });

    it('Monthly includes all expenses in September 2026', () => {
      const result = filterExpenses(mockExpenses, 'Monthly', REF_DATE);
      const ids = result.map((e) => e.id);

      expect(ids).toContain('1');
      expect(ids).toContain('2');
      expect(ids).toContain('3');
      expect(ids).toContain('4');
      expect(ids).toContain('5');
      expect(ids).toContain('6'); // Sept 01
      expect(ids).not.toContain('7'); // Aug 31
    });
  });
});
