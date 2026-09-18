import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useCategoryStore } from './categoryStore';
import { triggerDeviceNotification } from '../lib/notificationService';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { DEFAULT_INCOME_KEYWORDS } from '../lib/paymentUtils';
import { resolveHydratedDayBudget } from '../lib/budgetUtils';

const getIncomeCategoryIds = (): Set<string> => {
  const cats = useCategoryStore.getState().categories;
  const incomeIds = new Set<string>();
  for (let i = 0; i < cats.length; i++) {
    const name = cats[i].name.toLowerCase();
    if (DEFAULT_INCOME_KEYWORDS.some((kw) => name.includes(kw))) {
      incomeIds.add(cats[i].id);
    }
  }
  return incomeIds;
};

export interface DailyRecord {
  date: string; // 'yyyy-MM-dd'
  budget: number;
  spent: number;
  saved: number;
  isFinalized: boolean;
  status: 'saved' | 'exceeded' | 'even' | 'active' | 'unknown';
  needsUpload?: boolean;
}

export const calculateSavingsMetrics = (records: Record<string, DailyRecord>, todayStr: string, userCreatedAtStr?: string) => {
  let totalSaved = 0;
  let totalOverspent = 0;
  const userCreatedAt = userCreatedAtStr || useAuthStore.getState().user?.created_at?.split('T')[0]?.trim();

  Object.values(records).forEach((r) => {
    // Check confirmed finalized past days that are on or after the user registered
    if (r.isFinalized && r.date < todayStr) {
      if (userCreatedAt && r.date < userCreatedAt) {
        // Pre-registration backdated days do not affect Gullak savings or penalty
        return;
      }
      // 'unknown' days do not affect Gullak savings or penalties
      if (r.status === 'unknown') {
        return;
      }
      if (r.budget > 0 && r.spent > r.budget) {
        totalOverspent += (r.spent - r.budget);
      } else if ((r.saved || 0) > 0) {
        totalSaved += (r.saved || 0);
      }
    }
  });

  // Include today's live overspend if user spent more than today's budget
  const todayRec = records[todayStr];
  if (todayRec && todayRec.budget > 0 && todayRec.spent > todayRec.budget) {
    totalOverspent += (todayRec.spent - todayRec.budget);
  }

  // Net accumulated savings cannot drop below 0
  const netSavings = Math.max(0, totalSaved - totalOverspent);

  const confirmedSavedDays = Object.values(records).filter(
    (r) => r.isFinalized && r.date < todayStr && r.status === 'saved' && (r.saved || 0) > 0 && (!userCreatedAt || r.date >= userCreatedAt)
  ).length;

  let streak = 0;
  let dayCheck = subDays(new Date(), 1);
  while (true) {
    const dStr = format(dayCheck, 'yyyy-MM-dd');
    if (userCreatedAt && dStr < userCreatedAt) {
      break;
    }
    const rec = records[dStr];
    if (rec && rec.isFinalized) {
      // 'unknown' days neither extend nor break the streak: skip and continue checking earlier days
      if (rec.status === 'unknown') {
        dayCheck = subDays(dayCheck, 1);
        continue;
      }
      if (rec.status === 'saved' && (rec.saved || 0) > 0) {
        streak++;
        dayCheck = subDays(dayCheck, 1);
        continue;
      }
    }
    // Any other status (exceeded, even, active, or missing unfinalized day) breaks the streak
    break;
  }

  let maxStreak = 0;
  let currentRun = 0;
  const finalizedSavedRecords = Object.values(records)
    .filter((r) => r.isFinalized && r.date < todayStr && r.status === 'saved' && (r.saved || 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < finalizedSavedRecords.length; i++) {
    const rec = finalizedSavedRecords[i];
    if (i === 0) {
      currentRun = 1;
    } else {
      const prevDate = new Date(finalizedSavedRecords[i - 1].date);
      const curDate = new Date(rec.date);
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentRun++;
      } else {
        // Check if all days in between are 'unknown' — an unknown day should neither extend nor break a streak
        let allIntermediateUnknown = true;
        for (let step = 1; step < diffDays; step++) {
          const intermediateDate = new Date(prevDate);
          intermediateDate.setDate(prevDate.getDate() + step);
          const intermediateStr = format(intermediateDate, 'yyyy-MM-dd');
          if (records[intermediateStr]?.status !== 'unknown') {
            allIntermediateUnknown = false;
            break;
          }
        }
        if (allIntermediateUnknown) {
          currentRun++;
        } else {
          currentRun = 1;
        }
      }
    }
    if (currentRun > maxStreak) {
      maxStreak = currentRun;
    }
  }

  if (confirmedSavedDays === 0) {
    streak = 0;
    maxStreak = 0;
  } else if (streak > confirmedSavedDays) {
    streak = confirmedSavedDays;
  }
  const bestStreak = confirmedSavedDays === 0 ? 0 : Math.max(maxStreak, streak);

  return {
    totalAccumulatedSavings: netSavings,
    savingsStreak: streak,
    bestStreak,
  };
};

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

