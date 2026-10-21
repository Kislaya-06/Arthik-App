import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppRefreshControl } from '../components/AppRefreshControl';
import { StatusBar } from 'expo-status-bar';
import { AmbientBackground } from '../components/AmbientBackground';
import { useFocusEffect, useIsFocused, useScrollToTop } from '@react-navigation/native';
import { useNavBarContentInset } from '../hooks/useNavBarMetrics';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  TrendingUp, TrendingDown,
  ChevronRight, ChevronDown, ChevronUp,
  ShoppingBag, Sparkles, Flame,
} from 'lucide-react-native';
import {
  parseISO, format,
} from 'date-fns';
import {
  Period,
  CHART_COLORS,
  MAX_NAV_DOTS,
  buildInterval,
  buildDateLabel,
  computeMinOffset,
} from './insights/periodUtils';
import { PeriodNavigator, PeriodNavigatorProps } from './insights/PeriodNavigator';
import { styles } from './insights/InsightsScreen.styles';
import { useInsightsData } from './insights/useInsightsData';

import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useAuthStore } from '../store/authStore';
import { TabParamList, RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontFamily, ControlHeight } from '../config/theme';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { AnimatedCategoryDonut } from '../components/AnimatedCategoryDonut';
import { SpendingFlowChart } from '../components/SpendingFlowChart';
import { CashFlowChart } from '../components/CashFlowChart';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { AmountText } from '../components/ui/AmountText';
import { AppButton } from '../components/ui/AppButton';
import { YearlySavingsMilestoneCard } from '../components/YearlySavingsMilestoneCard';
import { WeeklyBreathingStrip } from '../components/WeeklyBreathingStrip';
import { MonthlyBreathingStrip } from '../components/MonthlyBreathingStrip';
import { YearlyBreathingStrip } from '../components/YearlyBreathingStrip';
import { YearlyCashFlowChart } from '../components/YearlyCashFlowChart';
import { BehavioralInsightRow } from '../components/BehavioralInsightRow';
import { getCategoryIcon } from '../lib/iconUtils';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Insights'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type { Period, PeriodNavigatorProps };
export { CHART_COLORS, MAX_NAV_DOTS, buildInterval, buildDateLabel, computeMinOffset, PeriodNavigator };

// Contract pinned by tests/uiPrimitiveParity.test.ts (PeriodNavigator dotsRow geometry, defined in ./insights/PeriodNavigator):
// dotsRow: { marginTop: Spacing.element }

// ─── Main Screen ───────────────────────────────────────────────────────────────

