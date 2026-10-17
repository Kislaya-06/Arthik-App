import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { isNetworkFailure } from '../../lib/networkUtils';
import { useDailyBudgetStore } from '../dailyBudgetStore';
import { useCategoryStore } from '../categoryStore';
import {
  getPendingDeletesKey,
  getPendingStorageKey,
  getPendingUpdatesKey,
  getCachedStorageKey,
  getBackoffDelay,
  MAX_SYNC_RETRIES,
  isValidUUID,
  saveFailedSyncItem as saveFailedSyncItemToQueue,
  PendingDelete,
  PendingUpdate,
  FailedSyncItem,
} from './pendingQueues';
import type { Expense, StoreGet, StoreSet } from './types';

const saveFailedSyncItem = (
  userId: string,
  item: FailedSyncItem,
  set?: StoreSet
) =>
  saveFailedSyncItemToQueue(userId, item, (filtered) => {
    if (set) {
      set({ failedSyncItems: filtered });
    }
  });

export const syncPendingDeletes = async (userId: string, _get: StoreGet, set: StoreSet): Promise<void> => {
  const now = Date.now();
  // 1. Sync pending deletes first
  const deleteKey = getPendingDeletesKey(userId);
  const storedDeletes = await AsyncStorage.getItem(deleteKey);
  if (storedDeletes) {
    const rawList: (string | PendingDelete)[] = JSON.parse(storedDeletes);
    const deleteList: PendingDelete[] = rawList.map((item) =>
      typeof item === 'string'
        ? { id: item, retryCount: 0, lastRetryAt: 0 }
        : { id: item.id, retryCount: item.retryCount || 0, lastRetryAt: item.lastRetryAt || 0 }
    );

    const syncedDeleteIds = new Set<string>();
    const updatedDeletesMap = new Map<string, PendingDelete>();

    for (const item of deleteList) {
      const retries = item.retryCount || 0;
      // Exponential backoff check (P0.7)
      if (now - (item.lastRetryAt || 0) < getBackoffDelay(retries)) {
        continue;
      }

      try {
        const { error } = await supabase.from('expenses').delete().eq('id', item.id);
        if (error) {
          if (isNetworkFailure(error)) {
            const nextRetries = retries + 1;
            if (nextRetries >= MAX_SYNC_RETRIES) {
              syncedDeleteIds.add(item.id);
              await saveFailedSyncItem(userId, {
                id: item.id,
                type: 'delete',
                errorReason: 'Deletion failed after 5 network attempts',
                failedAt: new Date().toISOString(),
              }, set);
            } else {
              updatedDeletesMap.set(item.id, { id: item.id, retryCount: nextRetries, lastRetryAt: now });
            }
          } else {
            if (__DEV__) console.error(`[sync] Permanent failure deleting expense ${item.id}:`, error);
            syncedDeleteIds.add(item.id);
            await saveFailedSyncItem(userId, {
              id: item.id,
              type: 'delete',
              errorReason: error.message || 'Database rejected delete',
              failedAt: new Date().toISOString(),
            }, set);
          }
        } else {
          // Delete succeeded on server
          syncedDeleteIds.add(item.id);
        }
      } catch (e: unknown) {
        const err = e as { message?: string } | null;
        if (isNetworkFailure(e)) {
          const nextRetries = retries + 1;
          if (nextRetries >= MAX_SYNC_RETRIES) {
            syncedDeleteIds.add(item.id);
            await saveFailedSyncItem(userId, {
              id: item.id,
              type: 'delete',
              errorReason: 'Deletion failed after 5 attempts',
              failedAt: new Date().toISOString(),
            }, set);
          } else {
            updatedDeletesMap.set(item.id, { id: item.id, retryCount: nextRetries, lastRetryAt: now });
          }
        } else {
          syncedDeleteIds.add(item.id);
          await saveFailedSyncItem(userId, {
            id: item.id,
            type: 'delete',
            errorReason: err?.message || 'Unexpected delete failure',
            failedAt: new Date().toISOString(),
          }, set);
        }
      }
    }

    // P0.12: Re-read queue before saving so concurrently added items are not lost
    const freshDeletesStored = await AsyncStorage.getItem(deleteKey);
    const freshDeletesRaw: (string | PendingDelete)[] = freshDeletesStored ? JSON.parse(freshDeletesStored) : [];
    const freshDeletesList: PendingDelete[] = freshDeletesRaw.map((item) =>
      typeof item === 'string'
        ? { id: item, retryCount: 0, lastRetryAt: 0 }
        : { id: item.id, retryCount: item.retryCount || 0, lastRetryAt: item.lastRetryAt || 0 }
    );

    const finalDeletes = freshDeletesList
      .filter((d) => !syncedDeleteIds.has(d.id))
      .map((d) => updatedDeletesMap.get(d.id) || d);

    await AsyncStorage.setItem(deleteKey, JSON.stringify(finalDeletes));
  }
};

