import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { format, subDays, parseISO } from 'date-fns';
import { Expense } from './expenseStore';
import { useNotificationStore } from './notificationStore';

const getUserCreatedAtLocalDate = (createdAt?: string | null): string | undefined => {
  if (!createdAt) return undefined;
  try {
    return format(parseISO(createdAt), 'yyyy-MM-dd');
  } catch {
    return createdAt.split('T')[0]?.trim();
  }
};

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
import { useCategoryStore } from './categoryStore';
import { notifyLimit, notifyRollover, notifyBudgetUpdated } from '../lib/budgetAlerts';
import { supabase } from '../config/supabase';
import { useAuthStore, registerStoreResetCallback } from './authStore';
import { useNetworkStore } from './networkStore';
import { isNetworkFailure, withTimeout } from '../lib/networkUtils';
import { makeIncomeClassifier, makeEligibleIncomeClassifier } from '../lib/incomeClassifier';
import { resolveHydratedDayBudget, resolveRolloverBudget } from '../lib/budgetUtils';
import { round2 } from '../lib/formatters';

const buildCategoryClassifier = (): ((e: Expense) => boolean) => {
  return makeIncomeClassifier(useCategoryStore.getState().categories);
};

const buildEligibleIncomeClassifier = (): ((e: Expense) => boolean) => {
  return makeEligibleIncomeClassifier(useCategoryStore.getState().categories);
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
  computeIncomeByDate,
  computeIncomeForDate,
  calculateCycleFinancials,
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
  computeIncomeByDate,
  computeIncomeForDate,
  calculateCycleFinancials,
  buildDefaultTodayRecord,
  filterPastRecords,
  shouldIgnoreDuplicates,
  shouldSendRolloverNotification,
};

const getUserCreatedAtStr = (): string | undefined =>
  useAuthStore.getState().user?.created_at?.split('T')[0]?.trim();


import {
  BudgetCadence,
  BudgetPlanChange,
  BudgetPeriodRecord,
  BudgetPeriodStatus,
} from '../types';
export type {
  BudgetCadence,
  BudgetPlanChange,
  BudgetPeriodRecord,
  BudgetPeriodStatus,
};
import {
  computeEffectiveFrom,
  upsertPendingChange,
  getDateOwner,
  buildPeriodsToFinalize,
  getCurrentPeriodSummary,
  isDailyGovernedDate,
  computeCadenceStreak,
  StreakUnit,
} from '../lib/budgetPeriods';
import { formatEffectiveFrom } from '../lib/budgetModeUtils';

export const getPendingSettingsKey = (userId: string) => `@arthik_pending_settings_${userId}`;
export const getPendingGullakAddsKey = (userId: string) => `@arthik_pending_gullak_adds_${userId}`;
export const getPendingGullakDeletesKey = (userId: string) => `@arthik_pending_gullak_deletes_${userId}`;
export const getPendingPlanChangesKey = (userId: string) => `@arthik_pending_plan_changes_${userId}`;
export const getPendingBudgetPeriodsKey = (userId: string) => `@arthik_pending_budget_periods_${userId}`;
export const getLastRenewedPeriodKey = (userId: string) => `@arthik_last_renewed_period_${userId}`;

export interface ProfileSettingsPatch {
  daily_budget?: number;
  is_auto_renew?: boolean;
  is_budget_mode_enabled?: boolean;
  budget_cadence?: string;
  weekly_budget?: number;
  monthly_budget?: number;
}

export const savePendingSettingsOffline = async (
  userId: string,
  patch: ProfileSettingsPatch
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
  keysToClear?: (keyof ProfileSettingsPatch)[]
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

export const savePendingPlanChangeOffline = async (
  userId: string,
  change: BudgetPlanChange
): Promise<void> => {
  const key = getPendingPlanChangesKey(userId);
  const list = await getStoredList<BudgetPlanChange>(key);
  const filtered = list.filter((c) => c.effectiveFrom !== change.effectiveFrom);
  await setStoredList(key, [...filtered, change]);
};

export const savePendingBudgetPeriodOffline = async (
  userId: string,
  period: BudgetPeriodRecord
): Promise<void> => {
  const key = getPendingBudgetPeriodsKey(userId);
  const list = await getStoredList<BudgetPeriodRecord>(key);
  const filtered = list.filter((p) => p.id !== period.id);
  await setStoredList(key, [...filtered, period]);
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

const getStoredList = async <T>(key: string): Promise<T[]> => {
  try {
    const s = await AsyncStorage.getItem(key);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
};
const setStoredList = async <T>(key: string, list: T[]) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(list)); } catch {}
};

const savePendingGullakAdd = async (userId: string, deposit: GullakDeposit): Promise<void> => {
  const key = getPendingGullakAddsKey(userId);
  const list = await getStoredList<GullakDeposit>(key);
  if (!list.some((d) => d.id === deposit.id)) await setStoredList(key, [...list, deposit]);
};

// Returns true if the deposit was in the pending-add queue (never reached Supabase).
const tryRemovePendingGullakAdd = async (userId: string, depositId: string): Promise<boolean> => {
  const key = getPendingGullakAddsKey(userId);
  const list = await getStoredList<GullakDeposit>(key);
  const filtered = list.filter((d) => d.id !== depositId);
  if (filtered.length === list.length) return false;
  await setStoredList(key, filtered);
  return true;
};

const savePendingGullakDelete = async (userId: string, depositId: string): Promise<void> => {
  const key = getPendingGullakDeletesKey(userId);
  const list = await getStoredList<string>(key);
  if (!list.includes(depositId)) await setStoredList(key, [...list, depositId]);
};

