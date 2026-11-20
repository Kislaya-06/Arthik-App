import { describe, it, expect } from 'vitest';
import { whileVisibleSelector, LastValueRef } from '../src/lib/whileVisibleSelector';

/**
 * Hidden popups (BudgetEditModal, DepositGullakModal on the warm Savings tab) must not re-render or re-run
 * full-history memos on every expense change. The selector returns the last value while hidden, so Zustand sees
 * the same reference and skips the re-render.
 */
type S = { expenses: number[] };

describe('whileVisibleSelector', () => {
  it('visible: follows the live store value', () => {
    const last: LastValueRef<number[]> = { current: null };
    const a = [1];
    const b = [1, 2];
    expect(whileVisibleSelector((s: S) => s.expenses, true, last)({ expenses: a })).toBe(a);
    expect(whileVisibleSelector((s: S) => s.expenses, true, last)({ expenses: b })).toBe(b);
  });

  it('hidden: keeps returning the last value it returned, whatever the store holds now', () => {
    const last: LastValueRef<number[]> = { current: null };
    const shown = [1, 2];
    whileVisibleSelector((s: S) => s.expenses, true, last)({ expenses: shown });
    const hidden = whileVisibleSelector((s: S) => s.expenses, false, last);
    expect(hidden({ expenses: [9] })).toBe(shown);
    expect(hidden({ expenses: [9, 9] })).toBe(shown);
  });

  it('hidden from the very first render: reads the store once (nothing to keep yet), then holds it', () => {
    const last: LastValueRef<number[]> = { current: null };
    const first = [3];
    const hidden = whileVisibleSelector((s: S) => s.expenses, false, last);
    expect(hidden({ expenses: first })).toBe(first);
    expect(hidden({ expenses: [4] })).toBe(first);
  });

  it('opening again returns the fresh value at once', () => {
    const last: LastValueRef<number[]> = { current: null };
    whileVisibleSelector((s: S) => s.expenses, false, last)({ expenses: [1] });
    const fresh = [1, 2, 3];
    expect(whileVisibleSelector((s: S) => s.expenses, true, last)({ expenses: fresh })).toBe(fresh);
  });

  it('is used by the two popups that stay mounted on Savings', async () => {
    const { readFileSync } = await import('fs');
    const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const budget = read('src/components/BudgetEditModal.tsx');
    expect(budget).toContain('useStoreWhileVisible(useExpenseStore, (s) => s.expenses, visible)');
    expect(budget).toContain('useStoreWhileVisible(useDailyBudgetStore, (s) => s.dailyRecords, visible)');
    const deposit = read('src/components/DepositGullakModal.tsx');
    expect(deposit).toContain('useStoreWhileVisible(useExpenseStore, (s) => s.expenses, visible)');
    expect(deposit).toContain('useStoreWhileVisible(useDailyBudgetStore, (s) => s.gullakDeposits, visible)');
  });
});
