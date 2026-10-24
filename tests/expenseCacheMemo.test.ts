import { describe, it, expect, beforeEach } from 'vitest';
import { isExpenseCacheUnchanged, rememberExpenseCache, forgetExpenseCache } from '../src/lib/expenseCacheMemo';

describe('OPT-20: expense cache memo', () => {
  beforeEach(() => forgetExpenseCache());

  it('knows nothing at first, so the first write always happens', () => {
    expect(isExpenseCacheUnchanged('k1', '[]')).toBe(false);
  });

  it('reports unchanged only for the same key and the same JSON', () => {
    rememberExpenseCache('k1', '[1]');
    expect(isExpenseCacheUnchanged('k1', '[1]')).toBe(true);
    expect(isExpenseCacheUnchanged('k1', '[2]')).toBe(false);
    expect(isExpenseCacheUnchanged('k2', '[1]')).toBe(false);
  });

  it('forgetting one key keeps the others; forgetting all clears everything', () => {
    rememberExpenseCache('k1', 'a');
    rememberExpenseCache('k2', 'b');
    forgetExpenseCache('k1');
    expect(isExpenseCacheUnchanged('k1', 'a')).toBe(false);
    expect(isExpenseCacheUnchanged('k2', 'b')).toBe(true);
    forgetExpenseCache();
    expect(isExpenseCacheUnchanged('k2', 'b')).toBe(false);
  });
});