const computeMetrics = (
  records: Record<string, DailyRecord>,
  deposits?: GullakDeposit[],
  userCreatedAt?: string,
  budgetPeriods?: Record<string, BudgetPeriodRecord>,
  currentCadence: BudgetCadence = 'daily',
  existingBestStreakByCadence?: Record<BudgetCadence, number>,
  availableIncome?: number
) => {
  const manual =
    deposits && Array.isArray(deposits)
      ? deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0)
      : 0;

  let incomeAvail = availableIncome;
  if (incomeAvail === undefined) {
    const isIncomeFn = buildCategoryClassifier();
    const totalIncome = getCurrentExpenses().reduce((sum, e) => sum + (isIncomeFn(e) ? (Number(e.amount) || 0) : 0), 0);
    const incomeDeposits = (deposits && Array.isArray(deposits))
      ? deposits.reduce((sum, d) => sum + (d.source === 'income' ? (Number(d.amount) || 0) : 0), 0)
      : 0;
    incomeAvail = round2(Math.max(0, totalIncome - incomeDeposits));
  }

  const dailyMetrics = calculateSavingsMetrics(
    records,
    getTodayDateStr(),
    userCreatedAt ?? getUserCreatedAtStr(),
    new Date(),
    manual,
    incomeAvail
  );

  let periodsSaved = 0;
  const periodsList = budgetPeriods ? Object.values(budgetPeriods) : [];
  for (const p of periodsList) {
    periodsSaved += Number(p.amountSaved) || 0;
  }
  periodsSaved = round2(periodsSaved);

  const totalAccumulatedSavings = round2(dailyMetrics.totalAccumulatedSavings + periodsSaved);

  const todayStr = getTodayDateStr();
  const uCreatedAt = userCreatedAt ?? getUserCreatedAtStr();

  const units: StreakUnit[] = [];

  const dailyList = Object.values(records)
    .filter((r) => r.isFinalized && r.date < todayStr && (!uCreatedAt || r.date >= uCreatedAt))
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const r of dailyList) {
    const status: BudgetPeriodStatus =
      r.status === 'saved'
        ? 'saved'
        : r.status === 'exceeded'
        ? 'missed'
        : r.status === 'even'
        ? 'even'
        : 'unknown';
    units.push({
      cadence: 'daily',
      status,
      key: `daily_${r.date}`,
      date: r.date,
      amountSaved: r.saved,
    });
  }

  for (const p of periodsList) {
    units.push({
      cadence: p.cadence,
      status: p.status,
      key: p.id,
      date: p.activeStart,
      amountSaved: p.amountSaved,
    });
  }

  units.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const { currentStreak, bestByCadence } = computeCadenceStreak(units, currentCadence);

  const mergedBestByCadence: Record<BudgetCadence, number> = {
    daily: Math.max(bestByCadence.daily, existingBestStreakByCadence?.daily || 0, dailyMetrics.bestStreak),
    weekly: Math.max(bestByCadence.weekly, existingBestStreakByCadence?.weekly || 0),
    monthly: Math.max(bestByCadence.monthly, existingBestStreakByCadence?.monthly || 0),
  };

  const savingsStreak =
    currentCadence === 'daily' && periodsList.length === 0
      ? dailyMetrics.savingsStreak
      : currentStreak;

  const bestStreak =
    currentCadence === 'daily' && periodsList.length === 0
      ? dailyMetrics.bestStreak
      : mergedBestByCadence[currentCadence];

  return {
    totalAccumulatedSavings,
    savingsStreak,
    bestStreak,
    bestStreakByCadence: mergedBestByCadence,
  };
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

  // --- Budget Modes & Multi-Cadence (Oct 2026) ---
  isBudgetModeEnabled: boolean;
  budgetCadence: BudgetCadence;
  weeklyBudgetAmount: number;
  monthlyBudgetAmount: number;
  planChanges: BudgetPlanChange[];
  budgetPeriods: Record<string, BudgetPeriodRecord>; // keyed by `${cadence}_${activeStart}`
  bestStreakByCadence: Record<BudgetCadence, number>;
  lastPeriodWarningKey: string | null;
  lastPeriodExceededKey: string | null;
  lastPeriodRolloverKey: string | null;
  lastRenewedPeriodKey: string | null;

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
  syncPendingGullakDeposits: () => Promise<void>;
  hydrateFromSupabase: (userId: string) => Promise<void>;
  resetDailyBudget: () => void;
  getTodayRecord: () => DailyRecord;
  getPastRecordsList: () => DailyRecord[];

  // --- Multi-Cadence Actions & Selectors ---
  setBudgetModeEnabled: (enabled: boolean) => void;
  setBudgetCadence: (
    cadence: BudgetCadence,
    options?: {
      amount?: number;
      carryMode?: 'additive' | 'allocation';
      carriedOverAmount?: number;
    }
  ) => void;
  setWeeklyBudget: (amount: number) => void;
  setMonthlyBudget: (amount: number) => void;
  getPendingPlanChange: () => BudgetPlanChange | null;
  getEffectiveFromLabel: (change?: BudgetPlanChange | null) => string;
  cancelPendingPlanChange: () => void;
  uploadPendingBudgetPeriods: () => Promise<void>;
  syncPendingPlanChanges: () => Promise<void>;
  setLastRenewedPeriodKey: (key: string) => Promise<void>;
}

const getTodayDateStr = () => format(new Date(), 'yyyy-MM-dd');

