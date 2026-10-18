import { describe, it, expect } from 'vitest';
import {
  applyRecoveries,
  buildPeopleLedger,
  buildPersonSummaries,
  planSettlement,
  planRefund,
  matchIncomingToPeople,
  nameMatches,
  getSplitView,
  validateSplit,
  validateSplitAllocations,
  deleteBlockReason,
  minAmountForExpense,
  minShareForExpense,
  refundCandidates,
  recoveriesForExpense,
  recoverySlices,
  cleanPersonName,
  personKey,
  type LedgerRow,
} from '../src/lib/splitLedger';
import { isCountedIncome, isCountedExpense, isExcludedFromTotals, getTransactionClass } from '../src/lib/transactionUtils';
import { calculateExpenseTotals } from '../src/lib/homeCalculations';
import { computeSpentByDate, computeIncomeByDate } from '../src/lib/budgetCalculations';
import { makeIncomeClassifier, makeEligibleIncomeClassifier } from '../src/lib/incomeClassifier';
import { computeMoneyWaterfall } from '../src/lib/moneyWaterfall';
import { classifyForWaterfall } from '../src/lib/moneyWaterfall';

// Prithvish story (SPL-001..SPL-004): dinner 300 (his share 200), petrol 200 (his share 100).
const dinner: LedgerRow = {
  id: 'dinner', amount: 300, type: 'expense', expense_date: '2026-10-10', created_at: '2026-10-10T20:00:00Z',
  note: 'Dinner', split_person: 'Prithvish', split_amount: 200,
};
const petrol: LedgerRow = {
  id: 'petrol', amount: 200, type: 'expense', expense_date: '2026-10-14', created_at: '2026-10-14T09:00:00Z',
  note: 'Petrol', split_person: 'prithvish ', split_amount: 100,
};
const salary: LedgerRow = { id: 'sal', amount: 1000, type: 'income', expense_date: '2026-10-01' };
const back = (id: string, amount: number, allocations: { expense_id: string; amount: number }[], extra: Partial<LedgerRow> = {}): LedgerRow => ({
  id, amount, type: 'income', transaction_class: 'recovery', recovery_kind: 'settlement', recovery_person: 'Prithvish',
  expense_date: '2026-10-18', created_at: '2026-10-18T10:00:00Z', recovery_allocations: allocations, ...extra,
});

describe('SPL-003: money back is a class of its own and never income', () => {
  it('is excluded from income and expense totals', () => {
    const row = back('b1', 300, [{ expense_id: 'dinner', amount: 300 }]);
    expect(getTransactionClass(row)).toBe('recovery');
    expect(isExcludedFromTotals(row)).toBe(true);
    expect(isCountedIncome(row)).toBe(false);
    expect(isCountedExpense(row)).toBe(false);
  });
});

describe('SPL-003: applyRecoveries', () => {
  it('leaves rows alone when nothing came back', () => {
    const rows = [dinner, petrol, salary];
    expect(applyRecoveries(rows)).toBe(rows);
  });

  it('reduces the counted amount by what came back and keeps the amount paid', () => {
    const rows = applyRecoveries([dinner, petrol, back('b1', 300, [
      { expense_id: 'dinner', amount: 200 },
      { expense_id: 'petrol', amount: 100 },
    ])]);
    const d = rows.find((r) => r.id === 'dinner')!;
    const p = rows.find((r) => r.id === 'petrol')!;
    expect([d.amount, d.gross_amount]).toEqual([100, 300]);
    expect([p.amount, p.gross_amount]).toEqual([100, 200]);
  });

  it('is safe to run again on its own output', () => {
    const once = applyRecoveries([dinner, back('b1', 200, [{ expense_id: 'dinner', amount: 200 }])]);
    const twice = applyRecoveries(once);
    expect(twice.find((r) => r.id === 'dinner')!.amount).toBe(100);
    expect(twice.find((r) => r.id === 'dinner')!.gross_amount).toBe(300);
  });

  it('deleting the money-back row brings the full amount back', () => {
    const withBack = applyRecoveries([dinner, back('b1', 200, [{ expense_id: 'dinner', amount: 200 }])]);
    const withoutBack = applyRecoveries(withBack.filter((r) => r.id !== 'b1'));
    const d = withoutBack.find((r) => r.id === 'dinner')!;
    expect([d.amount, d.gross_amount]).toEqual([300, 300]);
  });

  it('never goes below zero, even with bad data', () => {
    const rows = applyRecoveries([dinner, back('b1', 999, [{ expense_id: 'dinner', amount: 999 }])]);
    expect(rows.find((r) => r.id === 'dinner')!.amount).toBe(0);
  });

  it('ignores allocations that point at a deleted expense', () => {
    const rows = applyRecoveries([dinner, back('b1', 50, [{ expense_id: 'gone', amount: 50 }])]);
    expect(rows.find((r) => r.id === 'dinner')!.amount).toBe(300);
  });
});

