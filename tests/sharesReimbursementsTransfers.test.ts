import { describe, it, expect } from 'vitest';
import {
  computeSplit, validateShares, findReimbursementCandidates, reimbursedByShare,
  outstandingOf, normalizeTransferDescriptor, findMatchingTransferRule, needsUserChoice,
  ExpenseShare,
} from '../src/lib/shares';
import {
  isCountedIncome, isCountedExpense, isEligibleIncome, isEligibleReimbursement, isInternalTransfer,
} from '../src/lib/transactionUtils';
import { calculateExpenseTotals, calculatePeriodSummary } from '../src/lib/homeCalculations';
import {
  computeSpentByDate, computeIncomeByDate, computeReimbursementsByDate, calculateCycleFinancials,
  evaluateDayStatus, calculateSavingsMetrics, DailyRecord,
} from '../src/lib/budgetCalculations';
import { makeIncomeClassifier, makeEligibleIncomeClassifier, makeReimbursementClassifier } from '../src/lib/incomeClassifier';

const share = (id: string, expense_id: string, owed: number, label = 'Friend A'): ExpenseShare =>
  ({ id, user_id: 'u', expense_id, friend_label: label, amount_owed: owed });

const exp400: any = { id: 'e1', amount: 400, type: 'expense', expense_date: '2026-10-05' }
const reimb200: any = { id: 'r1', amount: 200, type: 'income', expense_date: '2026-10-06', transaction_class: 'reimbursement', reimburses_share_id: 's1' }
const salary: any = { id: 'i1', amount: 1000, type: 'income', expense_date: '2026-10-06' }
const transferOut: any = { id: 't1', amount: 5000, type: 'expense', expense_date: '2026-10-06', transaction_class: 'self_transfer' }
const transferIn: any = { id: 't2', amount: 5000, type: 'income', expense_date: '2026-10-06', transaction_class: 'self_transfer' }

describe('Part 1 — split expense', () => {
  it('1. ₹400 with Friend A ₹200: original stays 400, personal share 200', () => {
    const s = computeSplit(400, [{ amount: 200 }]);
    expect(s).toEqual({ total: 400, friendsTotal: 200, yourShare: 200 });
    // spend on 5 Oct is still the full ₹400
    expect(computeSpentByDate([exp400], makeIncomeClassifier()).hasOwnProperty('2026-10-05')).toBe(true);
    expect(computeSpentByDate([exp400], makeIncomeClassifier())['2026-10-05']).toBe(400);
  });
  it('2. multiple friends validate and cannot exceed the total', () => {
    expect(validateShares(400, [{ friendLabel: 'A', amount: 100 }, { friendLabel: 'B', amount: 150 }])).toBeNull();
    expect(validateShares(400, [{ friendLabel: 'A', amount: 300 }, { friendLabel: 'B', amount: 150 }])).not.toBeNull();
    expect(validateShares(400, [{ friendLabel: '', amount: 10 }])).not.toBeNull();
    expect(validateShares(400, [{ friendLabel: 'A', amount: 0 }])).not.toBeNull();
    expect(computeSplit(400, [{ amount: 100 }, { amount: 150 }]).yourShare).toBe(150);
  });
});

describe('Part 1 — reimbursement matching', () => {
  const withExp = [{ share: share('s1', 'e1', 200), expenseDate: '2026-10-05', expenseAmount: 400 }];
  it('3. a plausible payment on 6 Oct is offered for the 5 Oct share', () => {
    const c = findReimbursementCandidates(withExp, {}, { amount: 200, date: '2026-10-06' });
    expect(c).toHaveLength(1);
    expect(c[0].exact).toBe(true);
  });
  it('4. no outstanding share → no question', () => {
    expect(findReimbursementCandidates([], {}, { amount: 200, date: '2026-10-06' })).toEqual([]);
    expect(findReimbursementCandidates(withExp, { s1: 200 }, { amount: 200, date: '2026-10-06' })).toEqual([]);
  });
  it('4b. payment before the expense, far later, or above the outstanding amount is not offered', () => {
    expect(findReimbursementCandidates(withExp, {}, { amount: 200, date: '2026-10-04' })).toEqual([]);
    expect(findReimbursementCandidates(withExp, {}, { amount: 200, date: '2027-03-01' })).toEqual([]);
    expect(findReimbursementCandidates(withExp, {}, { amount: 250, date: '2026-10-06' })).toEqual([]);
  });
  it('5. several plausible shares require the user to choose', () => {
    const two = [
      ...withExp,
      { share: share('s2', 'e2', 200, 'Friend B'), expenseDate: '2026-10-03', expenseAmount: 600 },
    ];
    const c = findReimbursementCandidates(two, {}, { amount: 200, date: '2026-10-06' });
    expect(c).toHaveLength(2);
    expect(needsUserChoice(c)).toBe(true);
  });
  it('6. partial repayment reduces what is outstanding and is derived from linked rows', () => {
    const partial = { ...reimb200, amount: 80 };
    const map = reimbursedByShare([partial]);
    expect(map.s1).toBe(80);
    expect(outstandingOf(share('s1', 'e1', 200), map.s1)).toBe(120);
    const c = findReimbursementCandidates(withExp, map, { amount: 120, date: '2026-10-07' });
    expect(c[0].outstanding).toBe(120);
    // cannot over-allocate: 150 > 120 outstanding
    expect(findReimbursementCandidates(withExp, map, { amount: 150, date: '2026-10-07' })).toEqual([]);
  });
});

