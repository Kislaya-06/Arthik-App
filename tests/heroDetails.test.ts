import { describe, it, expect } from 'vitest';
import {
  pickPrimaryChip, buildHeroDetails, moneyBackInRows, autoSavedInScope, heroDetailsTitle, withTillToday,
} from '../src/lib/heroDetails';
import { buildHeroSubtextChips } from '../src/lib/homeCalculations';

const chip = (id: string, text: string, badgeText: string | null = null) => ({ id, text, badgeText, approxSize: text.length });

describe('pickPrimaryChip: one chip on the card', () => {
  it('returns null for no chips', () => expect(pickPrimaryChip([])).toBeNull());

  it('Gullak drawn beats everything', () => {
    const c = pickPrimaryChip([chip('a', '₹3,400 budget'), chip('b', '+₹101.5 income', 'drawn ₹664.56 from Gullak')])!;
    expect(c.id).toBe('b');
    expect(pickPrimaryChip([chip('a', 'Budget used up'), chip('gullak_only', 'Drawn ₹5 from Gullak')])!.id).toBe('gullak_only');
  });

  it('then over the limit, then budget used up, then budget left, then income', () => {
    expect(pickPrimaryChip([chip('a', '+₹10 income'), chip('b', 'Exceeded daily limit by ₹2.5')])!.id).toBe('b');
    expect(pickPrimaryChip([chip('a', '₹100 budget'), chip('b', 'Budget used up')])!.id).toBe('b');
    expect(pickPrimaryChip([chip('a', '+₹10 income'), chip('b', '₹100 budget (3 days)')])!.id).toBe('b');
    expect(pickPrimaryChip([chip('a', '+₹10 income'), chip('b', '₹5 deposits to Gullak')])!.id).toBe('a');
  });

  it('works on the real chips for the owner\'s weekly screenshot (budget used up + income + drawn)', () => {
    const chips = buildHeroSubtextChips({
      effectiveSubtext: 'Budget used up + ₹101.5 income',
      isBudgetModeEnabled: true,
      isSpendingFromGullak: true,
      gullakDrawnAmount: 528.56,
      periodIncome: 1394,
    });
    const c = pickPrimaryChip(chips)!;
    expect(c.badgeText ?? c.text).toMatch(/Gullak/i);
  });
});

describe('buildHeroDetails', () => {
  const base = {
    isBudgetMode: true, budgetGiven: 3400, spent: 3842.06, incomeReceived: 4499, incomeLeft: 101.5,
    moneyBack: 300, gullakAdded: 120, gullakDrawn: 664.56, gullakNow: 50,
  };

  it('Budget mode: budget, money in and Gullak', () => {
    const d = buildHeroDetails(base);
    expect(d.sections.map((s) => s.id)).toEqual(['budget', 'money_in', 'gullak']);
    const budget = d.sections[0].rows;
    expect(budget.map((r) => r.amount)).toEqual([3400, 3400, 0]); // spent from budget is capped at the budget
    const moneyIn = d.sections[1].rows;
    expect(moneyIn.find((r) => r.id === 'received')!.amount).toBe(4499);
    expect(moneyIn.find((r) => r.id === 'spent')!.amount).toBe(4397.5);
    expect(moneyIn.find((r) => r.id === 'left')!.amount).toBe(101.5);
    expect(d.sections[2].rows.map((r) => r.id)).toEqual(['added', 'drawn', 'now']);
    expect(d.totalSpent).toBe(3842.06);
  });

  it('hides "In Gullak now" outside the All view', () => {
    const d = buildHeroDetails({ ...base, moneyBack: 0, gullakNow: null });
    expect(d.sections[2].rows.some((r) => r.id === 'now')).toBe(false);
  });

  it('budget left is positive while budget remains', () => {
    const d = buildHeroDetails({ ...base, spent: 1000 });
    expect(d.sections[0].rows.map((r) => r.amount)).toEqual([3400, 1000, 2400]);
  });

  it('Pure Mode: no budget block and no Gullak block (GUL-002)', () => {
    const d = buildHeroDetails({ ...base, isBudgetMode: false });
    expect(d.sections.map((s) => s.id)).toEqual(['money_in']);
    expect(d.sections[0].rows.map((r) => r.id)).toEqual(['received']);
  });

  it('no budget set: no budget block', () => {
    expect(buildHeroDetails({ ...base, budgetGiven: 0 }).sections.map((s) => s.id)).toEqual(['money_in', 'gullak']);
  });

  it('preserves activeBudgetLeft when lifetime spent exceeds total budgetGiven in All view', () => {
    // 37 days @ 100/day = 3700 budgetGiven, spent = 4666.06. Today is active with 100 remaining.
    const d = buildHeroDetails({
      ...base,
      budgetGiven: 3700,
      spent: 4666.06,
      activeBudgetLeft: 100,
    });
    const budgetRows = d.sections.find((s) => s.id === 'budget')!.rows;
    expect(budgetRows.find((r) => r.id === 'given')!.amount).toBe(3700);
    expect(budgetRows.find((r) => r.id === 'used')!.amount).toBe(3600);
    expect(budgetRows.find((r) => r.id === 'left')!.amount).toBe(100);
  });

  it('reflects unspentInflowLeft under Money in so sheet breakdown matches Home Card total remaining', () => {
    const d = buildHeroDetails({
      ...base,
      budgetGiven: 3700,
      spent: 4666.06,
      activeBudgetLeft: 100,
      unspentInflowLeft: 32.94,
    });
    const moneyInRows = d.sections.find((s) => s.id === 'money_in')!.rows;
    expect(moneyInRows.find((r) => r.id === 'left')!.amount).toBe(32.94);
  });

  it('hard-caps Taken from Gullak at Added to Gullak so overdraft never shows in sheet', () => {
    const d = buildHeroDetails({
      ...base,
      gullakAdded: 1282,
      gullakDrawn: 1287.06,
      gullakNow: 0,
    });
    const gullakRows = d.sections.find((s) => s.id === 'gullak')!.rows;
    expect(gullakRows.find((r) => r.id === 'added')!.amount).toBe(1282);
    expect(gullakRows.find((r) => r.id === 'drawn')!.amount).toBe(1282); // Capped at 1282!
    expect(gullakRows.find((r) => r.id === 'now')!.amount).toBe(0);
  });

  it('hard-caps Still unspent at incomeReceived so unspent can never exceed received', () => {
    const d = buildHeroDetails({
      ...base,
      incomeReceived: 1099,
      incomeLeft: 4699, // caller passing larger amount
      unspentInflowLeft: 4699,
    });
    const moneyInRows = d.sections.find((s) => s.id === 'money_in')!.rows;
    expect(moneyInRows.find((r) => r.id === 'received')!.amount).toBe(1099);
    expect(moneyInRows.find((r) => r.id === 'left')!.amount).toBe(1099); // Hard-capped at 1099!
  });

  it('reconciles All-time sheet to exact numbers from owner report', () => {
    // Total lifetime spent: 4666.06. Total budget given: 3700. Money received: 1099. Today remaining budget: 100.
    // Total spendable: 3700 + 1099 = 4799. Total remaining: 4799 - 4666.06 = 132.94.
    // Unspent income: 132.94 - 100 = 32.94.
    const d = buildHeroDetails({
      isBudgetMode: true,
      budgetGiven: 3700,
      spent: 4666.06,
      incomeReceived: 1099,
      incomeLeft: 32.94,
      moneyBack: 0,
      gullakAdded: 1282,
      gullakDrawn: 1282,
      gullakNow: 0,
      activeBudgetLeft: 100,
      unspentInflowLeft: 32.94,
    });
    const budgetRows = d.sections.find((s) => s.id === 'budget')!.rows;
    expect(budgetRows.find((r) => r.id === 'given')!.amount).toBe(3700);
    expect(budgetRows.find((r) => r.id === 'used')!.amount).toBe(3600);
    expect(budgetRows.find((r) => r.id === 'left')!.amount).toBe(100);

    const moneyInRows = d.sections.find((s) => s.id === 'money_in')!.rows;
    expect(moneyInRows.find((r) => r.id === 'received')!.amount).toBe(1099);
    expect(moneyInRows.find((r) => r.id === 'left')!.amount).toBe(32.94);

    const gullakRows = d.sections.find((s) => s.id === 'gullak')!.rows;
    expect(gullakRows.find((r) => r.id === 'added')!.amount).toBe(1282);
    expect(gullakRows.find((r) => r.id === 'drawn')!.amount).toBe(1282);
    expect(gullakRows.find((r) => r.id === 'now')!.amount).toBe(0);
  });
});

