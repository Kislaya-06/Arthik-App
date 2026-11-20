import type { StoreApi } from 'zustand';
import { getTodayDateStr, getUserCreatedAtStr, dailyCarryExtraFor, computeMetrics } from './metrics';
import { round2 } from '../../lib/formatters';
import { useAuthStore } from '../authStore';
import { storeDismissedGapDates } from '../../lib/gapFiller';
import type { GullakDepositSource, GullakDeposit } from './types';
import * as Crypto from 'expo-crypto';
import { useNetworkStore } from '../networkStore';
import { getPendingGullakAddsKey, getPendingGullakDeletesKey, getStoredList, savePendingGullakAdd, tryRemovePendingGullakAdd, savePendingGullakDelete, removeSyncedFromQueue } from './pendingStorage';
import { supabase } from '../../config/supabase';
import { isNetworkFailure } from '../../lib/networkUtils';
import type { DailyBudgetState } from './types';

/**
 * createGullakActions: actions of useDailyBudgetStore moved here verbatim (facade split, AGENTS.md 6.1).
 * They receive the store's own set / get, so they never import the store (no circular import).
 */
export const createGullakActions = (
  set: StoreApi<DailyBudgetState>['setState'],
  get: StoreApi<DailyBudgetState>['getState']
): Pick<DailyBudgetState, 'saveGapDaysToGullak' | 'dismissGapDays' | 'addGullakDeposit' | 'removeGullakDeposit' | 'updateGullakDepositAmount' | 'adjustGullakIncomeDeposits' | 'syncPendingGullakDeposits'> => ({
  saveGapDaysToGullak: async (gapDates: string[]) => {
    if (!gapDates || gapDates.length === 0) return;
    const records = { ...get().dailyRecords };
    const baseBudget = get().dailyBudgetAmount;
    let updated = false;

    for (const d of gapDates) {
      const extraCarry = dailyCarryExtraFor(d, get());
      const budget = round2(baseBudget + extraCarry);
      records[d] = {
        date: d,
        budget,
        spent: 0,
        saved: budget,
        isFinalized: true,
        status: 'saved',
        needsUpload: true,
      };
      updated = true;
    }

    if (updated) {
      const deposits = get().gullakDeposits;
      const userCreatedAt = getUserCreatedAtStr();
      const budgetPeriods = get().budgetPeriods;
      const metrics = computeMetrics(
        records,
        deposits,
        userCreatedAt,
        budgetPeriods,
        get().budgetCadence,
        get().bestStreakByCadence
      );
      set({
        dailyRecords: records,
        ...metrics,
      });

      await get().uploadPendingDailyRecords();
    }
  },

  dismissGapDays: async (gapDates: string[]) => {
    if (!gapDates || gapDates.length === 0) return;
    const current = get().dismissedGapDates || [];
    const merged = Array.from(new Set([...current, ...gapDates]));
    set({ dismissedGapDates: merged });

    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      await storeDismissedGapDates(currentUser.id, gapDates);
    }
  },

  addGullakDeposit: (amount: number, note?: string, source: GullakDepositSource = 'external') => {
    if (!amount || amount <= 0) return;
    const newDeposit: GullakDeposit = {
      id: Crypto.randomUUID(),
      amount: round2(amount),
      date: getTodayDateStr(),
      note: note?.trim() || undefined,
      source,
      created_at: new Date().toISOString(),
    };
    const deposits = [newDeposit, ...(get().gullakDeposits || [])];
    const metrics = computeMetrics(get().dailyRecords, deposits);
    set({ gullakDeposits: deposits, ...metrics });

    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const insertPayload = {
      id: newDeposit.id,
      user_id: userId,
      amount: newDeposit.amount,
      date: newDeposit.date,
      note: newDeposit.note || null,
      source: newDeposit.source,
      created_at: newDeposit.created_at,
    };

    if (useNetworkStore.getState().isOffline) {
      savePendingGullakAdd(userId, newDeposit);
      return;
    }

    supabase
      .from('gullak_deposits')
      .insert(insertPayload)
      .then(({ error }) => {
        if (error) {
          if (isNetworkFailure(error)) {
            savePendingGullakAdd(userId, newDeposit);
          } else if (__DEV__) {
            console.error('[dailyBudgetStore] Error inserting gullak_deposit:', error);
          }
        }
      });
  },

  removeGullakDeposit: (id: string) => {
    const deposits = (get().gullakDeposits || []).filter((d) => d.id !== id);
    const metrics = computeMetrics(get().dailyRecords, deposits);
    set({ gullakDeposits: deposits, ...metrics });

    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    // If the deposit was never synced (still in pending-add queue), just remove it there.
    // Otherwise queue a server delete for when we reconnect.
    tryRemovePendingGullakAdd(userId, id).then((wasPending) => {
      if (wasPending) return;

      if (useNetworkStore.getState().isOffline) {
        savePendingGullakDelete(userId, id);
        return;
      }

      supabase
        .from('gullak_deposits')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) {
            if (isNetworkFailure(error)) {
              savePendingGullakDelete(userId, id);
            } else if (__DEV__) {
              console.error('[dailyBudgetStore] Error deleting gullak_deposit:', error);
            }
          }
        });
    });
  },

  updateGullakDepositAmount: (id: string, newAmount: number) => {
    const roundedAmount = round2(newAmount);
    if (roundedAmount <= 0) {
      get().removeGullakDeposit(id);
      return;
    }
    const deposits = (get().gullakDeposits || []).map((d) =>
      d.id === id ? { ...d, amount: roundedAmount } : d
    );
    const metrics = computeMetrics(get().dailyRecords, deposits);
    set({ gullakDeposits: deposits, ...metrics });

    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    if (useNetworkStore.getState().isOffline) {
      return;
    }

    supabase
      .from('gullak_deposits')
      .update({ amount: roundedAmount })
      .eq('id', id)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error && __DEV__) {
          console.error('[dailyBudgetStore] Error updating gullak_deposit:', error);
        }
      });
  },

  adjustGullakIncomeDeposits: async (dateStr: string, deficit: number) => {
    let remainingDeficit = round2(deficit);
    if (remainingDeficit <= 0) return;

    const allDeposits = [...(get().gullakDeposits || [])];
    const dateDeposits = allDeposits
      .filter((d) => d.source === 'income' && d.date?.split('T')[0]?.trim() === dateStr)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    for (const dep of dateDeposits) {
      if (remainingDeficit <= 0) break;
      if (dep.amount <= remainingDeficit) {
        remainingDeficit = round2(remainingDeficit - dep.amount);
        get().removeGullakDeposit(dep.id);
      } else {
        const updated = round2(dep.amount - remainingDeficit);
        remainingDeficit = 0;
        get().updateGullakDepositAmount(dep.id, updated);
      }
    }
  },

  syncPendingGullakDeposits: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    // 1. Flush pending adds (upsert is idempotent if sync runs twice)
    const addsKey = getPendingGullakAddsKey(userId);
    const adds = await getStoredList<GullakDeposit>(addsKey);
    if (adds.length) {
      const synced: string[] = [];
      for (const d of adds) {
        try {
          const { error } = await supabase.from('gullak_deposits').upsert(
            {
              id: d.id,
              user_id: userId,
              amount: d.amount,
              date: d.date,
              note: d.note || null,
              source: d.source,
              created_at: d.created_at,
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
          if (!error) synced.push(d.id);
        } catch {}
      }
      if (synced.length) await removeSyncedFromQueue<GullakDeposit>(addsKey, (d) => synced.includes(d.id));
    }

    // 2. Flush pending deletes
    const delsKey = getPendingGullakDeletesKey(userId);
    const dels = await getStoredList<string>(delsKey);
    if (dels.length) {
      const synced: string[] = [];
      for (const id of dels) {
        try {
          const { error } = await supabase.from('gullak_deposits').delete().eq('id', id).eq('user_id', userId);
          if (!error) synced.push(id);
        } catch {}
      }
      if (synced.length) await removeSyncedFromQueue<string>(delsKey, (id) => synced.includes(id));
    }
  },
});
