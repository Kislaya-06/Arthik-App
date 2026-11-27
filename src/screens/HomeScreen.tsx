import { WEEK_OPTIONS } from '../money/dateKeys';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, AppState, useWindowDimensions } from 'react-native';
import { PressableOpacity } from '../components/ui/PressableOpacity';
import { StatusBar } from 'expo-status-bar';
import { AmbientBackground } from '../components/AmbientBackground';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Bell from 'lucide-react-native/icons/bell';
import User from 'lucide-react-native/icons/user';
import Users from 'lucide-react-native/icons/users';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { hasUnsettledSplitExpenses } from '../lib/splitLedger';
import { BrandedHeroCard } from '../components/BrandedHeroCard';
import { AutoLogHomeBanner } from '../components/autolog/AutoLogHomeBanner';
import { PeriodRenewalModal } from '../components/PeriodRenewalModal';
import { WelcomeBackGapModal } from '../components/WelcomeBackGapModal';
import { PullToHistoryList, PullToHistoryListHandle } from '../components/PullToHistoryList';
import { RefreshScrollShell } from '../components/RefreshScrollShell';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { getNavTopOffset } from '../lib/pullToHistoryPhysics';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { isValid } from 'date-fns/isValid';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';
import { isSameWeek } from 'date-fns/isSameWeek';
import { isSameMonth } from 'date-fns/isSameMonth';
import { isSameDay } from 'date-fns/isSameDay';
import { HeroDetailsSheet } from '../components/HeroDetailsSheet';
import { buildHeroDetails, heroDetailsTitle, withTillToday } from '../lib/heroDetails';
import { FILTERS, Filter } from '../lib/expenseFilters';
import { selectRecentTransactions } from '../lib/homeCalculations';
import { dailyCarryForDate } from '../lib/budgetPeriods';
import { carryCoverCopy } from '../lib/notificationPolicy';
import { heroMoney } from '../money/scopeMoney';
import { useMoneySnapshot } from '../hooks/useMoneySnapshot';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useNotificationStore } from '../store/notificationStore';
import { useNetworkStore } from '../store/networkStore';
import { shouldShowHomeNetworkPill } from '../lib/homeNetworkPill';
import { useNavBarStore } from '../store/navBarStore';
import { useAppLockStore } from '../store/appLockStore';
import { useOtaStore } from '../store/otaStore';
import { maybeStartWhatsNewTour } from '../store/tourStore';
import { TourTarget } from '../components/tour/TourTarget';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabParamList, RootStackParamList } from '../types';
import { isIncomeTransaction } from '../lib/transactionUtils';
import { getDisplayName } from '../lib/profileUtils';
import { useTheme } from '../store/themeStore';
import { BouncyFilterToggle } from '../components/BouncyFilterToggle';
import { FontFamily } from '../config/theme';
import { perfMark, perfSummary } from '../lib/perfMarks';
import { PRESS_DIM_OPACITY } from '../lib/pressFeedback';
import { styles } from './HomeScreen.styles';
import { HomeTransactionItem, HomeGullakItem } from './home/HomeRecentItems';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─── Main Screen ──────────────────────────────────────────────────────────────
/** App must have been away this long before Home quietly refreshes on resume. */
const HOME_RESUME_STALE_MS = 5 * 60_000;

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const insets = useSafeAreaInsets();
  const showNavBar = useNavBarStore((s) => s.showNavBar);
  const isOffline = useNetworkStore((s) => s.isOffline);
  const isSyncing = useNetworkStore((s) => s.isSyncing);
  const networkBannerVisible = useNetworkStore((s) => s.bannerVisible);
  const pendingSyncCount = useMemo(() => expenses.filter((e) => e.pending).length, [expenses]);

  // Instagram-style pull-up-to-History lives entirely inside PullToHistoryList.
  const listRef = useRef<PullToHistoryListHandle>(null);

  const [selectedFilter, setSelectedFilter] = useState<Filter>(() => {
    const isBudgetEnabled = useDailyBudgetStore.getState().isBudgetModeEnabled;
    const cadence = useDailyBudgetStore.getState().budgetCadence;
    if (!isBudgetEnabled) return 'Daily';
    if (cadence === 'weekly') return 'Weekly';
    if (cadence === 'monthly') return 'Monthly';
    return 'Daily';
  });
  const [activeFilter, setActiveFilter] = useState<Filter>(selectedFilter);
  const [todayKey, setTodayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const referenceDate = useMemo(() => parseISO(todayKey), [todayKey]);

  const selectedFilterRef = useRef<Filter>(selectedFilter);
  selectedFilterRef.current = selectedFilter;

  // The pill (commitOnSettle) calls this only AFTER it has landed (PILL_SETTLE_MS after the last tap),
  // so the heavy period maths + digit rolls below never run while the pill is still gliding. That
  // overlap (old 220ms timer vs a ~350ms glide) was the Home pill jitter. Pill + numbers now update
  // in one render.
  const handleFilterChange = useCallback((newFilter: Filter) => {
    if (newFilter === selectedFilterRef.current) return;
    selectedFilterRef.current = newFilter;
    setSelectedFilter(newFilter);
    setActiveFilter(newFilter);
  }, []);

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
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
  const [showHeroDetails, setShowHeroDetails] = useState(false);
  const lastRenewedPeriodKey = useDailyBudgetStore((s) => s.lastRenewedPeriodKey);
  const setLastRenewedPeriodKey = useDailyBudgetStore((s) => s.setLastRenewedPeriodKey);
  // The oldest stretch that has something to say; the next one shows once this is answered.
  const absence = useDailyBudgetStore((s) => s.absences.find((a) => a.status !== 'unchecked'));
  const chooseAbsence = useDailyBudgetStore((s) => s.chooseAbsence);
  const closeAbsence = useDailyBudgetStore((s) => s.closeAbsence);
  const [gapModalDismissed, setGapModalDismissed] = useState(false);

  // Align activeFilter to active cadence on mount or hydration if not yet switched
  const hasAlignedCadenceFilter = useRef(false);
  useEffect(() => {
    if (!hasAlignedCadenceFilter.current && isBudgetModeEnabled) {
      hasAlignedCadenceFilter.current = true;
      const target: Filter =
        budgetCadence === 'weekly' ? 'Weekly' : budgetCadence === 'monthly' ? 'Monthly' : 'Daily';
      setSelectedFilter(target);
      setActiveFilter(target);
    }
  }, [isBudgetModeEnabled, budgetCadence]);

  const unreadCount = useNotificationStore((s) => s.notifications.filter((n) => !n.read).length);

  const lastFetchTime = useRef<number>(0);
  // Mirror of todayKey for the AppState listener (its closure would otherwise see an old value).
  const todayKeyRef = useRef(todayKey);
  todayKeyRef.current = todayKey;

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
      // Back on Home: list at the top, nothing pulled, footer hidden behind the nav bar again.
      listRef.current?.reset();
      // "What's new" tour: once after an update, when Home has settled and no lock screen / update popup is up.
      const tourTimer = setTimeout(() => {
        if (useAppLockStore.getState().isLocked || useOtaStore.getState().visible) return;
        maybeStartWhatsNewTour(useExpenseStore.getState().expenses.length > 0);
      }, 1200);
      return () => clearTimeout(tourTimer);
    }, [loadData, showNavBar])
  );

  // Auto-refresh when app comes to foreground from background across midnight
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const nowKey = format(new Date(), 'yyyy-MM-dd');
        const crossedMidnight = todayKeyRef.current !== nowKey;
        setTodayKey((prev) => {
          if (prev !== nowKey) {
            loadData(true);
            return nowKey;
          }
          return prev;
        });
        // Multi-device freshness: coming back after a while, quietly refresh (read-only; throttled by loadData).
        if (!crossedMidnight && Date.now() - lastFetchTime.current > HOME_RESUME_STALE_MS) {
          loadData(false);
        }
      }
    });
    return () => sub.remove();
  }, [loadData]);

  const refreshWork = useCallback(async () => {
    // Explicitly update today's date key on pull-to-refresh in case midnight just passed
    const nowKey = format(new Date(), 'yyyy-MM-dd');
    setTodayKey((prev) => (prev !== nowKey ? nowKey : prev));
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      await useDailyBudgetStore.getState().hydrateFromSupabase(currentUser.id);
    }
    await loadData(true);
  }, [loadData]);
  const { refreshing, onRefresh } = usePullRefresh(refreshWork);

  const handleNavigateSavings = useCallback(() => {
    navigation.navigate('Savings' as any);
  }, [navigation]);

  const handleOpenHeroDetails = useCallback(() => {
    setShowHeroDetails(true);
  }, []);

  const handleNavigateLedger = useCallback(() => {
    navigation.navigate('Ledger' as any);
  }, [navigation]);

  const handleNavigateNotifications = useCallback(() => {
    navigation.navigate('Notifications' as any);
  }, [navigation]);

  const handleNavigateProfile = useCallback(() => {
    navigation.navigate('Profile' as any);
  }, [navigation]);

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

  // "Not now" only hides the popup until the app is opened again: an undecided choice stays undecided.
  const shouldShowGapModal = !!absence && !gapModalDismissed;

  const handleAddExpenseForGap = useCallback((targetDate: string) => {
    setGapModalDismissed(true);
    closeAbsence();
    // Back on Home without saving: an undecided choice is asked again (rule 29).
    const unsubscribe = navigation.addListener('focus', () => {
      unsubscribe();
      setGapModalDismissed(false);
    });
    navigation.navigate('AddExpense', { defaultDate: targetDate });
  }, [navigation, closeAbsence]);

  const handleDismissGapModal = useCallback(() => {
    // An info popup is done once closed. An unanswered question only hides until the app is opened again.
    if (absence?.status === 'saved') closeAbsence();
    else setGapModalDismissed(true);
  }, [absence?.status, closeAbsence]);

  const recentTx = useMemo(
    () => selectRecentTransactions(expenses, gullakDeposits, 5),
    [expenses, gullakDeposits]
  );

  const { colors, isDark } = useTheme();
  const displayName = useMemo(
    () => getDisplayName(profile, user?.user_metadata, user?.email),
    [profile, user?.user_metadata, user?.email]
  );

  const nameFontSize = useMemo(() => {
    const len = displayName.length;
    // Three header buttons (Ledger, Notifications, Profile) leave a little less room for the name.
    if (len <= 7) return 34;
    if (len <= 10) return 28;
    if (len <= 13) return 24;
    if (len <= 17) return 22;
    return 19;
  }, [displayName]);

  // Dot on the Ledger button while someone still owes money (SPL-002).
  const hasUnsettledSplits = useMemo(() => hasUnsettledSplitExpenses(expenses), [expenses]);

  const todayRecord = useMemo(
    () => getTodayRecord(),
    [getTodayRecord, dailyRecords, dailyBudgetAmount, expenses, isAutoRenew, isBudgetModeEnabled]
  );

  // Every hero card number for this pill, from the Money Scope module (ADR 0022): the screen only renders.
  const moneySnapshot = useMoneySnapshot();
  const hero = useMemo(
    () => heroMoney(moneySnapshot, { filter: activeFilter, today: todayKey, todayRecord, userCreatedAt: userCreatedAtStr }),
    [moneySnapshot, activeFilter, todayKey, todayRecord, userCreatedAtStr]
  );
  const {
    todayBudget,
    todayRecordSpent,
    todayRemaining,
    isOverBudget,
    cadencePeriodSummary,
    primaryAmount,
    primaryLabel,
    primarySubtext,
    displaySpent,
    totalAvailable,
    isOverBudgetPeriod,
    periodSpent,
    periodIncome,
    remainingIncome,
    remainingDeposits,
    isSpendingFromGullak,
    gullakDrawnAmount,
    periodBudgetPool,
  } = hero;

  // Period Renewal Modal coordination
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
      setWeeklyBudget(newAmount, { immediate: cadencePeriodSummary?.spent === 0 });
    } else if (budgetCadence === 'monthly') {
      setMonthlyBudget(newAmount, { immediate: cadencePeriodSummary?.spent === 0 });
    }
    if (currentPeriodKey) {
      await setLastRenewedPeriodKey(currentPeriodKey);
    }
    setRenewalModalDismissed(true);
  }, [budgetCadence, currentPeriodKey, setLastRenewedPeriodKey, setWeeklyBudget, setMonthlyBudget, cadencePeriodSummary?.spent]);

  const handleCloseRenewalModal = useCallback(async () => {
    if (currentPeriodKey) {
      await setLastRenewedPeriodKey(currentPeriodKey);
    }
    setRenewalModalDismissed(true);
  }, [currentPeriodKey, setLastRenewedPeriodKey]);

  // One-line note under the hero about carried-over money ("Add only ₹50 today").
  const carryNote = useMemo(() => {
    if (!isBudgetModeEnabled) return null;
    const c = dailyCarryForDate(planChanges, (x) => dailyRecords[x]?.budget, dailyBudgetAmount, todayKey);
    if (!c || c.funded <= 0) return null;
    return carryCoverCopy({ date: todayKey, mode: c.mode, budget: c.base + c.extraBudget, funded: c.funded, toAdd: c.toAdd, remainingAfter: c.remainingAfter }).title;
  }, [isBudgetModeEnabled, planChanges, dailyRecords, dailyBudgetAmount, todayKey]);

  // Date range label shown below filter pills for quick orientation
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
    const now = new Date();
    const todayLabel = format(now, 'd MMM');
    if (activeFilter === 'Weekly') {
      const start = startOfWeek(t, WEEK_OPTIONS);
      const end = endOfWeek(t, WEEK_OPTIONS);
      const sameMonth = format(start, 'M') === format(end, 'M');
      const range = sameMonth ? `${format(start, 'd')}\u2013${format(end, 'd MMM')}` : `${format(start, 'd MMM')} \u2013 ${format(end, 'd MMM')}`;
      // A running week says how far the numbers go, so they are not read as a full-week figure.
      return withTillToday(range, 'Weekly', isSameWeek(t, now, WEEK_OPTIONS), todayLabel);
    }
    const start = startOfMonth(t);
    const end = endOfMonth(t);
    return withTillToday(`${format(start, 'd')}\u2013${format(end, 'd MMM yyyy')}`, 'Monthly', isSameMonth(t, now), todayLabel);
  }, [activeFilter, referenceDate, userCreatedAtStr]);

  // Details sheet behind the card (same numbers as the card; money back is shown on its own line).
  const heroDetails = useMemo(() => {
    if (!showHeroDetails || !isBudgetModeEnabled) {
      return { sections: [], totalSpent: periodSpent };
    }
    return buildHeroDetails({
      isBudgetMode: isBudgetModeEnabled,
      budgetGiven: periodBudgetPool,
      spent: periodSpent,
      incomeReceived: periodIncome,
      incomeLeft: remainingIncome ?? 0,
      moneyBack: hero.details.moneyBack,
      gullakAdded: hero.details.gullakAdded,
      gullakDrawn: gullakDrawnAmount ?? 0,
      gullakNow: activeFilter === 'All' ? totalAccumulatedSavings : null,
      activeBudgetLeft: hero.details.activeBudgetLeft,
      unspentInflowLeft: hero.details.unspentInflowLeft,
    });
  }, [showHeroDetails, activeFilter, isBudgetModeEnabled, periodBudgetPool, periodSpent, periodIncome, remainingIncome, hero.details, gullakDrawnAmount, totalAccumulatedSavings]);

  // ─── Pull to History ───────────────────────────────────────────────────────
  // Fired by PullToHistoryList only AFTER the finger is lifted with the ring full.
  const handleCommitToHistory = useCallback(() => {
    navigation.navigate('History');
  }, [navigation]);

  const handleExpensePress = useCallback((expenseId: string) => {
    navigation.navigate('ExpenseDetail', { expenseId });
  }, [navigation]);

  const handleGullakDepositPress = useCallback((depositId: string) => {
    navigation.navigate('GullakDepositDetail', { depositId });
  }, [navigation]);

  // Where the floating nav pill starts. The list is clipped exactly here, so the pull-up footer
  // rises out from BEHIND the nav bar (same as Instagram's footer rising out from behind its input bar).
  const { width: windowWidth } = useWindowDimensions();
  const navTopOffset = getNavTopOffset(insets.bottom, windowWidth);

  return (
    // Same native pull-to-refresh circle as History / Savings / Insights (see AppRefreshControl).
    <RefreshScrollShell refreshing={refreshing} onRefresh={onRefresh}>
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={() => {
        perfMark('home_first_layout');
        perfSummary();
      }}
    >
      <AmbientBackground />
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Fixed Top Section (Header, Filter, Hero Card & Recent Transactions Header) ── */}
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
                {
                  color: colors.textPrimary,
                  fontSize: nameFontSize,
                  lineHeight: Math.round(nameFontSize * 1.2),
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {displayName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleNavigateLedger}
              accessibilityRole="button"
              accessibilityLabel={hasUnsettledSplits ? "Split ledger, unsettled expenses" : "Split ledger"}
            >
              <Users size={20} color={colors.textPrimary} />
              {hasUnsettledSplits && <View style={styles.badgeDot} />}
            </PressableOpacity>
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleNavigateNotifications}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            >
              <Bell size={20} color={colors.textPrimary} />
              {unreadCount > 0 && <View style={styles.badgeDot} />}
            </PressableOpacity>
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleNavigateProfile}
              accessibilityRole="button"
              accessibilityLabel="Profile and settings"
            >
              <User size={20} color={colors.textPrimary} />
            </PressableOpacity>
          </View>
        </View>

        {/* Network & Offline Status Indicator (Visibility of System Status) */}
        {shouldShowHomeNetworkPill({ isOffline, isSyncing, bannerVisible: networkBannerVisible }) && (
          <View
            style={[
              styles.networkStatusPill,
              {
                backgroundColor: isOffline
                  ? (isDark ? 'rgba(255, 122, 110, 0.12)' : 'rgba(255, 122, 110, 0.08)')
                  : (isDark ? 'rgba(184, 224, 200, 0.15)' : 'rgba(184, 224, 200, 0.20)'),
                borderColor: isOffline
                  ? (isDark ? 'rgba(255, 122, 110, 0.30)' : 'rgba(255, 122, 110, 0.22)')
                  : (isDark ? 'rgba(184, 224, 200, 0.35)' : 'rgba(184, 224, 200, 0.30)'),
              },
            ]}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={
              isOffline
                ? `You are offline. ${pendingSyncCount > 0 ? `${pendingSyncCount} changes saved locally.` : 'Changes will sync when connected.'}`
                : 'Syncing changes with cloud...'
            }
          >
            {isOffline ? (
              <>
                <WifiOff size={13} color={isDark ? '#FF8A80' : '#D32F2F'} strokeWidth={2.2} />
                <Text style={[styles.networkStatusText, { color: isDark ? '#FF8A80' : '#D32F2F' }]}>
                  Offline · {pendingSyncCount > 0 ? `${pendingSyncCount} saved locally` : 'Changes saved locally'}
                </Text>
              </>
            ) : (
              <>
                <RefreshCw size={13} color={isDark ? colors.mintGreen : colors.mintGreenDark} strokeWidth={2.2} />
                <Text style={[styles.networkStatusText, { color: colors.mintText }]}>
                  Syncing changes...
                </Text>
              </>
            )}
          </View>
        )}

        {/* Segmented Filter Toggle */}
        <View style={styles.filterToggleWrapper}>
          <BouncyFilterToggle
            value={selectedFilter}
            onChange={handleFilterChange}
            options={FILTERS}
            commitOnSettle
          />
        </View>
        <View style={styles.filterDateRow}>
          <Text style={[styles.filterDateLabel, { color: colors.textSecondary }]}>
            {filterDateLabel}
          </Text>
        </View>

        {/* Branded Hero Card */}
        <TourTarget id="home.hero">
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
          onNavigateSavings={handleNavigateSavings}
          periodIncome={periodIncome}
          remainingIncome={remainingIncome}
          remainingDeposits={remainingDeposits}
          isSpendingFromGullak={isSpendingFromGullak}
          gullakDrawnAmount={gullakDrawnAmount}
          carryNote={carryNote}
          onOpenDetails={isBudgetModeEnabled ? handleOpenHeroDetails : undefined}
        />
        </TourTarget>

        {/* Automatic Logging: only visible when something needs review/attention */}
        <AutoLogHomeBanner />

        {/* ── Recent Transactions Header (Anchored Boundary / Viewport Entrance) ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
          {recentTx.length > 0 && (
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              onPress={handleCommitToHistory}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="View full transaction history"
              style={styles.historyAffordanceBtn}
            >
              <Text style={[styles.historyAffordanceText, { color: colors.mintText, fontFamily: FontFamily.semibold }]}>
                See all
              </Text>
              <ChevronRight size={13} color={colors.mintGreen} style={{ marginLeft: 2 }} />
            </PressableOpacity>
          )}
        </View>
        <View
          style={[
            styles.viewportSlotLine,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
          ]}
        />
      </View>

      {/* ── Transactions Portal: clipped at the nav bar's top edge. Rows + pull-up footer move as one block ── */}
      <View style={[styles.portalWrapper, { marginBottom: navTopOffset - 1 }]}>
        <PullToHistoryList
          ref={listRef}
          colors={colors}
          isDark={isDark}
          pullEnabled={recentTx.length > 0}
          onCommit={handleCommitToHistory}
        >
          {recentTx.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No expenses today. Tap + below to add your first expense.</Text>
            </View>
          ) : (
            <View style={styles.recentTxViewport}>
              {recentTx.map((item, idx) => {
                if (item.kind === 'gullak') {
                  return (
                    <HomeGullakItem
                      key={`gullak-${item.data.id}`}
                      deposit={item.data}
                      colors={colors}
                      isDark={isDark}
                      onPress={handleGullakDepositPress}
                      index={idx}
                    />
                  );
                }
                const e = item.data;
                const cat = e.category_id ? catMap[e.category_id] : undefined;
                const isIncome = isIncomeTransaction(e);
                const row = (
                  <HomeTransactionItem
                    key={e.id}
                    expense={e}
                    category={cat}
                    isIncome={isIncome}
                    colors={colors}
                    isDark={isDark}
                    onPress={handleExpensePress}
                    index={idx}
                  />
                );
                return idx === 0 ? <TourTarget key={e.id} id="home.recent">{row}</TourTarget> : row;
              })}
            </View>
          )}
        </PullToHistoryList>
      </View>

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

      <HeroDetailsSheet
        visible={showHeroDetails}
        onClose={() => setShowHeroDetails(false)}
        title={heroDetailsTitle(activeFilter, isSameDay(referenceDate, new Date()))}
        subtitle={filterDateLabel}
        details={heroDetails}
      />

      <WelcomeBackGapModal
        visible={shouldShowGapModal}
        from={absence?.from ?? ''}
        to={absence?.to ?? ''}
        amount={absence?.amount ?? 0}
        needsChoice={absence?.status === 'choice'}
        onSave={() => chooseAbsence('save')}
        onSkip={() => chooseAbsence('skip')}
        onAddExpense={handleAddExpenseForGap}
        onDismiss={handleDismissGapModal}
      />
    </View>
    </RefreshScrollShell>
  );
};
