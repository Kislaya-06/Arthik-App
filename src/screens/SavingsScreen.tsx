import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Animated,
  Alert,
  Easing,
  useAnimatedValue,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AmbientBackground } from '../components/AmbientBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppRefreshControl } from '../components/AppRefreshControl';
import { format, parseISO } from 'date-fns';

import { useTheme } from '../store/themeStore';
import { formatCurrency, round2 } from '../lib/formatters';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useSavingsDashboard } from '../hooks/useSavingsDashboard';
import { useDailyBudgetStore, GullakDeposit, BudgetPeriodRecord } from '../store/dailyBudgetStore';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { getCurrentPeriodSummary } from '../lib/budgetPeriods';
import { computeWaterfallFromState, summarizeScope } from '../lib/moneyWaterfall';
import { buildLedgerEntries, spendingTotalsByDateKey } from '../money/ledger';
import { isDateInPeriod } from '../lib/dateFilters';
import { StreakCalendarModal } from '../components/StreakCalendarModal';
import { BudgetEditModal } from '../components/BudgetEditModal';
import { DepositGullakModal } from '../components/DepositGullakModal';
import { MoneyExplainerModal } from '../components/MoneyExplainerModal';
import { PauseBudgetModal } from '../components/profile/PauseBudgetModal';
import { MoneyExplainerTopic } from '../lib/moneyExplainerContent';
import { CompositeScreenProps, useScrollToTop } from '@react-navigation/native';
import { useNavBarContentInset } from '../hooks/useNavBarMetrics';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TabParamList, RootStackParamList } from '../types';
import { SavingsHeader } from '../components/savings/SavingsHeader';
import { SavingsHeroCard } from '../components/savings/SavingsHeroCard';
import { BudgetHubSection } from '../components/savings/BudgetHubSection';
import { SavingsHistorySection } from '../components/savings/SavingsHistorySection';
import { styles } from './SavingsScreen.styles';
import { styles as profileStyles } from './ProfileScreen.styles';

const FILTERS = ['All', 'This Week', 'This Month', 'Deposits'] as const;
const INITIAL_RECORDS_COUNT = 8;
const RECORDS_PAGE_SIZE = 8;

type SavingsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Savings'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─── Main Savings Screen ──────────────────────────────────────────────────────
export const SavingsScreen: React.FC<SavingsScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  // Bottom padding follows the responsive nav bar (+20 extra room, as before); tapping the active tab scrolls up.
  const navBarInset = useNavBarContentInset(20);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { colors, isDark } = useTheme();
  const handleScroll = useScrollDirection();

  const dashboard = useSavingsDashboard();
  const {
    totalAccumulatedSavings,
    dailyBudgetAmount,
    isAutoRenew,
    effectiveStreak,
    effectiveBestStreak,
    savedDaysCount,
    todayMetrics,
    filteredRecords,
    activeFilter,
    setActiveFilter,
    refreshing,
    onRefresh,
    budgetModal,
    closeBudgetModal,
    cancelScheduledNextDailyBudget,
  } = dashboard;

  const [streakCalendarVisible, setStreakCalendarVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);
  const [explainerTopic, setExplainerTopic] = useState<MoneyExplainerTopic>('rollover_savings');
  const [pauseModalVisible, setPauseModalVisible] = useState(false);
  const [heroCardSize, setHeroCardSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [allowanceCardSize, setAllowanceCardSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const removeGullakDeposit = useDailyBudgetStore((s) => s.removeGullakDeposit);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const setBudgetModeEnabled = useDailyBudgetStore((s) => s.setBudgetModeEnabled);
  const getCarryableAmount = useDailyBudgetStore((s) => s.getCarryableAmount);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const getPendingPlanChange = useDailyBudgetStore((s) => s.getPendingPlanChange);
  const cancelPendingPlanChange = useDailyBudgetStore((s) => s.cancelPendingPlanChange);
  const expenses = useExpenseStore((s) => s.expenses);
  const categories = useCategoryStore((s) => s.categories);

  const pendingPlanChange = useMemo(() => getPendingPlanChange(), [getPendingPlanChange, planChanges]);
  const isScheduledSwitch = Boolean(pendingPlanChange && pendingPlanChange.isEnabled !== isBudgetModeEnabled);
  const toggleValue = isScheduledSwitch ? pendingPlanChange!.isEnabled : isBudgetModeEnabled;

  const handleToggleBudgetMode = useCallback((val: boolean) => {
    if (isScheduledSwitch) {
      setBudgetModeEnabled(val);
      return;
    }

    if (!val) {
      if (totalAccumulatedSavings > 0 || effectiveBestStreak > 0) {
        setPauseModalVisible(true);
      } else {
        setBudgetModeEnabled(false);
      }
    } else {
      setBudgetModeEnabled(true);
    }
  }, [isScheduledSwitch, totalAccumulatedSavings, effectiveBestStreak, setBudgetModeEnabled]);

  const handleCancelPendingPlan = useCallback(() => {
    Alert.alert(
      'Cancel Scheduled Switch?',
      pendingPlanChange?.isEnabled
        ? 'Do you want to stay in Pure Mode and cancel activating Smart Budget & Gullak tomorrow?'
        : 'Do you want to keep Smart Budget & Gullak and cancel switching to Pure Mode tomorrow?',
      [
        { text: 'Keep Scheduled', style: 'cancel' },
        {
          text: 'Cancel Switch',
          style: 'destructive',
          onPress: () => cancelPendingPlanChange(),
        },
      ]
    );
  }, [cancelPendingPlanChange, pendingPlanChange]);

  const handleDeleteDeposit = useCallback((id: string, amount: number) => {
    Alert.alert(
      'Remove Deposit',
      `Are you sure you want to remove ${formatCurrency(amount)} from your Gullak?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeGullakDeposit(id),
        },
      ]
    );
  }, [removeGullakDeposit]);

  const depositItems = useMemo(() => {
    return gullakDeposits.map((dep) => ({
      id: dep.id,
      type: 'deposit' as const,
      date: dep.date,
      deposit: dep,
      dailyRecord: undefined,
      period: undefined as BudgetPeriodRecord | undefined,
    }));
  }, [gullakDeposits]);

  const unifiedList = useMemo(() => {
    if (activeFilter === 'Deposits') {
      return depositItems;
    }
    const dailyItems = filteredRecords.map((rec) => ({
      id: `daily_${rec.date}`,
      type: 'daily' as const,
      date: rec.date,
      dailyRecord: rec,
      deposit: undefined as GullakDeposit | undefined,
      period: undefined as BudgetPeriodRecord | undefined,
    }));

    const periodItems = Object.values(budgetPeriods)
      .filter((p) => p.status === 'saved' || p.status === 'missed' || p.status === 'even' || p.amountSaved > 0)
      .map((p) => ({
        id: `period_${p.id || p.periodStart}`,
        type: 'period' as const,
        date: p.activeEnd || p.periodEnd || p.periodStart,
        dailyRecord: undefined,
        deposit: undefined as GullakDeposit | undefined,
        period: p,
      }));

    const matchingDeposits = depositItems.filter((d) => {
      if (activeFilter === 'All') return true;
      return isDateInPeriod(d.date, activeFilter === 'This Week' ? 'week' : 'month', new Date());
    });

    const matchingPeriods = periodItems.filter((p) => {
      if (activeFilter === 'All') return true;
      return isDateInPeriod(p.date, activeFilter === 'This Week' ? 'week' : 'month', new Date());
    });

    return [...dailyItems, ...matchingPeriods, ...matchingDeposits].sort((a, b) => b.date.localeCompare(a.date));
  }, [activeFilter, filteredRecords, depositItems, budgetPeriods]);

  const [visibleRecordsCount, setVisibleRecordsCount] = useState(INITIAL_RECORDS_COUNT);

  // Reset visible count whenever the active filter changes
  useEffect(() => {
    setVisibleRecordsCount(INITIAL_RECORDS_COUNT);
  }, [activeFilter]);

  const visibleUnifiedList = useMemo(() => {
    return unifiedList.slice(0, visibleRecordsCount);
  }, [unifiedList, visibleRecordsCount]);

  const hasMoreRecords = unifiedList.length > visibleRecordsCount;

  const {
    budget: todayBudget,
    spent: todaySpent,
    remaining: todayRemaining,
    isOverBudget,
    overAmount,
  } = todayMetrics;

  const spentByDate = useMemo(
    () => spendingTotalsByDateKey(buildLedgerEntries(expenses, categories)),
    [expenses, categories]
  );

  const todayKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const cadencePeriodSummary = useMemo(() => {
    if (!isBudgetModeEnabled || budgetCadence === 'daily') return null;
    return getCurrentPeriodSummary(planChanges, spentByDate, todayKey);
  }, [isBudgetModeEnabled, budgetCadence, planChanges, spentByDate, todayKey]);

  const isCadenceMode = isBudgetModeEnabled && budgetCadence !== 'daily';

  const cardTitle = useMemo(() => {
    if (budgetCadence === 'weekly') return 'Weekly Allowance';
    if (budgetCadence === 'monthly') return 'Monthly Allowance';
    return 'Daily Allowance';
  }, [budgetCadence]);

  const cardDateBadge = useMemo(() => {
    if (budgetCadence === 'weekly' && cadencePeriodSummary) {
      try {
        const start = parseISO(cadencePeriodSummary.periodStart);
        const end = parseISO(cadencePeriodSummary.periodEnd);
        return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
      } catch {
        return 'This week';
      }
    }
    if (budgetCadence === 'monthly' && cadencePeriodSummary) {
      try {
        const start = parseISO(cadencePeriodSummary.periodStart);
        return format(start, 'MMMM yyyy');
      } catch {
        return 'This month';
      }
    }
    return format(new Date(), 'd MMM');
  }, [budgetCadence, cadencePeriodSummary]);

  const cardBudget = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.budget : todayBudget;
  const cardSpent = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.spent : todaySpent;
  const cardRemaining = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.remaining : todayRemaining;
  const cardIsOver = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.isOver : isOverBudget;
  const cardOverAmount = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.overBy : overAmount;
  const cardProgressRatio = cardBudget > 0 ? cardSpent / cardBudget : 0;

  const allDailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const cardScopeFunding = useMemo(() => {
    const waterfall = computeWaterfallFromState({
      expenses,
      categories,
      deposits: gullakDeposits,
      isBudgetModeEnabled,
      isAutoRenew,
      todayStr: todayKey,
      todayBudget: allDailyRecords[todayKey]?.budget,
      dailyBudgetAmount,
      records: allDailyRecords,
      planChanges,
    });
    const start = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.periodStart : todayKey;
    const end = isCadenceMode && cadencePeriodSummary ? cadencePeriodSummary.periodEnd : todayKey;
    return summarizeScope(waterfall, (d) => d >= start && d <= end);
  }, [expenses, categories, gullakDeposits, isBudgetModeEnabled, isAutoRenew, todayKey, allDailyRecords, dailyBudgetAmount, planChanges, isCadenceMode, cadencePeriodSummary]);

  const overspendHint = useMemo(() => {
    if (!cardIsOver) {
      return cardBudget > 0
        ? `Save ${formatCurrency(cardRemaining)} if unspent ${budgetCadence === 'weekly' ? 'this week' : budgetCadence === 'monthly' ? 'this month' : 'today'}`
        : 'Set a limit to start saving';
    }
    // Where did THIS card's overspend really come from? Same time-ordered waterfall as Home and the
    // expense detail (budget -> income -> Gullak). Using lifetime income here said "Income" even when
    // that income was already spent.
    const fromIncome = round2(cardScopeFunding.incomeUsed);
    const fromGullak = round2(cardScopeFunding.gullakDrawn);

    if (fromGullak === 0) {
      return `${formatCurrency(cardOverAmount)} deducted from Income`;
    } else if (fromIncome > 0) {
      return `${formatCurrency(fromIncome)} from Income, ${formatCurrency(fromGullak)} from Gullak`;
    } else {
      return `${formatCurrency(cardOverAmount)} deducted from Gullak`;
    }
  }, [cardIsOver, cardBudget, cardRemaining, budgetCadence, cardScopeFunding, cardOverAmount]);

  // Scheduled budget cancellation handler
  const handleCancelScheduled = useCallback(() => {
    Alert.alert(
      'Cancel Scheduled Budget',
      'Are you sure you want to cancel the scheduled budget change for tomorrow?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: cancelScheduledNextDailyBudget },
      ]
    );
  }, [cancelScheduledNextDailyBudget]);

  // Priority 1 Animations: Piggy Bounce, Flame Breathe & Progress Fill ────
  const heroPiggyScale = useAnimatedValue(1);
  const cardTarget = Math.round(cardIsOver ? cardOverAmount : cardRemaining);
  const prevSavingsRef = useRef(totalAccumulatedSavings);

  const triggerPiggyBounce = useCallback(() => {
    Animated.sequence([
      Animated.spring(heroPiggyScale, {
        toValue: 1.25,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(heroPiggyScale, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroPiggyScale]);

  useEffect(() => {
    if (totalAccumulatedSavings > prevSavingsRef.current) {
      triggerPiggyBounce();
    }
    prevSavingsRef.current = totalAccumulatedSavings;
  }, [totalAccumulatedSavings, triggerPiggyBounce]);


  const progressAnim = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: cardIsOver ? 1 : Math.min(1, Math.max(0, cardProgressRatio)),
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [cardProgressRatio, cardIsOver, progressAnim]);

  const animatedProgressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });


  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <AmbientBackground />
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 16,
            paddingBottom: navBarInset,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        {/* ── Header ── */}
        <SavingsHeader
          budgetCadence={budgetCadence}
          effectiveStreak={effectiveStreak}
          onOpenStreakCalendar={() => setStreakCalendarVisible(true)}
          colors={colors}
          isDark={isDark}
        />

        {/* ── Hero Card: Total Accumulated Savings ── */}
        <SavingsHeroCard
          heroCardSize={heroCardSize}
          setHeroCardSize={setHeroCardSize}
          budgetCadence={budgetCadence}
          onOpenExplainer={() => {
            setExplainerTopic('rollover_savings');
            setExplainerVisible(true);
          }}
          triggerPiggyBounce={triggerPiggyBounce}
          heroPiggyScale={heroPiggyScale}
          totalAccumulatedSavings={totalAccumulatedSavings}
          effectiveBestStreak={effectiveBestStreak}
          savedDaysCount={savedDaysCount}
          onOpenDepositModal={() => setDepositModalVisible(true)}
          isDark={isDark}
        />

        {/* ── Unified Daily Allowance & Budget Mode Hub ── */}
        <BudgetHubSection
          dashboard={dashboard}
          allowanceCardSize={allowanceCardSize}
          setAllowanceCardSize={setAllowanceCardSize}
          cardTitle={cardTitle}
          cardDateBadge={cardDateBadge}
          cardBudget={cardBudget}
          cardSpent={cardSpent}
          cardTarget={cardTarget}
          cardIsOver={cardIsOver}
          cardProgressRatio={cardProgressRatio}
          animatedProgressWidth={animatedProgressWidth}
          cadencePeriodSummary={cadencePeriodSummary}
          handleCancelScheduled={handleCancelScheduled}
          pendingPlanChange={pendingPlanChange}
          cancelPendingPlanChange={handleCancelPendingPlan}
          isOverBudget={isOverBudget}
          overspendHint={overspendHint}
          budgetCadence={budgetCadence}
          weeklyBudgetAmount={weeklyBudgetAmount}
          monthlyBudgetAmount={monthlyBudgetAmount}
          toggleValue={toggleValue}
          onToggleBudgetMode={handleToggleBudgetMode}
          isScheduledSwitch={isScheduledSwitch}
        />

        {/* ── Day-by-Day Savings History ── */}
        <SavingsHistorySection
          budgetCadence={budgetCadence}
          filters={FILTERS}
          activeFilter={activeFilter}
          setActiveFilter={(key) => setActiveFilter(key as any)}
          unifiedList={unifiedList}
          visibleUnifiedList={visibleUnifiedList}
          hasMoreRecords={hasMoreRecords}
          onSeeMore={() => setVisibleRecordsCount((prev) => prev + RECORDS_PAGE_SIZE)}
          onNavigateDeposit={(depositId) => navigation.navigate('GullakDepositDetail', { depositId })}
          handleDeleteDeposit={handleDeleteDeposit}
          colors={colors}
          isDark={isDark}
        />
      </ScrollView>

      {/* ── Edit Budget Modal ── */}
      <BudgetEditModal
        visible={budgetModal.visible}
        mode={budgetModal.mode}
        initialAmount={budgetModal.initialAmount}
        onClose={closeBudgetModal}
      />

      {/* ── Interactive Streak Calendar Modal ── */}
      <StreakCalendarModal
        visible={streakCalendarVisible}
        onClose={() => setStreakCalendarVisible(false)}
      />

      {/* ── Deposit to Gullak Modal ── */}
      <DepositGullakModal
        visible={depositModalVisible}
        onClose={() => setDepositModalVisible(false)}
      />

      {/* ── Switch to Pure Mode Confirmation Modal ── */}
      <PauseBudgetModal
        visible={pauseModalVisible}
        onClose={() => setPauseModalVisible(false)}
        totalAccumulatedSavings={totalAccumulatedSavings}
        budgetCadence={budgetCadence}
        getCarryableAmount={getCarryableAmount}
        onTurnOff={() => {
          setPauseModalVisible(false);
          setBudgetModeEnabled(false);
        }}
        onOpenMoneyExplainer={() => {
          setExplainerTopic('budget_pause');
          setExplainerVisible(true);
        }}
        colors={colors}
        isDark={isDark}
        styles={profileStyles}
      />

      {/* ── Money Explainer Modal ── */}
      <MoneyExplainerModal
        visible={explainerVisible}
        topic={explainerTopic}
        onClose={() => setExplainerVisible(false)}
      />
    </View>
  );
};