interface DailyBudgetState {
  ownerUserId: string | null;
  hydratedForUserId: string | null;
  dailyBudgetAmount: number; // default daily recurring amount
  isAutoRenew: boolean; // toggle ON: auto-add daily budget; OFF: manual add
  dailyRecords: Record<string, DailyRecord>;
  totalAccumulatedSavings: number;
  savingsStreak: number;
  bestStreak: number;

  // Notification deduplication tracking
  lastWarningNotifiedDate: string | null;
  lastExceededNotifiedDate: string | null;
  lastRolloverNotifiedDate: string | null;

  // Actions
  setDailyBudget: (amount: number) => void;
  toggleAutoRenew: (enabled: boolean) => void;
  setTodayBudget: (amount: number) => void;
  addToTodayBudget: (amount: number) => void;
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
      totalAccumulatedSavings: 0,
      savingsStreak: 0,
      bestStreak: 0,
      lastWarningNotifiedDate: null,
      lastExceededNotifiedDate: null,
      lastRolloverNotifiedDate: null,

      getTodayRecord: () => {
        const todayStr = getTodayDateStr();
        const records = get().dailyRecords;
        if (records[todayStr]) {
          return records[todayStr];
        }

        const budget = get().isAutoRenew ? get().dailyBudgetAmount : 0;
        return {
          date: todayStr,
          budget,
          spent: 0,
          saved: budget,
          isFinalized: false,
          status: 'active',
        };
      },

      getPastRecordsList: () => {
        const todayStr = getTodayDateStr();
        const records = get().dailyRecords;
        return Object.values(records)
          .filter((r) => r.date !== todayStr)
          .sort((a, b) => b.date.localeCompare(a.date));
      },

      setDailyBudget: (amount: number) => {
        const cleanAmount = Math.max(0, Math.round(amount));
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const willAutoRenew = cleanAmount > 0 ? true : get().isAutoRenew;

        if (willAutoRenew) {
          const currentToday = records[todayStr] || {
            date: todayStr,
            budget: cleanAmount,
            spent: 0,
            saved: cleanAmount,
            isFinalized: false,
            status: 'active',
          };

          currentToday.budget = cleanAmount;
          currentToday.saved = Math.max(0, cleanAmount - currentToday.spent);
          currentToday.status = currentToday.spent > cleanAmount ? 'exceeded' : 'active';
          records[todayStr] = currentToday;
        }

        const metrics = calculateSavingsMetrics(records, todayStr);

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
          records[todayStr] = {
            date: todayStr,
            budget,
            spent,
            saved: Math.max(0, budget - spent),
            isFinalized: false,
            status: spent > budget ? 'exceeded' : 'active',
          };
        }

        const metrics = calculateSavingsMetrics(records, todayStr);

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

      setTodayBudget: (amount: number) => {
        const cleanAmount = Math.max(0, Math.round(amount));
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const currentToday = records[todayStr] || {
          date: todayStr,
          budget: cleanAmount,
          spent: 0,
          saved: cleanAmount,
          isFinalized: false,
          status: 'active',
        };

        currentToday.budget = cleanAmount;
        currentToday.saved = Math.max(0, cleanAmount - currentToday.spent);
        currentToday.status = currentToday.spent > cleanAmount ? 'exceeded' : 'active';
        records[todayStr] = currentToday;

        const metrics = calculateSavingsMetrics(records, todayStr);
        set({ dailyRecords: records, ...metrics });
      },

