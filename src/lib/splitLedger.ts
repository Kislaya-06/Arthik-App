/**
 * splitLedger.ts — Split expenses, money back and refunds (canonical rules SPL-001..SPL-006).
 *
 * The idea in one paragraph: when the user pays for a friend, the expense row keeps the FULL amount paid
 * (real money left the account) and records the friend's share (`split_person`, `split_amount`).
 * When that money comes back, the app writes ONE "money back" row (`transaction_class = 'recovery'`, income
 * direction) that lists which expenses it went back to (`recovery_allocations`). It is never income.
 *
 * The counted amount of an expense is `amount paid - money that came back for it`. That is computed here, in
 * ONE place, and applied when rows enter the expense store (`applyRecoveries`), so every total, budget day,
 * Gullak figure and chart sees the reduced amount automatically, from the day of the original expense.
 * Nothing is stored twice: deleting the money-back row brings every amount back exactly as it was.
 *
 * Pure functions only. No store imports.
 */
import { round2 } from './formatters';
import { isRecoveryClass } from './transactionUtils';

export interface LedgerAllocation {
  expense_id: string;
  amount: number;
  refund_target?: string;
}

export interface SplitAllocation {
  person: string;
  amount: number;
}

/** The fields of an expense row this module needs. The store's `Expense` satisfies it. */
export interface LedgerRow {
  id: string;
  amount: number | string;
  gross_amount?: number | null;
  type?: string;
  note?: string | null;
  expense_date?: string;
  created_at?: string;
  category_id?: string | null;
  transaction_class?: string | null;
  split_person?: string | null;
  split_amount?: number | string | null;
  split_allocations?: SplitAllocation[] | null;
  recovery_kind?: 'settlement' | 'refund' | string | null;
  recovery_person?: string | null;
  recovery_allocations?: LedgerAllocation[] | null;
}

export const MAX_PERSON_NAME = 40;

/** Trim, collapse spaces, cap length. */
export const cleanPersonName = (name: string | null | undefined): string =>
  (name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_PERSON_NAME);

/** Case-insensitive identity of a person ("prithvish" and "Prithvish " are the same person). */
export const personKey = (name: string | null | undefined): string => cleanPersonName(name).toLowerCase();

/** Returns all split allocations for this row (supporting both multi-person and legacy single-person). */
export function splitAllocationsOf(row: LedgerRow): SplitAllocation[] {
  if (Array.isArray(row.split_allocations) && row.split_allocations.length > 0) {
    const out: SplitAllocation[] = [];
    for (const a of row.split_allocations) {
      const name = cleanPersonName(a?.person);
      const amount = round2(Number(a?.amount) || 0);
      if (name && amount > 0) {
        out.push({ person: name, amount });
      }
    }
    if (out.length > 0) return out;
  }
  const name = cleanPersonName(row.split_person);
  const amount = round2(Number(row.split_amount) || 0);
  if (name && amount > 0) {
    return [{ person: name, amount }];
  }
  return [];
}

/** The amount actually paid: the original amount before any money came back. */
export const grossAmountOf = (row: Pick<LedgerRow, 'amount' | 'gross_amount'>): number =>
  round2(Number(row.gross_amount ?? row.amount) || 0);

const isExpenseRow = (row: LedgerRow): boolean =>
  row.type !== 'income' && !isRecoveryClass(row) && row.transaction_class !== 'self_transfer';

/** Clean list of allocations of a money-back row (bad / empty slices are dropped). */
export const allocationsOf = (row: LedgerRow): LedgerAllocation[] => {
  if (!isRecoveryClass(row) || !Array.isArray(row.recovery_allocations)) return [];
  const out: LedgerAllocation[] = [];
  for (const a of row.recovery_allocations) {
    const amount = round2(Number(a?.amount) || 0);
    if (a && typeof a.expense_id === 'string' && amount > 0) {
      out.push({
        expense_id: a.expense_id,
        amount,
        ...(a.refund_target ? { refund_target: cleanPersonName(a.refund_target) } : {}),
      });
    }
  }
  return out;
};

export interface RecoveredTotals {
  /** Everything that came back for the expense. */
  total: number;
  /** The part that came back from the split person (kind = settlement). */
  settlement: number;
  /** The part that came back as a refund. */
  refund: number;
  /** Slices tracked per person key (from settlements). */
  settlementByPerson: Map<string, number>;
  /** Refund amounts targeted to specific person keys (or 'user'/'me'). */
  refundByPerson: Map<string, number>;
  /** General refunds (not targeted to a specific person, i.e. 'everyone' or unspecified). */
  generalRefund: number;
}

