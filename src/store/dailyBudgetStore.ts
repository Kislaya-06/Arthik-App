import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { format, subDays } from 'date-fns';
import { Expense } from './expenseStore';
import { useNotificationStore } from './notificationStore';

let expenseGetter: (() => Expense[]) | null = null;
export const registerExpenseGetter = (getter: () => Expense[]) => {
  expenseGetter = getter;
};
export const getCurrentExpenses = (): Expense[] => {
  return expenseGetter ? expenseGetter() : [];
};

let expensesLoadedGetter: (() => boolean) | null = null;
export const registerExpensesLoadedGetter = (getter: () => boolean) => {
  expensesLoadedGetter = getter;
};
export const areExpensesLoaded = (): boolean => {
  if (expensesLoadedGetter) {
    return expensesLoadedGetter();
  }
  if (__DEV__) {
    console.warn('[dailyBudgetStore] areExpensesLoaded called before registerExpensesLoadedGetter was registered. Defaulting to false.');
  }
  return false;
};
import { useCategoryStore, Category } from './categoryStore';
import { triggerDeviceNotification } from '../lib/notificationService';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { resolveHydratedDayBudget, resolveRolloverBudget } from '../lib/budgetUtils';
import { formatCurrency, round2 } from '../lib/formatters';

const buildCategoryClassifier = (): ((e: Expense) => boolean) => {
  const categories = useCategoryStore.getState().categories;
  const categoryMap = new Map<string, Category>();
  for (let i = 0; i < categories.length; i++) {
    categoryMap.set(categories[i].id, categories[i]);
  }
  return (e: Expense): boolean => {
    const cat = e.category_id ? categoryMap.get(e.category_id) : undefined;
    return isIncomeTransaction(e, cat);
  };
};


import {
  DailyRecord,
  SavingsMetrics,
  calculateSavingsMetrics,
  DayStatus,
  DayEvaluation,
  evaluateDayStatus,
  computeSpentByDate,
  computeSpentForDate,
  buildDefaultTodayRecord,
  filterPastRecords,
  shouldIgnoreDuplicates,
  shouldSendRolloverNotification,
} from '../lib/budgetCalculations';
export type { DailyRecord, SavingsMetrics, DayStatus, DayEvaluation };
export {
  calculateSavingsMetrics,
  evaluateDayStatus,
  computeSpentByDate,
  computeSpentForDate,
  buildDefaultTodayRecord,
  filterPastRecords,
  shouldIgnoreDuplicates,
  shouldSendRolloverNotification,
};

const getUserCreatedAtStr = (): string | undefined =>
  useAuthStore.getState().user?.created_at?.split('T')[0]?.trim();


export const getPendingSettingsKey = (userId: string) => `@arthik_pending_settings_${userId}`;

export const savePendingSettingsOffline = async (
  userId: string,
  patch: { daily_budget?: number; is_auto_renew?: boolean }
) => {
  try {
    const key = getPendingSettingsKey(userId);
    const existing = await AsyncStorage.getItem(key);
    const data = existing ? JSON.parse(existing) : {};
    const updated = { ...data, ...patch };
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    if (__DEV__) console.log('Error saving pending settings offline:', e);
  }
};

