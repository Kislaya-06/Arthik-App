import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays } from 'date-fns';
import { Expense } from './expenseStore';
import { useNotificationStore } from './notificationStore';
import { useCategoryStore } from './categoryStore';
import { triggerDeviceNotification } from '../lib/notificationService';

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

        set({
          dailyBudgetAmount: cleanAmount,
          dailyRecords: records,
        });
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

        set({ dailyRecords: records });
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

        set({ dailyRecords: records });
      },

      syncWithExpenses: (expenses: Expense[]) => {
        const todayStr = getTodayDateStr();
        const records = { ...get().dailyRecords };
        const incomeIds = getIncomeCategoryIds();

        // Optimized spent calculation using Set lookup O(1)
        let todaySpent = 0;
        for (let i = 0; i < expenses.length; i++) {
          const e = expenses[i];
          if (e.expense_date === todayStr && !incomeIds.has(e.category_id)) {
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

        // Only finalize actual unfinalized past days that existed in records

        // Finalize any existing unfinalized past days
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        const keys = Object.keys(records);
        for (let k = 0; k < keys.length; k++) {
          const d = keys[k];
          if (d < todayStr && !records[d].isFinalized) {
            const r = records[d];
            let spent = 0;
            for (let j = 0; j < expenses.length; j++) {
              const e = expenses[j];
              if (e.expense_date === d && !incomeIds.has(e.category_id)) {
                spent += Number(e.amount) || 0;
              }
            }

            const saved = Math.max(0, r.budget - spent);
            const status = spent > r.budget ? 'exceeded' : saved > 0 ? 'saved' : 'even';

            records[d] = {
              ...r,
              spent,
              saved,
              isFinalized: true,
              status,
            };
            updated = true;

            // Trigger notification for yesterday's savings
            if (d === yesterdayStr && saved > 0 && get().lastRolloverNotifiedDate !== d) {
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

        // Compute total accumulated savings from finalized days
        const totalSaved = Object.values(records)
          .filter((r) => r.isFinalized)
          .reduce((sum, r) => sum + (r.saved || 0), 0);

        // Compute savings streak (consecutive days where status is 'saved' or 'even')
        let streak = 0;
        let dayCheck = subDays(new Date(), 1);
        while (true) {
          const dStr = format(dayCheck, 'yyyy-MM-dd');
          const rec = records[dStr];
          if (rec && (rec.status === 'saved' || rec.status === 'even')) {
            streak++;
            dayCheck = subDays(dayCheck, 1);
          } else {
            break;
          }
        }

        // Check if today is also under budget, and add +1 to streak display if spent <= budget
        const todayRec = records[todayStr];
        if (todayRec && todayRec.budget > 0 && todayRec.spent <= todayRec.budget) {
          streak += 1;
        }

        const bestStreak = Math.max(get().bestStreak, streak);

        if (
          updated ||
          get().totalAccumulatedSavings !== totalSaved ||
          get().savingsStreak !== streak ||
          get().bestStreak !== bestStreak
        ) {
          set({
            dailyRecords: records,
            totalAccumulatedSavings: totalSaved,
            savingsStreak: streak,
            bestStreak,
          });
        }
      },
    }),
    {
      name: 'arthik-daily-budget-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
