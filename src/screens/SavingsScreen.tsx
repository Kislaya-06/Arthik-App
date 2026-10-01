import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Alert,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Trophy,
  Calendar,
  Sparkles,
  Plus,
  Clock,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { StreakFlame } from '../components/StreakFlame';
import { AnimatedToggle } from '../components/AnimatedToggle';

import { useTheme } from '../store/themeStore';
import { formatCurrency, round2 } from '../lib/formatters';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useSavingsDashboard } from '../hooks/useSavingsDashboard';
import { useDailyBudgetStore, GullakDeposit, BudgetPeriodRecord } from '../store/dailyBudgetStore';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { getCurrentPeriodSummary } from '../lib/budgetPeriods';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { isDateInPeriod } from '../lib/dateFilters';
import { StreakCalendarModal } from '../components/StreakCalendarModal';
import { SavingsRecordRow } from '../components/SavingsRecordRow';
import { BudgetEditModal } from '../components/BudgetEditModal';
import { DepositGullakModal } from '../components/DepositGullakModal';
import { MoneyHelpBadge, MoneyExplainerModal } from '../components/MoneyExplainerModal';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TabParamList, RootStackParamList } from '../types';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

const FILTERS = ['All', 'This Week', 'This Month', 'Deposits'] as const;
const INITIAL_RECORDS_COUNT = 8;
const RECORDS_PAGE_SIZE = 8;

const OVER_BUDGET_CORAL = '#FF7A6E';
const OVER_BUDGET_CORAL_DOT = '#FF6B5E';

type SavingsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Savings'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─── Main Savings Screen ──────────────────────────────────────────────────────
export const SavingsScreen: React.FC<SavingsScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const handleScroll = useScrollDirection();

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
    handleToggleAutoRenew,
    scheduledNextDailyBudget,
    cancelScheduledNextDailyBudget,
    budgetModal,
    openBudgetModal,
    closeBudgetModal,
    availableIncome,
  } = useSavingsDashboard();

  const [streakCalendarVisible, setStreakCalendarVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);
  const [heroCardSize, setHeroCardSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [allowanceCardSize, setAllowanceCardSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits || []);
  const removeGullakDeposit = useDailyBudgetStore((s) => s.removeGullakDeposit);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods || {});
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const expenses = useExpenseStore((s) => s.expenses);
  const categories = useCategoryStore((s) => s.categories);

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
    progressRatio,
    isOverBudget,
    overAmount,
    saved: todaySaved,
  } = todayMetrics;

  const catMap = useMemo(() => {
    const m: Record<string, Category> = {};
    for (let i = 0; i < categories.length; i++) {
      m[categories[i].id] = categories[i];
    }
    return m;
  }, [categories]);

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

  const overspendHint = useMemo(() => {
    if (!cardIsOver) {
      return cardBudget > 0
        ? `Save ${formatCurrency(cardRemaining)} if unspent ${budgetCadence === 'weekly' ? 'this week' : budgetCadence === 'monthly' ? 'this month' : 'today'}`
        : 'Set a limit to start saving';
    }
    if (availableIncome >= cardOverAmount) {
      return `${formatCurrency(cardOverAmount)} deducted from Income`;
    } else if (availableIncome > 0) {
      const fromGullak = round2(cardOverAmount - availableIncome);
      return `${formatCurrency(availableIncome)} from Income, ${formatCurrency(fromGullak)} from Gullak`;
    } else {
      return `${formatCurrency(cardOverAmount)} deducted from Gullak`;
    }
  }, [cardIsOver, cardBudget, cardRemaining, budgetCadence, availableIncome, cardOverAmount]);

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

  // ─── Priority 1 Animations: Piggy Bounce, Flame Breathe & Progress Fill ────
  const heroPiggyScale = useRef(new Animated.Value(1)).current;
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


  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isAutoRenew) {
      Animated.timing(progressAnim, {
        toValue: cardIsOver ? 1 : Math.min(1, Math.max(0, cardProgressRatio)),
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [isAutoRenew, cardProgressRatio, cardIsOver, progressAnim]);

  const animatedProgressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.mintGreen}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              Savings & Gullak
            </Text>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
              {budgetCadence === 'weekly' ? 'Weekly Savings' : budgetCadence === 'monthly' ? 'Monthly Savings' : 'Daily Savings'}
            </Text>
          </View>

          {/* Streak Badge (Bonus Feature #2 - Tappable for Calendar) */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setStreakCalendarVisible(true)}
            style={[
              styles.streakBadge,
              {
                backgroundColor: isDark ? 'rgba(244, 184, 174, 0.18)' : '#FDEEEC',
                borderColor: colors.peachCoral,
              },
            ]}
          >
            <StreakFlame streak={effectiveStreak} size={18} />
            <Text style={[styles.streakBadgeText, { color: '#E05638' }]}>
              {effectiveStreak} {budgetCadence === 'weekly' ? (effectiveStreak === 1 ? 'Week' : 'Weeks') : budgetCadence === 'monthly' ? (effectiveStreak === 1 ? 'Month' : 'Months') : (effectiveStreak === 1 ? 'Day' : 'Days')} Streak
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero Card: Total Accumulated Savings ── */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: '#581C87',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              overflow: 'hidden',
              elevation: isDark ? 0 : 2,
            },
          ]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0 && (width !== heroCardSize.width || height !== heroCardSize.height)) {
              setHeroCardSize({ width, height });
            }
          }}
        >
          {/* Violet Premium Background Gradient */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg
              width={heroCardSize.width || '100%'}
              height={heroCardSize.height || '100%'}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <SvgLinearGradient id="gullakCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#8B5CF6" />
                  <Stop offset="100%" stopColor="#581C87" />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={heroCardSize.width || '100%'}
                height={heroCardSize.height || '100%'}
                fill="url(#gullakCardGrad)"
              />
            </Svg>
          </View>

          {/* Header Row: Title on Left, Piggy Icon Badge on Right */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={[styles.heroSub, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                Total Lifetime Savings
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.heroTitle, { color: '#FFFFFF' }]}>
                  Your {budgetCadence === 'weekly' ? 'Weekly' : budgetCadence === 'monthly' ? 'Monthly' : 'Daily'} Gullak
                </Text>
                <MoneyHelpBadge
                  size={18}
                  style={{ marginLeft: Spacing.element }}
                  onPress={() => setExplainerVisible(true)}
                />
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={triggerPiggyBounce}
              style={[styles.heroIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}
            >
              <Animated.View style={{ transform: [{ scale: heroPiggyScale }] }}>
                <PiggyBankCoinIcon size={28} color="#FFFFFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Large currency amount with strict alignItems: 'center' per project rule */}
          <View style={styles.heroAmountBlock}>
            <View style={styles.currencyRow}>
              <Text style={[styles.currencySymbol, { color: 'rgba(255, 255, 255, 0.85)' }]}>₹</Text>
              <Text style={[styles.heroAmount, { color: '#FFFFFF' }]}>
                {totalAccumulatedSavings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </View>
            <Text style={[styles.heroHelperText, { color: 'rgba(255, 255, 255, 0.8)' }]}>
              {`Auto-saved from unspent ${budgetCadence === 'weekly' ? 'weekly budget' : budgetCadence === 'monthly' ? 'monthly budget' : 'daily allowance'}`}
            </Text>
          </View>

          {/* Unboxed Minimal Stat Row */}
          <View style={[styles.heroStatsRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 10 }]}>
            {/* Best Streak */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <GradientIconBadge size={28} color="#FFFFFF" isDark={isDark}>
                {({ iconColor }) => <Trophy size={14} color={iconColor} />}
              </GradientIconBadge>
              <View style={styles.heroStatTextWrap}>
                <Text style={[styles.heroStatLabel, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                  Best Streak
                </Text>
                <Text style={[styles.heroStatValue, { color: '#FFFFFF' }]}>
                  {effectiveBestStreak} {budgetCadence === 'weekly' ? (effectiveBestStreak === 1 ? 'Week' : 'Weeks') : budgetCadence === 'monthly' ? (effectiveBestStreak === 1 ? 'Month' : 'Months') : (effectiveBestStreak === 1 ? 'Day' : 'Days')}
                </Text>
              </View>
            </View>

            {/* Vertical Divider */}
            <View style={{ width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center' }} />

            {/* Saved Days */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <GradientIconBadge size={28} color="#FFFFFF" isDark={isDark}>
                {({ iconColor }) => <Sparkles size={14} color={iconColor} />}
              </GradientIconBadge>
              <View style={styles.heroStatTextWrap}>
                <Text style={[styles.heroStatLabel, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                  {budgetCadence === 'weekly' ? 'Saved Weeks' : budgetCadence === 'monthly' ? 'Saved Months' : 'Saved Days'}
                </Text>
                <Text style={[styles.heroStatValue, { color: '#FFFFFF' }]}>
                  {savedDaysCount} {budgetCadence === 'weekly' ? (savedDaysCount === 1 ? 'Week' : 'Weeks') : budgetCadence === 'monthly' ? (savedDaysCount === 1 ? 'Month' : 'Months') : (savedDaysCount === 1 ? 'Day' : 'Days')}
                </Text>
              </View>
            </View>
          </View>

          {/* Action: Deposit into Gullak */}
          <TouchableOpacity
            style={[
              styles.depositCtaBtn,
              {
                backgroundColor: '#FFFFFF',
                borderColor: '#FFFFFF',
                marginTop: 12,
              },
            ]}
            onPress={() => setDepositModalVisible(true)}
            activeOpacity={0.75}
          >
            <Plus size={17} color="#5B21B6" />
            <Text style={[styles.depositCtaBtnText, { color: '#5B21B6' }]}>
              Deposit to Gullak
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Unified Daily Allowance & Budget Mode Hub ── */}
        <View
          style={[
            styles.unifiedBudgetCard,
            {
              backgroundColor: '#581C87',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              overflow: 'hidden',
              elevation: isDark ? 0 : 2,
            },
          ]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0 && (width !== allowanceCardSize.width || height !== allowanceCardSize.height)) {
              setAllowanceCardSize({ width, height });
            }
          }}
        >
          {/* Violet Gradient Backdrop matching Gullak Hero Card */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg
              key={`allowance_${allowanceCardSize.width}_${allowanceCardSize.height}`}
              width={allowanceCardSize.width || '100%'}
              height={allowanceCardSize.height ? allowanceCardSize.height + 4 : '100%'}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <SvgLinearGradient id="allowanceCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#8B5CF6" />
                  <Stop offset="100%" stopColor="#581C87" />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={allowanceCardSize.width || '100%'}
                height={allowanceCardSize.height ? allowanceCardSize.height + 4 : '100%'}
                fill="url(#allowanceCardGrad)"
              />
            </Svg>
          </View>

          {/* Row 1: Title + Date Pill inline left, Status indicator right */}
          <View style={styles.ucTopRow}>
            <View style={styles.ucTitleRow}>
              <Text style={[styles.ucTitle, { color: '#FFFFFF' }]}>
                {cardTitle}
              </Text>
              <View
                style={[
                  styles.ucDateBadge,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                ]}
              >
                <Text style={[styles.ucDateBadgeText, { color: '#FFFFFF' }]}>
                  {cardDateBadge}
                </Text>
              </View>
            </View>

            {/* Unboxed High-Visibility Status Indicator */}
            {isAutoRenew && cardBudget > 0 && (
              <View style={styles.ucStatusRow}>
                <View
                  style={[
                    styles.ucStatusDot,
                    {
                      backgroundColor: cardIsOver
                        ? OVER_BUDGET_CORAL_DOT
                        : cardProgressRatio >= 0.8
                        ? '#FBBF24'
                        : '#FFFFFF',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.ucStatusText,
                    {
                      color: cardIsOver
                        ? OVER_BUDGET_CORAL
                        : cardProgressRatio >= 0.8
                        ? '#FDE68A'
                        : '#FFFFFF',
                    },
                  ]}
                >
                  {cardIsOver ? 'Over budget' : cardProgressRatio >= 0.8 ? 'Near limit' : 'On track'}
                </Text>
              </View>
            )}
          </View>

          {/* Body: Active or Paused */}
          {isAutoRenew ? (
            <View style={styles.ucBody}>
              {/* Row 2: Hero Amount & Budget Change */}
              <View style={styles.ucHeroRow}>
                <View style={styles.ucHeroLeft}>
                  <Text
                    style={[
                      styles.ucHeroLabel,
                      { color: cardIsOver ? OVER_BUDGET_CORAL : 'rgba(255, 255, 255, 0.75)' },
                    ]}
                  >
                    {cardIsOver ? 'EXCEEDED BY' : 'LEFT TO SPEND'}
                  </Text>
                  <View style={styles.ucAmountRow}>
                    <Text
                      style={[
                        styles.ucHeroCurrencySymbol,
                        { color: cardIsOver ? OVER_BUDGET_CORAL : '#FFFFFF' },
                      ]}
                    >
                      ₹
                    </Text>
                    <Text
                      style={[
                        styles.ucHeroAmount,
                        { color: cardIsOver ? OVER_BUDGET_CORAL : '#FFFFFF' },
                      ]}
                    >
                      {(cardIsOver ? cardOverAmount : cardRemaining).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>

                {/* Right Column: Highlighted Change Action Button */}
                <View style={styles.ucHeroRight}>
                  <TouchableOpacity
                    onPress={() => openBudgetModal('recurring')}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.ucChangeBtn}
                  >
                    <Text style={styles.ucChangeBtnText}>
                      Change
                    </Text>
                    <ChevronRight size={13} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 3: Progress Bar */}
              <View
                style={[
                  styles.ucProgressTrack,
                  { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
                ]}
                accessibilityLabel={`Spent ${formatCurrency(cardSpent)} of ${formatCurrency(cardBudget)} budget`}
                accessibilityRole="progressbar"
              >
                <Animated.View
                  style={[
                    styles.ucProgressFill,
                    {
                      width: animatedProgressWidth,
                      backgroundColor: cardIsOver ? OVER_BUDGET_CORAL : '#FFFFFF',
                    },
                  ]}
                />
              </View>

              {/* Under-bar spending split */}
              <View style={styles.ucProgressLabels}>
                <Text style={[styles.ucProgressLabelText, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                  Spent <Text style={[styles.ucProgressLabelValue, { color: '#FFFFFF' }]}>{formatCurrency(cardSpent)}</Text>
                </Text>
                <Text style={[styles.ucProgressLabelText, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                  <Text style={[styles.ucProgressLabelValue, { color: '#FFFFFF' }]}>{formatCurrency(cardBudget)}</Text> budget
                </Text>
              </View>

              {/* Scheduled Tomorrow Budget Banner (if active) */}
              {scheduledNextDailyBudget !== null && scheduledNextDailyBudget > 0 && (
                <View style={[styles.scheduledBanner, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' }]}>
                  <Clock size={15} color="#FFFFFF" style={{ marginRight: Spacing.element }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.scheduledBannerTitle, { color: '#FFFFFF', fontFamily: FontFamily.bold }]}>
                      Tomorrow's Budget: {formatCurrency(scheduledNextDailyBudget)}
                    </Text>
                    <Text style={[styles.scheduledBannerSubtitle, { color: 'rgba(255, 255, 255, 0.8)', fontFamily: FontFamily.medium }]}>
                      Takes effect at 12:00 AM
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleCancelScheduled} hitSlop={8}>
                    <X size={16} color="rgba(255, 255, 255, 0.8)" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Row 4: Dedicated Auto-save Feature Row (Unboxed) */}
              <View style={styles.ucAutoSaveCapsule}>
                <View style={styles.ucAutoSaveLeft}>
                  <GradientIconBadge size={40} color="#FFFFFF" isDark={isDark}>
                    {({ iconColor }) => <PiggyBankCoinIcon size={20} color={iconColor} />}
                  </GradientIconBadge>
                  <View style={styles.ucAutoSaveTextWrap}>
                    <Text style={[styles.ucAutoSaveLabel, { color: '#FFFFFF' }]}>
                      Auto-save unspent to Gullak
                    </Text>
                    <Text
                      style={[
                        styles.ucFooterHint,
                        {
                          color: isOverBudget ? OVER_BUDGET_CORAL : 'rgba(255, 255, 255, 0.85)',
                          fontFamily: isOverBudget ? FontFamily.semibold : FontFamily.medium,
                        },
                      ]}
                    >
                      {overspendHint}
                    </Text>
                  </View>
                </View>
                <AnimatedToggle
                  value={isAutoRenew}
                  onValueChange={handleToggleAutoRenew}
                  width={52}
                  height={26}
                  onColor="#FFFFFF"
                />
              </View>
            </View>
          ) : (
            /* Paused State */
            <View style={styles.ucBody}>
              <View
                style={[
                  styles.pausedStateBox,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                ]}
              >
                <View style={styles.pausedStateTop}>
                  <View style={[styles.pausedIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                    <Sparkles size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pausedTitle, { color: '#FFFFFF' }]}>
                      {budgetCadence === 'weekly'
                        ? 'Weekly Budget Paused'
                        : budgetCadence === 'monthly'
                        ? 'Monthly Budget Paused'
                        : 'Daily Allowance Paused'}
                    </Text>
                    <Text style={[styles.pausedDesc, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                      Auto-rollover to Gullak is paused. All your past savings stay 100% safe.
                    </Text>
                  </View>
                </View>

                <View style={[styles.pausedDivider, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />

                <View style={styles.pausedBottomRow}>
                  <View>
                    <Text style={[styles.pausedSubLabel, { color: 'rgba(255, 255, 255, 0.75)' }]}>
                      Configured {budgetCadence === 'weekly' ? 'Weekly Budget' : budgetCadence === 'monthly' ? 'Monthly Budget' : 'Daily Allowance'}
                    </Text>
                    <Text style={[styles.pausedAmountText, { color: '#FFFFFF' }]}>
                      {dailyBudgetAmount > 0 ? formatCurrency(dailyBudgetAmount) : 'Not Set'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.pausedActionBtn,
                      {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#FFFFFF',
                      },
                    ]}
                    onPress={() => openBudgetModal('recurring')}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.pausedActionBtnText, { color: '#581C87' }]}>
                      {dailyBudgetAmount > 0 ? 'Change' : 'Set Limit'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Auto-save toggle capsule to re-enable */}
              <View
                style={[
                  styles.ucAutoSaveCapsule,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    marginTop: Spacing.group,
                  },
                ]}
              >
                <View style={styles.ucAutoSaveLeft}>
                  <GradientIconBadge size={40} color="#FFFFFF" isDark={isDark}>
                    {({ iconColor }) => <PiggyBankCoinIcon size={20} color={iconColor} />}
                  </GradientIconBadge>
                  <View style={styles.ucAutoSaveTextWrap}>
                    <Text style={[styles.ucAutoSaveLabel, { color: '#FFFFFF' }]}>
                      Auto-save unspent to Gullak
                    </Text>
                    <Text style={[styles.ucFooterHint, { color: 'rgba(255, 255, 255, 0.85)' }]}>
                      Turn on to resume daily rollover into Gullak
                    </Text>
                  </View>
                </View>
                <AnimatedToggle
                  value={isAutoRenew}
                  onValueChange={handleToggleAutoRenew}
                  width={52}
                  height={26}
                  onColor="#FFFFFF"
                />
              </View>
            </View>
          )}
        </View>


        {/* ── Day-by-Day Savings History ── */}
        <View style={styles.historySectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {budgetCadence === 'weekly' ? 'Week-by-Week Savings History' : budgetCadence === 'monthly' ? 'Month-by-Month Savings History' : 'Day-by-Day Savings History'}
          </Text>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {FILTERS.map((f) => {
            const active = f === activeFilter;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[
                  styles.filterPill,
                  active
                    ? { backgroundColor: colors.mintGreenSoft, borderColor: colors.mintGreen }
                    : { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    active
                      ? [styles.filterPillTextActive, { color: colors.textPrimary }]
                      : { color: colors.textSecondary },
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Past Records List */}
        {unifiedList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Calendar size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {activeFilter === 'Deposits' ? 'No Manual Deposits Yet' : 'No Past Savings History Yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {activeFilter === 'Deposits'
                ? 'Tap "Deposit to Gullak" above to add extra savings or cash directly into your jar.'
                : `At the end of each ${budgetCadence === 'weekly' ? 'week' : budgetCadence === 'monthly' ? 'month' : 'day'}, any unspent balance from your budget will automatically roll into your Savings Gullak and appear right here!`}
            </Text>
          </View>
        ) : (
          <>
            {visibleUnifiedList.map((item) => (
              <SavingsRecordRow
                key={item.id}
                rec={item.dailyRecord}
                deposit={item.deposit}
                period={item.period}
                onPress={
                  item.deposit
                    ? () => navigation.navigate('GullakDepositDetail', { depositId: item.deposit!.id })
                    : undefined
                }
                onDeleteDeposit={
                  item.deposit
                    ? () => handleDeleteDeposit(item.deposit!.id, item.deposit!.amount)
                    : undefined
                }
                colors={colors}
                isDark={isDark}
              />
            ))}

            {hasMoreRecords && (
              <TouchableOpacity
                style={[
                  styles.seeMoreBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setVisibleRecordsCount((prev) => prev + RECORDS_PAGE_SIZE)}
                activeOpacity={0.7}
              >
                <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>
                  See More
                </Text>
                <ChevronDown size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </>
        )}
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

      {/* ── Money Explainer Modal ── */}
      <MoneyExplainerModal
        visible={explainerVisible}
        topic="rollover_savings"
        onClose={() => setExplainerVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.block,
  },
  screenSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },
  screenTitle: {
    fontSize: 26,
    fontFamily: FontFamily.bold,
    marginTop: -2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    gap: Spacing.micro,
    overflow: 'visible',
  },
  streakBadgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },

  // Hero Card
  heroCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  heroTitleWrap: {
    justifyContent: 'center',
  },
  heroSub: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginBottom: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmountBlock: {
    marginTop: 0,
    marginBottom: 8,
  },
  // Strict rule: wrapping row container has alignItems: 'center'
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 26,
    fontFamily: FontFamily.bold,
    marginRight: Spacing.micro,
  },
  heroAmount: {
    fontSize: 34,
    fontFamily: FontFamily.bold,
  },
  heroHelperText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
    marginTop: 3,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: Spacing.group,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroStatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatTextWrap: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    marginBottom: 1,
  },
  heroStatValue: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
  },

  // Unified Budget & Allowance Card
  unifiedBudgetCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    marginBottom: Spacing.block,
  },
  // Top Row: Title + Date Pill left, Status Pill right
  ucTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ucTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  ucTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  ucDateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  ucDateBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
  },
  // Status Indicator (Unboxed, high visibility)
  ucStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ucStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  ucStatusText: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.1,
  },
  // Body wrapper
  ucBody: {
    gap: 0,
  },
  // Hero Amount Row
  ucHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ucHeroLeft: {
    flex: 1,
  },
  ucHeroLabel: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  ucAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ucHeroCurrencySymbol: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    marginRight: 2,
  },
  ucHeroAmount: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  ucHeroRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  ucChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  ucChangeBtnText: {
    fontSize: 12.5,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  // Progress Bar
  ucProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 4,
  },
  ucProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  ucProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ucProgressLabelText: {
    fontSize: 11.5,
    fontFamily: FontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  ucProgressLabelValue: {
    fontFamily: FontFamily.bold,
  },
  // Auto-save Feature Row (Unboxed)
  ucAutoSaveCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginTop: 4,
  },
  ucAutoSaveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 6,
  },
  ucAutoSaveTextWrap: {
    flex: 1,
  },
  ucAutoSaveLabel: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    marginBottom: 2,
  },
  ucFooterHint: {
    fontSize: 12.5,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },

  // Unified Active Live Tracker
  unifiedActiveContent: {
    marginTop: Spacing.nano,
  },
  todayNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.group,
  },
  todayNumberBlock: {
    justifyContent: 'center',
  },
  todayNumberLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.nano,
  },
  smallCurrencySymbol: {
    fontSize: 22,
    fontFamily: FontFamily.bold,
    marginRight: 2,
  },
  todayMainNumber: {
    fontSize: 30,
    fontFamily: FontFamily.bold,
  },
  unifiedRightBlock: {
    alignItems: 'flex-end',
    gap: Spacing.micro,
  },
  todaySubNumbers: {
    alignItems: 'flex-end',
  },
  subNumberSpent: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    marginBottom: 1,
  },
  subNumberBudget: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
  },
  unifiedChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.element,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    gap: 2,
  },
  unifiedChangeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
  },

  // Progress Bar
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.element,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressHint: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },

  // Scheduled Banner
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.element,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.group,
  },
  scheduledBannerTitle: {
    fontSize: FontSize.bodySmall,
  },
  scheduledBannerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },

  // Unified Paused State
  unifiedPausedContent: {
    marginTop: Spacing.nano,
  },
  pausedStateBox: {
    borderRadius: 16,
    padding: Spacing.group,
    borderWidth: 1,
  },
  pausedStateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
  },
  pausedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    marginBottom: 2,
  },
  pausedDesc: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },
  pausedDivider: {
    height: 1,
    marginVertical: Spacing.group,
  },
  pausedBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pausedSubLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginBottom: 2,
  },
  pausedAmountText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
  },
  pausedActionBtn: {
    paddingHorizontal: Spacing.group,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  pausedActionBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
  },

  // History Section
  historySectionHeader: {
    marginTop: Spacing.block,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: Spacing.element,
    marginBottom: Spacing.block,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },
  filterPillTextActive: {
    fontFamily: FontFamily.bold,
  },

  // Empty state
  emptyCard: {
    paddingVertical: Spacing.gutter,
    paddingHorizontal: Spacing.surface,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.micro,
  },
  emptyTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    marginTop: Spacing.group,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    lineHeight: 18,
  },

  depositCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  depositCtaBtnText: {
    fontSize: 15.5,
    fontFamily: FontFamily.bold,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.element,
    paddingVertical: 10,
    paddingHorizontal: Spacing.surface,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    marginTop: 24,
    marginBottom: Spacing.element,
  },
  seeMoreText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
});