export const InsightsScreen: React.FC<Props> = ({ navigation }) => {
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount);
  const user = useAuthStore((s) => s.user);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();
  const isFocused = useIsFocused();
  // Bottom padding follows the responsive nav bar; tapping the active Insights tab scrolls back to the top.
  const navBarInset = useNavBarContentInset();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const [period, setPeriod] = useState<Period>('Weekly');
  // offset=0 → current period, negative → how many periods back
  const [offset, setOffset] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [focusTime, setFocusTime] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const lastFetchTime = useRef<number>(0);
  const lastDayRef = useRef<string>(format(new Date(), 'yyyy-MM-dd'));

  // Reset category expansion whenever period or offset changes
  useEffect(() => {
    setShowAllCategories(false);
  }, [period, offset]);

  // Reset to current period when the user switches period type (Weekly/Monthly/Yearly)
  const handlePeriodChange = useCallback((p: Period) => {
    setPeriod(p);
    setOffset(0);
    setSelectedCategoryId(null);
    setShowAllCategories(false);
  }, []);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    const today = format(now, 'yyyy-MM-dd');
    if (today !== lastDayRef.current) {
      lastDayRef.current = today;
      setFocusTime(now);
    }
    if (!force && now - lastFetchTime.current < 60_000) return;
    lastFetchTime.current = now;
    await Promise.all([fetchExpenses(), fetchCategories()]);
  }, [fetchExpenses, fetchCategories]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const {
    minOff,
    currentInterval,
    periodLabel,
    dateLabel,
    subLabel,
    dotCount,
    activeDotIndex,
    currentTotal,
    sortedCategories,
    topCategory,
    weeklyData,
    maxWeekDay,
    monthlyCashFlowData,
    yearlyGullakMetrics,
    sideCategories,
    bottomCategories,
    yearlyDailyBurn,
    heroTrend,
    budgetHealth,
    elapsedDaysInWeek,
    monthlyRemainingDays,
    monthlyBudgetHealth,
    currentPeriodIncome,
    activeBudgetPool,
    safeDailyPace,
    monthlySafeDailyPace,
    weeklyGullak,
    weeklyMonthlyBudgetShare,
    weekTransactionCount,
    smartTakeaway,
    largestOutflow,
    weekdayWeekendDynamics,
    peakDaysSubtitle,
    monthlyDailyBurnPace,
    monthlyGullakSavings,
    monthlyLargestOutflow,
    monthlyCategoryShift,
    monthlyPeakWeek,
    monthTransactionCount,
    smartMonthlyTakeaway,
    yearlyInflow,
    yearlyNetCashFlow,
    yearlySavingsRate,
    yearlyCashFlowData,
    smartYearlyTakeaway,
    annualBudgetDiscipline,
    yearlyCapitalOutlier,
    yearlyCategoryTrajectory,
    yearTransactionCount,
    gullakDepositsInYearCount,
    hasPrevData,
  } = useInsightsData({
    period,
    offset,
    expenses,
    categories,
    dailyRecords,
    gullakDeposits,
    isBudgetModeEnabled,
    budgetPeriods,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    totalAccumulatedSavings,
    selectedCategoryId,
    focusTime,
    user,
  });

  // ─── Swipe gesture on hero card (horizontal swipe = period nav) ───────────
  const navBoundsRef = useRef({ offset, minOff });
  navBoundsRef.current = { offset, minOff };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Only claim the gesture if horizontal movement clearly dominates vertical
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        const { offset: curOffset, minOff: curMinOff } = navBoundsRef.current;
        if (gs.dx < -40 && curOffset < 0) {
          // Swipe left → go forward in time (toward current)
          setSelectedCategoryId(null);
          setOffset((o) => Math.min(o + 1, 0));
        } else if (gs.dx > 40 && curOffset > curMinOff) {
          // Swipe right → go back in time
          setSelectedCategoryId(null);
          setOffset((o) => Math.max(o - 1, curMinOff));
        }
      },
    })
  ).current;

  const { width: windowWidth } = useWindowDimensions();

  // Responsively scale donut size to guarantee zero-clipping on all viewport widths (320dp - 430dp+)
  const donutSize = useMemo(() => {
    const availableContentWidth = windowWidth - Spacing.gutter * 2;
    // Allocate ~42-44% of available row space to the donut, safely clamped between 126dp and 156dp
    const computed = Math.round((availableContentWidth - 14) * 0.44);
    return Math.min(156, Math.max(126, computed));
  }, [windowWidth]);

  const donutStroke = useMemo(() => {
    return Math.min(22, Math.max(18, Math.round(donutSize * 0.14)));
  }, [donutSize]);

  const handleCategoryPress = useCallback((catId: string) => {
    if (selectedCategoryId === catId) {
      navigation.navigate('CategoryDetail', {
        categoryId: catId,
        startDate: format(currentInterval.start, 'yyyy-MM-dd'),
        endDate: format(currentInterval.end, 'yyyy-MM-dd'),
        dateRangeLabel: dateLabel,
      });
    } else {
      setSelectedCategoryId(catId);
    }
  }, [selectedCategoryId, navigation, currentInterval, dateLabel]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <AmbientBackground />
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: navBarInset }]}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        {/* ── Header Row ── */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            Insights
          </Text>
          <View style={{ flex: 1, marginLeft: Spacing.group }}>
            <SegmentedControl
              options={['Weekly', 'Monthly', 'Yearly']}
              selectedKey={period}
              onChange={(key) => handlePeriodChange(key as Period)}
              commitOnSettle
              height={ControlHeight.standard}
            />
          </View>
        </View>

        {/* ── Total Spend Hero Card (swipeable) ── */}
        <View
          {...panResponder.panHandlers}
          style={[
            styles.heroCard,
            {
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(60, 35, 35, 0.10)',
            },
          ]}
        >
          {/* Gradient Background */}
          <View style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.cardLarge, overflow: 'hidden' }]}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="heroGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#F07167" />
                  <Stop offset="100%" stopColor="#FED0A8" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#heroGradient)" />
            </Svg>
          </View>

          {/* Decorative background circles */}
          <View style={[styles.heroCircle1, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]} />
          <View style={[styles.heroCircle2, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]} />

          <Text
            style={styles.heroLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {periodLabel}
          </Text>

          <View style={styles.heroAmountRow}>
            <AmountText
              role="hero"
              value={currentTotal}
              color="#2D1E1E"
              showDecimals={currentTotal % 1 !== 0}
              rolling
              rollOnFocus
            />
          </View>

          {/* Integrated Budget Progress & Pool Context (Weekly & Monthly in Budget Mode) */}
          {isBudgetModeEnabled && activeBudgetPool && activeBudgetPool.baseBudget > 0 && (
            <View style={styles.heroProgressSection}>
              <View style={styles.heroProgressTrack}>
                <View
                  style={[
                    styles.heroProgressFill,
                    {
                      width: `${Math.round(activeBudgetPool.progressRatio * 100)}%`,
                      backgroundColor: activeBudgetPool.isOver ? '#D32F2F' : '#3E2723',
                    },
                  ]}
                />
              </View>

              <Text style={[styles.heroProgressText, { fontFamily: FontFamily.medium }]} numberOfLines={2}>
                {activeBudgetPool.statusText}
              </Text>
            </View>
          )}

          <View style={styles.heroComparisonRow}>
            <View style={styles.trendBadge}>
              {heroTrend.percentageChange !== null ? (
                heroTrend.isIncrease
                  ? <TrendingUp size={12} color="#3E2723" />
                  : <TrendingDown size={12} color="#3E2723" />
              ) : null}
              <Text style={[
                styles.trendText,
                { color: '#3E2723' },
              ]}>
                {heroTrend.trendLabel}
              </Text>
            </View>
            {period === 'Monthly' && monthlyDailyBurnPace > 0 && (
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(60, 35, 35, 0.06)' }]}>
                <Text style={[styles.trendText, { color: '#3E2723' }]}>
                  ₹{monthlyDailyBurnPace}/day avg
                </Text>
              </View>
            )}
            {period === 'Yearly' && yearlyDailyBurn > 0 && (
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(60, 35, 35, 0.06)' }]}>
                <Text style={[styles.trendText, { color: '#3E2723' }]}>
                  ₹{formatAmountWithCommas(String(yearlyDailyBurn))}/day avg
                </Text>
              </View>
            )}
          </View>

          {/* Period navigator: arrows + date label + pagination dots */}
          <PeriodNavigator
            key={period}
            dateLabel={dateLabel}
            subLabel={subLabel}
            offset={offset}
            minOffset={minOff}
            dotCount={dotCount}
            activeDotIndex={activeDotIndex}
            hasPrevData={hasPrevData}
            onPrev={() => {
              setSelectedCategoryId(null);
              setOffset((o) => Math.max(o - 1, minOff));
            }}
            onNext={() => {
              setSelectedCategoryId(null);
              setOffset((o) => Math.min(o + 1, 0));
            }}
          />
        </View>

        {/* ── Weekly Breathing Strip (Dual Clean Tiles) ── */}
        {period === 'Weekly' && (
          <View style={{ marginTop: Spacing.surface }}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textPrimary, fontFamily: FontFamily.bold, marginTop: 0 },
              ]}
            >
              {offset === 0 ? 'Till Now This Week' : 'Week Summary'}
            </Text>
            <WeeklyBreathingStrip
              takeaway={smartTakeaway}
              isBudgetMode={isBudgetModeEnabled}
              safeDailyPace={safeDailyPace}
              isCurrentWeek={offset === 0}
              remainingDays={Math.max(0, 7 - elapsedDaysInWeek)}
              transactionCount={weekTransactionCount}
              totalWeekSavings={weeklyGullak.totalSaved}
              savedDaysCount={weeklyGullak.savedDaysCount}
              addedIncome={currentPeriodIncome}
              isOverBudget={activeBudgetPool ? activeBudgetPool.isOver : budgetHealth.isOverBudget}
              weeklyDailyBurnPace={Math.round(currentTotal / Math.max(1, elapsedDaysInWeek))}
              budgetCadence={budgetCadence}
              savedPillLabel={weeklyGullak.pillLabel}
              monthlyBudgetShare={weeklyMonthlyBudgetShare}
              onPressSavings={() => {
                navigation.navigate('Savings');
              }}
            />
          </View>
        )}

        {/* ── Monthly Financial Breathing Strip (Dual Clean Tiles) ── */}
        {period === 'Monthly' && (
          <View style={{ marginTop: Spacing.surface }}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textPrimary, fontFamily: FontFamily.bold, marginTop: 0 },
              ]}
            >
              {offset === 0 ? 'Till Now This Month' : 'Month Summary'}
            </Text>
            <MonthlyBreathingStrip
              takeaway={smartMonthlyTakeaway}
              isBudgetMode={isBudgetModeEnabled}
              safeDailyPace={monthlySafeDailyPace}
              isCurrentMonth={offset === 0}
              remainingDays={monthlyRemainingDays}
              transactionCount={monthTransactionCount}
              totalMonthSavings={monthlyGullakSavings.totalSaved}
              savedDaysCount={monthlyGullakSavings.savedDaysCount}
              savedPillLabel={monthlyGullakSavings.pillLabel}
              addedIncome={currentPeriodIncome}
              isOverBudget={activeBudgetPool ? activeBudgetPool.isOver : monthlyBudgetHealth.isOverBudget}
              monthlyDailyBurnPace={monthlyDailyBurnPace}
              onPressSavings={() => {
                navigation.navigate('Savings');
              }}
            />
          </View>
        )}

        {/* ── Yearly Financial Breathing Strip (Dual Clean Tiles) ── */}
        {period === 'Yearly' && (
          <View style={{ marginTop: Spacing.surface }}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textPrimary, fontFamily: FontFamily.bold, marginTop: 0 },
              ]}
            >
              {offset === 0 ? 'Till Now This Year' : 'Year Summary'}
            </Text>
            <YearlyBreathingStrip
              takeaway={smartYearlyTakeaway}
              netCashFlow={yearlyNetCashFlow.netCashFlow}
              isSurplus={yearlyNetCashFlow.isSurplus}
              totalInflow={yearlyInflow}
              totalOutflow={currentTotal}
              totalYearSavings={yearlyGullakMetrics?.totalSavedInYear || 0}
              savingsRate={yearlySavingsRate}
              savedDaysCount={yearlyGullakMetrics?.savedDaysCount || 0}
              isCurrentYear={offset === 0}
              transactionCount={yearTransactionCount}
              isBudgetMode={isBudgetModeEnabled}
              onPressSavings={() => {
                navigation.navigate('Savings');
              }}
            />
          </View>
        )}

        {/* ── Weekly Spending Flow Section ── */}
        {period === 'Weekly' && (
          <SpendingFlowChart
            title="Spending Flow"
            data={weeklyData}
            maxDay={maxWeekDay}
            isDark={isDark}
            colors={colors}
            subTitle={peakDaysSubtitle}
            onDayPress={(d) => {
              navigation.navigate('History', { targetDate: d.dateStr });
            }}
            triggerKey={`${period}_${offset}`}
          />
        )}

        {/* ── Monthly Dual-Bar Cash Flow Section (Money In vs Money Out) ── */}
        {period === 'Monthly' && (
          <CashFlowChart
            title="Cash Flow"
            subTitle={monthlyPeakWeek.text || format(currentInterval.start, 'MMMM yyyy')}
            data={monthlyCashFlowData.weeks}
            maxAmount={monthlyCashFlowData.maxAmount}
            totalIncome={monthlyCashFlowData.totalIncome}
            totalSpent={monthlyCashFlowData.totalSpent}
            isDark={isDark}
            colors={colors}
            onWeekPress={(week) => {
              navigation.navigate('History', {
                targetDate: week.dateStr,
                startDate: week.startDate,
                endDate: week.endDate,
              });
            }}
            triggerKey={`${period}_${offset}`}
          />
        )}

        {/* ── Yearly 12-Month Cash Flow Section ── */}
        {period === 'Yearly' && (
          <View>
            <YearlyCashFlowChart
              title="12-Month Cash Flow"
              subTitle={yearlyCashFlowData.chartSubtitle}
              months={yearlyCashFlowData.months}
              maxAmount={yearlyCashFlowData.maxAmount}
              totalIncome={yearlyCashFlowData.totalIncome}
              totalSpent={yearlyCashFlowData.totalSpent}
              isDark={isDark}
              colors={colors}
              onMonthPress={(month) => {
                navigation.navigate('History', {
                  targetDate: month.dateStr,
                  startDate: month.startDate,
                  endDate: month.endDate,
                });
              }}
              triggerKey={`${period}_${offset}`}
            />

            {/* Annual Budget Discipline (Completed Months Only) */}
            {annualBudgetDiscipline.canDisplay && (
              <View style={styles.disciplineContainer}>
                <Sparkles size={14} color={colors.mintGreen} />
                <Text style={[styles.disciplineText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  {annualBudgetDiscipline.disciplineText}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── By Category Section ── */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          By Category
        </Text>

        {currentTotal > 0 ? (
          <>
            {/* Top row: Donut on Left, up to 4 categories stacked on Right */}
            <View style={styles.byCategoryRow}>
              {/* Donut chart on left */}
              <View style={[styles.donutLeftContainer, { width: donutSize, height: donutSize }]}>
                <AnimatedCategoryDonut
                  categories={sortedCategories}
                  totalAmount={currentTotal}
                  topCategory={topCategory}
                  palette={CHART_COLORS}
                  size={donutSize}
                  strokeWidth={donutStroke}
                  isDark={isDark}
                  textColorPrimary={colors.textPrimary}
                  textColorSecondary={colors.textSecondary}
                  triggerKey={`${period}_${offset}`}
                  isFocused={isFocused}
                  selectedId={selectedCategoryId}
                  onSelectCategory={setSelectedCategoryId}
                />
              </View>

              {/* Stacked Categories on the Right */}
              <View style={styles.categoryStackRight}>
                {sideCategories.map((seg) => {
                  const isSelected = selectedCategoryId === seg.id;
                  const isAnySelected = selectedCategoryId !== null;
                  const rowOpacity = isSelected ? 1 : isAnySelected ? 0.35 : 1;

                  return (
                    <Pressable
                      key={seg.id}
                      style={[
                        styles.categoryStackItem,
                        { opacity: rowOpacity },
                        isSelected && {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          marginHorizontal: -8,
                        },
                      ]}
                      onPress={() => handleCategoryPress(seg.id)}
                    >
                      <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                      <View style={styles.categoryStackTextWrapper}>
                        <Text
                          style={[styles.categoryStackName, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
                          numberOfLines={1}
                        >
                          {seg.name}
                        </Text>
                        <Text
                          style={[styles.categoryStackSubtext, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}
                          numberOfLines={1}
                        >
                          {formatCurrency(seg.amount)} · {seg.percentage}%
                        </Text>
                      </View>
                      {isSelected && (
                        <ChevronRight size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Overflow Categories: Progressive Disclosure for Weekly & Monthly */}
            {(period === 'Weekly' || period === 'Monthly') && bottomCategories.length > 0 && (
              <Pressable
                style={styles.expandCategoriesBtn}
                onPress={() => setShowAllCategories((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                accessibilityRole="button"
                accessibilityLabel={
                  showAllCategories
                    ? 'Show less categories'
                    : `View ${bottomCategories.length} more ${bottomCategories.length === 1 ? 'category' : 'categories'}`
                }
              >
                <Text style={[styles.expandCategoriesText, { color: colors.mintGreen, fontFamily: FontFamily.bold }]}>
                  {showAllCategories
                    ? 'Show less'
                    : `+ View ${bottomCategories.length} more ${bottomCategories.length === 1 ? 'category' : 'categories'}`}
                </Text>
                {showAllCategories ? (
                  <ChevronUp size={14} color={colors.mintGreen} />
                ) : (
                  <ChevronDown size={14} color={colors.mintGreen} />
                )}
              </Pressable>
            )}

            {/* Expanded categories (when showAllCategories is true and bottomCategories exist) */}
            {showAllCategories && bottomCategories.length > 0 && (
              <View style={styles.legendGrid}>
                {bottomCategories.map((seg) => {
                  const isSelected = selectedCategoryId === seg.id;
                  const isAnySelected = selectedCategoryId !== null;
                  const rowOpacity = isSelected ? 1 : isAnySelected ? 0.35 : 1;

                  return (
                    <Pressable
                      key={seg.id}
                      style={[
                        styles.legendItem,
                        { opacity: rowOpacity },
                        isSelected && {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                          borderRadius: 8,
                          paddingHorizontal: 6,
                          paddingVertical: 4,
                        },
                      ]}
                      onPress={() => handleCategoryPress(seg.id)}
                    >
                      <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.legendName, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
                          numberOfLines={1}
                        >
                          {seg.name}
                        </Text>
                        <Text
                          style={[styles.legendSubtext, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}
                          numberOfLines={1}
                        >
                          {formatCurrency(seg.amount)} · {seg.percentage}%
                        </Text>
                      </View>
                      {isSelected && (
                        <ChevronRight size={14} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* ── Behavioral Insights (Weekly, Monthly & Yearly) ── */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Behavioral Insights
            </Text>

            {period === 'Weekly' ? (
              <View style={styles.behavioralInsightsList}>
                {largestOutflow && (
                  <BehavioralInsightRow
                    icon={largestOutflow.categoryIcon ? getCategoryIcon(largestOutflow.categoryIcon) : ShoppingBag}
                    badgeColor={largestOutflow.categoryColor}
                    title="LARGEST SINGLE PURCHASE"
                    headline={`${formatCurrency(largestOutflow.expense.amount)} · ${largestOutflow.expense.notes || largestOutflow.categoryName}`}
                    detail={
                      largestOutflow.expense.notes && largestOutflow.expense.notes.trim() !== largestOutflow.categoryName
                        ? `${format(parseISO(largestOutflow.expense.expense_date.split('T')[0]), 'EEEE, d MMM')} · ${largestOutflow.categoryName}`
                        : format(parseISO(largestOutflow.expense.expense_date.split('T')[0]), 'EEEE, d MMM')
                    }
                    pillText={largestOutflow.shouldShowPill ? `${largestOutflow.outflowPercent}% of week` : null}
                    pillColor={isDark ? '#F5A97F' : '#E06D53'}
                    onPress={() => {
                      navigation.navigate('ExpenseDetail', { expenseId: largestOutflow.expense.id });
                    }}
                    accessibilityLabel={`Largest single purchase: ${formatCurrency(largestOutflow.expense.amount)} for ${largestOutflow.expense.notes || largestOutflow.categoryName} on ${format(parseISO(largestOutflow.expense.expense_date.split('T')[0]), 'EEEE, d MMM')}. ${largestOutflow.shouldShowPill ? `Represents ${largestOutflow.outflowPercent}% of weekly spend.` : ''}`}
                  />
                )}

                {weekdayWeekendDynamics && (
                  <BehavioralInsightRow
                    icon={weekdayWeekendDynamics.mode === 'weekend_split' ? Sparkles : Flame}
                    badgeColor={weekdayWeekendDynamics.mode === 'weekend_split' ? '#84DCC6' : '#FED9B7'}
                    title={weekdayWeekendDynamics.title}
                    headline={weekdayWeekendDynamics.headline}
                    detail={weekdayWeekendDynamics.detail}
                    pillText={weekdayWeekendDynamics.pillText}
                    pillColor={colors.mintGreen}
                    accessibilityLabel={`${weekdayWeekendDynamics.title}: ${weekdayWeekendDynamics.headline}. ${weekdayWeekendDynamics.detail}. ${weekdayWeekendDynamics.pillText}`}
                  />
                )}
              </View>
            ) : period === 'Monthly' ? (
              <View style={styles.behavioralInsightsList}>
                {monthlyLargestOutflow && (
                  <BehavioralInsightRow
                    icon={monthlyLargestOutflow.categoryIcon ? getCategoryIcon(monthlyLargestOutflow.categoryIcon) : ShoppingBag}
                    badgeColor={monthlyLargestOutflow.categoryColor}
                    title="LARGEST SINGLE PURCHASE"
                    headline={`${formatCurrency(monthlyLargestOutflow.expense.amount)} · ${monthlyLargestOutflow.expense.notes || monthlyLargestOutflow.categoryName}`}
                    detail={
                      monthlyLargestOutflow.expense.notes && monthlyLargestOutflow.expense.notes.trim() !== monthlyLargestOutflow.categoryName
                        ? `${format(parseISO(monthlyLargestOutflow.expense.expense_date.split('T')[0]), 'EEEE, d MMM')} · ${monthlyLargestOutflow.categoryName}`
                        : format(parseISO(monthlyLargestOutflow.expense.expense_date.split('T')[0]), 'EEEE, d MMM')
                    }
                    pillText={monthlyLargestOutflow.shouldShowPill ? `${monthlyLargestOutflow.outflowPercent}% of month` : null}
                    pillColor={isDark ? '#F5A97F' : '#E06D53'}
                    onPress={() => {
                      navigation.navigate('ExpenseDetail', { expenseId: monthlyLargestOutflow.expense.id });
                    }}
                    accessibilityLabel={`Largest single purchase: ${formatCurrency(monthlyLargestOutflow.expense.amount)} for ${monthlyLargestOutflow.expense.notes || monthlyLargestOutflow.categoryName} on ${format(parseISO(monthlyLargestOutflow.expense.expense_date.split('T')[0]), 'EEEE, d MMM')}. ${monthlyLargestOutflow.shouldShowPill ? `Represents ${monthlyLargestOutflow.outflowPercent}% of monthly spend.` : ''}`}
                  />
                )}

                {monthlyCategoryShift && (
                  monthlyCategoryShift.mode === 'category_shift' ? (
                    <BehavioralInsightRow
                      icon={monthlyCategoryShift.isIncrease ? TrendingUp : TrendingDown}
                      badgeColor={monthlyCategoryShift.isIncrease ? (isDark ? '#F59682' : '#E06D53') : (isDark ? '#7CD49A' : '#3DA862')}
                      title={monthlyCategoryShift.isIncrease ? 'LARGEST SPENDING INCREASE' : 'LARGEST SPENDING DROP'}
                      headline={`${monthlyCategoryShift.isIncrease ? '+' : '−'}${formatCurrency(monthlyCategoryShift.absDelta)} in ${monthlyCategoryShift.categoryName}`}
                      detail={`${monthlyCategoryShift.shiftPercent}% vs ${offset === 0 ? 'same days last month' : 'last month'} · Total ${formatCurrency(monthlyCategoryShift.currentAmount)}`}
                      pillText={`${monthlyCategoryShift.isIncrease ? '+' : '−'}${monthlyCategoryShift.shiftPercent}%`}
                      pillColor={monthlyCategoryShift.isIncrease ? (isDark ? '#F5A97F' : '#E06D53') : colors.mintGreen}
                      onPress={() => {
                        navigation.navigate('CategoryDetail', { categoryId: monthlyCategoryShift.categoryId });
                      }}
                      accessibilityLabel={`Category shift: ${monthlyCategoryShift.categoryName} ${monthlyCategoryShift.isIncrease ? 'increased' : 'decreased'} by ${formatCurrency(monthlyCategoryShift.absDelta)}, ${monthlyCategoryShift.shiftPercent}% vs ${offset === 0 ? 'same days last month' : 'last month'}.`}
                    />
                  ) : (
                    <BehavioralInsightRow
                      icon={monthlyCategoryShift.categoryIcon ? getCategoryIcon(monthlyCategoryShift.categoryIcon) : ShoppingBag}
                      badgeColor={monthlyCategoryShift.categoryColor}
                      title="PRIMARY EXPENSE DRIVER"
                      headline={`${monthlyCategoryShift.categoryName} · ${formatCurrency(monthlyCategoryShift.currentAmount)}`}
                      detail={`Across ${monthlyCategoryShift.txnCount} ${monthlyCategoryShift.txnCount === 1 ? 'transaction' : 'transactions'} this month`}
                      pillText={`${monthlyCategoryShift.percentageOfTotal}% of month`}
                      pillColor={colors.mintGreen}
                      onPress={() => {
                        navigation.navigate('CategoryDetail', { categoryId: monthlyCategoryShift.categoryId });
                      }}
                      accessibilityLabel={`Primary expense driver: ${monthlyCategoryShift.categoryName}, ${formatCurrency(monthlyCategoryShift.currentAmount)}, representing ${monthlyCategoryShift.percentageOfTotal}% of monthly spend across ${monthlyCategoryShift.txnCount} transactions.`}
                    />
                  )
                )}
              </View>
            ) : (
              <View style={styles.behavioralInsightsList}>
                {yearlyCapitalOutlier && (
                  <BehavioralInsightRow
                    icon={yearlyCapitalOutlier.categoryIcon ? getCategoryIcon(yearlyCapitalOutlier.categoryIcon) : ShoppingBag}
                    badgeColor={yearlyCapitalOutlier.categoryColor}
                    title="LARGEST SINGLE PURCHASE"
                    headline={`${formatCurrency(yearlyCapitalOutlier.expense.amount)} · ${yearlyCapitalOutlier.expense.notes || yearlyCapitalOutlier.categoryName}`}
                    detail={
                      yearlyCapitalOutlier.expense.notes && yearlyCapitalOutlier.expense.notes.trim() !== yearlyCapitalOutlier.categoryName
                        ? `${format(parseISO(yearlyCapitalOutlier.expense.expense_date.split('T')[0]), 'EEEE, d MMM yyyy')} · ${yearlyCapitalOutlier.categoryName}`
                        : format(parseISO(yearlyCapitalOutlier.expense.expense_date.split('T')[0]), 'EEEE, d MMM yyyy')
                    }
                    pillText={`${yearlyCapitalOutlier.outflowPercent}% of year`}
                    pillColor={isDark ? '#F5A97F' : '#E06D53'}
                    onPress={() => {
                      navigation.navigate('ExpenseDetail', { expenseId: yearlyCapitalOutlier.expense.id });
                    }}
                    accessibilityLabel={`Largest single purchase of the year: ${formatCurrency(yearlyCapitalOutlier.expense.amount)} for ${yearlyCapitalOutlier.expense.notes || yearlyCapitalOutlier.categoryName} on ${format(parseISO(yearlyCapitalOutlier.expense.expense_date.split('T')[0]), 'EEEE, d MMM yyyy')}. Represents ${yearlyCapitalOutlier.outflowPercent}% of annual spend.`}
                  />
                )}

                {yearlyCategoryTrajectory && (
                  yearlyCategoryTrajectory.mode === 'category_shift' ? (
                    <BehavioralInsightRow
                      icon={yearlyCategoryTrajectory.isIncrease ? TrendingUp : TrendingDown}
                      badgeColor={yearlyCategoryTrajectory.isIncrease ? (isDark ? '#F59682' : '#E06D53') : (isDark ? '#7CD49A' : '#3DA862')}
                      title={yearlyCategoryTrajectory.isIncrease ? 'LARGEST H2 SPEND INCREASE' : 'LARGEST H2 SPEND DROP'}
                      headline={`${yearlyCategoryTrajectory.isIncrease ? '+' : '−'}${formatCurrency(yearlyCategoryTrajectory.absDelta)} in ${yearlyCategoryTrajectory.categoryName}`}
                      detail={`${yearlyCategoryTrajectory.shiftPercent}% shift vs H1 · Total ${formatCurrency(yearlyCategoryTrajectory.annualAmount)}`}
                      pillText={`${yearlyCategoryTrajectory.isIncrease ? '+' : '−'}${yearlyCategoryTrajectory.shiftPercent}%`}
                      pillColor={yearlyCategoryTrajectory.isIncrease ? (isDark ? '#F5A97F' : '#E06D53') : colors.mintGreen}
                      onPress={() => {
                        navigation.navigate('CategoryDetail', { categoryId: yearlyCategoryTrajectory.categoryId });
                      }}
                      accessibilityLabel={`Annual category shift: ${yearlyCategoryTrajectory.categoryName} ${yearlyCategoryTrajectory.isIncrease ? 'accelerated' : 'dropped'} by ${formatCurrency(yearlyCategoryTrajectory.absDelta)} in H2, ${yearlyCategoryTrajectory.shiftPercent}% shift vs H1.`}
                    />
                  ) : (
                    <BehavioralInsightRow
                      icon={yearlyCategoryTrajectory.categoryIcon ? getCategoryIcon(yearlyCategoryTrajectory.categoryIcon) : ShoppingBag}
                      badgeColor={yearlyCategoryTrajectory.categoryColor}
                      title="PRIMARY EXPENSE DRIVER"
                      headline={`${yearlyCategoryTrajectory.categoryName} · ${formatCurrency(yearlyCategoryTrajectory.annualAmount)}`}
                      detail={`Across ${yearlyCategoryTrajectory.txnCount} ${yearlyCategoryTrajectory.txnCount === 1 ? 'transaction' : 'transactions'} this year`}
                      pillText={`${yearlyCategoryTrajectory.percentageOfTotal}% of year`}
                      pillColor={colors.mintGreen}
                      onPress={() => {
                        navigation.navigate('CategoryDetail', { categoryId: yearlyCategoryTrajectory.categoryId });
                      }}
                      accessibilityLabel={`Primary expense driver: ${yearlyCategoryTrajectory.categoryName}, ${formatCurrency(yearlyCategoryTrajectory.annualAmount)}, representing ${yearlyCategoryTrajectory.percentageOfTotal}% of annual spend across ${yearlyCategoryTrajectory.txnCount} transactions.`}
                    />
                  )
                )}
              </View>
            )}

            {/* ── Yearly Savings & Gullak Milestones Section (Climax) ── */}
            {period === 'Yearly' && yearlyGullakMetrics && (yearlyGullakMetrics.totalSavedInYear > 0 || gullakDepositsInYearCount > 0) && (
              <View>
                <YearlySavingsMilestoneCard
                  metrics={yearlyGullakMetrics}
                  yearLabel={format(currentInterval.start, 'yyyy')}
                  isDark={isDark}
                  colors={colors}
                  isBudgetMode={isBudgetModeEnabled}
                  depositCount={gullakDepositsInYearCount}
                  onOpenSavings={() => navigation.navigate('Savings')}
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              Log an expense or income to unlock your spending breakdown.
            </Text>
            <AppButton
              label="Add Transaction"
              size="compact"
              onPress={() => navigation.navigate('AddExpense')}
              style={styles.emptyStateCta}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export { styles };

// Contract pinned by tests/uiPrimitiveParity.test.ts (defined in ./insights/useInsightsData and ./insights/InsightsScreen.styles):
// Total Spent This Month
// Total Spent This Week
// Total Spent This Year
// heroCard: { paddingBottom: Spacing.gutter, borderRadius: BorderRadius.cardLarge, overflow: 'hidden' }
// heroLabel: { fontSize: FontSize.body, fontFamily: FontFamily.bold }
