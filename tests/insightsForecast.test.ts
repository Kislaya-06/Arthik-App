/**
 * Where you're heading: INS-007 (spending projection), INS-008 (runway), INS-009 (Gullak milestone ETA).
 */
import { describe, it, expect } from 'vitest';
import { computeSpendingProjection, computeRunway, computeGullakEta } from '../src/lib/insights/forecast';
import type { HabitRow } from '../src/lib/insights/habits';

const spend = (date: string, amount: number, extra: Partial<HabitRow> = {}): HabitRow => ({
  amount, expense_date: date, type: 'expense', transaction_class: 'expense', ...extra,
});
const month = { start: '2026-11-01', end: '2026-11-30' };

describe('computeSpendingProjection (INS-007)', () => {
  it('spent so far + daily pace × days left, with the cut needed to land on the budget', () => {
    // 10 days elapsed, ₹200/day → 2000 so far, 20 days left → 6000
    const rows = Array.from({ length: 10 }, (_, i) => spend(`2026-11-${String(i + 1).padStart(2, '0')}`, 200));
    const r = computeSpendingProjection(rows, month, '2026-11-10', 4, 5000)!;
    expect(r).toEqual({
      spentSoFar: 2000, projected: 6000, target: 5000, difference: 1000, dailyCut: 50, daysLeft: 20, majorOutflowCount: 0,
    });
  });

  it('a major one-off expense (≥ 30% of spending) is counted once, not in the pace', () => {
    // rent 7000 + 10 × 100 = 8000 so far; pace 1000 / 10 = 100/day; 20 days left → 10000
    const rows = [spend('2026-11-01', 7000), ...Array.from({ length: 10 }, (_, i) => spend(`2026-11-${String(i + 1).padStart(2, '0')}`, 100))];
    const r = computeSpendingProjection(rows, month, '2026-11-10', 4, null)!;
    expect(r.projected).toBe(10000);
    expect(r.majorOutflowCount).toBe(1);
    expect(r.target).toBeNull();
    expect(r.dailyCut).toBeNull();
  });

  it('under target gives no cut; transfers and money back are not spending', () => {
    const rows = [
      spend('2026-11-02', 400),
      spend('2026-11-02', 9000, { transaction_class: 'self_transfer' }),
      spend('2026-11-03', 9000, { transaction_class: 'recovery' }),
      spend('2026-11-03', 400),
      spend('2026-11-04', 400),
      spend('2026-11-04', 400),
    ];
    const r = computeSpendingProjection(rows, month, '2026-11-04', 4, 99999)!;
    expect(r.spentSoFar).toBe(1600);
    expect(r.dailyCut).toBeNull();
    expect(r.difference).toBeLessThan(0);
  });

  it('hidden on the first days and for any finished period', () => {
    expect(computeSpendingProjection([], month, '2026-11-03', 4, 100)).toBeNull();
    expect(computeSpendingProjection([], { start: '2026-10-01', end: '2026-10-31' }, '2026-11-10', 4, 100)).toBeNull();
    expect(computeSpendingProjection([], { start: '2026-11-23', end: '2026-11-29' }, '2026-11-24', 3, 100)).toBeNull();
    expect(computeSpendingProjection([], { start: '2026-11-23', end: '2026-11-29' }, '2026-11-25', 3, 100)).not.toBeNull();
  });
});

describe('computeRunway (INS-008)', () => {
  const spent: Record<string, number> = {};
  for (let d = 1; d <= 30; d++) spent[`2026-10-${String(d).padStart(2, '0')}`] = 100; // Oct 1-30
  spent['2026-10-31'] = 200;
  spent['2026-11-01'] = 9999; // today: not a finished day

  it('spendable (account − Gullak) ÷ average of the last 30 finished days', () => {
    // last 30 finished days = Oct 2..31 → 29×100 + 200 = 3100 → 103.33/day
    const r = computeRunway(10000, 2000, spent, '2026-11-01', '2026-01-01')!;
    expect(r.spendable).toBe(8000);
    expect(r.gullak).toBe(2000);
    expect(r.dailyAvg).toBe(103.33);
    expect(r.runwayDays).toBe(77);
  });

  it('0 days when nothing spendable is left', () => {
    expect(computeRunway(1000, 1500, spent, '2026-11-01')!.runwayDays).toBe(0);
  });

  it('null before 30 days since sign-up or with no spending', () => {
    expect(computeRunway(10000, 0, spent, '2026-11-01', '2026-10-05')).toBeNull();
    expect(computeRunway(10000, 0, {}, '2026-11-01')).toBeNull();
  });
});

describe('computeGullakEta (INS-009)', () => {
  it('next milestone at the 90-day pace (money in − drawn out)', () => {
    // pace (1000 − 100) / 90 = 10/day; Gullak 4000 → Smart Builder 5000 in 100 days
    expect(computeGullakEta(4000, 1000, 100)).toEqual({
      status: 'growing', milestone: { amount: 5000, name: 'Smart Builder' }, etaDays: 100, tooFar: false, perDay: 10,
    });
  });

  it('far away, not growing, all reached', () => {
    expect(computeGullakEta(60000, 90, 0)).toMatchObject({ status: 'growing', tooFar: true });
    expect(computeGullakEta(500, 100, 300)).toEqual({ status: 'notGrowing' });
    expect(computeGullakEta(100000, 9000, 0)).toEqual({ status: 'allReached' });
  });
});
