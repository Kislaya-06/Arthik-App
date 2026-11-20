import type { StoreApi } from 'zustand';
import { useAuthStore } from '../authStore';
import { isValidUUID, savePendingUpdateOffline, savePendingDeleteOffline, updatePendingItemOffline, removePendingItemOffline, sanitizeNote, enqueuePendingDelete, removePendingDelete, readPendingUpdate, settlePendingUpdate, removePendingAddIfUnchanged } from './pendingQueues';
import * as Crypto from 'expo-crypto';
import type { Expense, ExpenseUpdatePayload } from './types';
import { useDailyBudgetStore } from '../dailyBudgetStore';
import { useNetworkStore } from '../networkStore';
import { SAVE_TIMEOUT_MS, SAVE_TIMED_OUT, isTimedOut, inFlightAdds, persistConfirmedCache } from './saveGuards';
import { extraColumnsFor } from './payload';
import { supabase } from '../../config/supabase';
import { isNetworkFailure, withTimeout } from '../../lib/networkUtils';
import { deleteBlockReason } from '../../lib/splitLedger';
import type { ExpenseState } from './types';

/**
 * createMutationActions: actions of useExpenseStore moved here verbatim (facade split, AGENTS.md 6.1).
 * They receive the store's own set / get, so they never import the store (no circular import).
 */
