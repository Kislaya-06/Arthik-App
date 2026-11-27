import type { StoreApi } from 'zustand';
import { addDaysToDateKey } from '../../money/dateKeys';
import { absenceBudgets, needsAbsenceChoice } from '../../lib/absence';
import type { AllowancePause } from '../../lib/allowancePauses';
import type { DailyRecord } from '../../lib/budgetCalculations';
import { useAuthStore } from '../authStore';
import { queueAllowancePauses, syncAllowancePauses } from './allowancePauseSync';
import { saveLastOpenDay, isOpenDayKnown } from './lastOpenSync';
import type { Expense } from '../expense/types';
import type { DailyBudgetState } from './types';

/**
 * One stretch the app was closed. Every stretch is judged on its own: a second long break never decides, or gets
 * decided by, an earlier unanswered one.
 * 'unchecked' waits for a server-fresh expense list (bank messages may be in it).
 * While undecided, its skipped stretch carries `ask: true`, so the question survives a reinstall.
 */
export interface Absence {
  from: string;
  to: string;
  status: 'unchecked' | 'choice' | 'saved';
  /** Budget money the popup talks about. */
  amount: number;
}

type Get = StoreApi<DailyBudgetState>['getState'];
type Set_ = StoreApi<DailyBudgetState>['setState'];

const same = (a: { from: string; to: string | null }, b: { from: string; to: string | null }) =>
  a.from === b.from && a.to === b.to;

const setSkipped = (set: Set_, pauses: AllowancePause[]): void => {
  set({ allowancePauses: pauses });
  const userId = useAuthStore.getState().user?.id;
  if (userId) void queueAllowancePauses(userId, pauses).then(() => syncAllowancePauses(userId));
};

const unskip = (set: Set_, get: Get, a: Absence): void =>
  setSkipped(set, (get().allowancePauses || []).filter((p) => !same(p, a)));

/** Replaces one stretch in the queue (null removes it). */
const update = (set: Set_, get: Get, a: Absence, next: Absence | null): void =>
  set({ absences: get().absences.flatMap((x) => (same(x, a) ? (next ? [next] : []) : [x])) });

const budgetsFor = (get: Get, a: Pick<Absence, 'from' | 'to'>) => {
  const s = get();
  return absenceBudgets(s.planChanges, a.from, a.to, s.dailyBudgetAmount, (d) => !!s.dailyRecords[d]);
};

/** The days count: every absent daily day gets its record, so its unspent budget reaches Gullak (rule 27). */
const countStretch = (set: Set_, get: Get, a: Absence): void => {
  const { dailyDays } = budgetsFor(get, a);
  unskip(set, get, a);
  const records: Record<string, DailyRecord> = { ...get().dailyRecords };
  for (const { date, budget } of dailyDays) {
    records[date] = { date, budget, spent: 0, saved: budget, isFinalized: true, status: 'saved', needsUpload: true };
  }
  set({ dailyRecords: records });
};

/**
 * Called by every rollover, BEFORE it finalizes. Remembers each gap since the last opened day (works offline), and
 * decides about it once the expense list is fresh from the server.
 */
export function trackAbsence(set: Set_, get: Get, todayStr: string, expenses: Expense[], isFresh: boolean): void {
  // Questions saved with the account but unknown on this phone (reinstall, another phone).
  for (const p of get().allowancePauses || []) {
    if (p.ask && p.to && !get().absences.some((a) => same(a, p))) {
      set({ absences: [...get().absences, { from: p.from, to: p.to, status: 'unchecked', amount: 0 }] });
    }
  }

  const s = get();
  if (isOpenDayKnown(useAuthStore.getState().user?.id) && (!s.lastOpenDay || s.lastOpenDay < todayStr)) {
    const from = s.lastOpenDay ? addDaysToDateKey(s.lastOpenDay, 1) : todayStr;
    const to = addDaysToDateKey(todayStr, -1);
    // The plan history says which closed days had a budget (a switch may have matured while the app was closed).
    const hadBudget = s.planChanges.length > 0 ? s.planChanges.some((c) => c.isEnabled) : s.isBudgetModeEnabled;
    if (from <= to && hadBudget) {
      set({ absences: [...get().absences, { from, to, status: 'unchecked', amount: 0 }] });
      // Nothing counts until the list is fresh enough to decide (rule 29).
      setSkipped(set, [...(get().allowancePauses || []), { from, to, ask: true }]);
    }
    set({ lastOpenDay: todayStr });
    const userId = useAuthStore.getState().user?.id;
    if (userId) void saveLastOpenDay(userId, todayStr);
  }

  if (get().absences.length === 0) return;
  const expenseDates = new Set(expenses.filter((e) => e.type !== 'income').map((e) => e.expense_date?.split('T')[0] ?? ''));

  for (const a of get().absences) {
    if (a.status === 'saved') continue;
    // "I spent money": the days count once an expense in them is saved.
    if (a.status === 'choice') {
      if ([...expenseDates].some((d) => d >= a.from && d <= a.to)) {
        countStretch(set, get, a);
        update(set, get, a, null);
      }
      continue;
    }
    if (!isFresh) continue;
    const budgets = budgetsFor(get, a);
    if (needsAbsenceChoice(a.from, a.to, expenseDates, budgets)) {
      update(set, get, a, { ...a, status: 'choice', amount: budgets.total });
      continue;
    }
    countStretch(set, get, a);
    // Say what was saved (rule 28).
    const tell = budgets.total > 0 && get().isBudgetModeEnabled;
    update(set, get, a, tell ? { ...a, status: 'saved', amount: budgets.total } : null);
  }
}

export const createAbsenceActions = (
  set: Set_,
  get: Get
): Pick<DailyBudgetState, 'chooseAbsence' | 'closeAbsence'> => ({
  chooseAbsence: (choice: 'save' | 'skip') => {
    const a = get().absences.find((x) => x.status === 'choice');
    if (!a) return;
    if (choice === 'save') countStretch(set, get, a);
    // "Don't count": the stretch stays skipped, and there is no question left.
    else setSkipped(set, (get().allowancePauses || []).map((p) => (same(p, a) ? { from: p.from, to: p.to } : p)));
    update(set, get, a, null);
    get().checkAndRollover();
    void get().uploadPendingDailyRecords();
  },
  closeAbsence: () => {
    const shown = get().absences.find((x) => x.status === 'saved');
    if (shown) update(set, get, shown, null);
  },
});