export const syncPendingAdds = async (userId: string, _get: StoreGet, set: StoreSet): Promise<void> => {
  const now = Date.now();
  // 2. Sync pending additions (P0.4 UUID client-generated + upsert)
  const addKey = getPendingStorageKey(userId);
  const storedAdds = await AsyncStorage.getItem(addKey);
  if (storedAdds) {
    const pendingList: Expense[] = JSON.parse(storedAdds);
    const syncedAddIds = new Set<string>();
    const updatedAddsMap = new Map<string, Expense>();

    for (const item of pendingList) {
      const retries = item.retryCount || 0;
      if (now - (item.lastRetryAt || 0) < getBackoffDelay(retries)) {
        continue;
      }

      // Check for invalid fake category IDs (e.g. '1' through '7') sitting in legacy queues
      if (item.category_id && !isValidUUID(item.category_id)) {
        if (__DEV__) console.warn(`[sync] Purging pending expense with invalid fake category_id: ${item.category_id}`);
        syncedAddIds.add(item.id);
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
        await saveFailedSyncItem(userId, {
          id: item.id,
          type: 'add',
          expense: item,
          errorReason: 'Invalid category format (legacy placeholder category)',
          failedAt: new Date().toISOString(),
        }, set);
        continue;
      }

      try {
        const payload = {
          id: item.id,
          user_id: userId,
          amount: item.amount,
          note: item.note,
          payment_mode: item.payment_mode,
          expense_date: item.expense_date,
          type: item.type,
          category_id: item.category_id || null,
          // A queued 'reimbursement' from an older app version is plain income now (TXN-004).
          transaction_class: item.transaction_class === 'self_transfer' ? 'self_transfer' : 'normal',
          transfer_rule_id: item.transfer_rule_id ?? null,
        };

        // P0.4: upsert with onConflict: 'id', ignoreDuplicates: true
        const { data, error } = await supabase
          .from('expenses')
          .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
          .select()
          .single();

        if (error) {
          if (isNetworkFailure(error)) {
            const nextRetries = retries + 1;
            if (nextRetries >= MAX_SYNC_RETRIES) {
              syncedAddIds.add(item.id);
              set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
              await saveFailedSyncItem(userId, {
                id: item.id,
                type: 'add',
                expense: item,
                errorReason: 'Sync failed after 5 network attempts',
                failedAt: new Date().toISOString(),
              }, set);
            } else {
              updatedAddsMap.set(item.id, { ...item, retryCount: nextRetries, lastRetryAt: now });
            }
          } else {
            if (__DEV__) console.error(`[sync] Permanent failure saving expense ${item.id}:`, error);
            syncedAddIds.add(item.id);
            set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
            await saveFailedSyncItem(userId, {
              id: item.id,
              type: 'add',
              expense: item,
              errorReason: error.message || 'Database rejected transaction',
              failedAt: new Date().toISOString(),
            }, set);
          }
        } else {
          // Successfully upserted
          syncedAddIds.add(item.id);
          const confirmedRecord = data || { ...item, pending: false };
          set((state) => ({
            expenses: state.expenses.map((e) => (e.id === item.id ? { ...confirmedRecord, pending: false } : e)),
          }));
        }
      } catch (e: unknown) {
        const err = e as { message?: string } | null;
        if (isNetworkFailure(e)) {
          const nextRetries = retries + 1;
          if (nextRetries >= MAX_SYNC_RETRIES) {
            syncedAddIds.add(item.id);
            set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
            await saveFailedSyncItem(userId, {
              id: item.id,
              type: 'add',
              expense: item,
              errorReason: 'Sync failed after 5 network attempts',
              failedAt: new Date().toISOString(),
            }, set);
          } else {
            updatedAddsMap.set(item.id, { ...item, retryCount: nextRetries, lastRetryAt: now });
          }
        } else {
          syncedAddIds.add(item.id);
          set((state) => ({ expenses: state.expenses.filter((e) => e.id !== item.id) }));
          await saveFailedSyncItem(userId, {
            id: item.id,
            type: 'add',
            expense: item,
            errorReason: err?.message || 'Unexpected sync failure',
            failedAt: new Date().toISOString(),
          }, set);
        }
      }
    }

    // P0.12: Concurrency-safe queue update
    const freshAddsStored = await AsyncStorage.getItem(addKey);
    const freshAddsList: Expense[] = freshAddsStored ? JSON.parse(freshAddsStored) : [];
    const finalAdds = freshAddsList
      .filter((e) => !syncedAddIds.has(e.id))
      .map((e) => updatedAddsMap.get(e.id) || e);

    await AsyncStorage.setItem(addKey, JSON.stringify(finalAdds));
  }
};

