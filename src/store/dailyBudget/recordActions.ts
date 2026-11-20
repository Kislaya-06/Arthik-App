import type { StoreApi } from 'zustand';
import { getTodayDateStr, isDailyOwnedDate, dailyCarryExtraFor } from './metrics';
import { buildDefaultTodayRecord, filterPastRecords } from '../../lib/budgetCalculations';
import type { DailyBudgetState } from './types';

/**
 * createRecordActions: actions of useDailyBudgetStore moved here verbatim (facade split, AGENTS.md 6.1).
 * They receive the store's own set / get, so they never import the store (no circular import).
 */
export const createRecordActions = (
  _set: StoreApi<DailyBudgetState>['setState'],
  get: StoreApi<DailyBudgetState>['getState']
): Pick<DailyBudgetState, 'getTodayRecord' | 'getPastRecordsList'> => ({
  getTodayRecord: () => {
    const todayStr = getTodayDateStr();
    const records = get().dailyRecords;
    if (records[todayStr]) {
      if ((!get().isAutoRenew || !get().isBudgetModeEnabled) && !records[todayStr].isFinalized) {
        return {
          ...records[todayStr],
          budget: 0,
          saved: 0,
          status: 'unknown',
        };
      }
      return records[todayStr];
    }

    const def = buildDefaultTodayRecord(
      todayStr,
      get().isAutoRenew && get().isBudgetModeEnabled && isDailyOwnedDate(get().planChanges, todayStr),
      get().dailyBudgetAmount + dailyCarryExtraFor(todayStr)
    );
    if (!get().isAutoRenew || !get().isBudgetModeEnabled) {
      return {
        ...def,
        status: 'unknown',
      };
    }
    return def;
  },

  getPastRecordsList: () => {
    const todayStr = getTodayDateStr();
    const records = get().dailyRecords;
    return filterPastRecords(records, todayStr);
  },
});