export const useDailyBudgetStore = create<DailyBudgetState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      hydratedForUserId: null,
      dailyBudgetAmount: 100,
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

      // --- Budget Modes & Multi-Cadence (Oct 2026) ---
      isBudgetModeEnabled: false,
      budgetCadence: 'daily',
      weeklyBudgetAmount: 0,
      monthlyBudgetAmount: 0,
      planChanges: [],
      budgetPeriods: {},
      bestStreakByCadence: { daily: 0, weekly: 0, monthly: 0 },
      lastPeriodWarningKey: null,
      lastPeriodExceededKey: null,
      lastPeriodRolloverKey: null,
      lastRenewedPeriodKey: null,

      getTodayRecord: () => {
        const todayStr = getTodayDateStr();
        const records = get().dailyRecords;
        if (records[todayStr]) {
          if ((!get().isAutoRenew || !get().isBudgetModeEnabled) && !records[todayStr].isFinalized) {
            return {
              ...records[todayStr],
              budget: 0,
              saved: 0,
              status: 'unknown',
            };
          }
          return records[todayStr];
        }

        const def = buildDefaultTodayRecord(todayStr, get().isAutoRenew && get().isBudgetModeEnabled, get().dailyBudgetAmount);
        if (!get().isAutoRenew || !get().isBudgetModeEnabled) {
          return {
            ...def,
            status: 'unknown',
          };
        }
        return def;
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
        const currentAutoRenew = get().isAutoRenew;
        const willAutoRenew = cleanAmount > 0 ? currentAutoRenew : false;

        if (willAutoRenew) {
          const existing = records[todayStr];
          const spent = existing?.spent || 0;
          const isEligibleIncomeFn = buildEligibleIncomeClassifier();
          const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr, isEligibleIncomeFn);
          const { saved } = evaluateDayStatus(cleanAmount, spent, todayIncome);
          const spendable = cleanAmount + todayIncome;
          records[todayStr] = {
            date: todayStr,
            budget: cleanAmount,
            spent,
            saved,
            isFinalized: false,
            status: spent > spendable && spendable > 0 ? 'exceeded' : 'active',
          };
        }

        let updatedChanges = get().planChanges;
        let newPlanChange: BudgetPlanChange | null = null;
        const currentUser = useAuthStore.getState().user;
        if (get().isBudgetModeEnabled && get().budgetCadence === 'daily') {
          newPlanChange = {
            id: Crypto.randomUUID(),
            userId: currentUser?.id || '',
            effectiveFrom: todayStr,
            isEnabled: true,
            cadence: 'daily',
            amount: cleanAmount,
            createdAt: new Date().toISOString(),
          };
          updatedChanges = upsertPendingChange(updatedChanges, newPlanChange);
        }

        const metrics = computeMetrics(
          records,
          get().gullakDeposits,
          undefined,
          get().budgetPeriods,
          get().budgetCadence,
          get().bestStreakByCadence
        );

        set({
          dailyBudgetAmount: cleanAmount,
          isAutoRenew: willAutoRenew,
          dailyRecords: records,
          planChanges: updatedChanges,
          ...metrics,
        });

        // Sync to Supabase profiles with offline queue (P0.13)
        try {
          if (currentUser) {
            savePendingSettingsOffline(currentUser.id, { daily_budget: cleanAmount, is_auto_renew: willAutoRenew });
            if (newPlanChange) {
              savePendingPlanChangeOffline(currentUser.id, newPlanChange);
            }
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

            if (newPlanChange) {
              supabase
                .from('budget_plan_changes')
                .upsert(
                  {
                    id: newPlanChange.id,
                    user_id: currentUser.id,
                    effective_from: newPlanChange.effectiveFrom,
                    is_enabled: newPlanChange.isEnabled,
                    cadence: newPlanChange.cadence,
                    amount: newPlanChange.amount,
                    created_at: newPlanChange.createdAt,
                  },
                  { onConflict: 'user_id,effective_from' }
                )
                .then(({ error }) => {
                  if (!error) {
                    get().syncPendingPlanChanges();
                  }
                });
            }
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
          const isEligibleIncomeFn = buildEligibleIncomeClassifier();
          const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr, isEligibleIncomeFn);
          const { saved } = evaluateDayStatus(budget, spent, todayIncome);
          const spendable = budget + todayIncome;
          records[todayStr] = {
            date: todayStr,
            budget,
            spent,
            saved,
            isFinalized: false,
            status: spent > spendable && spendable > 0 ? 'exceeded' : 'active',
          };
        } else if (!enabled && currentToday && !currentToday.isFinalized) {
          records[todayStr] = {
            ...currentToday,
            budget: 0,
            saved: 0,
            status: 'unknown',
          };
        }

        const metrics = computeMetrics(
          records,
          get().gullakDeposits,
          undefined,
          get().budgetPeriods,
          get().budgetCadence,
          get().bestStreakByCadence
        );

        set({
          isAutoRenew: enabled,
          isBudgetModeEnabled: enabled ? true : get().isBudgetModeEnabled,
          dailyRecords: records,
          ...metrics,
        });

        // Sync to Supabase profiles with offline queue (P0.13)
        try {
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            savePendingSettingsOffline(currentUser.id, {
              is_auto_renew: enabled,
              ...(enabled ? { is_budget_mode_enabled: true } : {}),
            });
            supabase
              .from('profiles')
              .update({
                is_auto_renew: enabled,
                ...(enabled ? { is_budget_mode_enabled: true } : {}),
              })
              .eq('id', currentUser.id)
              .then(
                ({ error }) => {
                  if (!error) {
                    clearPendingSettingsOffline(currentUser.id, ['is_auto_renew', ...(enabled ? ['is_budget_mode_enabled' as const] : [])]);
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

      setBudgetModeEnabled: (enabled: boolean) => {
        const todayStr = getTodayDateStr();
        const currentUser = useAuthStore.getState().user;
        const effectiveFrom = computeEffectiveFrom(enabled ? 'enable' : 'disable', todayStr);

        const cadence = get().budgetCadence;
        const amount =
          cadence === 'weekly'
            ? get().weeklyBudgetAmount
            : cadence === 'monthly'
            ? get().monthlyBudgetAmount
            : get().dailyBudgetAmount;

        const newChange: BudgetPlanChange = {
          id: Crypto.randomUUID(),
          userId: currentUser?.id || '',
          effectiveFrom,
          isEnabled: enabled,
          cadence,
          amount,
          createdAt: new Date().toISOString(),
        };

        const updatedChanges = upsertPendingChange(get().planChanges, newChange);
        const records = { ...get().dailyRecords };

        if (!enabled && records[todayStr] && !records[todayStr].isFinalized) {
          records[todayStr] = {
            ...records[todayStr],
            budget: 0,
            saved: 0,
            status: 'unknown',
          };
        } else if (enabled && get().dailyBudgetAmount > 0 && (!records[todayStr] || records[todayStr].budget === 0)) {
          const budget = get().dailyBudgetAmount;
          const spent = records[todayStr]?.spent || 0;
          const isEligibleIncomeFn = buildEligibleIncomeClassifier();
          const todayIncome = computeIncomeForDate(getCurrentExpenses(), todayStr, isEligibleIncomeFn);
          const { saved } = evaluateDayStatus(budget, spent, todayIncome);
          const spendable = budget + todayIncome;
          records[todayStr] = {
            date: todayStr,
            budget,
            spent,
            saved,
            isFinalized: false,
            status: spent > spendable && spendable > 0 ? 'exceeded' : 'active',
          };
        }

        const metrics = computeMetrics(
          records,
          get().gullakDeposits,
          undefined,
          get().budgetPeriods,
          cadence,
          get().bestStreakByCadence
        );

        set({
          isBudgetModeEnabled: enabled,
          isAutoRenew: enabled,
          planChanges: updatedChanges,
          dailyRecords: records,
          ...metrics,
        });

        if (currentUser) {
          savePendingSettingsOffline(currentUser.id, {
            is_budget_mode_enabled: enabled,
            is_auto_renew: enabled,
          });
          savePendingPlanChangeOffline(currentUser.id, newChange);

          supabase
            .from('profiles')
            .update({
              is_budget_mode_enabled: enabled,
              is_auto_renew: enabled,
            })
            .eq('id', currentUser.id)
            .then(({ error }) => {
              if (!error) {
                clearPendingSettingsOffline(currentUser.id, ['is_budget_mode_enabled', 'is_auto_renew']);
              }
            });

          supabase
            .from('budget_plan_changes')
            .upsert(
              {
                id: newChange.id,
                user_id: currentUser.id,
                effective_from: newChange.effectiveFrom,
                is_enabled: newChange.isEnabled,
                cadence: newChange.cadence,
                amount: newChange.amount,
                created_at: newChange.createdAt,
              },
              { onConflict: 'user_id,effective_from' }
            )
            .then(({ error }) => {
              if (!error) {
                get().syncPendingPlanChanges();
              }
            });
        }
      },

      setBudgetCadence: (
        cadence: BudgetCadence,
        options?: {
          amount?: number;
          carryMode?: 'additive' | 'allocation';
          carriedOverAmount?: number;
        }
      ) => {
        const todayStr = getTodayDateStr();
        const currentUser = useAuthStore.getState().user;
        const currentOwner = getDateOwner(get().planChanges, todayStr);
        const effectiveFrom = computeEffectiveFrom('cadence_switch', todayStr, { currentOwner });

        const amount =
          options?.amount !== undefined
            ? Math.max(0, round2(options.amount))
            : cadence === 'weekly'
            ? get().weeklyBudgetAmount
            : cadence === 'monthly'
            ? get().monthlyBudgetAmount
            : get().dailyBudgetAmount;

        const newChange: BudgetPlanChange = {
          id: Crypto.randomUUID(),
          userId: currentUser?.id || '',
          effectiveFrom,
          isEnabled: get().isBudgetModeEnabled,
          cadence,
          amount,
          carryMode: options?.carryMode,
          carriedOverAmount: options?.carriedOverAmount,
          createdAt: new Date().toISOString(),
        };

        const updatedChanges = upsertPendingChange(get().planChanges, newChange);
        const metrics = computeMetrics(
          get().dailyRecords,
          get().gullakDeposits,
          undefined,
          get().budgetPeriods,
          cadence,
          get().bestStreakByCadence
        );

        set({
          budgetCadence: cadence,
          ...(cadence === 'weekly' && options?.amount !== undefined ? { weeklyBudgetAmount: options.amount } : {}),
          ...(cadence === 'monthly' && options?.amount !== undefined ? { monthlyBudgetAmount: options.amount } : {}),
          ...(cadence === 'daily' && options?.amount !== undefined ? { dailyBudgetAmount: options.amount } : {}),
          planChanges: updatedChanges,
          ...metrics,
        });

        if (currentUser) {
          savePendingSettingsOffline(currentUser.id, { budget_cadence: cadence });
          savePendingPlanChangeOffline(currentUser.id, newChange);

          supabase
            .from('profiles')
            .update({ budget_cadence: cadence })
            .eq('id', currentUser.id)
            .then(({ error }) => {
              if (!error) {
                clearPendingSettingsOffline(currentUser.id, ['budget_cadence']);
              }
            });

          supabase
            .from('budget_plan_changes')
            .upsert(
              {
                id: newChange.id,
                user_id: currentUser.id,
                effective_from: newChange.effectiveFrom,
                is_enabled: newChange.isEnabled,
                cadence: newChange.cadence,
                amount: newChange.amount,
                carry_mode: newChange.carryMode || null,
                carried_over_amount: newChange.carriedOverAmount || 0,
                created_at: newChange.createdAt,
              },
              { onConflict: 'user_id,effective_from' }
            )
            .then(({ error }) => {
              if (!error) {
                get().syncPendingPlanChanges();
              }
            });
        }
      },

      setWeeklyBudget: (amount: number) => {
        const cleanAmount = Math.max(0, round2(amount));
        const todayStr = getTodayDateStr();
        const currentUser = useAuthStore.getState().user;
        const effectiveFrom = computeEffectiveFrom('weekly_amount', todayStr);

        let updatedChanges = get().planChanges;
        let newChange: BudgetPlanChange | null = null;

        if (get().budgetCadence === 'weekly' && get().isBudgetModeEnabled) {
          newChange = {
            id: Crypto.randomUUID(),
            userId: currentUser?.id || '',
            effectiveFrom,
            isEnabled: true,
            cadence: 'weekly',
            amount: cleanAmount,
            createdAt: new Date().toISOString(),
          };
          updatedChanges = upsertPendingChange(updatedChanges, newChange);
        }

        set({
          weeklyBudgetAmount: cleanAmount,
          planChanges: updatedChanges,
        });

        if (currentUser) {
          savePendingSettingsOffline(currentUser.id, { weekly_budget: cleanAmount });
          if (newChange) {
            savePendingPlanChangeOffline(currentUser.id, newChange);
          }

          supabase
            .from('profiles')
            .update({ weekly_budget: cleanAmount })
            .eq('id', currentUser.id)
            .then(({ error }) => {
              if (!error) {
                clearPendingSettingsOffline(currentUser.id, ['weekly_budget']);
              }
            });

          if (newChange) {
            supabase
              .from('budget_plan_changes')
              .upsert(
                {
                  id: newChange.id,
                  user_id: currentUser.id,
                  effective_from: newChange.effectiveFrom,
                  is_enabled: newChange.isEnabled,
                  cadence: newChange.cadence,
                  amount: newChange.amount,
                  created_at: newChange.createdAt,
                },
                { onConflict: 'user_id,effective_from' }
              )
              .then(({ error }) => {
                if (!error) {
                  get().syncPendingPlanChanges();
                }
              });
          }
        }
      },

      setMonthlyBudget: (amount: number) => {
        const cleanAmount = Math.max(0, round2(amount));
        const todayStr = getTodayDateStr();
        const currentUser = useAuthStore.getState().user;
        const effectiveFrom = computeEffectiveFrom('monthly_amount', todayStr);

        let updatedChanges = get().planChanges;
        let newChange: BudgetPlanChange | null = null;

        if (get().budgetCadence === 'monthly' && get().isBudgetModeEnabled) {
          newChange = {
            id: Crypto.randomUUID(),
            userId: currentUser?.id || '',
            effectiveFrom,
            isEnabled: true,
            cadence: 'monthly',
            amount: cleanAmount,
            createdAt: new Date().toISOString(),
          };
          updatedChanges = upsertPendingChange(updatedChanges, newChange);
        }

        set({
          monthlyBudgetAmount: cleanAmount,
          planChanges: updatedChanges,
        });

        if (currentUser) {
          savePendingSettingsOffline(currentUser.id, { monthly_budget: cleanAmount });
          if (newChange) {
            savePendingPlanChangeOffline(currentUser.id, newChange);
          }

          supabase
            .from('profiles')
            .update({ monthly_budget: cleanAmount })
            .eq('id', currentUser.id)
            .then(({ error }) => {
              if (!error) {
                clearPendingSettingsOffline(currentUser.id, ['monthly_budget']);
              }
            });

          if (newChange) {
            supabase
              .from('budget_plan_changes')
              .upsert(
                {
                  id: newChange.id,
                  user_id: currentUser.id,
                  effective_from: newChange.effectiveFrom,
                  is_enabled: newChange.isEnabled,
                  cadence: newChange.cadence,
                  amount: newChange.amount,
                  created_at: newChange.createdAt,
                },
                { onConflict: 'user_id,effective_from' }
              )
              .then(({ error }) => {
                if (!error) {
                  get().syncPendingPlanChanges();
                }
              });
          }
        }
      },

      getPendingPlanChange: () => {
        const todayStr = getTodayDateStr();
        const future = (get().planChanges || []).filter((c) => c.effectiveFrom > todayStr);
        if (future.length === 0) return null;
        future.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
        return future[0];
      },

      getEffectiveFromLabel: (change?: BudgetPlanChange | null) => {
        const target = change || get().getPendingPlanChange();
        if (!target) return '';
        const todayStr = getTodayDateStr();
        return formatEffectiveFrom(target.effectiveFrom, todayStr, target.cadence);
      },

      cancelPendingPlanChange: () => {
        const todayStr = getTodayDateStr();
        const pending = get().getPendingPlanChange();
        if (!pending) return;

        const remainingChanges = (get().planChanges || []).filter(
          (c) => c.effectiveFrom <= todayStr
        );
        set({
          planChanges: remainingChanges,
          scheduledNextDailyBudget: null,
          scheduledBudgetSetDate: null,
        });

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const key = getPendingPlanChangesKey(currentUser.id);
          getStoredList<BudgetPlanChange>(key).then((list) => {
            const updated = list.filter((c) => c.effectiveFrom <= todayStr);
            setStoredList(key, updated);
          });

          supabase
            .from('budget_plan_changes')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('effective_from', pending.effectiveFrom)
            .then(() => {});
        }
      },

      uploadPendingBudgetPeriods: async () => {
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
          await setStoredList(key, list.filter((p) => !syncedIds.includes(p.id)));
        }
      },

      syncPendingPlanChanges: async () => {
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
          await setStoredList(key, list.filter((c) => !syncedIds.includes(c.id)));
        }
      },

      setLastRenewedPeriodKey: async (key: string) => {
        set({ lastRenewedPeriodKey: key });
        const currentUser = useAuthStore.getState().user;
        const uid = currentUser?.id || get().ownerUserId;
        if (uid) {
          try {
            await AsyncStorage.setItem(getLastRenewedPeriodKey(uid), key);
          } catch {}
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
        const isEligibleIncomeFn = buildEligibleIncomeClassifier();

        const todaySpent = computeSpentForDate(expenses, todayStr, isIncomeFn);
        const todayEligibleIncome = computeIncomeForDate(expenses, todayStr, isEligibleIncomeFn);

        let todayRecord = records[todayStr];
        let hasTodayChanged = false;

        const isBudgetOn = get().isBudgetModeEnabled;

        if (!todayRecord) {
          const budget = isBudgetOn && get().isAutoRenew && get().dailyBudgetAmount > 0 ? get().dailyBudgetAmount : 0;
          const { saved } = evaluateDayStatus(budget, todaySpent, todayEligibleIncome);
          const effectiveSpendable = budget + todayEligibleIncome;
          todayRecord = {
            date: todayStr,
            budget,
            spent: todaySpent,
            saved: isBudgetOn ? saved : 0,
            isFinalized: false,
            status: isBudgetOn ? (todaySpent > effectiveSpendable && effectiveSpendable > 0 ? 'exceeded' : 'active') : 'unknown',
          };
          hasTodayChanged = true;
        } else if (!isBudgetOn) {
          if (todayRecord.budget !== 0 || todayRecord.spent !== todaySpent || todayRecord.saved !== 0 || todayRecord.status !== 'unknown') {
            todayRecord = {
              ...todayRecord,
              budget: 0,
              spent: todaySpent,
              saved: 0,
              status: 'unknown',
            };
            hasTodayChanged = true;
          }
        } else {
          const { saved: newSaved } = evaluateDayStatus(todayRecord.budget, todaySpent, todayEligibleIncome);
          const effectiveSpendable = todayRecord.budget + todayEligibleIncome;
          const newStatus =
            todaySpent > effectiveSpendable && effectiveSpendable > 0
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
        if (get().isBudgetModeEnabled && get().budgetCadence === 'daily' && (todayRecord.budget > 0 || todayEligibleIncome > 0)) {
          const spendable = todayRecord.budget + todayEligibleIncome;
          const ratio = spendable > 0 ? todaySpent / spendable : (todaySpent > 0 ? 1 : 0);
          const remaining = Math.max(0, spendable - todaySpent);
          if (ratio >= 1) {
            if (get().lastExceededNotifiedDate !== todayStr) {
              notifyLimit({
                id: `alert_exceeded_${todayStr}`,
                kind: 'exceeded',
                cadence: 'daily',
                spent: todaySpent,
                budget: spendable,
                remaining: 0,
                date: todayStr,
              });
              set({ lastExceededNotifiedDate: todayStr });
            }
          } else if (ratio >= 0.8) {
            if (get().lastWarningNotifiedDate !== todayStr) {
              notifyLimit({
                id: `alert_warning_80_${todayStr}`,
                kind: 'warning',
                cadence: 'daily',
                spent: todaySpent,
                budget: spendable,
                remaining,
                date: todayStr,
              });
              set({ lastWarningNotifiedDate: todayStr });
            }
          }
        } else if (get().isBudgetModeEnabled && (get().budgetCadence === 'weekly' || get().budgetCadence === 'monthly')) {
          const spentByDate = computeSpentByDate(expenses, isIncomeFn);
          const incomeByDate = computeIncomeByDate(expenses, isEligibleIncomeFn);
          const summary = getCurrentPeriodSummary(get().planChanges, spentByDate, todayStr, incomeByDate);
          if (summary && summary.budget > 0) {
            const ratio = summary.spent / summary.budget;
            const periodKey = `${summary.cadence}_${summary.periodStart}`;

            if (ratio >= 1) {
              if (get().lastPeriodExceededKey !== periodKey) {
                notifyLimit({
                  id: `alert_exceeded_${periodKey}`,
                  kind: 'exceeded',
                  cadence: summary.cadence,
                  spent: summary.spent,
                  budget: summary.budget,
                  remaining: 0,
                  date: todayStr,
                  periodKey,
                });
                set({ lastPeriodExceededKey: periodKey });
              }
            } else if (ratio >= 0.8) {
              if (get().lastPeriodWarningKey !== periodKey) {
                notifyLimit({
                  id: `alert_warning_80_${periodKey}`,
                  kind: 'warning',
                  cadence: summary.cadence,
                  spent: summary.spent,
                  budget: summary.budget,
                  remaining: summary.remaining,
                  remainingDays: summary.remainingDays,
                  date: todayStr,
                  periodKey,
                });
                set({ lastPeriodWarningKey: periodKey });
              }
            }
          }
        }

        if (hasTodayChanged) {
          const metrics = computeMetrics(
            records,
            get().gullakDeposits,
            undefined,
            get().budgetPeriods,
            get().budgetCadence,
            get().bestStreakByCadence
          );
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

          if (get().isBudgetModeEnabled) {
            notifyBudgetUpdated(`scheduled_budget_${todayStr}`, scheduled, todayStr);
          }
        }

        const isIncomeFn = buildCategoryClassifier();
        const isEligibleIncomeFn = buildEligibleIncomeClassifier();

        // 1. Group all non-income expenses by date in a single O(N) pass
        const spentByDate = computeSpentByDate(expenses, isIncomeFn);
        const incomeByDate = computeIncomeByDate(expenses, isEligibleIncomeFn);

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

        const userCreatedAtStr = getUserCreatedAtLocalDate(currentUser?.created_at);
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        // Only add gap-fill for days that already have an existing record OR have real expenses.
        // Do NOT fabricate days the user never interacted with — that creates phantom history entries.
        // ponytail: deliberately skipping zero-activity days; upgrade = track "app open" events per day

        // 3. For every past date, verify if spent or saved or status changed (e.g. after edit/delete)
        for (const d of pastDates) {
          // D2: Daily loop only processes dates governed by 'daily'
          if (!isDailyGovernedDate(get().planChanges, d)) {
            // If a daily record does NOT already exist, do NOT create one for dates owned by weekly/monthly/paused!
            if (!records[d]) {
              continue;
            }
          }

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
          const dayIncome = incomeByDate[d] || 0;

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
            const evaluated = evaluateDayStatus(budget, spent, dayIncome);
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
            const evaluated = evaluateDayStatus(budget, spent, dayIncome);
            saved = evaluated.saved;
            status = evaluated.status;
          } else {
            // Existing record with 0 budget (e.g. manual mode)
            if (get().isAutoRenew && get().dailyBudgetAmount > 0 && existing.budget === 0) {
              budget = get().dailyBudgetAmount;
            } else {
              budget = 0;
            }
            const evaluated = evaluateDayStatus(budget, spent, dayIncome);
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

            if (get().isBudgetModeEnabled && shouldNotify) {
              notifyRollover({ id: `rollover_${d}`, cadence: 'daily', amount: saved, date: d });

              set({ lastRolloverNotifiedDate: d });
            }
          }
        }

        // 4. Multi-cadence period finalization (weekly / monthly)
        const periodsToFinalize = buildPeriodsToFinalize(
          get().planChanges,
          spentByDate,
          todayStr,
          Object.keys(get().budgetPeriods),
          userCreatedAtStr
        );

        if (periodsToFinalize.length > 0) {
          const periods = { ...get().budgetPeriods };
          for (const p of periodsToFinalize) {
            periods[p.id] = p;
            updated = true;

            // Sync to Supabase budget_periods with offline queue
            if (currentUser) {
              savePendingBudgetPeriodOffline(currentUser.id, p);
              supabase
                .from('budget_periods')
                .upsert(
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
                )
                .then(({ error }) => {
                  if (!error) {
                    // Synced successfully
                  }
                });
            }

            // Rollover notification (D10)
            if (
              get().isBudgetModeEnabled &&
              p.amountSaved > 0 &&
              !skipRolloverNotification &&
              areExpensesLoaded() &&
              get().lastPeriodRolloverKey !== p.id
            ) {
              notifyRollover({
                id: `rollover_${p.id}`,
                cadence: p.cadence,
                amount: p.amountSaved,
                date: p.activeEnd,
                periodId: p.id,
              });

              set({ lastPeriodRolloverKey: p.id });
            }
          }
          set({ budgetPeriods: periods });
        }

        // Compute savings metrics using shared helper
        const metrics = computeMetrics(
          records,
          get().gullakDeposits,
          userCreatedAtStr,
          get().budgetPeriods,
          get().budgetCadence,
          get().bestStreakByCadence
        );

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

        // Also upload pending budget periods and pending plan changes
        await get().uploadPendingBudgetPeriods();
        await get().syncPendingPlanChanges();
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
          if (synced.length) await setStoredList(addsKey, adds.filter((d) => !synced.includes(d.id)));
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
          if (synced.length) await setStoredList(delsKey, dels.filter((id) => !synced.includes(id)));
        }
      },

      hydrateFromSupabase: async (userId: string) => {
        if (!userId) return;
        try {
          // P0.1: Wait for zustand persist rehydration if not already done
          if (!useDailyBudgetStore.persist.hasHydrated()) {
            await Promise.race([
              new Promise<void>((resolve) => {
                const unsub = useDailyBudgetStore.persist.onFinishHydration(() => {
                  unsub();
                  resolve();
                });
              }),
              new Promise<void>((resolve) => setTimeout(resolve, 500)),
            ]);
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
          let pendingSettings: ProfileSettingsPatch = {};
          try {
            const stored = await AsyncStorage.getItem(getPendingSettingsKey(userId));
            if (stored) pendingSettings = JSON.parse(stored);
          } catch {}

          // Offline fast-path: return immediately with persisted state from Zustand persist
          if (useNetworkStore.getState().isOffline) {
            const records = { ...get().dailyRecords };
            let resolvedBudget = get().dailyBudgetAmount;
            let resolvedAutoRenew = get().isAutoRenew;
            let resolvedBudgetModeEnabled = get().isBudgetModeEnabled;
            let resolvedCadence: BudgetCadence = get().budgetCadence;
            let resolvedWeeklyBudget = get().weeklyBudgetAmount;
            let resolvedMonthlyBudget = get().monthlyBudgetAmount;

            if (pendingSettings.daily_budget !== undefined) {
              resolvedBudget = pendingSettings.daily_budget;
            }
            if (pendingSettings.is_auto_renew !== undefined) {
              resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew);
            }
            if (pendingSettings.is_budget_mode_enabled !== undefined) {
              resolvedBudgetModeEnabled = Boolean(pendingSettings.is_budget_mode_enabled);
            }
            if (pendingSettings.budget_cadence !== undefined) {
              resolvedCadence = pendingSettings.budget_cadence as BudgetCadence;
            }
            if (pendingSettings.weekly_budget !== undefined) {
              resolvedWeeklyBudget = pendingSettings.weekly_budget;
            }
            if (pendingSettings.monthly_budget !== undefined) {
              resolvedMonthlyBudget = pendingSettings.monthly_budget;
            }

            if (!records[todayStr]) {
              const todayBudget = resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 ? resolvedBudget : 0;
              records[todayStr] = {
                date: todayStr,
                budget: todayBudget,
                spent: 0,
                saved: todayBudget,
                isFinalized: false,
                status: resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 ? 'active' : 'unknown',
              };
            } else if (resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
              if (resolvedAutoRenew && resolvedBudget > 0) {
                if (records[todayStr].budget === 0) {
                  records[todayStr].budget = resolvedBudget;
                  records[todayStr].saved = Math.max(0, resolvedBudget - records[todayStr].spent);
                  records[todayStr].status = records[todayStr].spent > resolvedBudget ? 'exceeded' : 'active';
                }
              } else {
                records[todayStr] = {
                  ...records[todayStr],
                  budget: 0,
                  saved: 0,
                  status: 'unknown',
                };
              }
            } else if (!resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
              records[todayStr] = {
                ...records[todayStr],
                budget: 0,
                saved: 0,
                status: 'unknown',
              };
            }
            const metrics = computeMetrics(
              records,
              get().gullakDeposits,
              undefined,
              get().budgetPeriods,
              resolvedCadence,
              get().bestStreakByCadence
            );
            set({
              dailyRecords: records,
              dailyBudgetAmount: resolvedBudget,
              isAutoRenew: resolvedAutoRenew,
              isBudgetModeEnabled: resolvedBudgetModeEnabled,
              budgetCadence: resolvedCadence,
              weeklyBudgetAmount: resolvedWeeklyBudget,
              monthlyBudgetAmount: resolvedMonthlyBudget,
              ...metrics,
              hydratedForUserId: userId,
            });
            return;
          }

          // 1. Fetch user profile, logs, plan changes, and budget periods in parallel with timeout
          const [profileRes, logsRes, plansRes, periodsRes] = await Promise.race([
            Promise.all([
              supabase
                .from('profiles')
                .select('daily_budget, is_auto_renew, is_budget_mode_enabled, budget_cadence, weekly_budget, monthly_budget')
                .eq('id', userId)
                .maybeSingle(),
              supabase
                .from('daily_savings_log')
                .select('date, amount_saved, spent_amount, status, budget_amount')
                .eq('user_id', userId)
                .order('date', { ascending: true }),
              supabase
                .from('budget_plan_changes')
                .select('id, effective_from, is_enabled, cadence, amount, carry_mode, carried_over_amount, created_at')
                .eq('user_id', userId)
                .order('effective_from', { ascending: true }),
              supabase
                .from('budget_periods')
                .select('id, cadence, period_start, period_end, active_start, active_end, budget_amount, spent_amount, amount_saved, status, is_prorated, carry_mode, carried_over_amount, created_at')
                .eq('user_id', userId)
                .order('active_start', { ascending: true }),
            ]),
            new Promise<[any, any, any, any]>((r) =>
              setTimeout(() => r([{ data: null }, { data: null }, { data: null }, { data: null }]), 3500)
            ),
          ]);

          const profileData = profileRes?.data;
          const logsData = logsRes?.data;
          const plansData = plansRes?.data;
          const periodsData = periodsRes?.data;

          let resolvedBudget = get().dailyBudgetAmount;
          let resolvedAutoRenew = get().isAutoRenew;
          // Track whether Supabase returned the migration-default 500 so self-healing can fire
          // even on fresh installs where local state is already default (and resolvedBudget gets set).
          let remoteBudgetWasMigrationDefault = false;

          if (pendingSettings.daily_budget !== undefined) {
            resolvedBudget = pendingSettings.daily_budget;
          } else if (profileData && profileData.daily_budget !== null && profileData.daily_budget !== undefined) {
            const remoteBudget = Math.max(0, round2(Number(profileData.daily_budget)));
            // Guard: Remote is the migration default 500 AND local has a different value (including fresh install).
            // In both cases the self-healing recovery block below will infer the real budget from savings logs,
            // so we defer — leave resolvedBudget as whatever local already has and let recovery overwrite if needed.
            if (remoteBudget === 500) {
              remoteBudgetWasMigrationDefault = true;
              resolvedBudget = get().dailyBudgetAmount;
            } else {
              resolvedBudget = remoteBudget;
            }
          } else {
            resolvedBudget = get().dailyBudgetAmount;
          }

          if (pendingSettings.is_auto_renew !== undefined) {
            resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew);
          } else if (profileData && profileData.is_auto_renew !== null && profileData.is_auto_renew !== undefined) {
            resolvedAutoRenew = Boolean(profileData.is_auto_renew);
          } else {
            resolvedAutoRenew = get().isAutoRenew;
          }

          // Resolve 4 new profile columns
          let resolvedBudgetModeEnabled = get().isBudgetModeEnabled;
          if (pendingSettings.is_budget_mode_enabled !== undefined) {
            resolvedBudgetModeEnabled = Boolean(pendingSettings.is_budget_mode_enabled);
          } else if (profileData && profileData.is_budget_mode_enabled !== null && profileData.is_budget_mode_enabled !== undefined) {
            resolvedBudgetModeEnabled = Boolean(profileData.is_budget_mode_enabled);
          }

          let resolvedCadence: BudgetCadence = get().budgetCadence || 'daily';
          if (pendingSettings.budget_cadence !== undefined) {
            resolvedCadence = pendingSettings.budget_cadence as BudgetCadence;
          } else if (profileData && profileData.budget_cadence) {
            resolvedCadence = profileData.budget_cadence as BudgetCadence;
          }

          let resolvedWeeklyBudget = get().weeklyBudgetAmount || 0;
          if (pendingSettings.weekly_budget !== undefined) {
            resolvedWeeklyBudget = pendingSettings.weekly_budget;
          } else if (profileData && profileData.weekly_budget !== null && profileData.weekly_budget !== undefined) {
            resolvedWeeklyBudget = Math.max(0, round2(Number(profileData.weekly_budget)));
          }

          let resolvedMonthlyBudget = get().monthlyBudgetAmount || 0;
          if (pendingSettings.monthly_budget !== undefined) {
            resolvedMonthlyBudget = pendingSettings.monthly_budget;
          } else if (profileData && profileData.monthly_budget !== null && profileData.monthly_budget !== undefined) {
            resolvedMonthlyBudget = Math.max(0, round2(Number(profileData.monthly_budget)));
          }

          // Process plan changes
          let resolvedPlanChanges: BudgetPlanChange[] = [];
          if (plansData && plansData.length > 0) {
            resolvedPlanChanges = (plansData as Array<{
              id: string;
              effective_from: string;
              is_enabled: boolean;
              cadence: string;
              amount: number | string;
              carry_mode?: 'additive' | 'allocation';
              carried_over_amount?: number | string;
              created_at?: string;
            }>).map((p) => ({
              id: p.id,
              userId,
              effectiveFrom: p.effective_from,
              isEnabled: Boolean(p.is_enabled),
              cadence: p.cadence as BudgetCadence,
              amount: Number(p.amount) || 0,
              carryMode: p.carry_mode,
              carriedOverAmount: Number(p.carried_over_amount) || 0,
              createdAt: p.created_at,
            }));
          } else {
            resolvedPlanChanges = get().planChanges || [];
          }
          const pendingChangesKey = getPendingPlanChangesKey(userId);
          const pendingChanges = await getStoredList<BudgetPlanChange>(pendingChangesKey);
          if (pendingChanges.length > 0) {
            for (const pc of pendingChanges) {
              resolvedPlanChanges = upsertPendingChange(resolvedPlanChanges, pc);
            }
          }

          // Process budget periods
          let resolvedPeriods: Record<string, BudgetPeriodRecord> = { ...get().budgetPeriods };
          if (periodsData && periodsData.length > 0) {
            for (const p of periodsData) {
              resolvedPeriods[p.id] = {
                id: p.id,
                userId,
                cadence: p.cadence as 'weekly' | 'monthly',
                periodStart: p.period_start,
                periodEnd: p.period_end,
                activeStart: p.active_start,
                activeEnd: p.active_end,
                budgetAmount: Number(p.budget_amount) || 0,
                spentAmount: Number(p.spent_amount) || 0,
                amountSaved: Number(p.amount_saved) || 0,
                status: p.status as BudgetPeriodStatus,
                isProrated: Boolean(p.is_prorated),
                carryMode: p.carry_mode,
                carriedOverAmount: Number(p.carried_over_amount) || 0,
                createdAt: p.created_at,
              };
            }
          }
          const pendingPeriodsKey = getPendingBudgetPeriodsKey(userId);
          const pendingPeriods = await getStoredList<BudgetPeriodRecord>(pendingPeriodsKey);
          if (pendingPeriods.length > 0) {
            for (const bp of pendingPeriods) {
              resolvedPeriods[bp.id] = bp;
            }
          }

          const records = { ...get().dailyRecords };

          const currentUser = useAuthStore.getState().user;
          const userCreatedAtStr = getUserCreatedAtLocalDate(currentUser?.created_at);

          // ------------------------------------------------------------------------------------
          // SELF-HEALING RECOVERY (Fix for OTA Update Bug where user budget was reset to 500)
          // ------------------------------------------------------------------------------------
          // If the user's resolved budget is 500 (the default migration/reset value), inspect their
          // historical savings logs & real expenses to detect if their original budget was different.
          const currentExpenses = getCurrentExpenses();
          const isIncomeFn = buildCategoryClassifier();
          const isEligibleIncomeFn = buildEligibleIncomeClassifier();
          const spentByDate = computeSpentByDate(currentExpenses, isIncomeFn);
          const incomeByDate = computeIncomeByDate(currentExpenses, isEligibleIncomeFn);

          // Trigger recovery only when Supabase returned the migration-default 500.
          // This covers both the live case (resolvedBudget===500 via pendingSettings) and the
          // fresh-install case (remote=500 deferred to local=0 above). Intentional 0 set by
          // the user is never treated as "wrong" — remoteBudgetWasMigrationDefault stays false.
          const budgetLooksWrong = remoteBudgetWasMigrationDefault || resolvedBudget === 500;
          if (budgetLooksWrong && logsData && logsData.length > 0) {
            const budgetCandidates: Record<number, number> = {};
            for (let i = 0; i < logsData.length; i++) {
              const logEntry = logsData[i] as {
                date: string;
                amount_saved?: number | string | null;
                budget_amount?: number | string | null;
                spent_amount?: number | string | null;
                status?: string | null;
              };
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
              supabase.from('profiles').update({ daily_budget: resolvedBudget }).eq('id', userId).then(() => {});
            }
          }

          // If remote was 500 and no non-500 candidate was found, restore 500
          if (remoteBudgetWasMigrationDefault && resolvedBudget === 0) {
            resolvedBudget = 500;
          }

          if (logsData && logsData.length > 0) {
            for (let i = 0; i < logsData.length; i++) {
              const log = logsData[i] as {
                date: string;
                amount_saved?: number | string | null;
                budget_amount?: number | string | null;
                spent_amount?: number | string | null;
                status?: string | null;
              };
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
              const dayIncome = incomeByDate[d] || 0;
              const { saved: daySaved, status: evaluatedStatus } = evaluateDayStatus(dayBudget, daySpent, dayIncome);

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
            const todayBudget = resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 ? resolvedBudget : 0;
            records[todayStr] = {
              date: todayStr,
              budget: todayBudget,
              spent: 0,
              saved: todayBudget,
              isFinalized: false,
              status: resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 ? 'active' : 'unknown',
            };
          } else if (resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
            if (resolvedAutoRenew && resolvedBudget > 0) {
              if (records[todayStr].budget === 0) {
                records[todayStr].budget = resolvedBudget;
                records[todayStr].saved = Math.max(0, resolvedBudget - records[todayStr].spent);
                records[todayStr].status = records[todayStr].spent > resolvedBudget ? 'exceeded' : 'active';
              }
            } else {
              // Auto-renew paused (OFF) -> today's unfinalized record has budget 0
              records[todayStr] = {
                ...records[todayStr],
                budget: 0,
                saved: 0,
                status: 'unknown',
              };
            }
          } else if (!resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
            records[todayStr] = {
              ...records[todayStr],
              budget: 0,
              saved: 0,
              status: 'unknown',
            };
          }

          // 2b. Fetch manual gullak deposits from Supabase with timeout
          let resolvedDeposits = get().gullakDeposits || [];
          try {
            const { data: depData, error: depError } = await withTimeout(
              supabase
                .from('gullak_deposits')
                .select('id, amount, date, note, source, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
              3500,
              { data: null, error: new Error('timeout') }
            );

            if (!depError && depData) {
              const serverDeposits: GullakDeposit[] = (depData as Array<{
                id: string;
                amount: number | string;
                date: string;
                note?: string | null;
                source?: string | null;
                created_at?: string;
              }>).map((d) => ({
                id: d.id,
                amount: Number(d.amount) || 0,
                date: d.date,
                note: d.note || undefined,
                source: (d.source === 'income' || d.source === 'external') ? d.source : 'external',
                created_at: d.created_at || new Date().toISOString(),
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
          const metrics = computeMetrics(
            records,
            resolvedDeposits,
            userCreatedAtStr,
            resolvedPeriods,
            resolvedCadence,
            get().bestStreakByCadence
          );

          set({
            dailyBudgetAmount: resolvedBudget,
            isAutoRenew: resolvedAutoRenew,
            isBudgetModeEnabled: resolvedBudgetModeEnabled,
            budgetCadence: resolvedCadence,
            weeklyBudgetAmount: resolvedWeeklyBudget,
            monthlyBudgetAmount: resolvedMonthlyBudget,
            planChanges: resolvedPlanChanges,
            budgetPeriods: resolvedPeriods,
            dailyRecords: records,
            gullakDeposits: resolvedDeposits,
            ownerUserId: userId,
            hydratedForUserId: userId,
            lastRenewedPeriodKey: await (async () => {
              try {
                return await AsyncStorage.getItem(getLastRenewedPeriodKey(userId));
              } catch {
                return null;
              }
            })(),
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
          dailyBudgetAmount: 100,
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

          // --- Budget Modes & Multi-Cadence (Oct 2026) ---
          isBudgetModeEnabled: false,
          budgetCadence: 'daily',
          weeklyBudgetAmount: 0,
          monthlyBudgetAmount: 0,
          planChanges: [],
          budgetPeriods: {},
          bestStreakByCadence: { daily: 0, weekly: 0, monthly: 0 },
          lastPeriodWarningKey: null,
          lastPeriodExceededKey: null,
          lastPeriodRolloverKey: null,
          lastRenewedPeriodKey: null,
        });
        AsyncStorage.removeItem('arthik-daily-budget-storage-v2').catch(() => {});
        const prevUid = get().ownerUserId;
        if (prevUid) {
          AsyncStorage.removeItem(getLastRenewedPeriodKey(prevUid)).catch(() => {});
        }
      },
    }),
    {
      name: 'arthik-daily-budget-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as DailyBudgetState;
        const state = persistedState as Record<string, unknown>;
        if (version < 3) {
          const isAutoRenew = Boolean(state.isAutoRenew);
          const deposits = (state.gullakDeposits as GullakDeposit[]) || [];
          const records = (state.dailyRecords as Record<string, DailyRecord>) || {};
          const hasSavedRecord = Object.values(records).some(
            (r) => r && (r.status === 'saved' || (r.saved !== undefined && r.saved > 0))
          );
          const inferredModeEnabled = isAutoRenew || deposits.length > 0 || hasSavedRecord;

          return {
            ...state,
            isBudgetModeEnabled: (state.isBudgetModeEnabled as boolean | undefined) ?? inferredModeEnabled,
            budgetCadence: (state.budgetCadence as BudgetCadence | undefined) ?? 'daily',
            weeklyBudgetAmount: (state.weeklyBudgetAmount as number | undefined) ?? 0,
            monthlyBudgetAmount: (state.monthlyBudgetAmount as number | undefined) ?? 0,
            planChanges: (state.planChanges as BudgetPlanChange[] | undefined) ?? [],
            budgetPeriods: (state.budgetPeriods as Record<string, BudgetPeriodRecord> | undefined) ?? {},
            bestStreakByCadence: (state.bestStreakByCadence as Record<string, number> | undefined) ?? {
              daily: (state.bestStreak as number | undefined) || 0,
              weekly: 0,
              monthly: 0,
            },
            lastPeriodWarningKey: (state.lastPeriodWarningKey as string | null | undefined) ?? null,
            lastPeriodExceededKey: (state.lastPeriodExceededKey as string | null | undefined) ?? null,
            lastPeriodRolloverKey: (state.lastPeriodRolloverKey as string | null | undefined) ?? null,
            lastRenewedPeriodKey: (state.lastRenewedPeriodKey as string | null | undefined) ?? null,
          } as unknown as DailyBudgetState;
        }
        return state as unknown as DailyBudgetState;
      },
    }
  )
);

registerStoreResetCallback(() => {
  useDailyBudgetStore.getState().resetDailyBudget();
});