describe('period helpers', () => {
  it('moneyBackInRows adds only money-back rows, using the amount received', () => {
    expect(moneyBackInRows([
      { amount: 100, transaction_class: 'recovery' },
      { amount: 50, transaction_class: 'normal' },
      { amount: 20, transaction_class: 'recovery' },
    ])).toBe(120);
  });

  it('autoSavedInScope adds finalized saved days and finished periods inside the scope only', () => {
    const records = {
      '2026-10-01': { date: '2026-10-01', saved: 100, isFinalized: true, status: 'saved' },
      '2026-10-02': { date: '2026-10-02', saved: 50, isFinalized: true, status: 'missed' },
      '2026-09-30': { date: '2026-09-30', saved: 70, isFinalized: true, status: 'saved' },
      '2026-10-03': { date: '2026-10-03', saved: 30, isFinalized: false, status: 'active' },
    };
    const periods = { a: { periodEnd: '2026-10-10', amountSaved: 40 }, b: { periodEnd: '2026-09-10', amountSaved: 999 } };
    expect(autoSavedInScope(records, periods, (d) => d >= '2026-10-01')).toBe(140);
    expect(autoSavedInScope(records, periods, () => true)).toBe(100 + 70 + 40 + 999);
  });

  it('titles and the "till today" date line', () => {
    expect(heroDetailsTitle('All', true)).toBe('All time');
    expect(heroDetailsTitle('Daily', true)).toBe('Today');
    expect(heroDetailsTitle('Daily', false)).toBe('That day');
    expect(heroDetailsTitle('Weekly', true)).toBe('This week');
    expect(withTillToday('12–18 Oct', 'Weekly', true, '18 Oct')).toBe('12–18 Oct · till today');
    expect(withTillToday('1–31 Oct 2026', 'Monthly', true, '18 Oct')).toBe('1–31 Oct 2026 · till 18 Oct');
    expect(withTillToday('1–31 Sep 2026', 'Monthly', false, '18 Oct')).toBe('1–31 Sep 2026');
    expect(withTillToday('Since 14 Sep 2026', 'All', true, '18 Oct')).toBe('Since 14 Sep 2026');
    expect(withTillToday('Sunday, 18 Oct', 'Daily', true, '18 Oct')).toBe('Sunday, 18 Oct');
  });
});
