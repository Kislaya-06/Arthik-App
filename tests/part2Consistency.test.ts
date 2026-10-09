import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { identityScore, decideIdentity, STRONG_SCORE } from '../src/features/autoLog/matching';
import { calculatePeriodSummary, calculateExpenseTotals } from '../src/lib/homeCalculations';
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
  const reimb: any = { amount: 25, type: 'income', expense_date: '2026-10-06', transaction_class: 'reimbursement' };
  const transfer: any = { amount: 5000, type: 'income', expense_date: '2026-10-06', transaction_class: 'self_transfer' };
  const salary: any = { amount: 1000, type: 'income', expense_date: '2026-10-06' };

  it('daily: ₹100 budget + ₹25 reimbursement is not income; remaining and Gullak agree', () => {
    const totals = calculateExpenseTotals([reimb, transfer], {});
    expect(totals.totalIncome).toBe(0);
    const fin = calculateCycleFinancials({ scheduledBudget: 100, eligibleReimbursements: totals.totalReimbursements, spent: 40 });
    const day = evaluateDayStatus(100, 40, 0, undefined, totals.totalReimbursements);
    expect(fin.remaining).toBe(85);
    expect(day.saved).toBe(fin.gullakDeposit); // Gullak == Remaining
    expect(fin.gullakDeposit).toBe(fin.remaining);
  });
  it('weekly/monthly period summary uses the same engine', () => {
    const changes: any = [{ id: 'p', userId: 'u', effectiveFrom: '2026-09-01', isEnabled: true, cadence: 'weekly', amount: 700 }];
    const sum = getCurrentPeriodSummary(changes, { '2026-10-06': 100 }, '2026-10-06', { '2026-10-06': 0 }, { '2026-10-06': 25 });
    const fin = calculateCycleFinancials({ scheduledBudget: 700, eligibleReimbursements: 25, spent: 100 });
    expect(sum?.remaining).toBe(fin.remaining);
  });
  it('self-transfer never inflates spendable money', () => {
    const totals = calculateExpenseTotals([transfer], {});
    expect(calculateCycleFinancials({ scheduledBudget: 100, eligibleIncome: totals.totalIncome, spent: 0 }).spendable).toBe(100);
  });
  it('dashboard: budget first, income below it as supporting info; data unchanged', () => {
    const totals = calculateExpenseTotals([salary], {});
    const s = calculatePeriodSummary({
      activeFilter: 'Daily', dailyBudgetAmount: 100, isAutoRenew: true, todayBudget: 100, dailyRecords: {},
      totalIncome: totals.totalIncome, totalSpent: 0, filtered: [], referenceDate: new Date('2026-10-06T10:00:00'),
    });
    const parts = (s.primarySubtext || '').split(' + ');
    expect(parts[0]).toMatch(/budget|allowance/);
    expect(parts[1]).toMatch(/income/);
    expect(s.periodIncome).toBe(1000);
    const hero = fs.readFileSync('src/components/BrandedHeroCard.tsx', 'utf8');
    expect(hero).toMatch(/subtextContainer: \{[^}]*flexDirection: 'column'/s); // stacked, not side by side
  });
});

describe('Part 2 — login password field is not clipped', () => {
  const src = fs.readFileSync('src/components/ui/AuthFormField.tsx', 'utf8');
  it('uses a min-height container and an explicit line box instead of a fixed 100% height', () => {
    expect(src).toMatch(/minHeight: ControlHeight\.row/);
    expect(src).not.toMatch(/height: '100%',\s*\n\s*includeFontPadding/);
    expect(src).toMatch(/lineHeight: Math\.ceil\(FontSize\.body \* 1\.4\)/);
    expect(src).not.toMatch(/(?:marginTop|top|paddingTop): -\d+/); // no device-specific offsets
  });
  it('keeps the visibility toggle, secure entry and submit handler', () => {
    expect(src).toMatch(/secureTextEntry=\{isPassword && !showPassword\}/);
    expect(src).toMatch(/onToggleShowPassword/);
    expect(src).toMatch(/onSubmitEditing=\{onSubmitEditing\}/);
  });
});
