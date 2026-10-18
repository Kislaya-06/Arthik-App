/**
 * Store middleware for SPL-003: whenever the `expenses` list is written, every expense's counted amount is
 * recomputed from the money-back rows that point at it (src/lib/splitLedger.ts `applyRecoveries`).
 * One choke point, so totals, budget days, Gullak, charts and notifications can never see a stale amount.
 */
import type { StateCreator } from 'zustand';
import { applyRecoveries } from '../../lib/splitLedger';
import type { Expense, ExpenseState } from './types';

type Partial_ = Partial<ExpenseState>;

const normalizeResult = (next: Partial_ | ExpenseState): Partial_ | ExpenseState =>
  next && Array.isArray((next as Partial_).expenses)
    ? { ...next, expenses: applyRecoveries((next as { expenses: Expense[] }).expenses) }
    : next;

export const withRecoveries =
  (creator: StateCreator<ExpenseState, [], []>): StateCreator<ExpenseState, [], []> =>
  (set, get, api) =>
    creator(
      ((partial: Partial_ | ExpenseState | ((s: ExpenseState) => Partial_ | ExpenseState), replace?: boolean) =>
        set(
          (typeof partial === 'function'
            ? (state: ExpenseState) => normalizeResult(partial(state))
            : normalizeResult(partial)) as never,
          replace as never
        )) as typeof set,
      get,
      api
    );
