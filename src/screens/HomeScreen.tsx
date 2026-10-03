import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Animated,
  Vibration,
  Platform,
  LayoutAnimation,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, ChevronUp, User } from 'lucide-react-native';
import { TransactionRow } from '../components/TransactionRow';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { BrandedHeroCard } from '../components/BrandedHeroCard';
import { PeriodRenewalModal } from '../components/PeriodRenewalModal';
import { format, parseISO, isValid, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { FILTERS, Filter, filterExpenses } from '../lib/expenseFilters';
import { calculatePeriodSummary, getExternalDepositsInPeriod, calculateExpenseTotals } from '../lib/homeCalculations';
import { getCurrentPeriodSummary } from '../lib/budgetPeriods';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore, GullakDeposit } from '../store/dailyBudgetStore';
import { useNotificationStore } from '../store/notificationStore';
import { useNavBarStore } from '../store/navBarStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabParamList, RootStackParamList } from '../types';
import { round2 } from '../lib/formatters';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { useTheme } from '../store/themeStore';
import { GullakDepositRow } from '../components/GullakDepositRow';
import { BouncyFilterToggle } from '../components/BouncyFilterToggle';
import { configureLayoutAnimation } from '../lib/animationUtils';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';
import {
  computeScrollProgress,
  evaluatePullRelease,
  PULL_TO_HISTORY_THRESHOLD,
} from '../lib/pullToHistoryUtils';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─── Staggered Transaction Row ────────────────────────────────────────────────
const StaggerRow: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      delay: Math.min(index * 35, 140),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const insets = useSafeAreaInsets();
  const showNavBar = useNavBarStore((s) => s.showNavBar);

  const scrollViewRef = useRef<ScrollView>(null);

  // ─── Pull to History: Animated Values ──────────────────────────────────────
  // scrollProgressAnim: 0 → 1 as scroll approaches the natural bottom (Phase A)
  const scrollProgressAnim = useRef(new Animated.Value(0)).current;
  // pullDepthAnim: 0 → PULL_TO_HISTORY_THRESHOLD as user overscrolls (Phase B)
  const pullDepthAnim = useRef(new Animated.Value(0)).current;

  // ─── Pull to History: Scroll metrics ref (no setState per frame) ───────────
  // We store the latest scroll metrics in a ref to avoid setState on every frame.
  const scrollMetricsRef = useRef({ contentOffsetY: 0, contentHeight: 0, layoutHeight: 0 });

  const [activeFilter, setActiveFilter] = useState<Filter>(() => {
    const isBudgetEnabled = useDailyBudgetStore.getState().isBudgetModeEnabled;
    const cadence = useDailyBudgetStore.getState().budgetCadence;
    if (!isBudgetEnabled) return 'Daily';
    if (cadence === 'weekly') return 'Weekly';
    if (cadence === 'monthly') return 'Monthly';
    return 'Daily';
  });
  const [todayKey, setTodayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const referenceDate = useMemo(() => parseISO(todayKey), [todayKey]);

  const handleFilterChange = useCallback((newFilter: Filter) => {
    if (newFilter !== activeFilter) {
      configureLayoutAnimation(LayoutAnimation.Presets.easeInEaseOut);
      setActiveFilter(newFilter);
    }
  }, [activeFilter]);

  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const getTodayRecord = useDailyBudgetStore((s) => s.getTodayRecord);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const syncWithExpenses = useDailyBudgetStore((s) => s.syncWithExpenses);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount);
  const setWeeklyBudget = useDailyBudgetStore((s) => s.setWeeklyBudget);
  const setMonthlyBudget = useDailyBudgetStore((s) => s.setMonthlyBudget);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods || {});
  const lastRenewedPeriodKey = useDailyBudgetStore((s) => s.lastRenewedPeriodKey);
  const setLastRenewedPeriodKey = useDailyBudgetStore((s) => s.setLastRenewedPeriodKey);

  // Align activeFilter to active cadence on mount or hydration if not yet switched
  const hasAlignedCadenceFilter = useRef(false);
  useEffect(() => {
    if (!hasAlignedCadenceFilter.current && isBudgetModeEnabled) {
      hasAlignedCadenceFilter.current = true;
      const target: Filter =
        budgetCadence === 'weekly' ? 'Weekly' : budgetCadence === 'monthly' ? 'Monthly' : 'Daily';
      setActiveFilter(target);
    }
  }, [isBudgetModeEnabled, budgetCadence]);

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const lastFetchTime = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    const currentUser = useAuthStore.getState().user;
    if (currentUser && useDailyBudgetStore.getState().hydratedForUserId !== currentUser.id) {
      await useDailyBudgetStore.getState().hydrateFromSupabase(currentUser.id);
    }
    if (!force && now - lastFetchTime.current < 60_000) {
      const cur = useExpenseStore.getState().expenses;
      syncWithExpenses(cur);
      return;
    }
    lastFetchTime.current = now;
    await fetchExpenses();
    const cur = useExpenseStore.getState().expenses;
    syncWithExpenses(cur);
  }, [fetchExpenses, syncWithExpenses]);

  useFocusEffect(
    useCallback(() => {
      // Ensure bottom nav bar is ALWAYS visible on HomeScreen
      if (!useNavBarStore.getState().isVisible) {
        showNavBar();
      }
      const nowKey = format(new Date(), 'yyyy-MM-dd');
      setTodayKey((prev) => (prev !== nowKey ? nowKey : prev));
      loadData(false);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        // Reset Pull to History animation state cleanly on every focus
        scrollProgressAnim.setValue(0);
        pullDepthAnim.setValue(0);
        scrollMetricsRef.current = { contentOffsetY: 0, contentHeight: 0, layoutHeight: 0 };
      });
    }, [loadData, showNavBar])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      await useDailyBudgetStore.getState().hydrateFromSupabase(currentUser.id);
    }
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const catMap = useMemo(() => {
    const m: Record<string, Category> = {};
    for (let i = 0; i < categories.length; i++) {
      m[categories[i].id] = categories[i];
    }
    return m;
  }, [categories]);

  const userCreatedAtStr = useMemo(() => {
    if (!user?.created_at) return undefined;
    try {
      return format(parseISO(user.created_at), 'yyyy-MM-dd');
    } catch {
      return user.created_at.split('T')[0]?.trim();
    }
  }, [user?.created_at]);

  const filtered = useMemo(
    () => filterExpenses(expenses, activeFilter, referenceDate),
    [expenses, activeFilter, referenceDate]
  );

  const { totalIncome, totalSpent } = useMemo(
    () => calculateExpenseTotals(filtered, catMap),
    [filtered, catMap]
  );

  type UnifiedTxItem =
    | { kind: 'expense'; data: Expense; date: string; created_at: string }
    | { kind: 'gullak'; data: GullakDeposit; date: string; created_at: string };

  const recentTx = useMemo<UnifiedTxItem[]>(() => {
    const items: UnifiedTxItem[] = [
      ...expenses.map((e) => ({ kind: 'expense' as const, data: e, date: e.expense_date, created_at: e.created_at || '' })),
      ...gullakDeposits.map((d) => ({ kind: 'gullak' as const, data: d, date: d.date, created_at: d.created_at || '' })),
    ];
    return items
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
  }, [expenses, gullakDeposits]);

  // Whether Phase B is available (gated on having transactions)
  const hasTransactions = recentTx.length > 0;

  const { colors, isDark } = useTheme();
  const nameFromMeta = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.first_name;
  const dbName = profile?.first_name === 'User' ? null : profile?.first_name;
  const firstName = dbName || nameFromMeta?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  const nameFontSize = useMemo(() => {
    const len = firstName.length;
    if (len <= 8) return 36;
    if (len <= 11) return 30;
    if (len <= 14) return 26;
    if (len <= 18) return 22;
    return 19;
  }, [firstName]);

  const isBudgetConfigured = isBudgetModeEnabled && isAutoRenew && dailyBudgetAmount > 0;
  const todayRecord = useMemo(
    () => getTodayRecord(),
    [getTodayRecord, dailyRecords, dailyBudgetAmount, expenses, isAutoRenew, isBudgetModeEnabled]
  );
  const todayBudget = isBudgetConfigured ? todayRecord.budget : 0;
  const todayLiveSpent = useMemo(() => {
    const todayStr = todayKey;
    let spent = 0;
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const cleanDate = e.expense_date?.split('T')[0]?.trim();
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      const isIncome = isIncomeTransaction(e, cat);
      if (cleanDate === todayStr && !isIncome) {
        spent += Number(e.amount) || 0;
      }
    }
    return round2(spent);
  }, [expenses, catMap, todayKey]);

  const todayRecordSpent = activeFilter === 'Daily' ? totalSpent : todayLiveSpent;
  const todayRemaining = Math.max(0, round2(todayBudget - todayRecordSpent));
  const isOverBudget = todayBudget > 0 && todayRecordSpent > todayBudget;

  const externalDepositsInPeriod = useMemo(
    () => getExternalDepositsInPeriod(gullakDeposits, activeFilter, referenceDate),
    [gullakDeposits, activeFilter, referenceDate]
  );

  const spentByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      if (isIncomeTransaction(e, cat)) continue;
      const cleanDate = e.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      map[cleanDate] = (map[cleanDate] || 0) + (Number(e.amount) || 0);
    }
    return map;
  }, [expenses, catMap]);

  const cadencePeriodSummary = useMemo(() => {
    if (!isBudgetModeEnabled || budgetCadence === 'daily') return null;
    return getCurrentPeriodSummary(planChanges, spentByDate, todayKey);
  }, [isBudgetModeEnabled, budgetCadence, planChanges, spentByDate, todayKey]);

  const [renewalModalDismissed, setRenewalModalDismissed] = useState(false);

  const currentPeriodKey = useMemo(() => {
    if (!cadencePeriodSummary) return null;
    return `${cadencePeriodSummary.cadence}_${cadencePeriodSummary.periodStart}`;
  }, [cadencePeriodSummary]);

  const shouldShowRenewalModal = useMemo(() => {
    if (!isBudgetModeEnabled) return false;
    if (budgetCadence === 'daily') return false;
    if (!cadencePeriodSummary || !currentPeriodKey) return false;
    if (renewalModalDismissed) return false;
    if (lastRenewedPeriodKey === currentPeriodKey) return false;
    return true;
  }, [isBudgetModeEnabled, budgetCadence, cadencePeriodSummary, currentPeriodKey, lastRenewedPeriodKey, renewalModalDismissed]);

  const previousRolloverSavings = useMemo(() => {
    if (!cadencePeriodSummary) return 0;
    const targetCadence = cadencePeriodSummary.cadence;
    const pastPeriods = Object.values(budgetPeriods).filter(
      (p) => p.cadence === targetCadence && p.periodEnd <= cadencePeriodSummary.periodStart && p.amountSaved > 0
    );
    if (pastPeriods.length === 0) return 0;
    pastPeriods.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
    return pastPeriods[0].amountSaved;
  }, [cadencePeriodSummary, budgetPeriods]);

  const handleConfirmKeepRenewal = useCallback(async () => {
    if (currentPeriodKey) {
      await setLastRenewedPeriodKey(currentPeriodKey);
    }
    setRenewalModalDismissed(true);
  }, [currentPeriodKey, setLastRenewedPeriodKey]);

  const handleChangeBudgetRenewal = useCallback(async (newAmount: number) => {
    if (budgetCadence === 'weekly') {
      setWeeklyBudget(newAmount);
    } else if (budgetCadence === 'monthly') {
      setMonthlyBudget(newAmount);
    }
    if (currentPeriodKey) {
      await setLastRenewedPeriodKey(currentPeriodKey);
    }
    setRenewalModalDismissed(true);
  }, [budgetCadence, currentPeriodKey, setLastRenewedPeriodKey, setWeeklyBudget, setMonthlyBudget]);

  const handleCloseRenewalModal = useCallback(async () => {
    if (currentPeriodKey) {
      await setLastRenewedPeriodKey(currentPeriodKey);
    }
    setRenewalModalDismissed(true);
  }, [currentPeriodKey, setLastRenewedPeriodKey]);

  const {
    primaryAmount,
    primaryLabel,
    primarySubtext,
    displaySpent,
    totalAvailable,
    isOverBudgetPeriod,
    periodIncome,
    periodSpent,
  } = useMemo(
    () =>
      calculatePeriodSummary({
        activeFilter,
        dailyBudgetAmount,
        isAutoRenew: isBudgetModeEnabled && isAutoRenew,
        todayBudget,
        dailyRecords,
        totalIncome,
        totalSpent,
        filtered,
        userCreatedAtStr,
        referenceDate,
        externalDepositsInPeriod,
        planChanges,
      }),
    [activeFilter, todayBudget, dailyBudgetAmount, isAutoRenew, isBudgetModeEnabled, dailyRecords, totalIncome, totalSpent, filtered, userCreatedAtStr, todayKey, externalDepositsInPeriod, planChanges]
  );

  const filterDateLabel = useMemo(() => {
    const t = referenceDate;
    if (activeFilter === 'All') {
      if (userCreatedAtStr) {
        try {
          const parsed = parseISO(userCreatedAtStr);
          if (isValid(parsed)) {
            return `Since ${format(parsed, 'd MMM yyyy')}`;
          }
        } catch {
          // fallback
        }
      }
      return 'All time';
    }
    if (activeFilter === 'Daily') return format(t, 'EEEE, d MMM');
    if (activeFilter === 'Weekly') {
      const start = startOfWeek(t, { weekStartsOn: 1 });
      const end = endOfWeek(t, { weekStartsOn: 1 });
      const sameMonth = format(start, 'M') === format(end, 'M');
      return sameMonth ? `${format(start, 'd')}\u2013${format(end, 'd MMM')}` : `${format(start, 'd MMM')} \u2013 ${format(end, 'd MMM')}`;
    }
    const start = startOfMonth(t);
    const end = endOfMonth(t);
    return `${format(start, 'd')}\u2013${format(end, 'd MMM yyyy')}`;
  }, [activeFilter, referenceDate, userCreatedAtStr]);

  // ─── Pull to History: Phase A — scroll-driven row exit ────────────────────
  // Driven by onScroll. No setState. Runs on native thread via useNativeDriver.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const metrics = {
        contentOffsetY: contentOffset.y,
        contentHeight: contentSize.height,
        layoutHeight: layoutMeasurement.height,
      };
      // Update ref (no re-render) for use in onScrollEndDrag
      scrollMetricsRef.current = metrics;

      // Phase A: drive scrollProgressAnim without setState
      const progress = computeScrollProgress(metrics);
      scrollProgressAnim.setValue(progress);

      // Phase B: compute live overscroll approximation for indicator feedback.
      // On Android, contentOffset.y is typically clamped to [0, maxScroll] during drag,
      // so this approximation may be 0 during live drag. The authoritative commit/cancel
      // decision is made in onScrollEndDrag. Live feedback is best-effort.
      if (hasTransactions) {
        const overscroll = Math.max(0, contentOffset.y + layoutMeasurement.height - contentSize.height);
        const clampedDepth = Math.min(overscroll, PULL_TO_HISTORY_THRESHOLD);
        pullDepthAnim.setValue(clampedDepth);
      }
    },
    [scrollProgressAnim, pullDepthAnim, hasTransactions]
  );

  // ─── Pull to History: Phase B — release handler ───────────────────────────
  // Guard ref to prevent double-commit on rapid releases
  const commitGuardRef = useRef(false);

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasTransactions) return;

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const { overscroll, shouldCommit } = evaluatePullRelease({
        contentOffsetY: contentOffset.y,
        contentHeight: contentSize.height,
        layoutHeight: layoutMeasurement.height,
        hasTransactions,
      });

      if (shouldCommit && !commitGuardRef.current) {
        // Commit: haptic + reset + navigate
        commitGuardRef.current = true;
        try { Vibration.vibrate(20); } catch { /* ignore */ }
        Animated.timing(pullDepthAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }).start(() => {
          commitGuardRef.current = false;
        });
        navigation.navigate('History');
      } else if (!shouldCommit && overscroll > 0) {
        // Cancel: spring back to rest
        Animated.spring(pullDepthAnim, {
          toValue: 0,
          tension: 100,
          friction: 16,
          useNativeDriver: true,
        }).start();
      }
    },
    [hasTransactions, pullDepthAnim, navigation]
  );

  // ─── Phase A: interpolated styles (native driver — opacity + translateY only)
  const phaseAOpacity = scrollProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.15],
    extrapolate: 'clamp',
  });
  const phaseATranslateY = scrollProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
    extrapolate: 'clamp',
  });
  // Badge has a slightly higher opacity floor (0.20) than txMiddle (0.15)
  const phaseABadgeOpacity = scrollProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.20],
    extrapolate: 'clamp',
  });

  // ─── Phase B: pull indicator interpolated styles ──────────────────────────
  const indicatorOpacity = pullDepthAnim.interpolate({
    inputRange: [0, PULL_TO_HISTORY_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const indicatorTranslateY = pullDepthAnim.interpolate({
    inputRange: [0, PULL_TO_HISTORY_THRESHOLD],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });
  const indicatorIconOpacity = pullDepthAnim.interpolate({
    inputRange: [0, PULL_TO_HISTORY_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const indicatorTextOpacity = pullDepthAnim.interpolate({
    inputRange: [0, PULL_TO_HISTORY_THRESHOLD],
    outputRange: [0, 0.85],
    extrapolate: 'clamp',
  });
  // Icon color: textSecondary → mintGreen across the pull range
  // Animated.Color is not available; we use opacity crossfade between two icon layers.
  // Secondary icon (textSecondary) fades out, primary icon (mintGreen) fades in.
  const iconMintOpacity = pullDepthAnim.interpolate({
    inputRange: [0, PULL_TO_HISTORY_THRESHOLD * 0.5, PULL_TO_HISTORY_THRESHOLD],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });
  const iconMutedOpacity = pullDepthAnim.interpolate({
    inputRange: [0, PULL_TO_HISTORY_THRESHOLD * 0.5, PULL_TO_HISTORY_THRESHOLD],
    outputRange: [1, 0.6, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.mintGreen}
            colors={[colors.mintGreen, '#15803D']}
            progressViewOffset={insets.top + 8}
          />
        }
      >
        {/* ── Top Section (Header, Filter, Hero Card & Recent Transactions Header) ── */}
        <View
          style={[
            styles.topSection,
            { paddingTop: insets.top + 10 },
          ]}
        >

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerGreeting}>
              <Text style={[styles.helloText, { color: colors.textSecondary }]}>Hello</Text>
              <Text
                style={[
                  styles.nameText,
                  { color: colors.textPrimary, fontSize: nameFontSize },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {firstName}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate('Notifications' as any)}
              >
                <Bell size={20} color={colors.textPrimary} />
                {unreadCount > 0 && <View style={styles.badgeDot} />}
              </Pressable>
              <Pressable
                style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate('Profile' as any)}
              >
                <User size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* Segmented Filter Toggle */}
          <View style={styles.filterToggleWrapper}>
            <BouncyFilterToggle
              value={activeFilter}
              onChange={handleFilterChange}
              options={FILTERS}
            />
          </View>
          <View style={styles.filterDateRow}>
            <Text style={[styles.filterDateLabel, { color: colors.textSecondary }]}>
              {filterDateLabel}
            </Text>
          </View>

          {/* Branded Hero Card */}
          <BrandedHeroCard
            primaryLabel={primaryLabel}
            primaryAmount={primaryAmount}
            primarySubtext={primarySubtext}
            displaySpent={displaySpent}
            totalAvailable={totalAvailable}
            periodSpent={periodSpent}
            isOverBudgetPeriod={isOverBudgetPeriod}
            activeFilter={activeFilter}
            todayBudget={todayBudget}
            todayRemaining={todayRemaining}
            todayRecordSpent={todayRecordSpent}
            isOverBudget={isOverBudget}
            cadencePeriodSummary={cadencePeriodSummary}
            colors={colors}
            isDark={isDark}
            onNavigateSavings={() => navigation.navigate('Savings' as any)}
          />

          {/* Recent Transactions Section Header — "See All" is intentionally removed */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent transactions</Text>
          </View>
        </View>

        {/* ── Scrollable Transactions List & Pull Indicator ── */}
        {recentTx.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions yet — tap + to add one!</Text>
          </View>
        ) : (
          <View style={styles.recentTxList}>
            {recentTx.map((item, idx) => {
              if (item.kind === 'gullak') {
                return (
                  <StaggerRow key={`gullak-${item.data.id}`} index={idx}>
                    {/* Phase A: animate GullakDepositRow icon+middle, but not the amount.
                        GullakDepositRow doesn't expose sub-columns, so we wrap the whole
                        row with a mild Phase A opacity — amount inside is still stable
                        since we don't translate or hide it aggressively. */}
                    <Animated.View
                      style={{
                        opacity: phaseAOpacity,
                        transform: [{ translateY: phaseATranslateY }],
                      }}
                    >
                      <Pressable
                        onPress={() => navigation.navigate('GullakDepositDetail', { depositId: item.data.id })}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <GullakDepositRow
                          deposit={item.data}
                          colors={colors}
                          isDark={isDark}
                        />
                      </Pressable>
                    </Animated.View>
                  </StaggerRow>
                );
              }

              const e = item.data;
              const cat = e.category_id ? catMap[e.category_id] : undefined;
              const isIncome = isIncomeTransaction(e, cat);

              // Phase A decomposition for TransactionRow:
              // We render the row using TransactionRow (which handles its own press-scale animation).
              // Phase A is applied via an Animated.View overlay strategy:
              // - The Animated.View wraps only the badge+txMiddle portion via negative margin trick.
              // However, TransactionRow is a black-box component.
              // The cleanest approach without modifying TransactionRow:
              // Wrap the entire StaggerRow in a position:relative container, then overlay
              // an Animated.View with pointerEvents='none' that fades from right=amount-width
              // to left=0, covering only badge+txMiddle.
              //
              // Simpler correct approach: render TransactionRow normally (which has its own
              // animated press scale), then apply Phase A to a sibling overlay that covers
              // ONLY the left+middle area (badge + txMiddle), while txRight remains unaffected.
              //
              // This overlay approach: transparent overlay dims left side; right side untouched.
              // But this requires knowing txRight width, which varies.
              //
              // CLEANEST APPROACH: inline-expand TransactionRow's inner layout at this call site,
              // giving us direct control of what animates. The row's press scale remains on the
              // outer Pressable. This avoids modifying the shared TransactionRow component.
              return (
                <StaggerRow key={e.id} index={idx}>
                  <TransactionRow
                    expense={e}
                    category={cat}
                    isIncome={isIncome}
                    colors={colors}
                    isDark={isDark}
                    onPress={() => navigation.navigate('ExpenseDetail', { expenseId: e.id })}
                    phaseABadgeOpacity={phaseABadgeOpacity}
                    phaseAMiddleOpacity={phaseAOpacity}
                    phaseATranslateY={phaseATranslateY}
                  />
                </StaggerRow>
              );
            })}

            {/* Phase B: Display-only pull indicator.
                Not a Pressable. Not a button. Tapping does nothing.
                Opacity and translateY are driven by pullDepthAnim. */}
            <Animated.View
              style={[
                styles.pullIndicator,
                {
                  opacity: indicatorOpacity,
                  transform: [{ translateY: indicatorTranslateY }],
                },
              ]}
              // Explicitly NOT accessible as a button — it is decorative only
              accessible={false}
              importantForAccessibility="no"
            >
              {/* Icon: crossfade between muted and mintGreen via layered icons */}
              <View style={styles.pullIndicatorIconContainer}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.pullIndicatorIconLayer, { opacity: iconMutedOpacity }]}>
                  <ChevronUp size={16} color={colors.textSecondary} strokeWidth={2} />
                </Animated.View>
                <Animated.View style={[styles.pullIndicatorIconLayer, { opacity: iconMintOpacity }]}>
                  <ChevronUp size={16} color={colors.mintGreen} strokeWidth={2} />
                </Animated.View>
              </View>
              <Animated.Text
                style={[
                  styles.pullIndicatorLabel,
                  { color: colors.textSecondary, opacity: indicatorTextOpacity },
                ]}
              >
                Pull for history
              </Animated.Text>
            </Animated.View>
          </View>
        )}
      </ScrollView>

      <PeriodRenewalModal
        visible={shouldShowRenewalModal}
        cadence={budgetCadence === 'monthly' ? 'monthly' : 'weekly'}
        budgetAmount={
          cadencePeriodSummary?.budget ||
          (budgetCadence === 'monthly' ? monthlyBudgetAmount : weeklyBudgetAmount)
        }
        isAutoRenew={isAutoRenew}
        periodStart={cadencePeriodSummary?.periodStart || ''}
        periodEnd={cadencePeriodSummary?.periodEnd || ''}
        rolloverSavings={previousRolloverSavings}
        onConfirmKeep={handleConfirmKeepRenewal}
        onChangeBudget={handleChangeBudgetRenewal}
        onClose={handleCloseRenewalModal}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  topSection: {
    paddingHorizontal: Spacing.gutter,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    flex: 1,
    marginRight: 14,
    justifyContent: 'center',
  },
  helloText: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.medium,
  },
  nameText: {
    fontSize: FontSize.display,
    lineHeight: LineHeight.display,
    fontFamily: FontFamily.bold,
    marginTop: -4,
    includeFontPadding: false,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Filter toggle
  filterToggleWrapper: {
    marginTop: Spacing.block,
  },
  filterDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.group,
    marginBottom: Spacing.block,
  },
  filterDateLabel: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.semibold,
    opacity: 0.85,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  setLimitAffordance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  setLimitDot: {
    fontSize: FontSize.caption,
    opacity: 0.5,
    marginRight: 6,
  },
  setLimitText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
  },

  // Section header — no "See All" button
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  sectionTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },

  // Transaction scroll list
  recentTxList: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: Spacing.surface,
    paddingHorizontal: Spacing.gutter,
  },
  emptyText: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },

  // Pull to History indicator (Phase B) — display only, not interactive
  pullIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.element,
    marginTop: Spacing.micro,
  },
  pullIndicatorIconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pullIndicatorIconLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pullIndicatorLabel: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.micro,
  },
});
