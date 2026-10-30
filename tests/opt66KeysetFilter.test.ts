import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/config/supabase', () => ({ supabase: {} }));
import { expenseKeysetCursor, expenseKeysetFilter, isMissingFunctionError } from '../src/store/expense/serverSync';

// The exact strings were verified end-to-end against PostgREST 12 + Postgres 16 (2,600 rows, ties, NULLs).
describe('OPT-66 keyset cursor and filter', () => {
  const id = '0571b70e-2507-4aca-9011-d35f5e3046af';

  it('builds the "after this row" filter for a normal row (timestamp quoted)', () => {
    const c = expenseKeysetCursor({ id, expense_date: '2026-10-02', created_at: '2026-10-02T10:00:00.123456+00:00' })!;
    expect(expenseKeysetFilter(c)).toBe(
      'expense_date.lt.2026-10-02,' +
        'and(expense_date.eq.2026-10-02,created_at.lt."2026-10-02T10:00:00.123456+00:00"),' +
        `and(expense_date.eq.2026-10-02,created_at.eq."2026-10-02T10:00:00.123456+00:00",id.lt.${id})`
    );
  });

  it('a NULL created_at row (NULLS FIRST in DESC) continues with the non-NULL rows of the same day', () => {
    const c = expenseKeysetCursor({ id, expense_date: '2026-10-02', created_at: null as any })!;
    expect(c.created_at).toBeNull();
    expect(expenseKeysetFilter(c)).toBe(
      'expense_date.lt.2026-10-02,' +
        'and(expense_date.eq.2026-10-02,created_at.not.is.null),' +
        `and(expense_date.eq.2026-10-02,created_at.is.null,id.lt.${id})`
    );
  });

  it('refuses rows it cannot describe safely (caller then reads by offset)', () => {
    expect(expenseKeysetCursor(undefined)).toBeNull();
    expect(expenseKeysetCursor({ id: 'temp_1', expense_date: '2026-10-02', created_at: null as any })).toBeNull();
    expect(expenseKeysetCursor({ id, expense_date: '2026-10-02T00:00:00', created_at: null as any })).toBeNull();
    expect(expenseKeysetCursor({ id, expense_date: '2026-10-02', created_at: 'x"),id.gt.(' })).toBeNull();
    expect(expenseKeysetCursor({ id: 'a,b', expense_date: '2026-10-02', created_at: null as any })).toBeNull();
  });

  it('recognises "function missing" errors only', () => {
    expect(isMissingFunctionError({ code: 'PGRST202' })).toBe(true);
    expect(isMissingFunctionError({ code: '42883' })).toBe(true);
    expect(isMissingFunctionError({ code: '500' })).toBe(false);
    expect(isMissingFunctionError(null)).toBe(false);
  });
});