      addToTodayBudget: (extraAmount: number) => {
        const cleanExtra = Math.max(0, Math.round(extraAmount));
        if (cleanExtra <= 0) return;

        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const currentToday = records[todayStr] || {
          date: todayStr,
          budget: get().isAutoRenew ? get().dailyBudgetAmount : 0,
          spent: 0,
          saved: 0,
          isFinalized: false,
          status: 'active',
        };

        const newBudget = currentToday.budget + cleanExtra;
        currentToday.budget = newBudget;
        currentToday.saved = Math.max(0, newBudget - currentToday.spent);
        currentToday.status = currentToday.spent > newBudget ? 'exceeded' : 'active';
        records[todayStr] = currentToday;

        const metrics = calculateSavingsMetrics(records, todayStr);
        set({ dailyRecords: records, ...metrics });
      },

      syncWithExpenses: (expenses: Expense[]) => {
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const incomeIds = getIncomeCategoryIds();

        // Optimized spent calculation using Set lookup O(1)
        let todaySpent = 0;
        for (let i = 0; i < expenses.length; i++) {
          const e = expenses[i];
          const isIncome = e.type === 'income' || (e.type !== 'expense' && e.category_id ? incomeIds.has(e.category_id) : false);
          const cleanDate = e.expense_date?.split('T')[0]?.trim();
          if (cleanDate === todayStr && !isIncome) {
            todaySpent += Number(e.amount) || 0;
          }
        }

        let todayRecord = records[todayStr];
        let hasTodayChanged = false;

        if (!todayRecord) {
          const budget = get().isAutoRenew && get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : 0;
          todayRecord = {
            date: todayStr,
            budget,
            spent: todaySpent,
            saved: Math.max(0, budget - todaySpent),
            isFinalized: false,
            status: todaySpent > budget && budget > 0 ? 'exceeded' : 'active',
          };
          hasTodayChanged = true;
        } else {
          const newSaved = Math.max(0, todayRecord.budget - todaySpent);
          const newStatus =
            todaySpent > todayRecord.budget && todayRecord.budget > 0
              ? 'exceeded'
              : 'active';

          if (todayRecord.spent !== todaySpent || todayRecord.status !== newStatus) {
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
              const body = `You spent ₹${Math.round(todaySpent)} of today's ₹${todayRecord.budget} limit (exceeded by ₹${Math.round(todaySpent - todayRecord.budget)}).`;

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
              const body = `You've used ${Math.round(ratio * 100)}% of today's budget. Only ₹${Math.round(remaining)} left to spend today!`;

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
          set({ dailyRecords: records });
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
        const incomeIds = getIncomeCategoryIds();
        let updated = false;

        // 1. Group all non-income expenses by date in a single O(N) pass
        const spentByDate: Record<string, number> = {};
        for (let i = 0; i < expenses.length; i++) {
          const e = expenses[i];
          const isIncome = e.type === 'income' || (e.type !== 'expense' && e.category_id ? incomeIds.has(e.category_id) : false);
          const cleanDate = e.expense_date?.split('T')[0]?.trim();
          if (!isIncome && cleanDate) {
            spentByDate[cleanDate] = (spentByDate[cleanDate] || 0) + (Number(e.amount) || 0);
          }
        }

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
            // Lock to budget-at-the-time persisted in existing record
            budget = existing.budget;
            // Guard: If existing was corrupted to 500 by previous bug, repair to user's real daily budget
            if (budget === 500 && get().dailyBudgetAmount > 0 && get().dailyBudgetAmount !== 500) {
              budget = get().dailyBudgetAmount;
            }
            saved = Math.max(0, budget - spent);
            status = spent > budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';
          } else if (!existing) {
            // Past date being finalized for the very first time with no prior record:
            // P1.3 (Option A): If auto-renew is active and budget > 0, use daily budget so streak & savings are preserved
            if (get().isAutoRenew && get().dailyBudgetAmount > 0) {
              budget = get().dailyBudgetAmount;
              saved = Math.max(0, budget - spent);
              status = spent > budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';
            } else if (spent > 0) {
              status = 'unknown';
              budget = 0;
              saved = 0;
            } else {
              // No prior record, 0 budget, 0 spent: skip
              continue;
            }
          } else {
            // Existing record with 0 budget (e.g. manual mode)
            if (get().isAutoRenew && get().dailyBudgetAmount > 0 && existing.budget === 0) {
              budget = get().dailyBudgetAmount;
              saved = Math.max(0, budget - spent);
              status = spent > budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';
            } else {
              status = 'unknown';
              budget = 0;
              saved = 0;
            }
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

              const isInsertOnly = status === 'unknown' || wasUnfinalized;

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

            // Trigger notification for yesterday's savings rollover on initial rollover only.
            // skipRolloverNotification=true when called from hydrateFromSupabase (stale local expenses)
            // so notification only fires after fresh expenses are loaded via syncWithExpenses.
            if (d === yesterdayStr && saved > 0 && wasUnfinalized && !skipRolloverNotification && get().lastRolloverNotifiedDate !== d) {
              const title = '🎉 Daily Savings Rollover!';
              const body = `Superb! You saved ₹${Math.round(saved)} yesterday. It has been deposited into your Savings Gullak!`;

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
        const metrics = calculateSavingsMetrics(records, todayStr);

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

            const isInsertOnly = rec.status === 'unknown';
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

          if (pendingSettings.daily_budget !== undefined) {
            resolvedBudget = pendingSettings.daily_budget;
          } else if (profileData && profileData.daily_budget !== null && profileData.daily_budget !== undefined) {
            const remoteBudget = Math.max(0, Math.round(Number(profileData.daily_budget)));
            // Guard: Remote is the migration default 500 AND local has a different value (including 0 = fresh install).
            // In both cases the self-healing recovery block below will infer the real budget from savings logs,
            // so we defer — leave resolvedBudget as whatever local already has and let recovery overwrite if needed.
            if (remoteBudget === 500) {
              // Keep local value for now; self-healing block below will fix it from savings log history
              resolvedBudget = get().dailyBudgetAmount; // may be 0 on fresh install — overwritten by recovery
            } else {
              resolvedBudget = remoteBudget;
            }
          } else {
            // New user without daily_budget: default to 0 (disabled)
            resolvedBudget = 0;
          }

          if (pendingSettings.is_auto_renew !== undefined) {
            resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew);
          } else if (profileData && profileData.is_auto_renew !== null && profileData.is_auto_renew !== undefined) {
            resolvedAutoRenew = Boolean(profileData.is_auto_renew);
          } else {
            // New user without is_auto_renew: default to false (disabled)
            resolvedAutoRenew = false;
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
          const incomeIds = getIncomeCategoryIds();
          const spentByDate: Record<string, number> = {};
          for (let i = 0; i < currentExpenses.length; i++) {
            const e = currentExpenses[i];
            const isIncome = e.type === 'income' || (e.type !== 'expense' && e.category_id ? incomeIds.has(e.category_id) : false);
            const cleanDate = e.expense_date?.split('T')[0]?.trim();
            if (!isIncome && cleanDate) {
              spentByDate[cleanDate] = (spentByDate[cleanDate] || 0) + (Number(e.amount) || 0);
            }
          }

          let wasRepairedFromHistory = false;
          // Trigger recovery if budget looks wrong: either 500 (migration default) or 0 on fresh install
          // when the user actually has historical savings logs (meaning they did set a real budget before)
          const budgetLooksWrong = resolvedBudget === 500 || (resolvedBudget === 0 && (logsData?.length ?? 0) > 0);
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
                const b = Math.round(Number(logEntry.budget_amount));
                if (b > 0 && b !== 500) {
                  budgetCandidates[b] = (budgetCandidates[b] || 0) + 2;
                }
              }

              // Check if local record for that day has a non-500 budget
              if (records[d]?.budget && records[d].budget > 0 && records[d].budget !== 500) {
                const b = Math.round(records[d].budget);
                budgetCandidates[b] = (budgetCandidates[b] || 0) + 2;
              }

              // On confirmed saved days, amount_saved + spent reveals the original day budget
              if (logEntry.status === 'saved' && amountSaved > 0) {
                const inferred = Math.round(amountSaved + spent);
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
              let daySaved: number;
              let evaluatedStatus: 'saved' | 'exceeded' | 'even' | 'unknown';

              if (dayBudget <= 0) {
                daySaved = 0;
                evaluatedStatus = daySpent > 0 ? 'unknown' : 'even';
              } else {
                daySaved = Math.max(0, dayBudget - daySpent);
                evaluatedStatus = daySpent > dayBudget ? 'exceeded' : daySaved > 0 ? 'saved' : 'even';
              }

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

          // 3. Recalculate metrics from combined records
          const metrics = calculateSavingsMetrics(records, todayStr, userCreatedAtStr);

          set({
            dailyBudgetAmount: resolvedBudget,
            isAutoRenew: resolvedAutoRenew,
            dailyRecords: records,
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
          totalAccumulatedSavings: 0,
          savingsStreak: 0,
          bestStreak: 0,
          lastWarningNotifiedDate: null,
          lastExceededNotifiedDate: null,
          lastRolloverNotifiedDate: null,
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
