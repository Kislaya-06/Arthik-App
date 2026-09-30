import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Switch,
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
  Settings,
  Plus,
  Clock,
  X,
  ChevronDown,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { StreakFlame } from '../components/StreakFlame';

import { useTheme } from '../store/themeStore';
import { formatCurrency } from '../lib/formatters';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useSavingsDashboard } from '../hooks/useSavingsDashboard';
import { useDailyBudgetStore, GullakDeposit, BudgetPeriodRecord } from '../store/dailyBudgetStore';
import { isDateInPeriod } from '../lib/dateFilters';
import { StreakCalendarModal } from '../components/StreakCalendarModal';
import { SavingsRecordRow } from '../components/SavingsRecordRow';
import { BudgetEditModal } from '../components/BudgetEditModal';
import { DepositGullakModal } from '../components/DepositGullakModal';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TabParamList, RootStackParamList } from '../types';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

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
  } = useSavingsDashboard();

  const [streakCalendarVisible, setStreakCalendarVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);

  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits || []);
  const removeGullakDeposit = useDailyBudgetStore((s) => s.removeGullakDeposit);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods || {});

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

  // Today's Allowance Card visibility & bouncy spring animation when Daily Budget Mode is toggled
  const cardAnim = useRef(new Animated.Value(isAutoRenew ? 1 : 0)).current;
  const [shouldRenderTodayCard, setShouldRenderTodayCard] = useState(isAutoRenew);

  useEffect(() => {
    if (isAutoRenew) {
      setShouldRenderTodayCard(true);
      Animated.spring(cardAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(cardAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShouldRenderTodayCard(false);
        }
      });
    }
  }, [isAutoRenew, cardAnim]);

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
    if (shouldRenderTodayCard) {
      Animated.timing(progressAnim, {
        toValue: Math.min(1, Math.max(0, progressRatio)),
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [shouldRenderTodayCard, progressRatio, progressAnim]);

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
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          {/* Header Row: Title on Left, Piggy Icon Badge on Right */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                Total Lifetime Savings
              </Text>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                Your {budgetCadence === 'weekly' ? 'Weekly' : budgetCadence === 'monthly' ? 'Monthly' : 'Daily'} Gullak
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={triggerPiggyBounce}
              style={[styles.heroIconWrap, { backgroundColor: colors.mintGreenSoft }]}
            >
              <Animated.View style={{ transform: [{ scale: heroPiggyScale }] }}>
                <PiggyBankCoinIcon size={24} color={colors.mintGreenDark} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Large currency amount with strict alignItems: 'center' per project rule */}
          <View style={styles.heroAmountBlock}>
            <View style={styles.currencyRow}>
              <Text style={[styles.currencySymbol, { color: colors.mintGreenDark }]}>₹</Text>
              <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
                {totalAccumulatedSavings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </View>
            <Text style={[styles.heroHelperText, { color: isOverBudget ? colors.danger : colors.textSecondary }]}>
              {isOverBudget
                ? `🚨 -${formatCurrency(overAmount)} deducted today from Gullak`
                : `Auto-saved from unspent ${budgetCadence === 'weekly' ? 'weekly budget' : budgetCadence === 'monthly' ? 'monthly budget' : 'daily allowance'}`}
            </Text>
          </View>

          {/* Balanced 2-Column Stat Tiles */}
          <View style={styles.heroStatsRow}>
            <View
              style={[
                styles.heroStatTile,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={[styles.heroStatIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Trophy size={14} color="#F59E0B" />
              </View>
              <View style={styles.heroStatTextWrap}>
                <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>
                  Best Streak
                </Text>
                <Text style={[styles.heroStatValue, { color: colors.textPrimary }]}>
                  {effectiveBestStreak} {budgetCadence === 'weekly' ? (effectiveBestStreak === 1 ? 'Week' : 'Weeks') : budgetCadence === 'monthly' ? (effectiveBestStreak === 1 ? 'Month' : 'Months') : (effectiveBestStreak === 1 ? 'Day' : 'Days')}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.heroStatTile,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={[styles.heroStatIconWrap, { backgroundColor: colors.mintGreenSoft }]}>
                <Sparkles size={14} color={colors.mintGreenDark} />
              </View>
              <View style={styles.heroStatTextWrap}>
                <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>
                  {budgetCadence === 'weekly' ? 'Saved Weeks' : budgetCadence === 'monthly' ? 'Saved Months' : 'Saved Days'}
                </Text>
                <Text style={[styles.heroStatValue, { color: colors.textPrimary }]}>
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
                backgroundColor: colors.mintGreenSoft,
                borderColor: isDark ? 'rgba(184, 224, 200, 0.25)' : colors.mintGreen,
              },
            ]}
            onPress={() => setDepositModalVisible(true)}
            activeOpacity={0.75}
          >
            <Plus size={16} color={colors.mintGreenDark} />
            <Text style={[styles.depositCtaBtnText, { color: colors.mintGreenDark }]}>
              Deposit to Gullak
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Today's Live Allowance Tracker Card (visible only when Daily Budget Mode is ON) ── */}
        {shouldRenderTodayCard && (
          <Animated.View
            style={[
              styles.todayCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: isDark ? 1 : 0,
                opacity: cardAnim,
                transform: [
                  {
                    scale: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
          {/* Header */}
          <View style={styles.todayHeader}>
            <View>
              <Text style={[styles.todayDateText, { color: colors.textSecondary }]}>
                {budgetCadence === 'weekly' ? 'This Week' : budgetCadence === 'monthly' ? 'This Month' : `Today, ${format(new Date(), 'd MMMM')}`}
              </Text>
              <Text style={[styles.todayTitleText, { color: colors.textPrimary }]}>
                {budgetCadence === 'weekly' ? "This Week's Budget" : budgetCadence === 'monthly' ? "This Month's Budget" : "Today's Allowance"}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    todayBudget === 0
                      ? isDark
                        ? 'rgba(156, 163, 175, 0.2)'
                        : '#F3F4F6'
                      : isOverBudget
                      ? isDark
                        ? 'rgba(239, 68, 68, 0.2)'
                        : '#FEE2E2'
                      : progressRatio >= 0.8
                      ? isDark
                        ? 'rgba(245, 158, 11, 0.2)'
                        : '#FEF3C7'
                      : colors.mintGreenSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      todayBudget === 0
                        ? colors.textSecondary
                        : isOverBudget
                        ? '#DC2626'
                        : progressRatio >= 0.8
                        ? '#D97706'
                        : colors.mintGreenDark,
                  },
                ]}
              >
                {todayBudget === 0
                  ? 'Feature Off'
                  : isOverBudget
                  ? 'Over Budget 🚨'
                  : progressRatio >= 0.8
                  ? 'Almost Full ⚠️'
                  : 'On Track 👍'}
              </Text>
            </View>
          </View>

          {/* Today's Remaining & Spent Summary */}
          <View style={styles.todayNumbersRow}>
            <View style={styles.todayNumberBlock}>
              <Text style={[styles.todayNumberLabel, { color: colors.textSecondary }]}>
                {isOverBudget ? 'Exceeded By' : 'Remaining to Spend'}
              </Text>
              <View style={styles.currencyRow}>
                <Text
                  style={[
                    styles.smallCurrencySymbol,
                    { color: isOverBudget ? '#DC2626' : colors.mintGreenDark },
                  ]}
                >
                  ₹
                </Text>
                <Text
                  style={[
                    styles.todayMainNumber,
                    { color: isOverBudget ? '#DC2626' : colors.textPrimary },
                  ]}
                >
                  {(isOverBudget ? overAmount : todayRemaining).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <View style={styles.todaySubNumbers}>
              <Text style={[styles.subNumberSpent, { color: colors.textPrimary }]}>
                Spent {formatCurrency(todaySpent)}
              </Text>
              <Text style={[styles.subNumberBudget, { color: colors.textSecondary }]}>
                of {formatCurrency(todayBudget)} budget
              </Text>
            </View>
          </View>

          {/* Sleek 6px Progress Bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.chartTrack }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: animatedProgressWidth,
                  backgroundColor: isOverBudget
                    ? '#EF4444'
                    : progressRatio >= 0.8
                    ? '#F59E0B'
                    : colors.mintGreen,
                },
              ]}
            />
          </View>

          {/* Single Meaningful Status Hint */}
          <Text style={[styles.progressHint, { color: isOverBudget ? colors.danger : colors.textSecondary }]}>
            {isOverBudget
              ? `🚨 ${formatCurrency(overAmount)} deducted from your Gullak`
              : todayBudget > 0
              ? `✨ Save ${formatCurrency(todaySaved)} if unspent ${budgetCadence === 'weekly' ? 'this week' : budgetCadence === 'monthly' ? 'this month' : 'today'}`
              : `Set a ${budgetCadence === 'weekly' ? 'weekly' : budgetCadence === 'monthly' ? 'monthly' : 'daily'} budget to start saving in Gullak`}
          </Text>
        </Animated.View>
        )}

        {/* ── Auto-Renew vs Manual Settings Card ── */}
        <View
          style={[
            styles.settingsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <View style={styles.settingsHeader}>
            <View style={styles.settingsTitleRow}>
              <Settings size={20} color={colors.textPrimary} />
              <Text style={[styles.settingsTitle, { color: colors.textPrimary }]}>
                {budgetCadence === 'weekly' ? 'Weekly Budget Mode' : budgetCadence === 'monthly' ? 'Monthly Budget Mode' : 'Daily Budget Mode'}
              </Text>
            </View>

            <Switch
              value={isAutoRenew}
              onValueChange={handleToggleAutoRenew}
              trackColor={{ false: colors.chartTrack, true: colors.mintGreen }}
              thumbColor={isAutoRenew ? colors.forestGreen : '#f4f3f4'}
            />
          </View>

          <Text style={[styles.settingsDesc, { color: colors.textSecondary }]}>
            {isAutoRenew && dailyBudgetAmount > 0
              ? `Auto-adds ${budgetCadence === 'weekly' ? 'weekly budget' : budgetCadence === 'monthly' ? 'monthly budget' : 'daily allowance'} and saves unspent money to Gullak.`
              : isAutoRenew
              ? `Set your ${budgetCadence === 'weekly' ? 'weekly budget' : budgetCadence === 'monthly' ? 'monthly budget' : 'daily allowance'} below to start automatic budgeting.`
              : `Manual mode: Set your ${budgetCadence === 'weekly' ? 'weekly budget' : budgetCadence === 'monthly' ? 'monthly budget' : 'daily budget'} whenever you want.`}
          </Text>

          <TouchableOpacity
            style={[
              styles.changeAmountBtn,
              {
                backgroundColor: colors.cardSubtle,
                borderColor: colors.border,
              },
            ]}
            onPress={() => openBudgetModal('recurring')}
            activeOpacity={0.75}
          >
            <View>
              <Text style={[styles.changeAmountSub, { color: colors.textSecondary }]}>
                Default {budgetCadence === 'weekly' ? 'Weekly Budget' : budgetCadence === 'monthly' ? 'Monthly Budget' : 'Daily Allowance'}
              </Text>
              <View style={styles.currencyRow}>
                {dailyBudgetAmount > 0 ? (
                  <>
                    <Text style={[styles.smallCurrencySymbol, { color: colors.textPrimary }]}>₹</Text>
                    <Text style={[styles.changeAmountText, { color: colors.textPrimary }]}>
                      {dailyBudgetAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.changeAmountText, { color: colors.textSecondary, fontSize: FontSize.body }]}>
                    Not Set
                  </Text>
                )}
              </View>
            </View>
            <View style={[styles.editPill, { backgroundColor: colors.mintGreenSoft }]}>
              <Text style={[styles.editPillText, { color: colors.mintGreenDark }]}>
                {dailyBudgetAmount > 0 ? 'Change' : 'Set Limit'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Scheduled Tomorrow Budget Banner */}
          {scheduledNextDailyBudget !== null && scheduledNextDailyBudget > 0 && (
            <View style={[styles.scheduledBanner, { backgroundColor: colors.mintGreenSoft, borderColor: colors.mintGreen }]}>
              <Clock size={16} color={colors.mintGreenDark} style={{ marginRight: Spacing.element }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.scheduledBannerTitle, { color: colors.mintGreenDark, fontFamily: FontFamily.bold }]}>
                  Tomorrow's Budget Scheduled
                </Text>
                <Text style={[styles.scheduledBannerSubtitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  {formatCurrency(scheduledNextDailyBudget)} will take effect at 12:00 AM
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Cancel Scheduled Budget',
                    'Are you sure you want to cancel the scheduled budget change for tomorrow?',
                    [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes, Cancel', style: 'destructive', onPress: cancelScheduledNextDailyBudget },
                    ]
                  );
                }}
                hitSlop={8}
              >
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
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
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
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
    marginBottom: 6,
  },
  heroTitleWrap: {
    justifyContent: 'center',
  },
  heroSub: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.nano,
  },
  heroTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmountBlock: {
    marginTop: Spacing.nano,
    marginBottom: Spacing.block,
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
    fontSize: 11,
    fontFamily: FontFamily.medium,
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

  // Today's Allowance Card
  todayCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  todayDateText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.nano,
  },
  todayTitleText: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: Spacing.micro,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
  },
  todayNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.nano,
    marginBottom: Spacing.group,
  },
  todayNumberBlock: {
    justifyContent: 'center',
  },
  todayNumberLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.nano,
  },
  smallCurrencySymbol: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    marginRight: 3,
  },
  todayMainNumber: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
  },
  todaySubNumbers: {
    alignItems: 'flex-end',
    marginBottom: Spacing.nano,
  },
  subNumberSpent: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    marginBottom: 1,
  },
  subNumberBudget: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },

  // Progress Bar
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },

  // Scheduled Banner
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.element,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: Spacing.element,
  },
  scheduledBannerTitle: {
    fontSize: FontSize.bodySmall,
  },
  scheduledBannerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },

  // Settings Card
  settingsCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: Spacing.block,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  settingsTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
  },
  settingsDesc: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 17,
    marginBottom: 10,
  },
  changeAmountBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.group,
    borderRadius: 14,
    borderWidth: 1,
  },
  changeAmountSub: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.nano,
  },
  changeAmountText: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
  },
  editPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  editPillText: {
    fontSize: 11,
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
    height: 42,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    marginTop: Spacing.group,
  },
  depositCtaBtnText: {
    fontSize: FontSize.body,
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