export const syncPendingUpdates = async (userId: string, _get: StoreGet, set: StoreSet): Promise<void> => {
  const now = Date.now();
  // 3. Sync pending updates
  const updateKey = getPendingUpdatesKey(userId);
  const storedUpdates = await AsyncStorage.getItem(updateKey);
  if (storedUpdates) {
    const updateList: PendingUpdate[] = JSON.parse(storedUpdates);
    const syncedUpdateIds = new Set<string>();
    const updatedUpdatesMap = new Map<string, PendingUpdate>();

    for (const upd of updateList) {
      const retries = upd.retryCount || 0;
      if (now - (upd.lastRetryAt || 0) < getBackoffDelay(retries)) {
        continue;
      }

      if (upd.payload?.category_id && !isValidUUID(upd.payload.category_id)) {
        if (__DEV__) console.warn(`[sync] Dropping pending update with invalid category_id: ${upd.payload.category_id}`);
        syncedUpdateIds.add(upd.id);
        await saveFailedSyncItem(userId, {
          id: upd.id,
          type: 'update',
          errorReason: 'Invalid category identifier format',
          failedAt: new Date().toISOString(),
        }, set);
        continue;
      }

      try {
        const { error } = await supabase
          .from('expenses')
          .update(upd.payload)
          .eq('id', upd.id);

        if (error) {
          if (isNetworkFailure(error)) {
            const nextRetries = retries + 1;
            if (nextRetries >= MAX_SYNC_RETRIES) {
              syncedUpdateIds.add(upd.id);
              await saveFailedSyncItem(userId, {
                id: upd.id,
                type: 'update',
                errorReason: 'Update sync failed after 5 network attempts',
                failedAt: new Date().toISOString(),
              }, set);
            } else {
              updatedUpdatesMap.set(upd.id, { ...upd, retryCount: nextRetries, lastRetryAt: now });
            }
          } else {
            if (__DEV__) console.error(`[sync] Permanent failure updating expense ${upd.id}:`, error);
            syncedUpdateIds.add(upd.id);
            await saveFailedSyncItem(userId, {
              id: upd.id,
              type: 'update',
              errorReason: error.message || 'Database rejected update',
              failedAt: new Date().toISOString(),
            }, set);
          }
        } else {
          syncedUpdateIds.add(upd.id);
        }
      } catch (e: unknown) {
        const err = e as { message?: string } | null;
        if (isNetworkFailure(e)) {
          const nextRetries = retries + 1;
          if (nextRetries >= MAX_SYNC_RETRIES) {
            syncedUpdateIds.add(upd.id);
            await saveFailedSyncItem(userId, {
              id: upd.id,
              type: 'update',
              errorReason: 'Update sync failed after 5 attempts',
              failedAt: new Date().toISOString(),
            }, set);
          } else {
            updatedUpdatesMap.set(upd.id, { ...upd, retryCount: nextRetries, lastRetryAt: now });
          }
        } else {
          syncedUpdateIds.add(upd.id);
          await saveFailedSyncItem(userId, {
            id: upd.id,
            type: 'update',
            errorReason: err?.message || 'Unexpected update sync failure',
            failedAt: new Date().toISOString(),
          }, set);
        }
      }
    }

    // P0.12: Concurrency-safe queue update
    const freshUpdatesStored = await AsyncStorage.getItem(updateKey);
    const freshUpdatesList: PendingUpdate[] = freshUpdatesStored ? JSON.parse(freshUpdatesStored) : [];
    const finalUpdates = freshUpdatesList
      .filter((u) => !syncedUpdateIds.has(u.id))
      .map((u) => updatedUpdatesMap.get(u.id) || u);

    await AsyncStorage.setItem(updateKey, JSON.stringify(finalUpdates));
  }
};

export const flushSideQueues = async (userId: string, get: StoreGet): Promise<void> => {
  // 4. Flush pending budget settings (P0.13)
  try {
    const settingsKey = `@arthik_pending_settings_${userId}`;
    const storedSettings = await AsyncStorage.getItem(settingsKey);
    if (storedSettings) {
      const patch = JSON.parse(storedSettings);
      if (patch.daily_budget !== undefined || patch.is_auto_renew !== undefined) {
        const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
        if (!error) {
          await AsyncStorage.removeItem(settingsKey);
        }
      }
    }
  } catch (settingsErr) {
    if (__DEV__) console.log('Error syncing pending settings:', settingsErr);
  }

  // 5. Upload pending daily savings records (P0.14)
  await useDailyBudgetStore.getState().uploadPendingDailyRecords();

  // 6. Sync pending gullak deposits
  await useDailyBudgetStore.getState().syncPendingGullakDeposits().catch((e) => {
    if (__DEV__) console.log('[sync] Error syncing gullak deposits:', e);
  });

  // 7. Sync pending category mutations
  await useCategoryStore.getState().syncPendingCategories().catch((e) => {
    if (__DEV__) console.log('[sync] Error syncing categories:', e);
  });

  // 8. Flush pending profile patch (name / avatar; budget settings already handled in step 4)
  try {
    const profileKey = `@arthik_pending_profile_${userId}`;
    const storedPatch = await AsyncStorage.getItem(profileKey);
    if (storedPatch) {
      const { error } = await supabase.from('profiles').update(JSON.parse(storedPatch)).eq('id', userId);
      if (!error) await AsyncStorage.removeItem(profileKey);
    }
  } catch (profileErr) {
    if (__DEV__) console.log('[sync] Error syncing profile:', profileErr);
  }

  // Cache updated confirmed expenses for offline resiliency
  const confirmedExpenses = get().expenses.filter((e) => !e.pending && !e.id.startsWith('temp_'));
  await AsyncStorage.setItem(getCachedStorageKey(userId), JSON.stringify(confirmedExpenses));
  useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
};
