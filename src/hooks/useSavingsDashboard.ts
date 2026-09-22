import { useState, useMemo, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useExpenseStore } from '../store/expenseStore';
import {
  calculateTodayMetrics,
  filterSavingsRecords,
  TodayMetrics,
  SavingsFilter,
  DailyRecord,
} from '../lib/budgetCalculations';

export interface UseSavingsDashboardReturn {
  // Store values
  totalAccumulatedSavings: number;
  savingsStreak: number;
  bestStreak: number;
  dailyBudgetAmount: number;
  isAutoRenew: boolean;

  // Derived metrics
  effectiveStreak: number;
  effectiveBestStreak: number;
  savedDaysCount: number;
  todayRecord: DailyRecord;
  todayMetrics: TodayMetrics;

  // Past records & filtering
  pastRecords: DailyRecord[];
  filteredRecords: DailyRecord[];
  activeFilter: SavingsFilter;
  setActiveFilter: (filter: SavingsFilter) => void;

  // Loading & refresh
  refreshing: boolean;
  onRefresh: () => Promise<void>;

  // Action handlers
  handleToggleAutoRenew: (val: boolean) => void;
  scheduledNextDailyBudget: number | null;
  cancelScheduledNextDailyBudget: () => void;

  // Modal coordination
  budgetModal: {
    visible: boolean;
    mode: 'recurring';
    initialAmount: number;
  };
  openBudgetModal: (mode?: 'recurring') => void;
  closeBudgetModal: () => void;
}

export function useSavingsDashboard(): UseSavingsDashboardReturn {
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);

  // Granular Zustand selectors to prevent unnecessary re-renders
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
  const savingsStreak = useDailyBudgetStore((s) => s.savingsStreak);
  const bestStreak = useDailyBudgetStore((s) => s.bestStreak);
  const toggleAutoRenew = useDailyBudgetStore((s) => s.toggleAutoRenew);
  const scheduledNextDailyBudget = useDailyBudgetStore((s) => s.scheduledNextDailyBudget);
  const cancelScheduledNextDailyBudget = useDailyBudgetStore((s) => s.cancelScheduledNextDailyBudget);
  const syncWithExpenses = useDailyBudgetStore((s) => s.syncWithExpenses);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const getTodayRecord = useDailyBudgetStore((s) => s.getTodayRecord);
  const getPastRecordsList = useDailyBudgetStore((s) => s.getPastRecordsList);

  // Modal state
  const [budgetModal, setBudgetModal] = useState<{
    visible: boolean;
    mode: 'recurring';
    initialAmount: number;
  }>({
    visible: false,
    mode: 'recurring',
    initialAmount: 0,
  });

  const [activeFilter, setActiveFilter] = useState<SavingsFilter>('All');

  const lastFetchTime = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Focus & Pull-to-Refresh Throttled Data Loading ────────────────────────
  const loadData = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetchTime.current < 60_000) {
        syncWithExpenses(useExpenseStore.getState().expenses);
        return;
      }
      lastFetchTime.current = now;
      await fetchExpenses();
      syncWithExpenses(useExpenseStore.getState().expenses);
    },
    [fetchExpenses, syncWithExpenses]
  );

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  // ─── Memoized Records ──────────────────────────────────────────────────────
  const todayRecord = useMemo(() => getTodayRecord(), [getTodayRecord, dailyRecords, isAutoRenew, dailyBudgetAmount]);
  const pastRecords = useMemo(() => getPastRecordsList(), [getPastRecordsList, dailyRecords]);

  // ─── Filtered Past Records (Explicit referenceDate, Week starts Monday) ─────
  const filteredRecords = useMemo(
    () => filterSavingsRecords(pastRecords, activeFilter, new Date()),
    [pastRecords, activeFilter]
  );

  // ─── Derived Allowance & Streak Metrics ───────────────────────────────────
  const savedDaysCount = pastRecords.filter((r) => r.isFinalized && r.saved > 0).length;

  // Guard: if savedDaysCount === 0, streak and bestStreak must be 0.
  // Although calculateSavingsMetrics clamps this internally, this guard shields the UI
  // during the cold-start AsyncStorage hydration race window where stale streak numbers
  // might temporarily be loaded before dailyRecords/remote expenses are reconciled.
  const effectiveStreak = savedDaysCount === 0 ? 0 : savingsStreak;
  const effectiveBestStreak = savedDaysCount === 0 ? 0 : bestStreak;

  const todayMetrics = useMemo(() => calculateTodayMetrics(todayRecord), [todayRecord]);

  // ─── Budget Modal Coordination ────────────────────────────────────────────
  const openBudgetModal = useCallback(
    (_mode?: 'recurring') => {
      setBudgetModal({
        visible: true,
        mode: 'recurring',
        initialAmount: dailyBudgetAmount,
      });
    },
    [dailyBudgetAmount]
  );

  const closeBudgetModal = useCallback(() => {
    setBudgetModal((prev) => ({ ...prev, visible: false }));
  }, []);

  // ─── Auto-Renew Actions ───────────────────────────────────────────────────
  const handleToggleAutoRenew = useCallback(
    (val: boolean) => {
      if (val && dailyBudgetAmount === 0) {
        openBudgetModal('recurring');
        return;
      }
      toggleAutoRenew(val);
    },
    [toggleAutoRenew, dailyBudgetAmount, openBudgetModal]
  );

  return {
    totalAccumulatedSavings,
    savingsStreak,
    bestStreak,
    dailyBudgetAmount,
    isAutoRenew,
    effectiveStreak,
    effectiveBestStreak,
    savedDaysCount,
    todayRecord,
    todayMetrics,
    pastRecords,
    filteredRecords,
    activeFilter,
    setActiveFilter,
    refreshing,
    onRefresh,
    handleToggleAutoRenew,
    scheduledNextDailyBudget,
    cancelScheduledNextDailyBudget,
    budgetModal,
    openBudgetModal,
    closeBudgetModal,
  };
}
