import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { BudgetCadence, BudgetPlanChange } from '../../types';
import { DateOwner, getPeriodBounds, getDateOwner } from './core';

export interface CalendarCadenceConnectionInfo {
  dateStr: string;
  owner: DateOwner;
  cycleId: string | null;
  hasLeftConnection: boolean;
  hasRightConnection: boolean;
}

/**
 * 10. Computes horizontal cadence connection metadata for calendar month cells.
 *
 * Rules:
 * - 'daily' or 'paused' dates: hasLeftConnection = false, hasRightConnection = false.
 * - 'weekly' dates: dates belonging to the same 7-day weekly cycle (Monday-Sunday) connect
 *    horizontally within each calendar row. If a cycle crosses rows (Sat -> Sun), Sat connects to the
 *    right edge and Sun connects from the left edge. Consecutive different weekly cycles do NOT connect.
 * - 'monthly' dates: dates belonging to the same monthly cycle (1st to last day of month) connect
 *    horizontally across rows for that month.
 * - Historical preservation: only dates governed by their active plan change share the connection.
 */
export function computeCalendarConnections(
  cells: Array<{ dateStr: string | null; day: number | null }>,
  planChanges: BudgetPlanChange[],
  fallbackCadence: BudgetCadence = 'daily',
  isBudgetModeEnabled: boolean = true
): Record<string, CalendarCadenceConnectionInfo> {
  const result: Record<string, CalendarCadenceConnectionInfo> = {};

  // First pass: resolve owner and cycleId for all non-empty cells
  for (const cell of cells) {
    if (!cell.dateStr) continue;

    let owner: DateOwner;
    if (planChanges && planChanges.length > 0) {
      owner = getDateOwner(planChanges, cell.dateStr);
    } else {
      owner = isBudgetModeEnabled ? fallbackCadence : 'paused';
    }

    let cycleId: string | null = null;
    if (owner === 'weekly') {
      const bounds = getPeriodBounds('weekly', cell.dateStr);
      cycleId = `weekly_${bounds.start}_${bounds.end}`;
    } else if (owner === 'monthly') {
      const bounds = getPeriodBounds('monthly', cell.dateStr);
      cycleId = `monthly_${bounds.start}_${bounds.end}`;
    }

    result[cell.dateStr] = {
      dateStr: cell.dateStr,
      owner,
      cycleId,
      hasLeftConnection: false,
      hasRightConnection: false,
    };
  }

  // Second pass: determine horizontal row connections (grid has 7 columns per row)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell.dateStr) continue;

    const currentInfo = result[cell.dateStr];
    if (!currentInfo || currentInfo.owner === 'daily' || currentInfo.owner === 'paused' || !currentInfo.cycleId) {
      continue;
    }

    const colIndex = i % 7; // 0 = Su, 1 = Mo, 2 = Tu, 3 = We, 4 = Th, 5 = Fr, 6 = Sa

    // Left connection:
    if (colIndex > 0) {
      const leftCell = cells[i - 1];
      if (leftCell && leftCell.dateStr) {
        const leftInfo = result[leftCell.dateStr];
        if (leftInfo && leftInfo.owner === currentInfo.owner && leftInfo.cycleId === currentInfo.cycleId) {
          currentInfo.hasLeftConnection = true;
        }
      }
    } else if (colIndex === 0) {
      // Sunday - start of row. Check if previous calendar day (Saturday) was in the same cycle!
      const prevDateStr = format(subDays(parseISO(cell.dateStr), 1), 'yyyy-MM-dd');
      let prevOwner: DateOwner;
      if (planChanges && planChanges.length > 0) {
        prevOwner = getDateOwner(planChanges, prevDateStr);
      } else {
        prevOwner = isBudgetModeEnabled ? fallbackCadence : 'paused';
      }

      if (prevOwner === currentInfo.owner) {
        let prevCycleId: string | null = null;
        if (prevOwner === 'weekly') {
          const bounds = getPeriodBounds('weekly', prevDateStr);
          prevCycleId = `weekly_${bounds.start}_${bounds.end}`;
        } else if (prevOwner === 'monthly') {
          const bounds = getPeriodBounds('monthly', prevDateStr);
          prevCycleId = `monthly_${bounds.start}_${bounds.end}`;
        }
        if (prevCycleId === currentInfo.cycleId) {
          currentInfo.hasLeftConnection = true;
        }
      }
    }

    // Right connection:
    if (colIndex < 6) {
      const rightCell = cells[i + 1];
      if (rightCell && rightCell.dateStr) {
        const rightInfo = result[rightCell.dateStr];
        if (rightInfo && rightInfo.owner === currentInfo.owner && rightInfo.cycleId === currentInfo.cycleId) {
          currentInfo.hasRightConnection = true;
        }
      }
    } else if (colIndex === 6) {
      // Saturday - end of row. Check if next calendar day (Sunday) is in the same cycle!
      const nextDateStr = format(addDays(parseISO(cell.dateStr), 1), 'yyyy-MM-dd');
      let nextOwner: DateOwner;
      if (planChanges && planChanges.length > 0) {
        nextOwner = getDateOwner(planChanges, nextDateStr);
      } else {
        nextOwner = isBudgetModeEnabled ? fallbackCadence : 'paused';
      }

      if (nextOwner === currentInfo.owner) {
        let nextCycleId: string | null = null;
        if (nextOwner === 'weekly') {
          const bounds = getPeriodBounds('weekly', nextDateStr);
          nextCycleId = `weekly_${bounds.start}_${bounds.end}`;
        } else if (nextOwner === 'monthly') {
          const bounds = getPeriodBounds('monthly', nextDateStr);
          nextCycleId = `monthly_${bounds.start}_${bounds.end}`;
        }
        if (nextCycleId === currentInfo.cycleId) {
          currentInfo.hasRightConnection = true;
        }
      }
    }
  }

  return result;
}