export const createMutationActions = (
  set: StoreApi<ExpenseState>['setState'],
  get: StoreApi<ExpenseState>['getState']
): Pick<ExpenseState, 'addExpense' | 'updateExpense' | 'deleteExpense'> => ({
  addExpense: async (amount, categoryId, note, paymentMode, date, type = 'expense', options) => {
    const user = useAuthStore.getState().user;
    // P0.10: Throw error if no active session
    if (!user) {
      throw new Error('No active user session. Please log in again.');
    }

    // Defense-in-depth: validate categoryId format if provided
    if (categoryId && !isValidUUID(categoryId)) {
      throw new Error(`Invalid category selected (${categoryId}). Please select a valid category.`);
    }

    // P0.4: Generate client-side UUID (no temp_ prefix).
    // Automatic Logging passes its own id so the transaction stays linked to its source message.
    const newId = options?.id && isValidUUID(options.id) ? options.id : Crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const optimisticExpense: Expense = {
      id: newId,
      user_id: user.id,
      amount,
      category_id: categoryId || null,
      note: sanitizeNote(note),
      payment_mode: paymentMode,
      expense_date: date,
      type,
      transaction_class: options?.transactionClass ?? 'normal',
      transfer_rule_id: options?.transferRuleId ?? null,
      split_person: options?.split?.person ?? null,
      split_amount: options?.split?.amount ?? null,
      split_allocations: options?.split?.allocations ?? null,
      recovery_kind: options?.recovery?.kind ?? null,
      recovery_person: options?.recovery?.person ?? null,
      recovery_allocations: options?.recovery?.allocations ?? null,
      created_at: nowIso,
      pending: true,
    };

    // 1. Instant optimistic update so UI shows transaction immediately (0ms)
    set((state) => ({ expenses: [optimisticExpense, ...state.expenses] }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

    // 2. Check if already known to be offline
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await get().savePendingOffline(optimisticExpense);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    // 3. OPT-60 write-ahead: put it in the offline queue BEFORE talking to the server, so it can never be lost
    // (app killed mid-request, phone switched off, request hanging). Removed again once the server confirms.
    // Sending it twice is harmless: same id + upsert with ignoreDuplicates.
    await get().savePendingOffline(optimisticExpense);

    // Server confirmed: same state update as before, then clear the queue entry and refresh the offline copy.
    const applyConfirmed = async (data: Expense | null): Promise<void> => {
      const confirmed = data || { ...optimisticExpense, pending: false };
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === newId ? { ...confirmed, pending: false } : e)),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
      // Queue entry first, then the offline copy (this order means one expense can never be in both).
      await removePendingAddIfUnchanged(user.id, optimisticExpense);
      persistConfirmedCache(user.id, () => get().expenses, () => get().isExpensesLoaded).catch(() => {});
    };

    set({ loading: true });
    try {
      const payload = {
        id: newId,
        user_id: user.id,
        amount,
        note: sanitizeNote(note),
        payment_mode: paymentMode,
        expense_date: date,
        type,
        category_id: categoryId || null,
        transaction_class: options?.transactionClass ?? 'normal',
        transfer_rule_id: options?.transferRuleId ?? null,
        ...extraColumnsFor(optimisticExpense),
      };

      // P0.4: upsert with onConflict: 'id', ignoreDuplicates: true.
      // OPT-62: maybeSingle → a row that is already on the server comes back as data = null (success), not as an error.
      // Promise.resolve runs the request exactly once (a Supabase query re-sends itself on every `.then`).
      const request = Promise.resolve(
        supabase
          .from('expenses')
          .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
          .select()
          .maybeSingle()
      );
      const outcome = await withTimeout(request, SAVE_TIMEOUT_MS, SAVE_TIMED_OUT);

      if (isTimedOut(outcome)) {
        // OPT-60: stop waiting. It is already queued and shows as "sync pending"; no offline banner, no offline mode.
        inFlightAdds.set(newId, {});
        request.then(
          (late) => {
            const tracked = inFlightAdds.get(newId);
            inFlightAdds.delete(newId);
            if (late.error) return; // still queued; the normal sync retries it
            const stillPending = get().expenses.some((e) => e.id === newId && e.pending);
            if (stillPending && !tracked?.lastUpdate && !tracked?.deleted) {
              applyConfirmed(late.data as Expense | null).catch(() => {});
              return;
            }
            // The user edited or deleted it while we waited: make sure that reaches the server after this insert.
            if (tracked?.deleted) enqueuePendingDelete(user.id, newId).catch(() => {});
            else if (tracked?.lastUpdate) savePendingUpdateOffline(user.id, newId, tracked.lastUpdate).catch(() => {});
          },
          () => {
            inFlightAdds.delete(newId);
          }
        );
        return;
      }

      const { data, error } = outcome;

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await get().savePendingOffline(optimisticExpense);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Real schema/DB validation error: take it out of the queue again, then rollback optimistic item
        await removePendingItemOffline(user.id, newId);
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== newId) }));
        useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
        throw error;
      }

      // Confirmed by server: clear pending flag
      await applyConfirmed(data as Expense | null);
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await get().savePendingOffline(optimisticExpense);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }
      // Anything else: the transaction stays queued (written ahead) and the normal sync retries it.
      if (__DEV__) console.error('Error adding expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateExpense: async (id, amount, categoryId, note, paymentMode, date, type = 'expense', extras) => {
    const user = useAuthStore.getState().user;
    // P0.10: Throw error if no active session
    if (!user) {
      throw new Error('No active user session. Please log in again.');
    }

    // Defense-in-depth: validate categoryId format if provided
    if (categoryId && !isValidUUID(categoryId)) {
      throw new Error(`Invalid category selected (${categoryId}). Please select a valid category.`);
    }

    const previousExpense = get().expenses.find((e) => e.id === id);
    if (!previousExpense) return;

    let isRolledBack = false;
    const rollbackUpdate = () => {
      if (isRolledBack) return;
      isRolledBack = true;
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? previousExpense : e)),
      }));
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    };

    const payload: ExpenseUpdatePayload = {
      amount,
      note: sanitizeNote(note),
      payment_mode: paymentMode,
      expense_date: date,
      type,
    };
    if (categoryId !== undefined) {
      payload.category_id = categoryId || null;
    }
    // SPL-001: undefined = leave the split alone, null = remove it, object = set / change it.
    if (extras?.split !== undefined) {
      payload.split_person = extras.split?.person ?? null;
      payload.split_amount = extras.split?.amount ?? null;
      payload.split_allocations = extras.split?.allocations ?? null;
    }

    // 1. Optimistic update in Zustand state. `amount` here is the amount PAID; the middleware turns it into the
    // counted amount (SPL-003), so the paid amount is also kept as gross_amount.
    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === id ? { ...e, ...payload, gross_amount: amount } : e
      ),
    }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

    // 2. If it's a pending offline expense, update it in local pending storage
    if (previousExpense.pending || id.startsWith('temp_')) {
      await updatePendingItemOffline(user.id, id, payload);
      // OPT-60: its first save timed out and may still land on the server; queue the edit for the server too.
      const tracked = inFlightAdds.get(id);
      if (tracked) {
        tracked.lastUpdate = { ...(tracked.lastUpdate || {}), ...payload };
        await savePendingUpdateOffline(user.id, id, payload);
      }
      return;
    }

    // 3. If currently offline, queue update for later
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await savePendingUpdateOffline(user.id, id, payload);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    // 4. OPT-60 write-ahead: queue the edit BEFORE the request. If an older queued edit exists, the queue now
    // holds both merged (newest values win), exactly like an offline edit; it is then sent by the normal sync.
    const queuedBefore = await readPendingUpdate(user.id, id);
    await savePendingUpdateOffline(user.id, id, payload);
    const queuedNow: ExpenseUpdatePayload = queuedBefore ? { ...queuedBefore.payload, ...payload } : payload;

    set({ loading: true });
    try {
      // Promise.resolve runs the request exactly once.
      const request = Promise.resolve(
        supabase
          .from('expenses')
          .update(payload)
          .eq('id', id)
      );
      const outcome = await withTimeout(request, SAVE_TIMEOUT_MS, SAVE_TIMED_OUT);

      if (isTimedOut(outcome)) {
        // Stop waiting: the edit is queued and will be sent by the normal sync. A late success clears it.
        request.then(
          (late) => {
            if (!late.error && !queuedBefore) settlePendingUpdate(user.id, id, queuedNow, null).catch(() => {});
          },
          () => {}
        );
        return;
      }

      const { error } = outcome;

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await savePendingUpdateOffline(user.id, id, payload);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Refused by the database: put the queue back exactly as it was before this edit, then rollback.
        await settlePendingUpdate(user.id, id, queuedNow, queuedBefore);
        rollbackUpdate();
        throw error;
      }

      // Confirmed. With no older queued edit, the queue entry is done. With one, the merged entry stays and is
      // sent by the normal sync (it carries the older fields that still have to reach the server).
      if (!queuedBefore) await settlePendingUpdate(user.id, id, queuedNow, null);
      persistConfirmedCache(user.id, () => get().expenses, () => get().isExpensesLoaded).catch(() => {});
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingUpdateOffline(user.id, id, payload);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }

      // Not a server answer (it threw): undo the write-ahead and rollback, exactly as before.
      if (!isRolledBack) await settlePendingUpdate(user.id, id, queuedNow, queuedBefore);
      rollbackUpdate();
      if (__DEV__) console.error('Error updating expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteExpense: async (id) => {
    const user = useAuthStore.getState().user;
    // P0.10: Throw error if no active session
    if (!user) {
      throw new Error('No active user session. Please log in again.');
    }

    const previousExpense = get().expenses.find((e) => e.id === id);
    const previousIndex = get().expenses.findIndex((e) => e.id === id);
    if (!previousExpense) return;

    // SPL-006: money that came back for this expense must be deleted first, so no money-back row is left pointing at nothing.
    const blocked = deleteBlockReason(id, get().expenses);
    if (blocked) throw new Error(blocked);

    let isRolledBack = false;
    const rollbackDelete = () => {
      if (isRolledBack) return;
      isRolledBack = true;
      set((state) => {
        if (state.expenses.some((e) => e.id === id)) return state;
        const restored = [...state.expenses];
        if (previousIndex >= 0 && previousIndex <= restored.length) {
          restored.splice(previousIndex, 0, previousExpense);
        } else {
          restored.unshift(previousExpense);
        }
        restored.sort((a, b) => {
          const dateCompare = (b.expense_date || '').localeCompare(a.expense_date || '');
          if (dateCompare !== 0) return dateCompare;
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        return { expenses: restored };
      });
      useDailyBudgetStore.getState().syncWithExpenses(get().expenses);
    };

    // 1. Optimistic local delete
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
    useDailyBudgetStore.getState().syncWithExpenses(get().expenses);

    // 2. If it's a pending offline expense, remove it from offline queue
    if (previousExpense.pending || id.startsWith('temp_')) {
      await removePendingItemOffline(user.id, id);
      // OPT-60: its first save timed out and may still land on the server; delete it there too.
      const tracked = inFlightAdds.get(id);
      if (tracked) {
        tracked.deleted = true;
        await enqueuePendingDelete(user.id, id);
      }
      return;
    }

    // 3. If currently offline, queue deletion
    const isOffline = useNetworkStore.getState().isOffline;
    if (isOffline) {
      await savePendingDeleteOffline(user.id, id);
      useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
      return;
    }

    // 4. OPT-60 write-ahead: queue the delete BEFORE the request (delete queue only; queued edits are left as they
    // are, like before). `queuedHere` = this call added it, so this call may take it out again.
    const queuedHere = await enqueuePendingDelete(user.id, id);

    set({ loading: true });
    try {
      // Promise.resolve runs the request exactly once.
      const request = Promise.resolve(
        supabase
          .from('expenses')
          .delete()
          .eq('id', id)
      );
      const outcome = await withTimeout(request, SAVE_TIMEOUT_MS, SAVE_TIMED_OUT);

      if (isTimedOut(outcome)) {
        // Stop waiting: the delete is queued and will be sent by the normal sync. A late success clears it.
        request.then(
          (late) => {
            if (!late.error && queuedHere) removePendingDelete(user.id, id).catch(() => {});
          },
          () => {}
        );
        return;
      }

      const { error } = outcome;

      if (error) {
        if (isNetworkFailure(error)) {
          useNetworkStore.getState().setOffline(true);
          await savePendingDeleteOffline(user.id, id);
          useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
          return;
        }

        // Refused by the database: take the write-ahead out again, then rollback (as before).
        if (queuedHere) await removePendingDelete(user.id, id);
        rollbackDelete();
        throw error;
      }

      // Confirmed by the server.
      if (queuedHere) await removePendingDelete(user.id, id);
      persistConfirmedCache(user.id, () => get().expenses, () => get().isExpensesLoaded).catch(() => {});
    } catch (e: unknown) {
      if (isNetworkFailure(e)) {
        useNetworkStore.getState().setOffline(true);
        await savePendingDeleteOffline(user.id, id);
        useNetworkStore.getState().triggerOfflineAlert('You are offline, changes will sync when connected');
        return;
      }

      if (!isRolledBack && queuedHere) await removePendingDelete(user.id, id);
      rollbackDelete();
      if (__DEV__) console.error('Error deleting expense:', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },
});
