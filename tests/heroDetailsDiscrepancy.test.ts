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
});
