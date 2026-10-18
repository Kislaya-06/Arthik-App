/**
 * Recording money that came back for expenses the user already paid (SPL-003, SPL-004, SPL-006).
 *
 * One call writes ONE money-back row (class 'recovery') that lists the expenses it went back to. If more money
 * arrived than was owed (or than was still out on a refund), the extra becomes a normal income row (SPL-004).
 * Nothing else is touched: the app recomputes the counted amounts from the money-back row, so deleting that row
 * undoes everything exactly.
 */
import { useExpenseStore } from '../expenseStore';
import { planSettlement, planRefund, cleanPersonName, grossAmountOf, type RecoveryPlan } from '../../lib/splitLedger';
import { isRecoveryClass, isExcludedFromTotals } from '../../lib/transactionUtils';
import { round2 } from '../../lib/formatters';

export interface RecordMoneyBackParams {
  /** 'settlement': a person paid back their share. 'refund': a shop / company paid back for one expense. */
  kind: 'settlement' | 'refund';
  /** The person (settlement) or the shop / company (refund). */
  who: string;
  /** Everything that was received. */
  amount: number;
  date: string;
  /** Income can only arrive by upi or cash (UX-002). */
  paymentMode: 'cash' | 'upi';
  /** Settlement: only these expenses (oldest first). Omit to use every open expense of the person. */
  expenseIds?: string[];
  /** Refund: the one expense the refund belongs to. */
  refundExpenseId?: string;
  /** Refund: recipient choice ('everyone' | 'user' | person name). */
  refundTarget?: string;
  /** Use an existing id (Automatic Logging links the row to its bank message). */
  id?: string;
  note?: string;
}

export interface MoneyBackResult {
  plan: RecoveryPlan;
  moneyBackId: string | null;
}

/** What would happen, without saving anything. Used by the screens for the live preview. */
export function previewMoneyBack(
  p: Pick<RecordMoneyBackParams, 'kind' | 'who' | 'amount' | 'expenseIds' | 'refundExpenseId' | 'refundTarget'>
): RecoveryPlan {
  const rows = useExpenseStore.getState().expenses;
  const amount = round2(p.amount);
  return p.kind === 'refund'
    ? planRefund(rows, p.refundExpenseId || '', amount, p.refundTarget)
    : planSettlement(rows, p.who, amount, p.expenseIds);
}

export async function recordMoneyBack(p: RecordMoneyBackParams): Promise<MoneyBackResult> {
  const who = cleanPersonName(p.who);
  const amount = round2(p.amount);
  if (!(amount > 0)) throw new Error('Enter an amount.');
  if (!who) throw new Error(p.kind === 'refund' ? 'Add who paid it back.' : 'Choose a person.');

  const plan = previewMoneyBack({ ...p, who, amount });
  if (plan.allocated <= 0) {
    throw new Error(p.kind === 'refund' ? 'Choose the expense this refund belongs to.' : 'Nothing is left to settle for this person.');
  }

  const store = useExpenseStore.getState();
  const moneyBackId = p.id ?? null;
  const defaultNote = p.kind === 'refund' ? `Refund from ${who}` : `${who} paid back`;

  await store.addExpense(plan.allocated, null, p.note?.trim() || defaultNote, p.paymentMode, p.date, 'income', {
    ...(moneyBackId ? { id: moneyBackId } : {}),
    transactionClass: 'recovery',
    recovery: { kind: p.kind, person: who, allocations: plan.allocations },
  });

  // SPL-004: more than was owed is real, new money, so the extra is ordinary income.
  if (plan.excess > 0) {
    await useExpenseStore
      .getState()
      .addExpense(plan.excess, null, `Extra from ${who}`, p.paymentMode, p.date, 'income');
  }
  return { plan, moneyBackId };
}

export interface ConvertToMoneyBackParams {
  /** An income row already in the app (for example one Automatic Logging created from a bank message). */
  incomeId: string;
  kind: 'settlement' | 'refund';
  who: string;
  expenseIds?: string[];
  refundExpenseId?: string;
  refundTarget?: string;
}

/**
 * "This income was really money coming back." The income row is replaced by a money-back row that keeps the same
 * id (so an Automatic Logging link still works). Any extra over what was owed stays as ordinary income (SPL-004).
 * If saving the money-back row fails, the original income is put back, so no money is ever lost.
 */
export async function convertIncomeToMoneyBack(p: ConvertToMoneyBackParams): Promise<MoneyBackResult> {
  const store = useExpenseStore.getState();
  const income = store.expenses.find((e) => e.id === p.incomeId);
  if (!income || income.type !== 'income' || isExcludedFromTotals(income) || isRecoveryClass(income)) {
    throw new Error('This is not income that can be marked as money back.');
  }
  const amount = grossAmountOf(income);
  const mode = income.payment_mode === 'cash' ? 'cash' : 'upi';
  const plan = previewMoneyBack({
    kind: p.kind,
    who: p.who,
    amount,
    expenseIds: p.expenseIds,
    refundExpenseId: p.refundExpenseId,
    refundTarget: p.refundTarget,
  });
  if (plan.allocated <= 0) throw new Error('Nothing is left to settle for this.');

  await store.deleteExpense(income.id);
  try {
    return await recordMoneyBack({
      kind: p.kind,
      who: p.who,
      amount,
      date: income.expense_date,
      paymentMode: mode,
      expenseIds: p.expenseIds,
      refundExpenseId: p.refundExpenseId,
      refundTarget: p.refundTarget,
      id: income.id,
      note: income.note || undefined,
    });
  } catch (e) {
    await useExpenseStore.getState().addExpense(amount, null, income.note || '', mode, income.expense_date, 'income', { id: income.id });
    throw e;
  }
}
