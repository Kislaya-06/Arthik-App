import { describe, it, expect } from 'vitest';
import {
  buildPeopleLedger,
  buildPersonSummaries,
  getSplitView,
  applyRecoveries,
  planRefund,
  validateSplitAllocations,
  minShareForExpense,
  settledPersonsForExpense,
  type LedgerRow,
} from '../src/lib/splitLedger';

describe('Multi-person split expenses (SPL-001 update)', () => {
  it('splits an expense among multiple people and tracks individual debts', () => {
    // ₹600 dinner split with Alice (₹200) and Bob (₹200); user share is ₹200
    const dinner: LedgerRow = {
      id: 'dinner',
      amount: 600,
      type: 'expense',
      expense_date: '2026-10-18',
      split_person: 'Alice, Bob',
      split_amount: 400,
      split_allocations: [
        { person: 'Alice', amount: 200 },
        { person: 'Bob', amount: 200 },
      ],
    };

    const people = buildPeopleLedger([dinner]);
    expect(people).toHaveLength(2);

    const alice = people.find((p) => p.name === 'Alice')!;
    expect(alice).toBeDefined();
    expect(alice.owed).toBe(200);
    expect(alice.openSplits[0].outstanding).toBe(200);

    const bob = people.find((p) => p.name === 'Bob')!;
    expect(bob).toBeDefined();
    expect(bob.owed).toBe(200);
    expect(bob.openSplits[0].outstanding).toBe(200);

    // Detail view
    const view = getSplitView(dinner, [dinner])!;
    expect(view.paid).toBe(600);
    expect(view.theirShare).toBe(400);
    expect(view.myShare).toBe(200);
    expect(view.allocations).toHaveLength(2);
    expect(view.allocations[0]).toMatchObject({ person: 'Alice', theirShare: 200, outstanding: 200 });
    expect(view.allocations[1]).toMatchObject({ person: 'Bob', theirShare: 200, outstanding: 200 });
  });

  it('settles only Alice when Alice pays back, leaving Bob owing', () => {
    const dinner: LedgerRow = {
      id: 'dinner',
      amount: 600,
      type: 'expense',
      expense_date: '2026-10-18',
      split_person: 'Alice, Bob',
      split_amount: 400,
      split_allocations: [
        { person: 'Alice', amount: 200 },
        { person: 'Bob', amount: 200 },
      ],
    };

    // Alice pays back ₹200
    const alicePay: LedgerRow = {
      id: 'pay-alice',
      amount: 200,
      type: 'income',
      transaction_class: 'recovery',
      recovery_kind: 'settlement',
      recovery_person: 'Alice',
      recovery_allocations: [{ expense_id: 'dinner', amount: 200 }],
    };

    const rows = applyRecoveries([dinner, alicePay]);
    // Counted amount on dinner shrinks to ₹400
    const countedDinner = rows.find((r) => r.id === 'dinner')!;
    expect(countedDinner.amount).toBe(400);
    expect(countedDinner.gross_amount).toBe(600);

    const people = buildPeopleLedger(rows);
    const alice = people.find((p) => p.name === 'Alice');
    const bob = people.find((p) => p.name === 'Bob')!;

    // Alice owes 0, so she has no open splits
    expect(alice?.owed || 0).toBe(0);
    // Bob still owes ₹200
    expect(bob.owed).toBe(200);
    expect(bob.openSplits[0].outstanding).toBe(200);

    // Person summaries
    const summaries = buildPersonSummaries(rows);
    const aliceSummary = summaries.find((p) => p.name === 'Alice')!;
    expect(aliceSummary.isSettled).toBe(true);
    expect(aliceSummary.totalPaidBack).toBe(200);

    const bobSummary = summaries.find((p) => p.name === 'Bob')!;
    expect(bobSummary.isSettled).toBe(false);
    expect(bobSummary.owed).toBe(200);
  });

  it('validates multi-person split allocations', () => {
    expect(validateSplitAllocations(500, [])).toBe('Add a name.');
    expect(validateSplitAllocations(500, [{ person: '', amount: 100 }])).toBe('Add a name.');
    expect(validateSplitAllocations(500, [
      { person: 'Alice', amount: 200 },
      { person: '', amount: 100 },
    ])).toBe('Person #2 needs a name.');
    expect(validateSplitAllocations(500, [
      { person: 'Alice', amount: 200 },
      { person: 'Bob', amount: 0 },
    ])).toBe('Enter share for Bob.');
    expect(validateSplitAllocations(500, [
      { person: 'Alice', amount: 300 },
      { person: 'Bob', amount: 250 },
    ])).toBe('Total shares cannot be more than the amount.');
    expect(validateSplitAllocations(500, [
      { person: 'Alice', amount: 200 },
      { person: 'Bob', amount: 200 },
    ])).toBeNull();
  });

  it('tracks per-person minimum share bounds when money comes back for multi-person split (SPL-006)', () => {
    const dinner: LedgerRow = {
      id: 'dinner',
      amount: 600,
      type: 'expense',
      expense_date: '2026-10-18',
      split_person: 'Alice, Bob',
      split_amount: 400,
      split_allocations: [
        { person: 'Alice', amount: 200 },
        { person: 'Bob', amount: 200 },
      ],
    };

    const alicePay: LedgerRow = {
      id: 'pay-alice',
      amount: 150,
      type: 'income',
      transaction_class: 'recovery',
      recovery_kind: 'settlement',
      recovery_person: 'Alice',
      recovery_allocations: [{ expense_id: 'dinner', amount: 150 }],
    };

    const rows = [dinner, alicePay];

    // Total settlement on dinner is ₹150
    expect(minShareForExpense(rows, 'dinner')).toBe(150);

    // Alice specifically settled ₹150
    expect(minShareForExpense(rows, 'dinner', 'Alice')).toBe(150);
    expect(minShareForExpense(rows, 'dinner', 'alice')).toBe(150);

    // Bob settled ₹0
    expect(minShareForExpense(rows, 'dinner', 'Bob')).toBe(0);

    // Settled persons list
    const settled = settledPersonsForExpense(rows, 'dinner');
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({
      key: 'alice',
      name: 'Alice',
      amount: 150,
    });
  });

  describe('Solution 2: Multi-person merchant refunds and attribution', () => {
    // ₹1,000 dinner with Alice (₹400) and Bob (₹400); user share is ₹200
    const dinner1000: LedgerRow = {
      id: 'dinner-1000',
      amount: 1000,
      type: 'expense',
      expense_date: '2026-10-18',
      split_person: 'Alice, Bob',
      split_amount: 800,
      split_allocations: [
        { person: 'Alice', amount: 400 },
        { person: 'Bob', amount: 400 },
      ],
    };

    it('Option A (everyone): proportional refund reduces each share and never falsely zeroes Bob when Alice settles', () => {
      // Merchant refunds ₹700 to everyone
      const refund700: LedgerRow = {
        id: 'refund-700',
        amount: 700,
        type: 'income',
        transaction_class: 'recovery',
        recovery_kind: 'refund',
        recovery_person: 'Restaurant',
        recovery_allocations: [{ expense_id: 'dinner-1000', amount: 700, refund_target: 'everyone' }],
      };

      const rowsAfterRefund = applyRecoveries([dinner1000, refund700]);
      const peopleAfterRefund = buildPeopleLedger(rowsAfterRefund);

      const alice = peopleAfterRefund.find((p) => p.name === 'Alice')!;
      const bob = peopleAfterRefund.find((p) => p.name === 'Bob')!;

      // 40% of 700 = 280 refund share each. 400 - 280 = 120 remaining
      expect(alice.owed).toBe(120);
      expect(bob.owed).toBe(120);

      // Now Alice repays her ₹120 share
      const alicePay: LedgerRow = {
        id: 'alice-pay',
        amount: 120,
        type: 'income',
        transaction_class: 'recovery',
        recovery_kind: 'settlement',
        recovery_person: 'Alice',
        recovery_allocations: [{ expense_id: 'dinner-1000', amount: 120 }],
      };

      const rowsAfterAlicePay = applyRecoveries([dinner1000, refund700, alicePay]);
      const peopleAfterAlicePay = buildPeopleLedger(rowsAfterAlicePay);

      const aliceFinal = peopleAfterAlicePay.find((p) => p.name === 'Alice');
      const bobFinal = peopleAfterAlicePay.find((p) => p.name === 'Bob')!;

      // Alice is fully settled (owes 0)
      expect(aliceFinal?.owed || 0).toBe(0);
      // Bob STILL owes ₹120 (NOT wiped out to 0!)
      expect(bobFinal.owed).toBe(120);
      expect(bobFinal.openSplits[0].outstanding).toBe(120);

      // Detail view
      const view = getSplitView(dinner1000, rowsAfterAlicePay)!;
      expect(view.allocations.find((a) => a.person === 'Alice')!.isSettled).toBe(true);
      expect(view.allocations.find((a) => a.person === 'Bob')!.isSettled).toBe(false);
      expect(view.allocations.find((a) => a.person === 'Bob')!.outstanding).toBe(120);
    });

    it('Option B (specific person): targeting Bob reduces Bob share and leaves Alice untouched', () => {
      // Merchant refunds ₹400 targeted specifically to Bob (e.g. Bob cancelled dish)
      const bobRefund: LedgerRow = {
        id: 'bob-refund',
        amount: 400,
        type: 'income',
        transaction_class: 'recovery',
        recovery_kind: 'refund',
        recovery_person: 'Restaurant',
        recovery_allocations: [{ expense_id: 'dinner-1000', amount: 400, refund_target: 'Bob' }],
      };

      const rows = applyRecoveries([dinner1000, bobRefund]);
      const people = buildPeopleLedger(rows);

      const alice = people.find((p) => p.name === 'Alice')!;
      const bob = people.find((p) => p.name === 'Bob');

      // Alice still owes her full ₹400
      expect(alice.owed).toBe(400);
      // Bob is settled by the refund (owes 0)
      expect(bob?.owed || 0).toBe(0);

      const view = getSplitView(dinner1000, rows)!;
      expect(view.allocations.find((a) => a.person === 'Bob')!.isSettled).toBe(true);
      expect(view.allocations.find((a) => a.person === 'Alice')!.outstanding).toBe(400);
    });

    it('Option B (user/me): targeting user reduces user share leaving all friends untouched', () => {
      // Merchant refunds ₹200 targeted to user
      const userRefund: LedgerRow = {
        id: 'user-refund',
        amount: 200,
        type: 'income',
        transaction_class: 'recovery',
        recovery_kind: 'refund',
        recovery_person: 'Restaurant',
        recovery_allocations: [{ expense_id: 'dinner-1000', amount: 200, refund_target: 'user' }],
      };

      const rows = applyRecoveries([dinner1000, userRefund]);
      const people = buildPeopleLedger(rows);

      const alice = people.find((p) => p.name === 'Alice')!;
      const bob = people.find((p) => p.name === 'Bob')!;

      // Both friends still owe full shares
      expect(alice.owed).toBe(400);
      expect(bob.owed).toBe(400);
    });

    it('planRefund previewBreakdown generates real-time previews for interactive UI', () => {
      // Plan refund with 'everyone'
      const planEveryone = planRefund([dinner1000], 'dinner-1000', 700, 'everyone');
      expect(planEveryone.allocated).toBe(700);
      expect(planEveryone.previewBreakdown).toBeDefined();
      expect(planEveryone.previewBreakdown!.userShareBefore).toBe(200);
      expect(planEveryone.previewBreakdown!.userShareAfter).toBe(60);
      expect(planEveryone.previewBreakdown!.members).toEqual([
        { person: 'Alice', shareBefore: 400, shareAfter: 120 },
        { person: 'Bob', shareBefore: 400, shareAfter: 120 },
      ]);

      // Plan refund targeted to 'Bob'
      const planBob = planRefund([dinner1000], 'dinner-1000', 400, 'Bob');
      expect(planBob.previewBreakdown!.members).toEqual([
        { person: 'Alice', shareBefore: 400, shareAfter: 400 },
        { person: 'Bob', shareBefore: 400, shareAfter: 0 },
      ]);

      // Plan refund targeted to 'user'
      const planUser = planRefund([dinner1000], 'dinner-1000', 200, 'user');
      expect(planUser.previewBreakdown!.userShareAfter).toBe(0);
      expect(planUser.previewBreakdown!.members).toEqual([
        { person: 'Alice', shareBefore: 400, shareAfter: 400 },
        { person: 'Bob', shareBefore: 400, shareAfter: 400 },
      ]);
    });
  });
});