/** expense id -> how much came back for it, split by kind. */
export function recoveredByExpense(rows: LedgerRow[]): Map<string, RecoveredTotals> {
  const map = new Map<string, RecoveredTotals>();
  for (const row of rows) {
    if (!isRecoveryClass(row)) continue;
    const isRefund = row.recovery_kind === 'refund';
    const pKey = personKey(row.recovery_person);
    for (const a of allocationsOf(row)) {
      const cur = map.get(a.expense_id) || {
        total: 0,
        settlement: 0,
        refund: 0,
        settlementByPerson: new Map<string, number>(),
        refundByPerson: new Map<string, number>(),
        generalRefund: 0,
      };
      cur.total = round2(cur.total + a.amount);
      if (isRefund) {
        cur.refund = round2(cur.refund + a.amount);
        const targetKey = a.refund_target ? personKey(a.refund_target) : undefined;
        if (targetKey && targetKey !== 'everyone' && targetKey !== 'all') {
          const prev = cur.refundByPerson.get(targetKey) || 0;
          cur.refundByPerson.set(targetKey, round2(prev + a.amount));
        } else {
          cur.generalRefund = round2(cur.generalRefund + a.amount);
        }
      } else {
        cur.settlement = round2(cur.settlement + a.amount);
        if (pKey) {
          const prev = cur.settlementByPerson.get(pKey) || 0;
          cur.settlementByPerson.set(pKey, round2(prev + a.amount));
        }
      }
      map.set(a.expense_id, cur);
    }
  }
  return map;
}

/**
 * SPL-003: returns the rows with every expense's `amount` reduced by the money that came back for it.
 * `gross_amount` keeps the amount paid. Safe to run again on its own output (it always starts from gross).
 * Money-back rows are returned untouched (they are excluded from totals by their class).
 */
