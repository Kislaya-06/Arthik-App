import { supabase } from '../../config/supabase';
import { useAuthStore } from '../authStore';
import { useNotificationStore } from '../notificationStore';
import { formatEffectiveFrom } from '../../lib/budgetModeUtils';
import type { BudgetPlanChange } from '../../types';
import type { DailyBudgetState } from './types';
import { getPendingPlanChangesKey, removeSyncedFromQueue } from './pendingStorage';
import { getTodayDateStr } from './metrics';

export function resolvePendingPlanChange(
  planChanges: BudgetPlanChange[] | undefined,
  todayStr: string
): BudgetPlanChange | null {
  const future = (planChanges || []).filter((c) => c.effectiveFrom > todayStr);
  if (future.length === 0) return null;
  future.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return future[0];
}

export function resolveEffectiveFromLabel(
  target: BudgetPlanChange | null,
  todayStr: string
): string {
  if (!target) return '';
  return formatEffectiveFrom(target.effectiveFrom, todayStr, target.cadence);
}

export function handleCancelPendingPlanChange(
  get: () => DailyBudgetState,
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void
): void {
  const todayStr = getTodayDateStr();
  const pending = resolvePendingPlanChange(get().planChanges, todayStr);
  if (!pending) return;

  const remainingChanges = (get().planChanges || []).filter(
    (c) => c.effectiveFrom <= todayStr
  );
  set({
    planChanges: remainingChanges,
    scheduledNextDailyBudget: null,
    scheduledBudgetSetDate: null,
  });

  useNotificationStore.getState().removeNotification?.(`scheduled_budget_mode_${pending.effectiveFrom}`);
  useNotificationStore.getState().removeNotification?.(`scheduled_pure_mode_${pending.effectiveFrom}`);

  const currentUser = useAuthStore.getState().user;
  if (currentUser) {
    const key = getPendingPlanChangesKey(currentUser.id);
    // Locked read -> change -> write (a plan change queued at the same moment is never wiped).
    removeSyncedFromQueue<BudgetPlanChange>(key, (c) => c.effectiveFrom > todayStr).catch(() => {});

    supabase
      .from('budget_plan_changes')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('effective_from', pending.effectiveFrom)
      .then(() => {});
  }
}