describe('Prithvish example end to end', () => {
  const all: LedgerRow[] = [salary, dinner, petrol];

  it('before money back: owes 300, oldest first, split names are one person', () => {
    const ledger = buildPeopleLedger(all);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].owed).toBe(300);
    expect(ledger[0].openSplits.map((s) => s.expenseId)).toEqual(['dinner', 'petrol']);
  });

  it('300 comes back: both expenses shrink, total income does not change, money is back on the original days', () => {
    const settlement = planSettlement(all, 'Prithvish', 300);
    expect(settlement).toEqual({
      allocations: [{ expense_id: 'dinner', amount: 200 }, { expense_id: 'petrol', amount: 100 }],
      allocated: 300,
      excess: 0,
    });
    const rows = applyRecoveries([...all, back('b1', 300, settlement.allocations)]);

    // totals: income stays 1000, spent goes 500 -> 200
    expect(calculateExpenseTotals(all, {})).toEqual({ totalIncome: 1000, totalSpent: 500 });
    expect(calculateExpenseTotals(rows, {})).toEqual({ totalIncome: 1000, totalSpent: 200 });

    // per day: the original days get their money back (10 Oct 300 -> 100, 14 Oct 200 -> 100)
    const spent = computeSpentByDate(rows as any[], makeIncomeClassifier());
    expect(spent).toEqual({ '2026-10-10': 100, '2026-10-14': 100 });
    // the 18 Oct money-back row creates no income on 18 Oct
    expect(computeIncomeByDate(rows as any[], makeEligibleIncomeClassifier())).toEqual({ '2026-10-01': 1000 });

    // nothing owed any more
    expect(buildPeopleLedger(rows)[0].owed).toBe(0);
  });

  it('waterfall: the 100 that the dinner took from income comes back to income (budget 200/day)', () => {
    const budget = (key: string) => ({ key, budget: 200 });
    const resolvePool = (date: string) => budget(`daily_${date}`);
    const before = computeMoneyWaterfall({ txs: classifyForWaterfall([salary, dinner, petrol]), resolvePool });
    expect(before.incomeRemaining).toBe(900); // dinner overspent 100 from income
    const settlement = planSettlement(all, 'Prithvish', 300);
    const rows = applyRecoveries([...all, back('b1', 300, settlement.allocations)]);
    const after = computeMoneyWaterfall({ txs: classifyForWaterfall(rows), resolvePool });
    expect(after.incomeRemaining).toBe(1000);
    expect(after.incomeReceived).toBe(1000);
  });

  it('only 150 comes back: oldest expense first, 150 still owed', () => {
    const plan = planSettlement(all, 'prithvish', 150);
    expect(plan.allocations).toEqual([{ expense_id: 'dinner', amount: 150 }]);
    const rows = applyRecoveries([...all, back('b1', 150, plan.allocations)]);
    const ledger = buildPeopleLedger(rows)[0];
    expect(ledger.owed).toBe(150);
    expect(ledger.openSplits[0]).toMatchObject({ expenseId: 'dinner', theirShare: 200, settled: 150, outstanding: 50 });
    const view = getSplitView(rows.find((r) => r.id === 'dinner')!, rows)!;
    expect(view).toMatchObject({ paid: 300, theirShare: 200, myShare: 100, settled: 150, outstanding: 50, isSettled: false });
  });

  it('350 comes back while 300 is owed: 300 is settled, 50 is left over to become income (SPL-004)', () => {
    const plan = planSettlement(all, 'Prithvish', 350);
    expect(plan.allocated).toBe(300);
    expect(plan.excess).toBe(50);
  });

  it('can settle only ticked expenses', () => {
    const plan = planSettlement(all, 'Prithvish', 300, ['petrol']);
    expect(plan.allocations).toEqual([{ expense_id: 'petrol', amount: 100 }]);
    expect(plan.excess).toBe(200);
  });

  it('a person nobody owes settles nothing', () => {
    expect(planSettlement(all, 'Someone', 100)).toEqual({ allocations: [], allocated: 0, excess: 100 });
  });
});