describe('Part 1 — accounting (income / spent / budget / Gullak)', () => {
  const catMap = {};
  it('3b/7. reimbursement is received on its own date and never counts as income', () => {
    const totals = calculateExpenseTotals([exp400, reimb200, salary], catMap);
    expect(totals.totalIncome).toBe(1000);        // salary only
    expect(totals.totalSpent).toBe(400);          // full original expense
    expect(totals.totalReimbursements).toBe(200); // separate channel
    expect(isCountedIncome(reimb200)).toBe(false);
    expect(isEligibleIncome(reimb200)).toBe(false);
    expect(isEligibleReimbursement(reimb200)).toBe(true);
    const byDate = computeReimbursementsByDate([reimb200], makeReimbursementClassifier());
    expect(byDate).toEqual({ '2026-10-06': 200 }); // not backdated to 5 Oct
    expect(computeIncomeByDate([reimb200], makeEligibleIncomeClassifier())).toEqual({});
  });
  it('8. reimbursement restores spending power through the shared engine, not as income', () => {
    const base = calculateCycleFinancials({ scheduledBudget: 100, spent: 150 });
    expect(base.isOverBudget).toBe(true);
    const withReimb = calculateCycleFinancials({ scheduledBudget: 100, eligibleReimbursements: 50, spent: 150 });
    expect(withReimb.spendable).toBe(150);
    expect(withReimb.isOverBudget).toBe(false);
    expect(evaluateDayStatus(100, 150, 0, undefined, 50).status).toBe('even');
    // Same ₹ as fresh income would give the same spendable — but income is tracked separately:
    const summary = calculatePeriodSummary({
      activeFilter: 'Daily', dailyBudgetAmount: 100, isAutoRenew: true, todayBudget: 100, dailyRecords: {},
      totalIncome: 0, totalSpent: 150, totalReimbursements: 50, filtered: [], referenceDate: new Date('2026-10-06T10:00:00'),
    });
    expect(summary.periodIncome).toBe(0);
    expect(summary.totalAvailable).toBe(150);
  });
  it('8b. Gullak overspend cushion ignores reimbursements and transfers', () => {
    const records: Record<string, DailyRecord> = {
      '2026-10-06': { date: '2026-10-06', budget: 100, spent: 200, saved: 0, isFinalized: false, status: 'exceeded' },
    };
    const income = [reimb200, transferIn].filter((e) => isCountedIncome(e)).reduce((s, e) => s + e.amount, 0);
    expect(income).toBe(0);
    const m = calculateSavingsMetrics(records, '2026-10-06', undefined, new Date('2026-10-06'), 0, income);
    expect(m.totalAccumulatedSavings).toBe(0);
  });
  it('9. ₹5,000 self-transfer is neither income nor expense nor budget/Gullak input', () => {
    for (const t of [transferOut, transferIn]) {
      expect(isCountedIncome(t)).toBe(false);
      expect(isCountedExpense(t)).toBe(false);
      expect(isInternalTransfer(t)).toBe(true);
    }
    const totals = calculateExpenseTotals([transferOut, transferIn], catMap);
    expect(totals).toEqual({ totalIncome: 0, totalSpent: 0, totalReimbursements: 0 });
    expect(computeSpentByDate([transferOut, transferIn], makeIncomeClassifier())).toEqual({});
    expect(computeIncomeByDate([transferOut, transferIn], makeEligibleIncomeClassifier())).toEqual({});
    expect(computeReimbursementsByDate([transferOut, transferIn], makeReimbursementClassifier())).toEqual({});
  });
  it('12. normal income / expense flows are unchanged', () => {
    const t = calculateExpenseTotals([exp400, salary], catMap);
    expect(t).toEqual({ totalIncome: 1000, totalSpent: 400, totalReimbursements: 0 });
    expect(isCountedIncome(salary)).toBe(true);
    expect(isCountedExpense(exp400)).toBe(true);
    expect(isEligibleIncome(salary)).toBe(true);
  });
  it('legacy rows without transaction_class keep the old keyword fallback', () => {
    expect(isInternalTransfer({ type: 'expense', note: 'self transfer to savings' })).toBe(true);
    expect(isInternalTransfer({ type: 'expense', note: 'lunch' })).toBe(false);
  });
});

describe('Part 1 — self-transfer rules', () => {
  it('10/11. rules are narrow: descriptor based, never amount based', () => {
    expect(normalizeTransferDescriptor('₹5000')).toBeNull();
    expect(normalizeTransferDescriptor('5000')).toBeNull();
    expect(normalizeTransferDescriptor('abc')).toBeNull();
    const d = normalizeTransferDescriptor('HDFC → SBI savings');
    expect(d).toBe('hdfc sbi savings');
    const rules = [{ id: 'r', user_id: 'u', descriptor: d as string }];
    expect(findMatchingTransferRule(rules, 'hdfc sbi  SAVINGS')?.id).toBe('r');
    expect(findMatchingTransferRule(rules, 'Zomato dinner')).toBeNull();
    expect(findMatchingTransferRule(rules, '')).toBeNull();
  });
  it('13. a wrongly classified reimbursement/transfer is corrected by returning to normal', () => {
    const corrected: any = { ...reimb200, transaction_class: 'normal', reimburses_share_id: null };
    expect(isCountedIncome(corrected)).toBe(true);
    expect(isEligibleReimbursement(corrected)).toBe(false);
    expect(reimbursedByShare([corrected])).toEqual({});
  });
});