export const clearPendingSettingsOffline = async (
  userId: string,
  keysToClear?: ('daily_budget' | 'is_auto_renew')[]
) => {
  try {
    const key = getPendingSettingsKey(userId);
    if (!keysToClear) {
      await AsyncStorage.removeItem(key);
      return;
    }
    const existing = await AsyncStorage.getItem(key);
    if (!existing) return;
    const data = JSON.parse(existing);
    keysToClear.forEach((k) => delete data[k]);
    if (Object.keys(data).length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {
    if (__DEV__) console.log('Error clearing pending settings offline:', e);
  }
};

export type GullakDepositSource = 'income' | 'external';

export interface GullakDeposit {
  id: string;
  amount: number;
  date: string; // 'yyyy-MM-dd'
  note?: string;
  source: GullakDepositSource;
  created_at: string;
}

const computeMetrics = (
  records: Record<string, DailyRecord>,
  deposits?: GullakDeposit[],
  userCreatedAt?: string
) => {
  const manual = deposits && Array.isArray(deposits) ? deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0) : 0;
  return calculateSavingsMetrics(
    records,
    getTodayDateStr(),
    userCreatedAt ?? getUserCreatedAtStr(),
    new Date(),
    manual
  );
};

interface DailyBudgetState {
  ownerUserId: string | null;
  hydratedForUserId: string | null;
  dailyBudgetAmount: number; // default daily recurring amount
  isAutoRenew: boolean; // toggle ON: auto-add daily budget; OFF: manual add
  dailyRecords: Record<string, DailyRecord>;
  gullakDeposits: GullakDeposit[];
  totalAccumulatedSavings: number;
  savingsStreak: number;
  bestStreak: number;

  // Notification deduplication tracking
  lastWarningNotifiedDate: string | null;
  lastExceededNotifiedDate: string | null;
  lastRolloverNotifiedDate: string | null;

  // Next-day scheduled budget
  scheduledNextDailyBudget: number | null;
  scheduledBudgetSetDate: string | null;

  // Actions
  setDailyBudget: (amount: number) => void;
  scheduleNextDailyBudget: (amount: number) => void;
  cancelScheduledNextDailyBudget: () => void;
  toggleAutoRenew: (enabled: boolean) => void;
  addGullakDeposit: (amount: number, note?: string, source?: GullakDepositSource) => void;
  removeGullakDeposit: (id: string) => void;
  getAvailableIncomeBalance: () => number;
  syncWithExpenses: (expenses: Expense[]) => void;
  checkAndRollover: (expenses: Expense[], skipRolloverNotification?: boolean) => void;
  uploadPendingDailyRecords: () => Promise<void>;
  hydrateFromSupabase: (userId: string) => Promise<void>;
  resetDailyBudget: () => void;
  getTodayRecord: () => DailyRecord;
  getPastRecordsList: () => DailyRecord[];
}

const getTodayDateStr = () => format(new Date(), 'yyyy-MM-dd');

export const useDailyBudgetStore = create<DailyBudgetState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      hydratedForUserId: null,
      dailyBudgetAmount: 0,
      isAutoRenew: false,
      dailyRecords: {},
      gullakDeposits: [],
      totalAccumulatedSavings: 0,
      savingsStreak: 0,
      bestStreak: 0,
      lastWarningNotifiedDate: null,
      lastExceededNotifiedDate: null,
      lastRolloverNotifiedDate: null,
      scheduledNextDailyBudget: null,
      scheduledBudgetSetDate: null,

      getTodayRecord: () => {
        const todayStr = getTodayDateStr();
        const records = get().dailyRecords;
        if (records[todayStr]) {
          if (!get().isAutoRenew && !records[todayStr].isFinalized) {
            return {
              ...records[todayStr],
              budget: 0,
              saved: 0,
              status: 'unknown',
            };
          }
          return records[todayStr];
        }

        return buildDefaultTodayRecord(todayStr, get().isAutoRenew, get().dailyBudgetAmount);
      },

      getPastRecordsList: () => {
        const todayStr = getTodayDateStr();
        const records = get().dailyRecords;
        return filterPastRecords(records, todayStr);
      },

      setDailyBudget: (amount: number) => {
        const cleanAmount = Math.max(0, round2(amount));
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const willAutoRenew = cleanAmount > 0 ? true : false;

        if (willAutoRenew) {
          const existing = records[todayStr];
          const spent = existing?.spent || 0;
          const { saved } = evaluateDayStatus(cleanAmount, spent, cleanAmount);
          records[todayStr] = {
            date: todayStr,
            budget: cleanAmount,
            spent,
            saved,
            isFinalized: false,
            status: spent > cleanAmount && cleanAmount > 0 ? 'exceeded' : 'active',
          };
        }

        const metrics = computeMetrics(records, get().gullakDeposits);

        set({
          dailyBudgetAmount: cleanAmount,
          isAutoRenew: willAutoRenew,
          dailyRecords: records,
          ...metrics,
        });

        // Sync to Supabase profiles with offline queue (P0.13)
        try {
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            savePendingSettingsOffline(currentUser.id, { daily_budget: cleanAmount, is_auto_renew: willAutoRenew });
            supabase
              .from('profiles')
              .update({ daily_budget: cleanAmount, is_auto_renew: willAutoRenew })
              .eq('id', currentUser.id)
              .then(
                ({ error }) => {
                  if (!error) {
                    clearPendingSettingsOffline(currentUser.id, ['daily_budget', 'is_auto_renew']);
                  } else if (__DEV__) {
                    console.error('Error syncing daily_budget to Supabase:', error);
                  }
                },
                () => {}
              );
          }
        } catch (e) {
          // Ignore offline / auth errors
        }
      },

      toggleAutoRenew: (enabled: boolean) => {
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const currentToday = records[todayStr];

        if (enabled && get().dailyBudgetAmount > 0 && (!currentToday || currentToday.budget === 0)) {
          const budget = get().dailyBudgetAmount;
          const spent = currentToday?.spent || 0;
          const { saved } = evaluateDayStatus(budget, spent, budget);
          records[todayStr] = {
            date: todayStr,
            budget,
            spent,
            saved,
            isFinalized: false,
            status: spent > budget ? 'exceeded' : 'active',
          };
        } else if (!enabled && currentToday && !currentToday.isFinalized) {
          records[todayStr] = {
            ...currentToday,
            budget: 0,
            saved: 0,
            status: 'unknown',
          };
        }

        const metrics = computeMetrics(records, get().gullakDeposits);

        set({
          isAutoRenew: enabled,
          dailyRecords: records,
          ...metrics,
        });

        // Sync to Supabase profiles with offline queue (P0.13)
        try {
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            savePendingSettingsOffline(currentUser.id, { is_auto_renew: enabled });
            supabase
              .from('profiles')
              .update({ is_auto_renew: enabled })
              .eq('id', currentUser.id)
              .then(
                ({ error }) => {
                  if (!error) {
                    clearPendingSettingsOffline(currentUser.id, ['is_auto_renew']);
                  } else if (__DEV__) {
                    console.error('Error syncing is_auto_renew to Supabase:', error);
                  }
                },
                () => {}
              );
          }
        } catch (e) {
          // Ignore offline / auth errors
        }
      },

      scheduleNextDailyBudget: (amount: number) => {
        const cleanAmount = Math.max(0, round2(amount));
        const todayStr = getTodayDateStr();
        set({
          scheduledNextDailyBudget: cleanAmount > 0 ? cleanAmount : null,
          scheduledBudgetSetDate: cleanAmount > 0 ? todayStr : null,
        });
      },

      cancelScheduledNextDailyBudget: () => {
        set({
          scheduledNextDailyBudget: null,
          scheduledBudgetSetDate: null,
        });
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
        if (userId) {
          supabase
            .from('gullak_deposits')
            .insert({
              id: newDeposit.id,
              user_id: userId,
              amount: newDeposit.amount,
              date: newDeposit.date,
              note: newDeposit.note || null,
              source: newDeposit.source,
              created_at: newDeposit.created_at,
            })
            .then(({ error }) => {
              if (error && __DEV__) {
                console.error('[dailyBudgetStore] Error inserting gullak_deposit:', error);
              }
            });
        }
      },

      removeGullakDeposit: (id: string) => {
        const deposits = (get().gullakDeposits || []).filter((d) => d.id !== id);
        const metrics = computeMetrics(get().dailyRecords, deposits);
        set({ gullakDeposits: deposits, ...metrics });

        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          supabase
            .from('gullak_deposits')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
            .then(({ error }) => {
              if (error && __DEV__) {
                console.error('[dailyBudgetStore] Error deleting gullak_deposit:', error);
              }
            });
        }
      },

      getAvailableIncomeBalance: () => {
        const isIncome = buildCategoryClassifier();
        const totalIncome = getCurrentExpenses().reduce((sum, e) => sum + (isIncome(e) ? (Number(e.amount) || 0) : 0), 0);
        const incomeDeposits = (get().gullakDeposits || []).reduce((sum, d) => sum + (d.source === 'income' ? (Number(d.amount) || 0) : 0), 0);
        return round2(Math.max(0, totalIncome - incomeDeposits));
      },

      syncWithExpenses: (expenses: Expense[]) => {
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const isIncomeFn = buildCategoryClassifier();

        const todaySpent = computeSpentForDate(expenses, todayStr, isIncomeFn);

        let todayRecord = records[todayStr];
        let hasTodayChanged = false;

        const baseDaily = get().isAutoRenew && get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : undefined;

        if (!todayRecord) {
          const budget = get().isAutoRenew && get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : 0;
          const { saved } = evaluateDayStatus(budget, todaySpent, baseDaily);
          todayRecord = {
            date: todayStr,
            budget,
            spent: todaySpent,
            saved,
            isFinalized: false,
            status: todaySpent > budget && budget > 0 ? 'exceeded' : 'active',
          };
          hasTodayChanged = true;
        } else {
          const { saved: newSaved } = evaluateDayStatus(todayRecord.budget, todaySpent, baseDaily);
          const newStatus =
            todaySpent > todayRecord.budget && todayRecord.budget > 0
              ? 'exceeded'
              : 'active';

          if (todayRecord.spent !== todaySpent || todayRecord.status !== newStatus || todayRecord.saved !== newSaved) {
            todayRecord = {
              ...todayRecord,
              spent: todaySpent,
              saved: newSaved,
              status: newStatus,
            };
            hasTodayChanged = true;
          }
        }
        records[todayStr] = todayRecord;

        // Check for smart alerts & trigger native phone notifications
        if (todayRecord.budget > 0) {
          const ratio = todaySpent / todayRecord.budget;
          const remaining = Math.max(0, todayRecord.budget - todaySpent);
          const notifStore = useNotificationStore.getState();

          if (ratio >= 1) {
            if (get().lastExceededNotifiedDate !== todayStr) {
              const title = '🚨 Daily Allowance Exceeded!';
              const body = `You spent ${formatCurrency(todaySpent)} of today's ${formatCurrency(todayRecord.budget)} limit (exceeded by ${formatCurrency(todaySpent - todayRecord.budget)}).`;

              notifStore.addNotification({
                id: `alert_exceeded_${todayStr}`,
                title,
                message: body,
                type: 'budget_exceeded',
                data: { date: todayStr, amount: todaySpent, remaining: 0 },
              });

              triggerDeviceNotification(title, body, {
                type: 'budget_exceeded',
                screen: 'Savings',
                date: todayStr,
              });

              set({ lastExceededNotifiedDate: todayStr });
            }
          } else if (ratio >= 0.8) {
            if (get().lastWarningNotifiedDate !== todayStr) {
              const title = '⚠️ 80% Daily Budget Reached';
              const body = `You've used ${Math.round(ratio * 100)}% of today's budget. Only ${formatCurrency(remaining)} left to spend today!`;

              notifStore.addNotification({
                id: `alert_warning_80_${todayStr}`,
                title,
                message: body,
                type: 'budget_warning',
                data: { date: todayStr, amount: todaySpent, remaining },
              });

              triggerDeviceNotification(title, body, {
                type: 'budget_warning',
                screen: 'Savings',
                date: todayStr,
              });

              set({ lastWarningNotifiedDate: todayStr });
            }
          }
        }

        if (hasTodayChanged) {
          const metrics = computeMetrics(records, get().gullakDeposits);
          set({ dailyRecords: records, ...metrics });
        }

        // Trigger rollover check
        get().checkAndRollover(expenses);
      },

      checkAndRollover: (expenses: Expense[], skipRolloverNotification = false) => {
        const currentUser = useAuthStore.getState().user;
        // P0.1: Must not run or finalize before hydrateFromSupabase has completed for this user!
        if (!currentUser || get().hydratedForUserId !== currentUser.id) {
          return;
        }

        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        let updated = false;

        // Apply scheduled next-day daily budget if date has advanced past scheduled day
        const scheduled = get().scheduledNextDailyBudget;
        const scheduledDate = get().scheduledBudgetSetDate;
        if (scheduled && scheduledDate && todayStr > scheduledDate) {
          get().setDailyBudget(scheduled);
          set({ scheduledNextDailyBudget: null, scheduledBudgetSetDate: null });

          const title = '✨ Daily Budget Updated!';
          const body = `Your new daily budget of ${formatCurrency(scheduled)} is now active.`;
          useNotificationStore.getState().addNotification({
            id: `scheduled_budget_${todayStr}`,
            title,
            message: body,
            type: 'budget_warning',
            data: { date: todayStr, amount: scheduled },
          });
          triggerDeviceNotification(title, body, { type: 'budget_warning', screen: 'Savings', date: todayStr });
        }

        const isIncomeFn = buildCategoryClassifier();

        // 1. Group all non-income expenses by date in a single O(N) pass
        const spentByDate = computeSpentByDate(expenses, isIncomeFn);

        // 2. Identify all past dates (< todayStr) from existing records and expenses
        const pastDates = new Set<string>();
        const recordKeys = Object.keys(records);
        for (let i = 0; i < recordKeys.length; i++) {
          if (recordKeys[i] < todayStr) {
            pastDates.add(recordKeys[i]);
          }
        }
        const expenseDates = Object.keys(spentByDate);
        for (let i = 0; i < expenseDates.length; i++) {
          if (expenseDates[i] < todayStr) {
            pastDates.add(expenseDates[i]);
          }
        }

        const userCreatedAtStr = currentUser?.created_at?.split('T')[0]?.trim();
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        // Only add gap-fill for days that already have an existing record OR have real expenses.
        // Do NOT fabricate days the user never interacted with — that creates phantom history entries.
        // ponytail: deliberately skipping zero-activity days; upgrade = track "app open" events per day

        // 3. For every past date, verify if spent or saved or status changed (e.g. after edit/delete)
        for (const d of pastDates) {
          const isPreAccount = Boolean(userCreatedAtStr && d < userCreatedAtStr);
          if (isPreAccount) {
            // Backdated entry from before user account creation: do not create auto-renew daily record
            if (records[d]) {
              delete records[d];
              updated = true;
            }
            continue;
          }

          const existing = records[d];
          const spent = spentByDate[d] || 0;

          let budget = 0;
          let saved = 0;
          let status: 'saved' | 'exceeded' | 'even' | 'unknown' = 'unknown';

          if (existing && existing.status === 'unknown') {
            // Preserved untracked historical day
            status = 'unknown';
            budget = 0;
            saved = 0;
          } else if (existing && (existing.budget > 0 || existing.isFinalized)) {
            // Lock to budget-at-the-time persisted in existing record (resolved via pure helper)
            budget = resolveRolloverBudget(existing.budget, get().dailyBudgetAmount);
            const baseDaily = get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : undefined;
            const evaluated = evaluateDayStatus(budget, spent, baseDaily);
            saved = evaluated.saved;
            status = evaluated.status;
          } else if (!existing) {
            // Past date being finalized for the very first time with no prior record:
            // P1.3 (Option A): If auto-renew is active and budget > 0, use daily budget so streak & savings are preserved
            if (get().isAutoRenew && get().dailyBudgetAmount > 0) {
              budget = get().dailyBudgetAmount;
            } else if (spent > 0) {
              budget = 0;
            } else {
              // No prior record, 0 budget, 0 spent: skip
              continue;
            }
            const baseDaily = get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : undefined;
            const evaluated = evaluateDayStatus(budget, spent, baseDaily);
            saved = evaluated.saved;
            status = evaluated.status;
          } else {
            // Existing record with 0 budget (e.g. manual mode)
            if (get().isAutoRenew && get().dailyBudgetAmount > 0 && existing.budget === 0) {
              budget = get().dailyBudgetAmount;
            } else {
              budget = 0;
            }
            const baseDaily = get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : undefined;
            const evaluated = evaluateDayStatus(budget, spent, baseDaily);
            saved = evaluated.saved;
            status = evaluated.status;
          }

          const hasChanged =
            !existing ||
            !existing.isFinalized ||
            existing.spent !== spent ||
            existing.saved !== saved ||
            existing.status !== status ||
            existing.budget !== budget;

          if (hasChanged) {
            const wasUnfinalized = !existing?.isFinalized;
            records[d] = {
              date: d,
              budget,
              spent,
              saved,
              isFinalized: true,
              status,
              needsUpload: true,
            };
            updated = true;

            // Sync updated past day to Supabase daily_savings_log (async fire-and-forget with offline fallback)
            try {
              const supabaseStatus =
                status === 'unknown'
                  ? 'unknown'
                  : saved > 0
                  ? 'saved'
                  : status === 'even'
                  ? 'even'
                  : 'missed';

              const isInsertOnly = shouldIgnoreDuplicates(status);

              supabase
                .from('daily_savings_log')
                .upsert(
                  {
                    user_id: currentUser.id,
                    date: d,
                    amount_saved: saved,
                    spent_amount: spent,
                    status: supabaseStatus,
                    budget_amount: budget,
                  },
                  { onConflict: 'user_id,date', ignoreDuplicates: isInsertOnly }
                )
                .then(
                  ({ error }) => {
                    if (!error) {
                      const cur = get().dailyRecords;
                      if (cur[d]) {
                        set({
                          dailyRecords: {
                            ...cur,
                            [d]: { ...cur[d], needsUpload: false },
                          },
                        });
                      }
                    } else if (__DEV__) {
                      console.error('Error syncing updated daily_savings_log to Supabase:', error);
                    }
                  },
                  () => {}
                );
            } catch {
              // Ignore offline/auth errors; needsUpload remains true
            }

            // Trigger notification for yesterday's savings rollover once confirmed expenses are loaded.
            const shouldNotify = shouldSendRolloverNotification({
              date: d,
              yesterdayStr,
              saved,
              isExpensesLoaded: areExpensesLoaded(),
              skipRolloverNotification,
              lastRolloverNotifiedDate: get().lastRolloverNotifiedDate,
            });

            if (shouldNotify) {
              const title = '🎉 Savings Gullak Deposit!';
              const body = `Superb! You saved ${formatCurrency(saved)} yesterday. It has been deposited into your Savings Gullak!`;

              useNotificationStore.getState().addNotification({
                id: `rollover_${d}`,
                title,
                message: body,
                type: 'savings_rollover',
                data: { date: d, amount: saved },
              });

              triggerDeviceNotification(title, body, {
                type: 'savings_rollover',
                screen: 'Savings',
                date: d,
              });

              set({ lastRolloverNotifiedDate: d });
            }
          }
        }

        // Compute savings metrics using shared helper
        const metrics = computeMetrics(records, get().gullakDeposits);

        if (
          updated ||
          get().totalAccumulatedSavings !== metrics.totalAccumulatedSavings ||
          get().savingsStreak !== metrics.savingsStreak ||
          get().bestStreak !== metrics.bestStreak
        ) {
          set({
            dailyRecords: records,
            ...metrics,
          });
        }
      },

      uploadPendingDailyRecords: async () => {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) return;
        if (get().hydratedForUserId !== currentUser.id) return;

        const records = { ...get().dailyRecords };
        const dates = Object.keys(records);
        let hasUpdates = false;

        for (const d of dates) {
          const rec = records[d];
          if (rec && rec.isFinalized && rec.needsUpload) {
            const supabaseStatus =
              rec.status === 'unknown'
                ? 'unknown'
                : rec.saved > 0
                ? 'saved'
                : rec.status === 'even'
                ? 'even'
                : 'missed';

            const isInsertOnly = shouldIgnoreDuplicates(rec.status);
            try {
              const { error } = await supabase
                .from('daily_savings_log')
                .upsert(
                  {
                    user_id: currentUser.id,
                    date: d,
                    amount_saved: rec.saved,
                    spent_amount: rec.spent,
                    status: supabaseStatus,
                    budget_amount: rec.budget,
                  },
                  { onConflict: 'user_id,date', ignoreDuplicates: isInsertOnly }
                );

              if (!error) {
                records[d] = { ...rec, needsUpload: false };
                hasUpdates = true;
              }
            } catch {
              // Still offline
            }
          }
        }

        if (hasUpdates) {
          set({ dailyRecords: records });
        }
      },

      hydrateFromSupabase: async (userId: string) => {
        if (!userId) return;
        try {
          // P0.1: Wait for zustand persist rehydration if not already done
          if (!useDailyBudgetStore.persist.hasHydrated()) {
            await new Promise<void>((resolve) => {
              const unsub = useDailyBudgetStore.persist.onFinishHydration(() => {
                unsub();
                resolve();
              });
            });
          }

          // P0.2: Reset state if owner changed
          if (get().ownerUserId && get().ownerUserId !== userId) {
            get().resetDailyBudget();
          }
          set({ ownerUserId: userId });

          // Also set owner on notificationStore
          useNotificationStore.getState().setOwnerUserId(userId);

          const todayStr = getTodayDateStr();

          // Check pending settings key (P0.13)
          let pendingSettings: { daily_budget?: number; is_auto_renew?: boolean } = {};
          try {
            const stored = await AsyncStorage.getItem(getPendingSettingsKey(userId));
            if (stored) pendingSettings = JSON.parse(stored);
          } catch {}

          // 1. Fetch user's profile settings (daily_budget, is_auto_renew)
          const { data: profileData } = await supabase
            .from('profiles')
            .select('daily_budget, is_auto_renew')
            .eq('id', userId)
            .maybeSingle();

          let resolvedBudget = get().dailyBudgetAmount;
          let resolvedAutoRenew = get().isAutoRenew;
          // Track whether Supabase returned the migration-default 500 so self-healing can fire
          // even on fresh installs where local state is already 0 (and resolvedBudget gets set to 0).
          let remoteBudgetWasMigrationDefault = false;

          if (pendingSettings.daily_budget !== undefined) {
            resolvedBudget = pendingSettings.daily_budget;
          } else if (profileData && profileData.daily_budget !== null && profileData.daily_budget !== undefined) {
            const remoteBudget = Math.max(0, round2(Number(profileData.daily_budget)));
            // Guard: Remote is the migration default 500 AND local has a different value (including 0 = fresh install).
            // In both cases the self-healing recovery block below will infer the real budget from savings logs,
            // so we defer — leave resolvedBudget as whatever local already has and let recovery overwrite if needed.
            if (remoteBudget === 500) {
              remoteBudgetWasMigrationDefault = true;
              // Keep local value for now; self-healing block below will fix it from savings log history
              resolvedBudget = get().dailyBudgetAmount; // may be 0 on fresh install — overwritten by recovery
            } else {
              resolvedBudget = remoteBudget;
            }
          }

          if (pendingSettings.is_auto_renew !== undefined) {
            resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew);
          } else if (profileData && profileData.is_auto_renew !== null && profileData.is_auto_renew !== undefined) {
            resolvedAutoRenew = Boolean(profileData.is_auto_renew);
          } else if (resolvedBudget > 0) {
            resolvedAutoRenew = true;
          }

          // 2. Fetch past daily savings logs from Supabase
          const { data: logsData } = await supabase
            .from('daily_savings_log')
            .select('date, amount_saved, spent_amount, status, budget_amount')
            .eq('user_id', userId)
            .order('date', { ascending: true });

          const records = { ...get().dailyRecords };

          const currentUser = useAuthStore.getState().user;
          const userCreatedAtStr = currentUser?.created_at?.split('T')[0]?.trim();

          // ------------------------------------------------------------------------------------
          // SELF-HEALING RECOVERY (Fix for OTA Update Bug where user budget was reset to 500)
          // ------------------------------------------------------------------------------------
          // If the user's resolved budget is 500 (the default migration/reset value), inspect their
          // historical savings logs & real expenses to detect if their original budget was different.
          const currentExpenses = getCurrentExpenses();
          const isIncomeFn = buildCategoryClassifier();
          const spentByDate = computeSpentByDate(currentExpenses, isIncomeFn);

          let wasRepairedFromHistory = false;
          // Trigger recovery only when Supabase returned the migration-default 500.
          // This covers both the live case (resolvedBudget===500 via pendingSettings) and the
          // fresh-install case (remote=500 deferred to local=0 above). Intentional 0 set by
          // the user is never treated as "wrong" — remoteBudgetWasMigrationDefault stays false.
          const budgetLooksWrong = remoteBudgetWasMigrationDefault || resolvedBudget === 500;
          if (budgetLooksWrong && logsData && logsData.length > 0) {
            const budgetCandidates: Record<number, number> = {};
            for (let i = 0; i < logsData.length; i++) {
              const logEntry: any = logsData[i];
              const d = logEntry.date;
              if (userCreatedAtStr && d < userCreatedAtStr) continue;
              const amountSaved = Number(logEntry.amount_saved) || 0;
              const spent = spentByDate[d] || 0;

              // Check if past log had an explicit non-500 budget_amount saved
              if (logEntry.budget_amount !== null && logEntry.budget_amount !== undefined) {
                const b = round2(Number(logEntry.budget_amount));
                if (b > 0 && b !== 500) {
                  budgetCandidates[b] = (budgetCandidates[b] || 0) + 2;
                }
              }

              // Check if local record for that day has a non-500 budget
              if (records[d]?.budget && records[d].budget > 0 && records[d].budget !== 500) {
                const b = round2(records[d].budget);
                budgetCandidates[b] = (budgetCandidates[b] || 0) + 2;
              }

              // On confirmed saved days, amount_saved + spent reveals the original day budget
              if (logEntry.status === 'saved' && amountSaved > 0) {
                const inferred = round2(amountSaved + spent);
                if (inferred > 0 && inferred !== 500) {
                  budgetCandidates[inferred] = (budgetCandidates[inferred] || 0) + 1;
                }
              }
            }

            let bestCandidate = 0;
            let maxCount = 0;
            for (const [candidateStr, count] of Object.entries(budgetCandidates)) {
              const candidate = Number(candidateStr);
              if (count > maxCount) {
                maxCount = count;
                bestCandidate = candidate;
              }
            }

            // If we detected a consistent original non-500 budget, restore it!
            if (bestCandidate > 0 && bestCandidate !== 500) {
              resolvedBudget = bestCandidate;
              resolvedAutoRenew = true;
              wasRepairedFromHistory = true;
              supabase.from('profiles').update({ daily_budget: resolvedBudget, is_auto_renew: true }).eq('id', userId).then(() => {});
            }
          }

          // If remote was 500 and no non-500 candidate was found, restore 500
          if (remoteBudgetWasMigrationDefault && resolvedBudget === 0) {
            resolvedBudget = 500;
          }
          if (resolvedBudget > 0 && profileData?.is_auto_renew !== false && !pendingSettings.is_auto_renew) {
            resolvedAutoRenew = true;
          }

          if (logsData && logsData.length > 0) {
            for (let i = 0; i < logsData.length; i++) {
              const log: any = logsData[i];
              const d = log.date;
              if (userCreatedAtStr && d < userCreatedAtStr) {
                continue; // Ignore any erroneous pre-registration logs
              }

              const rawLogBudget = log.budget_amount !== null && log.budget_amount !== undefined ? Number(log.budget_amount) : null;
              const rawLogSaved = Number(log.amount_saved) || 0;
              const daySpent =
                log.spent_amount !== null && log.spent_amount !== undefined
                  ? Number(log.spent_amount)
                  : spentByDate[d] !== undefined
                  ? spentByDate[d]
                  : 0;

              // --- 1. DETERMINE TRUE DAY BUDGET ---
              const dayBudget = resolveHydratedDayBudget({
                rawLogBudget,
                localRecordBudget: records[d]?.budget,
                resolvedBudget,
              });

              // --- 2. RECALCULATE SAVED & STATUS ---
              const baseDaily = resolvedBudget > 0 ? resolvedBudget : undefined;
              const { saved: daySaved, status: evaluatedStatus } = evaluateDayStatus(dayBudget, daySpent, baseDaily);

              records[d] = {
                date: d,
                budget: dayBudget,
                spent: daySpent,
                saved: daySaved,
                isFinalized: true,
                status: evaluatedStatus,
                needsUpload: false,
              };

              // --- 3. SELF-HEAL SUPABASE CORRUPTED ROW ---
              // If the row in Supabase had the fake 500 budget or wrong saved amount/status, fix it!
              const wasCorrupted =
                (rawLogBudget === 500 && dayBudget !== 500) ||
                rawLogSaved !== daySaved ||
                (rawLogBudget !== null && rawLogBudget !== dayBudget) ||
                log.status !== (evaluatedStatus === 'even' ? 'even' : daySaved > 0 ? 'saved' : evaluatedStatus === 'unknown' ? 'unknown' : 'missed');

              if (wasCorrupted && dayBudget > 0) {
                // Self-healing deliberately omits ignoreDuplicates to unconditionally overwrite confirmed corrupted server rows.
                supabase
                  .from('daily_savings_log')
                  .upsert(
                    {
                      user_id: userId,
                      date: d,
                      amount_saved: daySaved,
                      spent_amount: daySpent,
                      budget_amount: dayBudget,
                      status: evaluatedStatus === 'even' ? 'even' : daySaved > 0 ? 'saved' : evaluatedStatus === 'unknown' ? 'unknown' : 'missed',
                    },
                    { onConflict: 'user_id,date' }
                  )
                  .then(() => {});
              }
            }
          }



          // Ensure today's record exists if not present
          if (!records[todayStr]) {
            const todayBudget = resolvedAutoRenew && resolvedBudget > 0 ? resolvedBudget : 0;
            records[todayStr] = {
              date: todayStr,
              budget: todayBudget,
              spent: 0,
              saved: todayBudget,
              isFinalized: false,
              status: 'active',
            };
          } else if (!records[todayStr].isFinalized && records[todayStr].budget === 0 && resolvedAutoRenew && resolvedBudget > 0) {
            records[todayStr].budget = resolvedBudget;
            records[todayStr].saved = Math.max(0, resolvedBudget - records[todayStr].spent);
          }

          // 2b. Fetch manual gullak deposits from Supabase
          let resolvedDeposits = get().gullakDeposits || [];
          try {
            const { data: depData, error: depError } = await supabase
              .from('gullak_deposits')
              .select('id, amount, date, note, source, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (!depError && depData) {
              const serverDeposits: GullakDeposit[] = depData.map((d: any) => ({
                id: d.id,
                amount: Number(d.amount) || 0,
                date: d.date,
                note: d.note || undefined,
                source: (d.source === 'income' || d.source === 'external') ? d.source : 'external',
                created_at: d.created_at,
              }));

              const localDeposits = get().gullakDeposits || [];
              const serverIdSet = new Set(serverDeposits.map((d) => d.id));
              const missingOnServer = localDeposits.filter((d) => !serverIdSet.has(d.id));

              if (missingOnServer.length > 0) {
                missingOnServer.forEach((m) => {
                  supabase
                    .from('gullak_deposits')
                    .insert({
                      id: m.id,
                      user_id: userId,
                      amount: m.amount,
                      date: m.date,
                      note: m.note || null,
                      source: m.source || 'external',
                      created_at: m.created_at,
                    })
                    .then(() => {});
                });
              }

              resolvedDeposits = [...serverDeposits, ...missingOnServer].sort((a, b) =>
                b.date.localeCompare(a.date)
              );
            }
          } catch (depErr) {
            if (__DEV__) console.log('Error hydrating gullak_deposits from Supabase:', depErr);
          }

          // 3. Recalculate metrics from combined records
          const metrics = computeMetrics(records, resolvedDeposits, userCreatedAtStr);

          set({
            dailyBudgetAmount: resolvedBudget,
            isAutoRenew: resolvedAutoRenew,
            dailyRecords: records,
            gullakDeposits: resolvedDeposits,
            ownerUserId: userId,
            hydratedForUserId: userId,
            ...metrics,
          });

          // P0.1: Trigger checkAndRollover once after successful hydration.
          // Skip rollover notification here — expenses may be stale local cache.
          // Notification will fire correctly from syncWithExpenses after fresh fetch.
          get().checkAndRollover(currentExpenses, true);

          // P0.14: Also upload any records that need upload
          get().uploadPendingDailyRecords();
        } catch (e) {
          if (__DEV__) console.error('Error hydrating daily budget from Supabase:', e);
        }
      },

      resetDailyBudget: () => {
        set({
          ownerUserId: null,
          hydratedForUserId: null,
          dailyBudgetAmount: 0,
          isAutoRenew: false,
          dailyRecords: {},
          gullakDeposits: [],
          totalAccumulatedSavings: 0,
          savingsStreak: 0,
          bestStreak: 0,
          lastWarningNotifiedDate: null,
          lastExceededNotifiedDate: null,
          lastRolloverNotifiedDate: null,
          scheduledNextDailyBudget: null,
          scheduledBudgetSetDate: null,
        });
        AsyncStorage.removeItem('arthik-daily-budget-storage-v2').catch(() => {});
      },
    }),
    {
      name: 'arthik-daily-budget-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

registerStoreResetCallback(() => {
  useDailyBudgetStore.getState().resetDailyBudget();
});