describe('SPL-006: refunds', () => {
  it('a refund reduces the expense and is not income', () => {
    const shoes: LedgerRow = { id: 'shoes', amount: 2000, type: 'expense', expense_date: '2026-10-02', note: 'Shoes' };
    const plan = planRefund([shoes], 'shoes', 2000);
    expect(plan.allocated).toBe(2000);
    const refund: LedgerRow = {
      id: 'r1', amount: 2000, type: 'income', transaction_class: 'recovery', recovery_kind: 'refund',
      recovery_person: 'Amazon', expense_date: '2026-10-15', recovery_allocations: plan.allocations,
    };
    const rows = applyRecoveries([shoes, refund]);
    expect(calculateExpenseTotals(rows, {})).toEqual({ totalIncome: 0, totalSpent: 0 });
    expect(rows.find((r) => r.id === 'shoes')!.gross_amount).toBe(2000);
  });

  it('never refunds more than is still out, the rest is left over', () => {
    const shoes: LedgerRow = { id: 'shoes', amount: 1000, type: 'expense', expense_date: '2026-10-02' };
    expect(planRefund([shoes], 'shoes', 1500)).toMatchObject({ allocated: 1000, excess: 500 });
    expect(planRefund([shoes], 'missing', 100)).toMatchObject({ allocated: 0, excess: 100 });
  });

  it('lists expenses that still have money out, newest first', () => {
    const a: LedgerRow = { id: 'a', amount: 100, type: 'expense', expense_date: '2026-10-01' };
    const b: LedgerRow = { id: 'b', amount: 100, type: 'expense', expense_date: '2026-10-05' };
    const refundA: LedgerRow = {
      id: 'r', amount: 100, type: 'income', transaction_class: 'recovery', recovery_kind: 'refund',
      expense_date: '2026-10-06', recovery_allocations: [{ expense_id: 'a', amount: 100 }],
    };
    expect(refundCandidates([a, b, refundA]).map((c) => c.id)).toEqual(['b']);
  });
});

describe('SPL-005: matching an incoming payment (name and amount first, then name only)', () => {
  const people = buildPeopleLedger([dinner, petrol]);

  it('name + amount equal to the total owed is an exact match', () => {
    const m = matchIncomingToPeople(people, { amount: 300, sender: 'PRITHVISH KUMAR' });
    expect(m).toHaveLength(1);
    expect(m[0].kind).toBe('exact');
  });

  it('name + amount equal to one expense is exact too', () => {
    expect(matchIncomingToPeople(people, { amount: 200, sender: 'Prithvish' })[0].kind).toBe('exact');
  });

  it('name only (half the money) is still offered', () => {
    expect(matchIncomingToPeople(people, { amount: 150, sender: 'PRITHVISH K' })[0].kind).toBe('name');
  });

  it('amount alone, or a different name, never matches', () => {
    expect(matchIncomingToPeople(people, { amount: 300, sender: 'Rahul' })).toEqual([]);
    expect(matchIncomingToPeople(people, { amount: 300, sender: null })).toEqual([]);
  });

  it('a person who owes nothing is never offered', () => {
    const rows = applyRecoveries([dinner, back('b1', 200, [{ expense_id: 'dinner', amount: 200 }])]);
    expect(matchIncomingToPeople(buildPeopleLedger(rows), { amount: 200, sender: 'Prithvish' })).toEqual([]);
  });

  it('exact matches are listed before name-only matches', () => {
    const rahul: LedgerRow = { id: 'x', amount: 500, type: 'expense', expense_date: '2026-10-12', split_person: 'Rahul Sharma', split_amount: 250 };
    const ppl = buildPeopleLedger([dinner, petrol, rahul]);
    const m = matchIncomingToPeople(ppl, { amount: 250, sender: 'RAHUL SHARMA' });
    expect(m[0].person.name).toBe('Rahul Sharma');
    expect(m[0].kind).toBe('exact');
  });

  it('nameMatches handles initials, case, punctuation and extra words', () => {
    expect(nameMatches('Prithvish', 'PRITHVISH KUMAR')).toBe(true);
    expect(nameMatches('Prithvish Kumar', 'PRITHVISH K')).toBe(true);
    expect(nameMatches('Rahul', 'Rahul.S@okaxis')).toBe(true);
    expect(nameMatches('Rahul', 'Rohit')).toBe(false);
    expect(nameMatches('Raj', 'Rajesh Kumar')).toBe(true);
    expect(nameMatches('Anu', 'Anuj')).toBe(true);
    expect(nameMatches('', 'Anuj')).toBe(false);
  });
});

