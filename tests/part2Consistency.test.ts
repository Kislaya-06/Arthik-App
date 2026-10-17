import { describe, it, expect } from 'vitest';
import { identityScore, decideIdentity, STRONG_SCORE } from '../src/features/autoLog/matching';
import { calculateExpenseTotals } from '../src/lib/homeCalculations';
import { calculateCycleFinancials, evaluateDayStatus } from '../src/lib/budgetCalculations';
import { getCurrentPeriodSummary } from '../src/lib/budgetPeriods';

const t = Date.UTC(2026, 9, 5, 10, 30);
const ev = (o: any) => ({ amount: 20, direction: 'debit' as const, occurredAt: t, ref: null, source: 'email' as const, accountKey: null, merchant: null, ...o });

describe('Part 2 — never merge on amount + direction + time alone', () => {
  it('different sources, same amount/direction/minute, nothing else → weak, not strong', () => {
    const s = identityScore(ev({}), ev({ source: 'sms' }));
    expect(s).not.toBeNull();
    expect(s as number).toBeLessThan(STRONG_SCORE);
    const d = decideIdentity(ev({}), [ev({ source: 'sms' })]);
    expect(d.kind).toBe('weak'); // review, never silent merge
  });
  it('same account or same merchant corroborates', () => {
    expect(identityScore(ev({ accountKey: 'HDFC:1234' }), ev({ source: 'sms', accountKey: 'HDFC:1234' }))).toBeGreaterThanOrEqual(STRONG_SCORE);
    expect(identityScore(ev({ merchant: 'Zomato' }), ev({ source: 'sms', merchant: 'Zomato' }))).toBeGreaterThanOrEqual(STRONG_SCORE);
  });
  it('exact reference still wins, and conflicts still block', () => {
    expect(identityScore(ev({ ref: 'R1' }), ev({ source: 'sms', ref: 'R1', occurredAt: t + 5 * 3600_000 }))).toBe(100);
    expect(identityScore(ev({ accountKey: 'HDFC:1234' }), ev({ source: 'sms', accountKey: 'HDFC:9999' }))).toBeNull();
    expect(identityScore(ev({ direction: 'credit' }), ev({ source: 'sms' }))).toBeNull();
  });
  it('same-source events stay distinct', () => {
    expect(identityScore(ev({}), ev({}))).toBeNull();
  });
});

describe('Part 2 — one financial source of truth', () => {
  const transfer: any = { amount: 5000, type: 'income', expense_date: '2026-10-06', transaction_class: 'self_transfer' };

  it('daily: remaining and Gullak agree, and a self-transfer changes nothing', () => {
    const totals = calculateExpenseTotals([transfer], {});
    expect(totals).toEqual({ totalIncome: 0, totalSpent: 0 });
    const fin = calculateCycleFinancials({ scheduledBudget: 100, spent: 40 });
    const day = evaluateDayStatus(100, 40, 0);
    expect(fin.remaining).toBe(60);
    expect(day.saved).toBe(fin.gullakDeposit); // Gullak == Remaining
    expect(fin.gullakDeposit).toBe(fin.remaining);
  });
  it('weekly/monthly period summary uses the same engine', () => {
    const changes: any = [{ id: 'p', userId: 'u', effectiveFrom: '2026-09-01', isEnabled: true, cadence: 'weekly', amount: 700 }];
    const sum = getCurrentPeriodSummary(changes, { '2026-10-06': 100 }, '2026-10-06', { '2026-10-06': 0 });
    const fin = calculateCycleFinancials({ scheduledBudget: 700, spent: 100 });
    expect(sum?.remaining).toBe(fin.remaining);
  });
});
