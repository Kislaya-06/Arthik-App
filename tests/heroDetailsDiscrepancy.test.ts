import { describe, it, expect } from 'vitest';
import { buildHeroDetails } from '../src/lib/heroDetails';

describe('HeroDetailsSheet All-time Money In unspent reproduction & resolution', () => {
  it('hard-caps unspent income at incomeReceived even if a flawed input of 4699 is passed', () => {
    // Exact user numbers from screenshot:
    // budgetGiven: 3700
    // spent: 4666.06
    // incomeReceived: 1099
    // todayRemaining: 100
    // totalAvailable (spendable inflow): 3700 + 1099 = 4799
    const totalAvailable = 4799;
    const todayRemaining = 100;

    // What the previous buggy HomeScreen.tsx did:
    const buggyUnspentInflowLeft = totalAvailable - todayRemaining; // 4699!

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
      unspentInflowLeft: buggyUnspentInflowLeft,
    });

    const moneyInRows = d.sections.find((s) => s.id === 'money_in')!.rows;
    const received = moneyInRows.find((r) => r.id === 'received')!.amount;
    const unspent = moneyInRows.find((r) => r.id === 'left')!.amount;

    expect(received).toBe(1099);
    // Hard-cap guard in buildHeroDetails clamps unspent at incomeReceived (1099), preventing impossible UI (> received)
    expect(unspent).toBe(1099);
    expect(unspent).toBeLessThanOrEqual(received);
  });

  it('proves that remaining inflow is derived from total remaining balance, yielding exactly 32.94', () => {
    // Total spendable: 3700 + 1099 = 4799
    // Total spent: 4666.06
    // Total remaining balance across all time = 4799 - 4666.06 = 132.94
    const totalRemainingBalance = 132.94;
    const todayRemaining = 100;
    const incomeReceived = 1099;

    // Correct unspent income calculation from HomeScreen.tsx:
    const expectedUnspentInflow = Math.min(
      incomeReceived,
      Math.max(0, +(totalRemainingBalance - todayRemaining).toFixed(2))
    );
    expect(expectedUnspentInflow).toBe(32.94);

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
      unspentInflowLeft: expectedUnspentInflow,
    });

    const moneyInRows = d.sections.find((s) => s.id === 'money_in')!.rows;
    const received = moneyInRows.find((r) => r.id === 'received')!.amount;
    const unspent = moneyInRows.find((r) => r.id === 'left')!.amount;

    expect(received).toBe(1099);
    expect(unspent).toBe(32.94);
    expect(unspent).toBeLessThanOrEqual(received);

    // And verify the full reconciliation:
    // Budget left (100) + Still unspent (32.94) = 132.94 (Matches totalRemainingBalance!)
    const budgetRows = d.sections.find((s) => s.id === 'budget')!.rows;
    const budgetLeft = budgetRows.find((r) => r.id === 'left')!.amount;
    expect(budgetLeft + unspent).toBe(132.94);
  });

  it('reconciles unspent income when Gullak has accumulated savings (subtracting Gullak from remaining balance)', () => {
    // Exact user numbers from report:
    // Total lifetime spent: 4634.72. Total budget given: 3900. Money received: 1106.
    // Today remaining budget: 0. Total remaining balance: 5006 - 4634.72 = 371.28.
    // Gullak savings: 271.28.
    const totalRemainingBalance = 371.28;
    const todayRemaining = 0;
    const gullakNow = 271.28;
    const incomeReceived = 1106;

    // Derived unspent income:
    const expectedUnspentInflow = Math.min(
      incomeReceived,
      Math.max(0, +(totalRemainingBalance - todayRemaining - gullakNow).toFixed(2))
    );
    expect(expectedUnspentInflow).toBe(100.00);

    const d = buildHeroDetails({
      isBudgetMode: true,
      budgetGiven: 3900,
      spent: 4634.72,
      incomeReceived: 1106,
      incomeLeft: 100.00,
      moneyBack: 0,
      gullakAdded: 1382,
      gullakDrawn: 1048.72,
      gullakNow: 271.28,
      activeBudgetLeft: 0,
      unspentInflowLeft: expectedUnspentInflow,
    });

    const moneyInRows = d.sections.find((s) => s.id === 'money_in')!.rows;
    const received = moneyInRows.find((r) => r.id === 'received')!.amount;
    const spentFromIncome = moneyInRows.find((r) => r.id === 'spent')!.amount;
    const unspent = moneyInRows.find((r) => r.id === 'left')!.amount;

    expect(received).toBe(1106);
    expect(spentFromIncome).toBe(1006.00);
    expect(unspent).toBe(100.00);

    const gullakRows = d.sections.find((s) => s.id === 'gullak')!.rows;
    const inGullakNow = gullakRows.find((r) => r.id === 'now')!.amount;
    expect(inGullakNow).toBe(271.28);

    const budgetRows = d.sections.find((s) => s.id === 'budget')!.rows;
    const budgetLeft = budgetRows.find((r) => r.id === 'left')!.amount;
    expect(budgetLeft).toBe(0);

    // Full reconciliation: Budget left (0) + Gullak now (271.28) + Still unspent (100.00) = 371.28 (Total Remaining Balance)
    expect(budgetLeft + inGullakNow + unspent).toBe(371.28);
  });
});
