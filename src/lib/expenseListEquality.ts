import type { Expense } from '../store/expense/types';

/**
 * True when both lists have the same expenses in the same order with the same field values.
 * Used so a refresh that brings back identical data keeps the SAME array (no wasted re-renders).
 */
export function sameExpenseList(a: readonly Expense[], b: readonly Expense[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as unknown as Record<string, unknown>;
    const y = b[i] as unknown as Record<string, unknown>;
    if (x === y) continue;
    const kx = Object.keys(x);
    const ky = Object.keys(y);
    if (kx.length !== ky.length) return false;
    for (const k of kx) {
      if (!(k in y)) return false;
      const vx = x[k];
      const vy = y[k];
      if (vx === vy) continue;
      if (vx && vy && typeof vx === 'object' && typeof vy === 'object') {
        // Nested values such as split_allocations
        if (JSON.stringify(vx) !== JSON.stringify(vy)) return false;
        continue;
      }
      return false;
    }
  }
  return true;
}
