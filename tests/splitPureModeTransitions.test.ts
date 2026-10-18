import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {},
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => '10000000-0000-4000-8000-000000000001',
}));
import {
  buildPeopleLedger,
  applyRecoveries,
  getSplitView,
  type LedgerRow,
} from '../src/lib/splitLedger';
import { calculateExpenseTotals } from '../src/lib/homeCalculations';
import { isCountedIncome, isCountedExpense } from '../src/lib/transactionUtils';

describe('Split Expenses & Pure Mode / Budget Mode Transitions', () => {
  it('preserves split debts created in Pure Mode and settles them correctly after switching to Budget Mode', () => {
    // 1. In Pure Mode: user pays ₹600 for dinner on 2026-10-10, split with Alice (Alice owes ₹400)
    const dinner: LedgerRow = {
      id: 'dinner-1',
      amount: 600,
      gross_amount: 600,
      type: 'expense',
      expense_date: '2026-10-10',
      split_person: 'Alice',
      split_amount: 400,
      split_allocations: [{ person: 'Alice', amount: 400 }],
    };

    // User also has ₹2,000 initial income
    const income: LedgerRow = {
      id: 'inc-1',
      amount: 2000,
      type: 'income',
      expense_date: '2026-10-01',
    };

    // In Pure Mode: Ledger correctly tracks Alice's ₹400 debt
    let rows: LedgerRow[] = [income, dinner];
    let people = buildPeopleLedger(rows);
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Alice');
    expect(people[0].owed).toBe(400);

    // Initial Pure Mode totals: Inflow ₹2000, Outflow ₹600, Net ₹1400
    const catMap = {
      income_cat: { name: 'Salary', is_income: true },
      food_cat: { name: 'Food', is_income: false },
    };
    let totals = calculateExpenseTotals(
      [
        { amount: income.amount, category_id: 'income_cat', type: 'income' },
        { amount: dinner.amount, category_id: 'food_cat', type: 'expense' },
      ],
      catMap
    );
    expect(totals.totalIncome).toBe(2000);
    expect(totals.totalSpent).toBe(600);
    expect(totals.totalIncome - totals.totalSpent).toBe(1400);

    // 2. Transition from Pure Mode to Budget Mode on 2026-10-15
    // In Budget Mode: Alice STILL owes ₹400 (debt is derived from rows, unaffected by mode toggle)
    people = buildPeopleLedger(rows);
    expect(people[0].owed).toBe(400);

    // 3. Alice pays back ₹400 on 2026-10-16 while user is in Budget Mode
    const alicePay: LedgerRow = {
      id: 'pay-alice-1',
      amount: 400,
      type: 'income',
      expense_date: '2026-10-16',
      transaction_class: 'recovery',
      recovery_kind: 'settlement',
      recovery_person: 'Alice',
      recovery_allocations: [{ expense_id: 'dinner-1', amount: 400 }],
    };

    // Apply recoveries (middleware behavior)
    rows = applyRecoveries([income, dinner, alicePay]);

    // 4. Verify outcomes:
    // A. Dinner counted amount shrinks to ₹200 (user share), gross stays ₹600
    const countedDinner = rows.find((r) => r.id === 'dinner-1')!;
    expect(countedDinner.amount).toBe(200);
    expect(countedDinner.gross_amount).toBe(600);

    // B. Alice is fully settled in the Ledger
    people = buildPeopleLedger(rows);
    const alice = people.find((p) => p.name === 'Alice');
    expect(alice?.owed || 0).toBe(0);

    // C. Money back is NEVER counted as income
    const payRow = rows.find((r) => r.id === 'pay-alice-1')!;
    expect(isCountedIncome(payRow as any)).toBe(false);
    expect(isCountedExpense(payRow as any)).toBe(false);

    // D. Real Money Cashflow:
    // Outflow dropped from ₹600 to ₹200. Money back ₹400 entered the account as cash.
    totals = calculateExpenseTotals(
      rows.map((r) => ({
        amount: r.amount,
        type: r.type,
        transaction_class: r.transaction_class,
        category_id: r.type === 'income' ? 'income_cat' : 'food_cat',
      })),
      catMap
    );
    expect(totals.totalIncome).toBe(2000);
    expect(totals.totalSpent).toBe(200);
    // Net cash remaining = 2000 - 200 = 1800 (which is 1400 original + 400 recovered)
    expect(totals.totalIncome - totals.totalSpent).toBe(1800);
  });

  it('preserves split debts created in Budget Mode and settles them correctly after switching to Pure Mode', () => {
    // 1. In Budget Mode: user pays ₹1,000 for groceries on 2026-10-05, split with Bob (Bob owes ₹500)
    const groceries: LedgerRow = {
      id: 'groc-1',
      amount: 1000,
      gross_amount: 1000,
      type: 'expense',
      expense_date: '2026-10-05',
      split_person: 'Bob',
      split_amount: 500,
      split_allocations: [{ person: 'Bob', amount: 500 }],
    };

    const initialIncome: LedgerRow = {
      id: 'inc-base',
      amount: 3000,
      type: 'income',
      expense_date: '2026-10-01',
    };

    let rows: LedgerRow[] = [initialIncome, groceries];

    // 2. User switches to Pure Mode (Budget Mode disabled)
    // Bob still owes ₹500 in Pure Mode
    let people = buildPeopleLedger(rows);
    expect(people[0].name).toBe('Bob');
    expect(people[0].owed).toBe(500);

    // 3. Bob pays back ₹500 in Pure Mode
    const bobPay: LedgerRow = {
      id: 'pay-bob-1',
      amount: 500,
      type: 'income',
      expense_date: '2026-10-12',
      transaction_class: 'recovery',
      recovery_kind: 'settlement',
      recovery_person: 'Bob',
      recovery_allocations: [{ expense_id: 'groc-1', amount: 500 }],
    };

    rows = applyRecoveries([initialIncome, groceries, bobPay]);

    // Bob is settled
    people = buildPeopleLedger(rows);
    expect(people.find((p) => p.name === 'Bob')?.owed || 0).toBe(0);

    // Groceries counted amount dropped to ₹500
    const countedGroc = rows.find((r) => r.id === 'groc-1')!;
    expect(countedGroc.amount).toBe(500);

    // Net balance in Pure Mode is 3000 - 500 = 2500
    const catMap = {
      income_cat: { name: 'Salary', is_income: true },
      food_cat: { name: 'Food', is_income: false },
    };
    const pureTotals = calculateExpenseTotals(
      rows.map((r) => ({
        amount: r.amount,
        type: r.type,
        transaction_class: r.transaction_class,
        category_id: r.type === 'income' ? 'income_cat' : 'food_cat',
      })),
      catMap
    );
    expect(pureTotals.totalIncome).toBe(3000);
    expect(pureTotals.totalSpent).toBe(500);
    expect(pureTotals.totalIncome - pureTotals.totalSpent).toBe(2500);
  });

  it('keeps multi-person split allocations intact across cadence switches (Daily -> Weekly -> Monthly)', () => {
    const trip: LedgerRow = {
      id: 'trip-1',
      amount: 900,
      gross_amount: 900,
      type: 'expense',
      expense_date: '2026-10-18',
      split_person: 'Alice, Bob',
      split_amount: 600,
      split_allocations: [
        { person: 'Alice', amount: 300 },
        { person: 'Bob', amount: 300 },
      ],
    };

    const rows = [trip];
    const people = buildPeopleLedger(rows);
    expect(people).toHaveLength(2);
    expect(people.find((p) => p.name === 'Alice')!.owed).toBe(300);
    expect(people.find((p) => p.name === 'Bob')!.owed).toBe(300);

    const view = getSplitView(trip, rows)!;
    expect(view.myShare).toBe(300);
    expect(view.theirShare).toBe(600);
  });
});