describe('guards (SPL-001, SPL-006)', () => {
  const rows = applyRecoveries([dinner, back('b1', 150, [{ expense_id: 'dinner', amount: 150 }])]);

  it('validates what the user types', () => {
    expect(validateSplit(300, '', 100)).toBe('Add a name.');
    expect(validateSplit(300, 'A', 0)).toBe('Enter their share.');
    expect(validateSplit(300, 'A', 301)).toBe('Their share cannot be more than the amount.');
    expect(validateSplit(300, 'A', 300)).toBeNull();
    // Multi-person duplicate participant check
    expect(
      validateSplitAllocations(300, [
        { person: 'Rohan', amount: 100 },
        { person: 'rohan ', amount: 100 },
      ])
    ).toMatch(/added more than once/);
  });

  it('an expense with money back cannot be deleted; its money-back row can go first', () => {
    expect(deleteBlockReason('dinner', rows)).toMatch(/money-back entry first/);
    expect(deleteBlockReason('dinner', rows.filter((r) => r.id !== 'b1'))).toBeNull();
  });

  it('amount and share cannot drop below what already came back', () => {
    expect(minAmountForExpense(rows, 'dinner')).toBe(150);
    expect(minShareForExpense(rows, 'dinner')).toBe(150);
    expect(minAmountForExpense(rows, 'petrol')).toBe(0);
  });

  it('finds the money-back rows of an expense and its slices', () => {
    expect(recoveriesForExpense(rows, 'dinner').map((r) => r.id)).toEqual(['b1']);
    const slices = recoverySlices(rows.find((r) => r.id === 'b1')!, rows);
    expect(slices).toHaveLength(1);
    expect(slices[0].expense?.id).toBe('dinner');
    expect(slices[0].amount).toBe(150);
  });

  it('a split with the whole amount (cash lent) leaves the user share at 0', () => {
    const lent: LedgerRow = { id: 'l', amount: 500, type: 'expense', expense_date: '2026-10-03', split_person: 'Amit', split_amount: 500 };
    expect(getSplitView(lent, [lent])).toMatchObject({ myShare: 0, outstanding: 500 });
  });

  it('names are cleaned and compared without case or extra spaces', () => {
    expect(cleanPersonName('  Prithvish   Kumar ')).toBe('Prithvish Kumar');
    expect(personKey('PRITHVISH ')).toBe(personKey('prithvish'));
  });
});

describe('buildPersonSummaries (Ledger screen)', () => {
  it('lists who owes what, what was paid back and when; people who still owe come first', () => {
    const amit: LedgerRow = { id: 'a', amount: 400, type: 'expense', expense_date: '2026-10-02', note: 'Movie', split_person: 'Amit', split_amount: 200 };
    const paidAmit = back('pa', 200, [{ expense_id: 'a', amount: 200 }], { recovery_person: 'Amit', expense_date: '2026-10-05' });
    const rows = applyRecoveries([amit, dinner, petrol, paidAmit, back('b1', 100, [{ expense_id: 'dinner', amount: 100 }])]);
    const list = buildPersonSummaries(rows);
    expect(list.map((p) => p.name)).toEqual(['Prithvish', 'Amit']); // owing first, settled last
    const p = list[0];
    expect(p).toMatchObject({ owed: 200, totalShared: 300, totalPaidBack: 100, isSettled: false });
    expect(p.splits.map((s) => s.expenseId)).toEqual(['petrol', 'dinner']);
    expect(p.splits[1]).toMatchObject({ settled: 100, outstanding: 100, isSettled: false });
    expect(p.payments).toEqual([{ id: 'b1', date: '2026-10-18', amount: 100 }]);
    expect(list[1]).toMatchObject({ owed: 0, totalPaidBack: 200, isSettled: true });
    expect(list[1].payments[0].amount).toBe(200);
  });

  it('one payment covering two people is split between them, a refund is never a person payment, no split = empty', () => {
    const x: LedgerRow = { id: 'x', amount: 100, type: 'expense', expense_date: '2026-10-01', split_person: 'X', split_amount: 50 };
    const y: LedgerRow = { id: 'y', amount: 100, type: 'expense', expense_date: '2026-10-01', split_person: 'Y', split_amount: 50 };
    const shared = back('p', 100, [{ expense_id: 'x', amount: 50 }, { expense_id: 'y', amount: 50 }]);
    const refund: LedgerRow = { ...back('r', 10, [{ expense_id: 'x', amount: 10 }]), recovery_kind: 'refund' };
    const list = buildPersonSummaries(applyRecoveries([x, y, shared, refund]));
    expect(list.find((p) => p.name === 'X')!.payments).toEqual([{ id: 'p', date: '2026-10-18', amount: 50 }]);
    expect(buildPersonSummaries([])).toEqual([]);
  });
});
