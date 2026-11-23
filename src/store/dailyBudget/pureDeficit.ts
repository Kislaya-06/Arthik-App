import * as Crypto from 'expo-crypto';
import { round2 } from '../../lib/formatters';
import { useNotificationStore } from '../notificationStore';
import type { DailyBudgetState } from './types';
import { getCurrentExpenses, addExpenseFromBridge } from './expenseBridge';
import { computeTotalAccountRemaining, runWaterfall } from './metrics';
import { PURE_DEFICIT_NOTE, isCountedExpense } from '../../lib/transactionUtils';

export function balancePureDeficitIfNeeded(get: () => DailyBudgetState, todayStr: string): void {
  if (get().isBudgetModeEnabled) return;
  balancePureDeficit(get, todayStr);
}

/**
 * PUR-001 deficit auto-balance without the "mode is still off" guard. `excludeTodayAllowance` measures the deficit the
 * way the switch does when the app is open (before the new day's allowance exists): today's record counts as 0.
 */
export function balancePureDeficit(
  get: () => DailyBudgetState,
  todayStr: string,
  options?: { excludeTodayAllowance?: boolean }
): void {
  const currentExpenses = getCurrentExpenses();
  let calcState = get();
  if (options?.excludeTodayAllowance && calcState.dailyRecords?.[todayStr]) {
    calcState = {
      ...calcState,
      dailyRecords: {
        ...calcState.dailyRecords,
        [todayStr]: { ...calcState.dailyRecords[todayStr], budget: 0, saved: 0, status: 'unknown' },
      },
    };
  }
  const R = computeTotalAccountRemaining(calcState, currentExpenses);
  if (R >= 0) return;
  const D = round2(-R);
  if (D <= 0) return;

  const countedExpenses = currentExpenses
    .filter((e) => isCountedExpense(e))
    .sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '') || (b.created_at || '').localeCompare(a.created_at || ''));

  const waterfall = options?.excludeTodayAllowance ? runWaterfall({ records: calcState.dailyRecords }) : runWaterfall();
  let runningSum = 0;
  let dateStr = todayStr;
  for (const e of countedExpenses) {
    const gDrawn = waterfall.byExpense[e.id]?.fromGullak || 0;
    runningSum = round2(runningSum + gDrawn);
    if (runningSum >= D) {
      dateStr = e.expense_date?.split('T')[0]?.trim() || todayStr;
      break;
    }
  }

  addExpenseFromBridge(
    D,
    null,
    PURE_DEFICIT_NOTE,
    'upi',
    dateStr,
    'income',
    { id: Crypto.randomUUID(), transactionClass: 'normal' }
  );

  get().syncWithExpenses(getCurrentExpenses());

  useNotificationStore.getState().addNotification({
    id: `pure_deficit_${dateStr}_${D}`,
    title: 'Pure Mode deficit balanced',
    message: `You spent ₹${D} more than you had in Pure Mode. We added ₹${D} to Total Income so everything is balanced.`,
    type: 'pure_deficit_balanced',
    data: { date: dateStr, amount: D, screen: 'Home' },
  });
}
