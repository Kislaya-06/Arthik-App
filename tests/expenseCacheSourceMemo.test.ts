import { describe, it, expect, beforeEach } from 'vitest';
import {
  isExpenseCacheUnchanged,
  isExpenseSourceUnchanged,
  rememberExpenseCache,
  forgetExpenseCache,
} from '../src/lib/expenseCacheMemo';

/**
 * Expense cache write (performance): the confirmed-cache write stringified the WHOLE expense list after every
 * confirmed save just to find out nothing changed. The memo now also remembers the list reference the JSON was
 * made from; the very same list skips the stringify. Any write that does not pass its source (the sync) clears
 * the remembered source, so an old reference can never skip a write that is needed.
 */
const KEY = '@arthik_cached_expenses_u1';

describe('expenseCacheMemo: source-reference skip', () => {
  beforeEach(() => forgetExpenseCache());

  it('nothing remembered → never "unchanged"', () => {
    expect(isExpenseSourceUnchanged(KEY, [])).toBe(false);
  });

  it('the same list reference after a write → unchanged; a new list (even with equal content) → not', () => {
    const list = [{ id: 'a' }];
    rememberExpenseCache(KEY, '[{"id":"a"}]', list);
    expect(isExpenseSourceUnchanged(KEY, list)).toBe(true);
    expect(isExpenseSourceUnchanged(KEY, [{ id: 'a' }])).toBe(false);
  });

  it('a write without a source (the sync) clears the remembered source', () => {
    const list = [{ id: 'a' }];
    rememberExpenseCache(KEY, '[{"id":"a"}]', list);
    rememberExpenseCache(KEY, '[{"id":"a"},{"id":"b"}]');
    expect(isExpenseSourceUnchanged(KEY, list)).toBe(false);
    expect(isExpenseCacheUnchanged(KEY, '[{"id":"a"},{"id":"b"}]')).toBe(true);
  });

  it('forget (one key or all) clears the source too', () => {
    const list = [{ id: 'a' }];
    rememberExpenseCache(KEY, '[]', list);
    forgetExpenseCache(KEY);
    expect(isExpenseSourceUnchanged(KEY, list)).toBe(false);
    rememberExpenseCache(KEY, '[]', list);
    forgetExpenseCache();
    expect(isExpenseSourceUnchanged(KEY, list)).toBe(false);
  });

  it('keys are independent (another user never shares the memory)', () => {
    const list = [{ id: 'a' }];
    rememberExpenseCache(KEY, '[]', list);
    expect(isExpenseSourceUnchanged('@arthik_cached_expenses_u2', list)).toBe(false);
  });

  it('the store checks the source before stringifying and remembers it after the write', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync(new URL('../src/store/expense/saveGuards.ts', import.meta.url), 'utf8');
    const at = src.indexOf('const persistConfirmedCache');
    const body = src.slice(at, src.indexOf('};', at));
    expect(body.indexOf('isExpenseSourceUnchanged(key, list)')).toBeLessThan(body.indexOf('JSON.stringify(confirmed)'));
    expect(body).toContain('rememberExpenseCache(key, json, list);');
  });
});
