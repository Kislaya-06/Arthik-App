import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays } from 'date-fns';
import { Expense } from './expenseStore';
import { useNotificationStore } from './notificationStore';
import { useCategoryStore } from './categoryStore';
import { triggerDeviceNotification } from '../lib/notificationService';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';

const getIncomeCategoryIds = (): Set<string> => {
  const cats = useCategoryStore.getState().categories;
  const incomeIds = new Set<string>();
  for (let i = 0; i < cats.length; i++) {
    const name = cats[i].name.toLowerCase();
    if (name.includes('salary') || name.includes('income') || name.includes('freelance') || name.includes('business')) {
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
  status: 'saved' | 'exceeded' | 'even' | 'active';
}

export const calculateSavingsMetrics = (records: Record<string, DailyRecord>, todayStr: string) => {
  let totalSaved = 0;
  let totalOverspent = 0;

  Object.values(records).forEach((r) => {
    // Check confirmed finalized past days
    if (r.isFinalized && r.date < todayStr) {
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
    (r) => r.isFinalized && r.date < todayStr && (r.saved || 0) > 0
  ).length;

  let streak = 0;
  let dayCheck = subDays(new Date(), 1);
  while (true) {
    const dStr = format(dayCheck, 'yyyy-MM-dd');
    const rec = records[dStr];
    if (rec && rec.isFinalized && rec.status === 'saved' && (rec.saved || 0) > 0) {
      streak++;
      dayCheck = subDays(dayCheck, 1);
    } else {
      break;
    }
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
        currentRun = 1;
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

interface DailyBudgetState {
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
  checkAndRollover: (expenses: Expense[]) => void;
  hydrateFromSupabase: (userId: string) => Promise<void>;
  resetDailyBudget: () => void;
  getTodayRecord: () => DailyRecord;
  getPastRecordsList: () => DailyRecord[];
}

const getTodayDateStr = () => format(new Date(), 'yyyy-MM-dd');

export const useDailyBudgetStore = create<DailyBudgetState>()(
  persist(
    (set, get) => ({
      dailyBudgetAmount: 500,
      isAutoRenew: true,
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

        if (get().isAutoRenew) {
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

        // Repair any past records that were accidentally corrupted to 500
        const pastKeys = Object.keys(records);
        for (let i = 0; i < pastKeys.length; i++) {
          const d = pastKeys[i];
          if (d < todayStr) {
            const r = records[d];
            if (r.budget === 500 && cleanAmount !== 500) {
              const newSaved = Math.max(0, cleanAmount - r.spent);
              const newStatus: 'saved' | 'exceeded' | 'even' =
                r.spent > cleanAmount ? 'exceeded' : newSaved > 0 ? 'saved' : 'even';
              records[d] = {
                ...r,
                budget: cleanAmount,
                saved: newSaved,
                status: newStatus,
              };

              // Sync repaired past day to Supabase (async fire-and-forget)
              try {
                const currentUser = useAuthStore.getState().user;
                if (currentUser) {
                  supabase
                    .from('daily_savings_log')
                    .upsert(
                      {
                        user_id: currentUser.id,
                        date: d,
                        amount_saved: newSaved,
                        status: newSaved > 0 ? 'saved' : 'missed',
                      },
                      { onConflict: 'user_id,date' }
                    )
                    .then(() => {});
                }
              } catch {}
            }
          }
        }

        const metrics = calculateSavingsMetrics(records, todayStr);

        set({
          dailyBudgetAmount: cleanAmount,
          dailyRecords: records,
          ...metrics,
        });

        // Sync to Supabase profiles (fire-and-forget)
        try {
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            supabase
              .from('profiles')
              .update({ daily_budget: cleanAmount })
              .eq('id', currentUser.id)
              .then(({ error }) => {
                if (error) {
                  console.error('Error syncing daily_budget to Supabase:', error);
                }
              });
          }
        } catch (e) {
          // Ignore offline / auth errors
        }
      },

      toggleAutoRenew: (enabled: boolean) => {
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const currentToday = records[todayStr];

        if (enabled && (!currentToday || currentToday.budget === 0)) {
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

        set({
          isAutoRenew: enabled,
          dailyRecords: records,
        });

        // Sync to Supabase profiles (fire-and-forget)
        try {
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            supabase
              .from('profiles')
              .update({ is_auto_renew: enabled })
              .eq('id', currentUser.id)
              .then(({ error }) => {
                if (error) {
                  console.error('Error syncing is_auto_renew to Supabase:', error);
                }
              });
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
          const isIncome = e.type === 'income' || (e.category_id ? incomeIds.has(e.category_id) : false);
          const cleanDate = e.expense_date?.split('T')[0]?.trim();
          if (cleanDate === todayStr && !isIncome) {
            todaySpent += Number(e.amount) || 0;
          }
        }

        let todayRecord = records[todayStr];
        let hasTodayChanged = false;

        if (!todayRecord) {
          const budget = get().isAutoRenew ? get().dailyBudgetAmount : 0;
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

      checkAndRollover: (expenses: Expense[]) => {
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const incomeIds = getIncomeCategoryIds();
        let updated = false;

        // 1. Group all non-income expenses by date in a single O(N) pass
        const spentByDate: Record<string, number> = {};
        for (let i = 0; i < expenses.length; i++) {
          const e = expenses[i];
          const isIncome = e.type === 'income' || (e.category_id ? incomeIds.has(e.category_id) : false);
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

        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        // 3. For every past date, verify if spent or saved or status changed (e.g. after edit/delete)
        for (const d of pastDates) {
          const existing = records[d];
          const spent = spentByDate[d] || 0;
          const userDailyAllowance = get().dailyBudgetAmount;
          let budget = userDailyAllowance;
          if (existing && existing.budget > 0) {
            // If it was corrupted to 500 by the previous bug, repair it to the user's actual daily allowance
            if (existing.budget === 500 && userDailyAllowance !== 500) {
              budget = userDailyAllowance;
            } else {
              budget = existing.budget;
            }
          } else {
            budget = get().isAutoRenew ? userDailyAllowance : 0;
          }

          // Skip past dates that had no prior record, 0 budget, and 0 spent
          if (!existing && budget === 0 && spent === 0) {
            continue;
          }

          const saved = Math.max(0, budget - spent);
          const status: 'saved' | 'exceeded' | 'even' =
            spent > budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';

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
            };
            updated = true;

            // Sync updated past day to Supabase daily_savings_log (async fire-and-forget)
            try {
              const currentUser = useAuthStore.getState().user;
              if (currentUser) {
                supabase
                  .from('daily_savings_log')
                  .upsert(
                    {
                      user_id: currentUser.id,
                      date: d,
                      amount_saved: saved,
                      status: saved > 0 ? 'saved' : 'missed',
                    },
                    { onConflict: 'user_id,date' }
                  )
                  .then(({ error }) => {
                    if (error) {
                      console.error('Error syncing updated daily_savings_log to Supabase:', error);
                    }
                  });
              }
            } catch {
              // Ignore offline/auth errors
            }

            // Trigger notification for yesterday's savings rollover on initial rollover only
            if (d === yesterdayStr && saved > 0 && wasUnfinalized && get().lastRolloverNotifiedDate !== d) {
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

      hydrateFromSupabase: async (userId: string) => {
        if (!userId) return;
        try {
          const todayStr = getTodayDateStr();

          // 1. Fetch user's profile settings (daily_budget, is_auto_renew)
          const { data: profileData } = await supabase
            .from('profiles')
            .select('daily_budget, is_auto_renew')
            .eq('id', userId)
            .maybeSingle();

          let resolvedBudget = get().dailyBudgetAmount;
          let resolvedAutoRenew = get().isAutoRenew;

          if (profileData) {
            if (profileData.daily_budget !== null && profileData.daily_budget !== undefined) {
              const remoteBudget = Math.max(0, Math.round(Number(profileData.daily_budget)));
              // If remote is the migration default 500 but local has a custom budget, preserve local and sync to remote!
              if (remoteBudget === 500 && get().dailyBudgetAmount !== 500) {
                resolvedBudget = get().dailyBudgetAmount;
                supabase.from('profiles').update({ daily_budget: resolvedBudget }).eq('id', userId).then(() => {});
              } else {
                resolvedBudget = remoteBudget;
              }
            }
            if (profileData.is_auto_renew !== null && profileData.is_auto_renew !== undefined) {
              resolvedAutoRenew = Boolean(profileData.is_auto_renew);
            }
          }

          // 2. Fetch past daily savings logs from Supabase
          const { data: logsData } = await supabase
            .from('daily_savings_log')
            .select('date, amount_saved, status')
            .eq('user_id', userId)
            .order('date', { ascending: true });

          const records = { ...get().dailyRecords };

          if (logsData && logsData.length > 0) {
            for (const log of logsData) {
              const d = log.date;
              const amountSaved = Number(log.amount_saved) || 0;
              const logStatus: 'saved' | 'exceeded' | 'even' =
                log.status === 'saved' ? 'saved' : log.status === 'even' ? 'even' : 'exceeded';

              if (!records[d]) {
                records[d] = {
                  date: d,
                  budget: resolvedBudget,
                  spent: Math.max(0, resolvedBudget - amountSaved),
                  saved: amountSaved,
                  isFinalized: true,
                  status: logStatus,
                };
              } else {
                let currentBudget = records[d].budget;
                // If corrupted to 500 by previous bug and user daily allowance is different, repair it
                if (currentBudget === 500 && resolvedBudget !== 500) {
                  currentBudget = resolvedBudget;
                }
                records[d] = {
                  ...records[d],
                  budget: currentBudget || resolvedBudget,
                  saved: amountSaved > 0 ? amountSaved : records[d].saved,
                  isFinalized: true,
                  status: logStatus,
                };
              }
            }
          }

          // Ensure today's record exists if not present
          if (!records[todayStr]) {
            const todayBudget = resolvedAutoRenew ? resolvedBudget : 0;
            records[todayStr] = {
              date: todayStr,
              budget: todayBudget,
              spent: 0,
              saved: todayBudget,
              isFinalized: false,
              status: 'active',
            };
          } else if (!records[todayStr].isFinalized && records[todayStr].budget === 0 && resolvedAutoRenew) {
            records[todayStr].budget = resolvedBudget;
            records[todayStr].saved = Math.max(0, resolvedBudget - records[todayStr].spent);
          }

          // 3. Recalculate metrics from combined records
          const metrics = calculateSavingsMetrics(records, todayStr);

          set({
            dailyBudgetAmount: resolvedBudget,
            isAutoRenew: resolvedAutoRenew,
            dailyRecords: records,
            ...metrics,
          });
        } catch (e) {
          console.error('Error hydrating daily budget from Supabase:', e);
        }
      },

      resetDailyBudget: () => {
        set({
          dailyBudgetAmount: 500,
          isAutoRenew: true,
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
