import { supabase } from '../../config/supabase';
import { useAuthStore } from '../authStore';
import type { BudgetPlanChange, BudgetPeriodRecord } from '../../types';
import type { DailyBudgetState } from './types';
import { getPendingPlanChangesKey, getPendingBudgetPeriodsKey, getStoredList, removeSyncedFromQueue } from './pendingStorage';

export async function uploadPendingBudgetPeriods(
  _get?: () => DailyBudgetState
): Promise<void> {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser) return;
  const key = getPendingBudgetPeriodsKey(currentUser.id);
  const list = await getStoredList<BudgetPeriodRecord>(key);
  if (list.length === 0) return;

  const syncedIds: string[] = [];
  for (const p of list) {
    try {
      const { error } = await supabase.from('budget_periods').upsert(
        {
          id: p.id,
          user_id: currentUser.id,
          cadence: p.cadence,
          period_start: p.periodStart,
          period_end: p.periodEnd,
          active_start: p.activeStart,
          active_end: p.activeEnd,
          budget_amount: p.budgetAmount,
          spent_amount: p.spentAmount,
          amount_saved: p.amountSaved,
          status: p.status,
          is_prorated: p.isProrated,
          carry_mode: p.carryMode || null,
          carried_over_amount: p.carriedOverAmount || 0,
          created_at: p.createdAt || new Date().toISOString(),
        },
        { onConflict: 'user_id,cadence,active_start' }
      );
      if (!error) syncedIds.push(p.id);
    } catch {}
  }
  if (syncedIds.length > 0) {
    await removeSyncedFromQueue<BudgetPeriodRecord>(key, (p) => syncedIds.includes(p.id));
  }
}

export async function syncPendingPlanChanges(
  _get?: () => DailyBudgetState
): Promise<void> {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser) return;
  const key = getPendingPlanChangesKey(currentUser.id);
  const list = await getStoredList<BudgetPlanChange>(key);
  if (list.length === 0) return;

  const syncedIds: string[] = [];
  for (const c of list) {
    try {
      const { error } = await supabase.from('budget_plan_changes').upsert(
        {
          id: c.id,
          user_id: currentUser.id,
          effective_from: c.effectiveFrom,
          is_enabled: c.isEnabled,
          cadence: c.cadence,
          amount: c.amount,
          carry_mode: c.carryMode || null,
          carried_over_amount: c.carriedOverAmount || 0,
          created_at: c.createdAt || new Date().toISOString(),
        },
        { onConflict: 'user_id,effective_from' }
      );
      if (!error) syncedIds.push(c.id);
    } catch {}
  }
  if (syncedIds.length > 0) {
    await removeSyncedFromQueue<BudgetPlanChange>(key, (c) => syncedIds.includes(c.id));
  }
}