export function applyRecoveries<T extends LedgerRow>(rows: T[]): T[] {
  const recovered = recoveredByExpense(rows);
  let changed = false;
  const out = rows.map((row) => {
    if (!isExpenseRow(row)) return row;
    const gross = grossAmountOf(row);
    const back = recovered.get(row.id)?.total || 0;
    const net = round2(Math.max(0, gross - back));
    if (back === 0 && row.gross_amount === undefined) return row;
    if (row.amount === net && row.gross_amount === gross) return row;
    changed = true;
    return { ...row, amount: net, gross_amount: gross };
  });
  return changed ? out : rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// People and what they owe
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenSplit {
  expenseId: string;
  date: string;
  note: string;
  /** Their share of the expense. */
  theirShare: number;
  /** How much of their share already came back. */
  settled: number;
  /** What they still owe on this expense. */
  outstanding: number;
}

export interface PersonLedger {
  key: string;
  /** Name as the user first typed it. */
  name: string;
  /** Total they still owe. */
  owed: number;
  /** Expenses where they still owe something, oldest first (the order money is matched in). */
  openSplits: OpenSplit[];
  /** Date of the newest split with this person. */
  lastDate: string;
}

const byDateThenCreated = (a: LedgerRow, b: LedgerRow): number =>
  (a.expense_date || '').localeCompare(b.expense_date || '') ||
  (a.created_at || '').localeCompare(b.created_at || '') ||
  a.id.localeCompare(b.id);

/** How much of an expense is still "out" (paid by the user, not yet back). */
export const remainingGross = (row: LedgerRow, recovered: Map<string, RecoveredTotals>): number =>
  round2(Math.max(0, grossAmountOf(row) - (recovered.get(row.id)?.total || 0)));

/** What the split person still owes on one expense. Never more than the money still out. */
export const outstandingOnExpense = (
  row: LedgerRow,
  recovered: Map<string, RecoveredTotals>,
  personName?: string
): number => {
  const allocations = splitAllocationsOf(row);
  if (allocations.length === 0) return 0;
  const rec = recovered.get(row.id);
  const room = remainingGross(row, recovered);
  if (room <= 0) return 0;

  const gross = grossAmountOf(row);

  if (personName) {
    const targetKey = personKey(personName);
    const alloc = allocations.find((a) => personKey(a.person) === targetKey);
    if (!alloc) return 0;
    const settled = rec?.settlementByPerson?.get(targetKey) ?? (allocations.length === 1 ? (rec?.settlement || 0) : 0);
    const targetedRefund = rec?.refundByPerson?.get(targetKey) || 0;
    const generalRefund = rec?.generalRefund || 0;
    const ratio = gross > 0 ? alloc.amount / gross : 0;
    const generalShare = round2(generalRefund * ratio);
    const personOwed = round2(Math.max(0, alloc.amount - settled - targetedRefund - generalShare));
    return round2(Math.min(personOwed, room));
  }

  let totalOutstanding = 0;
  for (const alloc of allocations) {
    const key = personKey(alloc.person);
    const settled = rec?.settlementByPerson?.get(key) ?? (allocations.length === 1 ? (rec?.settlement || 0) : 0);
    const targetedRefund = rec?.refundByPerson?.get(key) || 0;
    const generalRefund = rec?.generalRefund || 0;
    const ratio = gross > 0 ? alloc.amount / gross : 0;
    const generalShare = round2(generalRefund * ratio);
    const personOwed = round2(Math.max(0, alloc.amount - settled - targetedRefund - generalShare));
    totalOutstanding = round2(totalOutstanding + personOwed);
  }
  return round2(Math.min(totalOutstanding, room));
};

/** Everyone the user ever split with, newest first, with what each still owes. */
export function buildPeopleLedger(rows: LedgerRow[]): PersonLedger[] {
  const recovered = recoveredByExpense(rows);
  const people = new Map<string, PersonLedger>();
  const splitRows = rows.filter((r) => isExpenseRow(r) && splitAllocationsOf(r).length > 0);
  for (const row of [...splitRows].sort(byDateThenCreated)) {
    const allocations = splitAllocationsOf(row);
    const rec = recovered.get(row.id);
    for (const alloc of allocations) {
      const name = alloc.person;
      const key = personKey(name);
      const person = people.get(key) || { key, name, owed: 0, openSplits: [], lastDate: '' };
      const share = alloc.amount;
      const settled = round2(rec?.settlementByPerson?.get(key) ?? (allocations.length === 1 ? (rec?.settlement || 0) : 0));
      const outstanding = outstandingOnExpense(row, recovered, name);
      if (outstanding > 0) {
        person.openSplits.push({
          expenseId: row.id,
          date: row.expense_date || '',
          note: row.note || '',
          theirShare: share,
          settled,
          outstanding,
        });
        person.owed = round2(person.owed + outstanding);
      }
      if ((row.expense_date || '') >= person.lastDate) person.lastDate = row.expense_date || '';
      people.set(key, person);
    }
  }
  return Array.from(people.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
}

/** Fast early-exit check to determine if any split expense remains unsettled (SPL-002). */
export function hasUnsettledSplitExpenses(rows: LedgerRow[]): boolean {
  const splitRows = rows.filter((r) => isExpenseRow(r) && splitAllocationsOf(r).length > 0);
  if (splitRows.length === 0) return false;
  const recovered = recoveredByExpense(rows);
  for (let i = 0; i < splitRows.length; i++) {
    const row = splitRows[i];
    const allocations = splitAllocationsOf(row);
    for (let j = 0; j < allocations.length; j++) {
      if (outstandingOnExpense(row, recovered, allocations[j].person) > 0) {
        return true;
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching an incoming payment to a person (SPL-005)
// ─────────────────────────────────────────────────────────────────────────────

const tokens = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const tokenMatches = (personToken: string, otherToken: string): boolean => {
  if (personToken === otherToken) return true;
  if (personToken.length >= 3 && otherToken.startsWith(personToken)) return true;
  if (otherToken.length >= 3 && personToken.startsWith(otherToken)) return true;
  // Banks often print an initial: "PRITHVISH K" matches "Prithvish Kumar".
  if (otherToken.length === 1 && personToken.startsWith(otherToken)) return true;
  return false;
};

/** Does the sender name from a bank message belong to this saved person? Every word of the saved name must be found. */
export function nameMatches(personName: string, senderName: string | null | undefined): boolean {
  if (!senderName) return false;
  const p = tokens(personName);
  const s = tokens(senderName);
  if (p.length === 0 || s.length === 0) return false;
  return p.every((pt) => s.some((st) => tokenMatches(pt, st)));
}

export interface PersonMatch {
  person: PersonLedger;
  /** 'exact': name matches AND the amount equals what they owe in total or on one expense. 'name': name only. */
  kind: 'exact' | 'name';
}

/**
 * Name AND amount first, then name only (the owner's priority). Only people who still owe something are returned.
 * An amount alone (no name match) is never enough.
 */
export function matchIncomingToPeople(
  people: PersonLedger[],
  incoming: { amount: number; sender?: string | null }
): PersonMatch[] {
  const amount = round2(incoming.amount);
  const matches: PersonMatch[] = [];
  for (const person of people) {
    if (person.owed <= 0 || !nameMatches(person.name, incoming.sender)) continue;
    const exact = person.owed === amount || person.openSplits.some((s) => s.outstanding === amount);
    matches.push({ person, kind: exact ? 'exact' : 'name' });
  }
  return matches.sort((a, b) => (a.kind === b.kind ? b.person.owed - a.person.owed : a.kind === 'exact' ? -1 : 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning a settlement or a refund (SPL-004, SPL-006)
// ─────────────────────────────────────────────────────────────────────────────

export interface RefundPreviewBreakdown {
  userShareBefore: number;
  userShareAfter: number;
  members: Array<{
    person: string;
    shareBefore: number;
    shareAfter: number;
  }>;
}

export interface RecoveryPlan {
  allocations: LedgerAllocation[];
  /** Part of the received amount that goes back against expenses. */
  allocated: number;
  /** Part that is left over (more than was owed): it becomes normal income (SPL-004). */
  excess: number;
  /** Targeted recipient for refund (Solution 2): 'everyone' | 'user' | person name */
  target?: string;
  previewBreakdown?: RefundPreviewBreakdown;
}

/**
 * A person paid back `amount`. Oldest unpaid expense first, never more than they owe on each.
 * `onlyExpenseIds` limits it to ticked expenses (review screen), still oldest first.
 */
export function planSettlement(
  rows: LedgerRow[],
  person: string,
  amount: number,
  onlyExpenseIds?: string[]
): RecoveryPlan {
  const ledger = buildPeopleLedger(rows).find((p) => p.key === personKey(person));
  let left = round2(amount);
  const allocations: LedgerAllocation[] = [];
  for (const open of ledger?.openSplits || []) {
    if (left <= 0) break;
    if (onlyExpenseIds && !onlyExpenseIds.includes(open.expenseId)) continue;
    const take = round2(Math.min(left, open.outstanding));
    if (take <= 0) continue;
    allocations.push({ expense_id: open.expenseId, amount: take });
    left = round2(left - take);
  }
  const allocated = round2(allocations.reduce((s, a) => s + a.amount, 0));
  return { allocations, allocated, excess: round2(Math.max(0, amount - allocated)) };
}

/** A shop / company paid back `amount` for one expense. Never more than is still out on it. */
export function planRefund(
  rows: LedgerRow[],
  expenseId: string,
  amount: number,
  target?: string
): RecoveryPlan {
  const recovered = recoveredByExpense(rows);
  const row = rows.find((r) => r.id === expenseId && isExpenseRow(r));
  const room = row ? remainingGross(row, recovered) : 0;
  const take = round2(Math.min(round2(amount), room));
  const cleanTarget = target ? cleanPersonName(target) : undefined;

  const allocations: LedgerAllocation[] =
    take > 0
      ? [
          {
            expense_id: expenseId,
            amount: take,
            ...(cleanTarget ? { refund_target: cleanTarget } : {}),
          },
        ]
      : [];

  let previewBreakdown: RefundPreviewBreakdown | undefined;

  if (row && take > 0) {
    const allocationsList = splitAllocationsOf(row);
    if (allocationsList.length > 0) {
      const gross = grossAmountOf(row);
      const totalTheirShare = round2(allocationsList.reduce((sum, a) => sum + a.amount, 0));
      const userOriginalShare = round2(Math.max(0, gross - totalTheirShare));
      const rec = recovered.get(row.id);

      const userTargeted =
        (rec?.refundByPerson.get('user') || 0) + (rec?.refundByPerson.get('me') || 0);
      const userRatio = gross > 0 ? userOriginalShare / gross : 0;
      const userGeneralShare = round2((rec?.generalRefund || 0) * userRatio);
      const userShareBefore = round2(Math.max(0, userOriginalShare - userTargeted - userGeneralShare));

      const isTargetEveryone =
        !cleanTarget ||
        personKey(cleanTarget) === 'everyone' ||
        personKey(cleanTarget) === 'all';
      const isTargetUser =
        cleanTarget && (personKey(cleanTarget) === 'user' || personKey(cleanTarget) === 'me');

      let userShareAfter = userShareBefore;
      const members = allocationsList.map((alloc) => {
        const shareBefore = outstandingOnExpense(row, recovered, alloc.person);
        let shareAfter = shareBefore;

        if (isTargetEveryone) {
          const ratio = gross > 0 ? alloc.amount / gross : 0;
          const reduction = round2(take * ratio);
          shareAfter = round2(Math.max(0, shareBefore - reduction));
        } else if (!isTargetUser && personKey(cleanTarget) === personKey(alloc.person)) {
          shareAfter = round2(Math.max(0, shareBefore - take));
          if (take > shareBefore) {
            const spill = round2(take - shareBefore);
            userShareAfter = round2(Math.max(0, userShareAfter - spill));
          }
        }
        return {
          person: alloc.person,
          shareBefore,
          shareAfter,
        };
      });

      if (isTargetEveryone) {
        const userReduction = round2(take * userRatio);
        userShareAfter = round2(Math.max(0, userShareBefore - userReduction));
      } else if (isTargetUser) {
        userShareAfter = round2(Math.max(0, userShareBefore - take));
      }

      previewBreakdown = {
        userShareBefore,
        userShareAfter,
        members,
      };
    }
  }

  return {
    allocations,
    allocated: take,
    excess: round2(Math.max(0, amount - take)),
    target: cleanTarget,
    previewBreakdown,
  };
}

export interface RefundCandidate {
  id: string;
  date: string;
  note: string;
  /** Amount paid. */
  paid: number;
  /** Still out (paid minus money already back). */
  remaining: number;
}

/** Expenses a refund could belong to, newest first. Expenses that are fully paid back are left out. */
export function refundCandidates(rows: LedgerRow[]): RefundCandidate[] {
  const recovered = recoveredByExpense(rows);
  return rows
    .filter(isExpenseRow)
    .map((r) => ({
      id: r.id,
      date: r.expense_date || '',
      note: r.note || '',
      paid: grossAmountOf(r),
      remaining: remainingGross(r, recovered),
    }))
    .filter((c) => c.remaining > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─────────────────────────────────────────────────────────────────────────────
// Views for the screens
// ─────────────────────────────────────────────────────────────────────────────

export interface SplitAllocationView {
  person: string;
  theirShare: number;
  settled: number;
  outstanding: number;
  isSettled: boolean;
}

export interface SplitView {
  person: string;
  paid: number;
  theirShare: number;
  /** What the user really spends: paid minus their share. */
  myShare: number;
  settled: number;
  outstanding: number;
  isSettled: boolean;
  allocations: SplitAllocationView[];
}

/** The numbers of a split expense, or null when the expense is not split. */
export function getSplitView(expense: LedgerRow, rows: LedgerRow[]): SplitView | null {
  const allocations = splitAllocationsOf(expense);
  if (allocations.length === 0 || !isExpenseRow(expense)) return null;
  const recovered = recoveredByExpense(rows);
  const paid = grossAmountOf(expense);
  const totalTheirShare = round2(allocations.reduce((sum, a) => sum + a.amount, 0));
  const rec = recovered.get(expense.id);
  const totalSettled = round2(rec?.settlement || 0);
  const totalOutstanding = outstandingOnExpense(expense, recovered);

  const allocationViews: SplitAllocationView[] = allocations.map((a) => {
    const pKey = personKey(a.person);
    const settled = round2(rec?.settlementByPerson?.get(pKey) ?? (allocations.length === 1 ? totalSettled : 0));
    const outstanding = outstandingOnExpense(expense, recovered, a.person);
    return {
      person: a.person,
      theirShare: a.amount,
      settled,
      outstanding,
      isSettled: outstanding <= 0,
    };
  });

  const names = allocations.map((a) => a.person).join(', ');
  return {
    person: names,
    paid,
    theirShare: totalTheirShare,
    myShare: round2(Math.max(0, paid - totalTheirShare)),
    settled: totalSettled,
    outstanding: totalOutstanding,
    isSettled: totalOutstanding <= 0,
    allocations: allocationViews,
  };
}

/** Money-back rows that point at this expense, newest first. */
export const recoveriesForExpense = (rows: LedgerRow[], expenseId: string): LedgerRow[] =>
  rows
    .filter((r) => isRecoveryClass(r) && allocationsOf(r).some((a) => a.expense_id === expenseId))
    .sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || ''));

export interface RecoverySlice {
  expenseId: string;
  /** Original expense, or null if it no longer exists. */
  expense: LedgerRow | null;
  amount: number;
}

/** The slices of a money-back row joined with their expenses (for the detail screen). */
export function recoverySlices(recovery: LedgerRow, rows: LedgerRow[]): RecoverySlice[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return allocationsOf(recovery).map((a) => ({
    expenseId: a.expense_id,
    expense: byId.get(a.expense_id) || null,
    amount: a.amount,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards (SPL-001, SPL-006)
// ─────────────────────────────────────────────────────────────────────────────

/** Error text for split allocations the user is typing, or null if it is fine. */
export function validateSplitAllocations(
  paid: number,
  allocations: { person: string; amount: number }[]
): string | null {
  if (!allocations || allocations.length === 0) return 'Add a name.';
  const isSingle = allocations.length === 1;
  const seenKeys = new Set<string>();
  let totalShare = 0;
  for (let i = 0; i < allocations.length; i++) {
    const name = cleanPersonName(allocations[i].person);
    if (!name) return isSingle ? 'Add a name.' : `Person #${i + 1} needs a name.`;
    const key = personKey(name);
    if (seenKeys.has(key)) {
      return `"${name}" was added more than once. Combine their share into one row.`;
    }
    seenKeys.add(key);
    const amt = round2(allocations[i].amount);
    if (!(amt > 0)) return isSingle ? 'Enter their share.' : `Enter share for ${name}.`;
    totalShare = round2(totalShare + amt);
  }
  if (round2(totalShare) > round2(paid)) {
    return isSingle ? 'Their share cannot be more than the amount.' : 'Total shares cannot be more than the amount.';
  }
  return null;
}

/** Error text for a split the user is typing, or null if it is fine. */
export function validateSplit(paid: number, person: string, theirShare: number): string | null {
  return validateSplitAllocations(paid, [{ person, amount: theirShare }]);
}

/** The expense amount can never go below money that already came back for it. */
export const minAmountForExpense = (rows: LedgerRow[], expenseId: string): number =>
  recoveredByExpense(rows).get(expenseId)?.total || 0;

/** Their share can never go below what they already paid back. If personName is given, returns what that specific person paid back. */
export function minShareForExpense(rows: LedgerRow[], expenseId: string, personName?: string): number {
  const rec = recoveredByExpense(rows).get(expenseId);
  if (!rec) return 0;
  if (personName) {
    const key = personKey(personName);
    const byPerson = rec.settlementByPerson.get(key);
    if (byPerson !== undefined) return byPerson;
    const exp = rows.find((r) => r.id === expenseId);
    if (exp) {
      const allocs = splitAllocationsOf(exp);
      if (allocs.length === 1 && personKey(allocs[0].person) === key) {
        return rec.settlement;
      }
    }
    return 0;
  }
  return rec.settlement;
}

export interface SettledPersonInfo {
  key: string;
  name: string;
  amount: number;
}

/** All persons who have settled some or all of their share on this expense. */
export function settledPersonsForExpense(rows: LedgerRow[], expenseId: string): SettledPersonInfo[] {
  const rec = recoveredByExpense(rows).get(expenseId);
  if (!rec) return [];
  const exp = rows.find((r) => r.id === expenseId);
  const allocs = exp ? splitAllocationsOf(exp) : [];
  const nameByKey = new Map<string, string>();
  for (const a of allocs) {
    nameByKey.set(personKey(a.person), a.person);
  }

  const result: SettledPersonInfo[] = [];
  if (rec.settlementByPerson.size > 0) {
    for (const [key, amount] of rec.settlementByPerson.entries()) {
      if (amount > 0) {
        result.push({
          key,
          name: nameByKey.get(key) || key,
          amount,
        });
      }
    }
  } else if (rec.settlement > 0 && allocs.length === 1) {
    result.push({
      key: personKey(allocs[0].person),
      name: allocs[0].person,
      amount: rec.settlement,
    });
  }
  return result;
}

/** Why this expense cannot be deleted right now, or null. Money back that points at it must go first. */
export function deleteBlockReason(expenseId: string, rows: LedgerRow[]): string | null {
  const back = recoveredByExpense(rows).get(expenseId)?.total || 0;
  return back > 0
    ? 'Money that came back is linked to this expense. Delete that money-back entry first.'
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full ledger per person (the "Ledger" screen)
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerSplitLine {
  expenseId: string;
  date: string;
  note: string;
  theirShare: number;
  settled: number;
  outstanding: number;
  isSettled: boolean;
}

export interface LedgerPayment {
  /** The money-back row. */
  id: string;
  date: string;
  /** The part of it that went to THIS person's expenses. */
  amount: number;
}

export interface PersonSummary {
  key: string;
  name: string;
  /** Still owed. */
  owed: number;
  /** Everything ever shared with them. */
  totalShared: number;
  /** Everything they paid back so far. */
  totalPaidBack: number;
  /** Every shared expense, newest first (settled ones included). */
  splits: LedgerSplitLine[];
  /** Every payment back, newest first. */
  payments: LedgerPayment[];
  /** Date of the newest split or payment. */
  lastActivity: string;
  isSettled: boolean;
}

/** Everyone the user ever split with: who owes what, what was paid back and when. People who still owe come first. */
export function buildPersonSummaries(rows: LedgerRow[]): PersonSummary[] {
  const recovered = recoveredByExpense(rows);
  const byKey = new Map<string, PersonSummary>();
  const expenseOwner = new Map<string, string>();
  const expensePersons = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!isExpenseRow(row)) continue;
    const allocations = splitAllocationsOf(row);
    if (allocations.length === 0) continue;
    const rec = recovered.get(row.id);
    const personsSet = expensePersons.get(row.id) || new Set<string>();
    for (const alloc of allocations) {
      const name = alloc.person;
      const share = alloc.amount;
      const key = personKey(name);
      personsSet.add(key);
      const summary =
        byKey.get(key) ||
        { key, name, owed: 0, totalShared: 0, totalPaidBack: 0, splits: [], payments: [], lastActivity: '', isSettled: true };
      const settled = round2(rec?.settlementByPerson?.get(key) ?? (allocations.length === 1 ? (rec?.settlement || 0) : 0));
      const targetedRefund = round2(rec?.refundByPerson?.get(key) || 0);
      const generalRefund = rec?.generalRefund || 0;
      const ratio = grossAmountOf(row) > 0 ? alloc.amount / grossAmountOf(row) : 0;
      const generalShare = round2(generalRefund * ratio);
      const totalRelieved = round2(settled + targetedRefund + generalShare);
      const outstanding = outstandingOnExpense(row, recovered, name);
      summary.splits.push({
        expenseId: row.id,
        date: row.expense_date || '',
        note: row.note || '',
        theirShare: share,
        settled: totalRelieved,
        outstanding,
        isSettled: outstanding <= 0,
      });
      summary.owed = round2(summary.owed + outstanding);
      summary.totalShared = round2(summary.totalShared + share);
      summary.totalPaidBack = round2(summary.totalPaidBack + totalRelieved);
      if ((row.expense_date || '') > summary.lastActivity) summary.lastActivity = row.expense_date || '';
      byKey.set(key, summary);
      if (!expenseOwner.has(row.id)) expenseOwner.set(row.id, key);
    }
    expensePersons.set(row.id, personsSet);
  }

  for (const row of rows) {
    if (!isRecoveryClass(row) || row.recovery_kind === 'refund') continue;
    const pKey = personKey(row.recovery_person);
    const perPerson = new Map<string, number>();
    for (const a of allocationsOf(row)) {
      const persons = expensePersons.get(a.expense_id);
      const key = (pKey && persons?.has(pKey)) ? pKey : expenseOwner.get(a.expense_id);
      if (key) perPerson.set(key, round2((perPerson.get(key) || 0) + a.amount));
    }
    for (const [key, amount] of perPerson) {
      const summary = byKey.get(key);
      if (summary) {
        summary.payments.push({ id: row.id, date: row.expense_date || '', amount });
        if ((row.expense_date || '') > summary.lastActivity) summary.lastActivity = row.expense_date || '';
      }
    }
  }

  const list = Array.from(byKey.values());
  for (const s of list) {
    s.splits.sort((a, b) => b.date.localeCompare(a.date));
    s.payments.sort((a, b) => b.date.localeCompare(a.date));
    s.isSettled = s.owed <= 0;
  }
  return list.sort(
    (a, b) => Number(a.isSettled) - Number(b.isSettled) || b.lastActivity.localeCompare(a.lastActivity) || a.name.localeCompare(b.name)
  );
}
