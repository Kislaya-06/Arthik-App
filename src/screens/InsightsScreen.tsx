import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, PanResponder, Animated, Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Polyline, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  TrendingUp, TrendingDown, CheckSquare, Wallet, CreditCard,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  ShoppingBag, Sparkles, Flame,
} from 'lucide-react-native';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subWeeks, subMonths, subYears, addDays, differenceInCalendarDays,
  isWithinInterval, isBefore, startOfDay, parseISO, format,
  isSameMonth, isSameYear,
} from 'date-fns';

import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useAuthStore } from '../store/authStore';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { TabParamList, RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight, CATEGORY_PALETTE } from '../config/theme';
import { formatCurrency, formatAmountWithCommas, round2 } from '../lib/formatters';
import { GradientIconBadge } from '../components/GradientIconBadge';
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
import { computeMonthlyCashFlowData, computeYearlyGullakMilestones } from '../lib/chartUtils';
import {
  computeEffectiveWeekBudget,
  computeBudgetHealth,
  computeSafeDailyPace,
  computeWeeklyGullakSavings,
  computeSmartWeeklyTakeaway,
  computeLargestSingleOutflow,
  computeWeekdayVsWeekendDynamics,
  computeDayMatchedPreviousComparison,
  computePeakDaysSubtitle,
} from '../lib/weeklyInsightsUtils';
import {
  computeMonthlyComparison,
  computeEffectiveMonthBudget,
  computeMonthlyBudgetHealth,
  computeMonthlySafeDailyPace,
  computeMonthlyGullakSavings,
  computeMonthlyLargestOutflow,
  computeMonthlyCategoryShift,
  computeMonthlyPeakWeek,
  computeSmartMonthlyTakeaway,
} from '../lib/monthlyInsightsUtils';
import {
  computeActiveDaysInYear,
  computeAnnualDailyBurn,
  computeYearlyComparison,
  computeYearlyInflow,
  computeAnnualNetCashFlow,
  computeAnnualSavingsRate,
  computeSmartYearlyTakeaway,
  compute12MonthCashFlow,
  computeAnnualBudgetDiscipline,
  computeAnnualCapitalOutlier,
  computeAnnualCategoryTrajectory,
} from '../lib/yearlyInsightsUtils';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Insights'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Period = 'Weekly' | 'Monthly' | 'Yearly';

const CHART_COLORS = CATEGORY_PALETTE;

// Max dots shown in the navigator — prevents visual clutter for long-time users
const MAX_NAV_DOTS = 5;

// ─── Pure helpers ──────────────────────────────────────────────────────────────

const getCategoryInsightIcon = (name: string) => {
  const n = name.toLowerCase();
  return (n.includes('food') || n.includes('eat')) ? Wallet : (n.includes('card') || n.includes('credit')) ? CreditCard : CheckSquare;
};

const getPaymentInsightIcon = (mode: string) => mode === 'card' ? CreditCard : mode === 'cash' ? Wallet : CheckSquare;

/**
 * Returns the date interval (start/end) for a period shifted by `offset` steps from today.
 * offset=0 → current period, offset=-1 → previous period, offset=-2 → two periods back, etc.
 */
function buildInterval(period: Period, offset: number): { start: Date; end: Date } {
  const now = new Date(), abs = Math.abs(offset);
  if (period === 'Weekly') {
    const ref = offset < 0 ? subWeeks(now, abs) : now;
    return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
  }
  if (period === 'Monthly') {
    const ref = offset < 0 ? subMonths(now, abs) : now;
    return { start: startOfMonth(ref), end: endOfMonth(ref) };
  }
  const ref = offset < 0 ? subYears(now, abs) : now;
  return { start: startOfYear(ref), end: endOfYear(ref) };
}

/**
 * Builds a human-readable label for the navigator header.
 *   offset=0  → "This Week" / "This Month" / "This Year"
 *   offset=-1 → "Last Week" / "Last Month" / "Last Year"
 *   older     → "15 – 21 Sep" / "Aug 2026" / "2025"
 */
function buildDateLabel(period: Period, offset: number): string {
  if (offset === 0) return period === 'Weekly' ? 'This Week' : period === 'Monthly' ? 'This Month' : 'This Year';
  if (offset === -1) return period === 'Weekly' ? 'Last Week' : period === 'Monthly' ? 'Last Month' : 'Last Year';
  const { start, end } = buildInterval(period, offset);
  if (period === 'Weekly') {
    if (isSameMonth(start, end) && isSameYear(start, end)) {
      return `${format(start, 'd')} – ${format(end, 'd MMM yyyy')}`;
    }
    if (isSameYear(start, end)) {
      return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
    }
    return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
  }
  return period === 'Monthly' ? format(start, 'MMMM yyyy') : format(start, 'yyyy');
}

/**
 * Computes the furthest back (most negative) offset the user is allowed to navigate to,
 * based on the earliest recorded expense date. Returns 0 if no expenses exist yet.
 */
function computeMinOffset(period: Period, earliestDate: Date | null): number {
  if (!earliestDate) return 0;
  let offset = 0;
  const earliestDay = startOfDay(earliestDate);
  // Walk backward until the previous interval ended strictly before the earliest expense
  while (offset > -60) {
    const { end } = buildInterval(period, offset - 1);
    if (isBefore(startOfDay(end), earliestDay)) break;
    offset--;
  }
  return offset;
}

// ─── PeriodNavigator sub-component ────────────────────────────────────────────

interface PeriodNavigatorProps {
  dateLabel: string;
  subLabel: string;
  offset: number;
  minOffset: number;
  dotCount: number;
  activeDotIndex: number;
  hasPrevData: boolean;  // false → grey left arrow (no expenses in prev period)
  onPrev: () => void;
  onNext: () => void;
}

const PeriodNavigator: React.FC<PeriodNavigatorProps> = ({
  dateLabel, subLabel, offset, minOffset, dotCount, activeDotIndex, hasPrevData, onPrev, onNext,
}) => {
  const isAtCurrent = offset === 0;
  // Block going back if at oldest period with data
  const isAtOldest = offset <= minOffset || hasPrevData === false;

  // Each dot slot is (inactive dot width 6 + gap 8) = 14px
  const DOT_SLOT = 14;

  // Elastic pill animation: independent left position and width values
  const slideLeft = useRef(new Animated.Value(activeDotIndex * DOT_SLOT)).current;
  const slideWidth = useRef(new Animated.Value(16)).current;
  const prevIndex = useRef(activeDotIndex);

  useEffect(() => {
    const from = prevIndex.current;
    const to = activeDotIndex;
    if (from === to) return;
    prevIndex.current = to;

    slideLeft.stopAnimation();
    slideWidth.stopAnimation();

    const distance = Math.abs(to - from);
    const maxStretch = 16 + distance * DOT_SLOT;
    const targetLeft = to * DOT_SLOT;

    const springCfg = { tension: 70, friction: 8, useNativeDriver: false };
    const timeCfg = { duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: false };

    Animated.sequence([
      to > from
        ? Animated.timing(slideWidth, { toValue: maxStretch, ...timeCfg })
        : Animated.parallel([
            Animated.timing(slideLeft, { toValue: targetLeft, ...timeCfg }),
            Animated.timing(slideWidth, { toValue: maxStretch, ...timeCfg }),
          ]),
      to > from
        ? Animated.parallel([
            Animated.spring(slideLeft, { toValue: targetLeft, ...springCfg }),
            Animated.spring(slideWidth, { toValue: 16, ...springCfg }),
          ])
        : Animated.spring(slideWidth, { toValue: 16, ...springCfg }),
    ]).start();
  }, [activeDotIndex]);

  return (
    <View style={navStyles.container}>
      {/* Arrow row */}
      <View style={navStyles.row}>
        <Pressable
          onPress={onPrev}
          disabled={isAtOldest}
          hitSlop={12}
          style={[navStyles.arrowBtn, isAtOldest && navStyles.arrowDisabled]}
        >
          <ChevronLeft size={16} color={isAtOldest ? 'rgba(60,35,35,0.25)' : '#2D1E1E'} />
        </Pressable>

        <View style={navStyles.labelBlock}>
          <Text style={[navStyles.dateLabel, { fontFamily: FontFamily.bold }]}>{dateLabel}</Text>
          {!!subLabel && (
            <Text style={[navStyles.subLabel, { fontFamily: FontFamily.medium }]}>{subLabel}</Text>
          )}
        </View>

        <Pressable
          onPress={onNext}
          disabled={isAtCurrent}
          hitSlop={12}
          style={[navStyles.arrowBtn, isAtCurrent && navStyles.arrowDisabled]}
        >
          <ChevronRight size={16} color={isAtCurrent ? 'rgba(60,35,35,0.25)' : '#2D1E1E'} />
        </Pressable>
      </View>

      {/* Pagination dots with stretchy elastic sliding pill */}
      {dotCount > 1 && (
        <View style={navStyles.dotsRow}>
          {/* Static ghost dots with left-to-right emergence progression */}
          {Array.from({ length: dotCount }).map((_, i) => {
            // Older history on the left is softly faded, smoothly emerging towards the current period on the right
            const progress = dotCount > 1 ? i / (dotCount - 1) : 1;
            const dotOpacity = 0.2 + progress * 0.45;
            const dotScale = 0.82 + progress * 0.18;

            return (
              <View
                key={i}
                style={[
                  navStyles.dot,
                  { width: i === activeDotIndex ? 16 : 6 },
                  {
                    backgroundColor: `rgba(60,35,35,${dotOpacity.toFixed(2)})`,
                    transform: [{ scale: dotScale }],
                  },
                ]}
              />
            );
          })}
          {/* Animated pill that stretches and snaps over the dots */}
          <Animated.View
            style={[
              navStyles.dot,
              navStyles.activePill,
              {
                left: slideLeft,
                width: slideWidth,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const navStyles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: Spacing.group },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60,35,35,0.06)',
  },
  arrowDisabled: { opacity: 0.35 },
  labelBlock: { alignItems: 'center', minWidth: 175 },
  dateLabel: { fontSize: FontSize.cta, color: '#2D1E1E' },
  subLabel: { fontSize: FontSize.bodySmall, color: 'rgba(60,35,35,0.6)', marginTop: Spacing.nano },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginTop: Spacing.element,
    position: 'relative',
  },
  dot: { height: 6, borderRadius: 3 },
  // Absolutely-positioned elastic pill drawn on top of the ghost dots
  activePill: {
    position: 'absolute',
    top: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2D1E1E',
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export const InsightsScreen: React.FC<Props> = ({ navigation }) => {
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords || {});
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits || []);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings || 0);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods || {});
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount || 0);
  const user = useAuthStore((s) => s.user);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();
  const isFocused = useIsFocused();

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

  // ─── Earliest expense date bound ───────────────────────────────────────────
  // Scans non-income expenses to find the earliest recorded transaction date.
  // This ensures period navigation and pagination dots only exist for periods with real user activity.
  const earliestExpenseDate = useMemo<Date | null>(() => {
    let earliest: string | null = null;
    for (const exp of expenses) {
      if (!exp.expense_date) continue;
      const cleanDate = exp.expense_date.split('T')[0]?.trim();
      if (!cleanDate) continue;
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;
      if (!earliest || cleanDate < earliest) {
        earliest = cleanDate;
      }
    }
    return earliest ? parseISO(earliest) : null;
  }, [expenses, categories]);

  const minOff = useMemo(
    () => computeMinOffset(period, earliestExpenseDate),
    [period, earliestExpenseDate],
  );

  // ─── Navigator labels ──────────────────────────────────────────────────────
  const { currentInterval, previousInterval, periodLabel, dateLabel, subLabel } = useMemo(() => {
    const current = buildInterval(period, offset);
    const previous = buildInterval(period, offset - 1);

    // Hero card uppercase label, e.g. "THIS WEEK" / "WEEK (PAST)"
    const pLabel = offset === 0
      ? (period === 'Weekly' ? 'THIS WEEK' : period === 'Monthly' ? 'THIS MONTH' : 'THIS YEAR')
      : (period === 'Weekly' ? 'WEEK' : period === 'Monthly' ? 'MONTH' : 'YEAR');

    // Navigator main label, e.g. "This Week" / "Last Week" / "15 – 21 Sep"
    const dLabel = buildDateLabel(period, offset);

    // Sub-label date range: kept empty because dateLabel now cleanly formats the complete date range in one line
    const sLabel = '';

    return {
      currentInterval: current,
      previousInterval: previous,
      periodLabel: pLabel,
      dateLabel: dLabel,
      subLabel: sLabel,
    };
  // focusTime: included so labels stay fresh after midnight without a full refetch
  }, [period, offset, focusTime]);

  // ─── Pagination dots ───────────────────────────────────────────────────────
  const { dotCount, activeDotIndex } = useMemo(() => {
    // Total available navigable periods capped at MAX_NAV_DOTS
    const total = Math.min(-minOff + 1, MAX_NAV_DOTS);
    const count = Math.max(total, 1);
    // Rightmost dot = current period (offset=0); left dots = past periods
    const active = count - 1 + offset;
    return { dotCount: count, activeDotIndex: Math.max(0, Math.min(active, count - 1)) };
  }, [offset, minOff]);

  // ─── Swipe gesture on hero card (horizontal swipe = period nav) ───────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        // Only claim the gesture if horizontal movement clearly dominates vertical
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
        onPanResponderRelease: (_, gs) => {
          if (gs.dx < -40 && offset < 0) {
            // Swipe left → go forward in time (toward current)
            setSelectedCategoryId(null);
            setOffset((o) => Math.min(o + 1, 0));
          } else if (gs.dx > 40 && offset > minOff) {
            // Swipe right → go back in time
            setSelectedCategoryId(null);
            setOffset((o) => Math.max(o - 1, minOff));
          }
        },
      }),
    [offset, minOff],
  );

  // ─── Expense aggregation ───────────────────────────────────────────────────
  const { currentTotal, previousTotal, categoryTotals } = useMemo(() => {
    let curr = 0;
    let prev = 0;
    const catTotals: Record<string, number> = {};

    for (const exp of expenses) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;

      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;

      const date = parseISO(cleanDate);
      if (isWithinInterval(date, currentInterval)) {
        curr += exp.amount;
        const key = exp.category_id || 'others';
        catTotals[key] = (catTotals[key] || 0) + exp.amount;
      } else if (isWithinInterval(date, previousInterval)) {
        prev += exp.amount;
      }
    }

    return { currentTotal: curr, previousTotal: prev, categoryTotals: catTotals };
  }, [expenses, categories, currentInterval, previousInterval]);

  const { percentageChange, isIncrease } = useMemo(() => {
    if (previousTotal === 0) return { percentageChange: currentTotal > 0 ? 100 : 0, isIncrease: true };
    const diff = currentTotal - previousTotal;
    return { percentageChange: Math.round((Math.abs(diff) / previousTotal) * 100), isIncrease: diff >= 0 };
  }, [currentTotal, previousTotal]);

  const sortedCategories = useMemo(() => {
    return Object.keys(categoryTotals)
      .map((catId, index) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          id: catId,
          name: cat?.name || (catId === 'others' ? 'Others' : 'Unknown'),
          amount: categoryTotals[catId],
          percentage: currentTotal > 0 ? Math.round((categoryTotals[catId] / currentTotal) * 100) : 0,
          color: cat?.color || CHART_COLORS[index % CHART_COLORS.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [categoryTotals, categories, currentTotal]);

  const topCategory = sortedCategories[0] ?? null;

  // Bar chart: shows Mon–Sun data for the selected week.
  // For Monthly/Yearly views it always reflects the current calendar week (same as before).
  const { weeklyData, maxWeekDay } = useMemo(() => {
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const weekRef = period === 'Weekly' && offset < 0
      ? subWeeks(new Date(), Math.abs(offset))
      : new Date();

    const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 });
    const weekInterval = {
      start: weekStart,
      end: endOfWeek(weekRef, { weekStartsOn: 1 }),
    };

    const data = weekDays.map((day, i) => {
      const dateObj = addDays(weekStart, i);
      return {
        day,
        dateStr: format(dateObj, 'yyyy-MM-dd'),
        amount: 0,
      };
    });

    for (const exp of expenses) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;

      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;

      const date = parseISO(cleanDate);
      if (isWithinInterval(date, weekInterval)) {
        let dayIndex = date.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6; // Sunday wraps to index 6
        data[dayIndex].amount += exp.amount;
      }
    }

    const maxDay = data.reduce((max, d) => (d.amount > max.amount ? d : max), data[0]);
    return { weeklyData: data, maxWeekDay: maxDay.amount > 0 ? maxDay : null };
  }, [expenses, categories, period, offset]);

  // Monthly week-by-week cash flow (Money In vs Money Out)
  const monthlyCashFlowData = useMemo(() => {
    if (period !== 'Monthly') return { weeks: [], totalIncome: 0, totalSpent: 0, maxAmount: 0 };
    return computeMonthlyCashFlowData(
      currentInterval.start,
      currentInterval.end,
      expenses,
      gullakDeposits,
      (exp) => {
        const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
        return isIncomeTransaction(exp, cat);
      },
      user?.created_at,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      }
    );
  }, [
    period,
    currentInterval,
    expenses,
    gullakDeposits,
    categories,
    user?.created_at,
    isBudgetModeEnabled,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
  ]);

  // Yearly Gullak savings & milestone metrics
  const yearlyGullakMetrics = useMemo(() => {
    if (period !== 'Yearly') return null;
    return computeYearlyGullakMilestones(
      currentInterval.start,
      currentInterval.end,
      Object.values(dailyRecords),
      gullakDeposits,
      totalAccumulatedSavings,
      Object.values(budgetPeriods)
    );
  }, [period, currentInterval, dailyRecords, gullakDeposits, totalAccumulatedSavings, budgetPeriods]);

  const topPaymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;

    for (const exp of expenses) {
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;

      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        counts[exp.payment_mode] = (counts[exp.payment_mode] || 0) + 1;
        total++;
      }
    }

    let topMode = 'None';
    let maxCount = 0;
    for (const mode in counts) {
      if (counts[mode] > maxCount) { maxCount = counts[mode]; topMode = mode; }
    }

    const formattedMode = topMode === 'None' ? 'None'
      : topMode.toLowerCase() === 'upi' ? 'UPI'
      : topMode.charAt(0).toUpperCase() + topMode.slice(1);

    return {
      mode: formattedMode,
      percentage: total > 0 ? Math.round((maxCount / total) * 100) : 0,
      originalMode: topMode,
    };
  }, [expenses, currentInterval]);

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

  const maxSideStack = period === 'Weekly' ? 4 : 5;

  const legendSegments = useMemo(() => {
    return sortedCategories.map((item) => ({
      ...item,
      color: item.color,
    }));
  }, [sortedCategories]);

  const sideCategories = useMemo(
    () => legendSegments.slice(0, maxSideStack),
    [legendSegments, maxSideStack]
  );
  const bottomCategories = useMemo(
    () => legendSegments.slice(maxSideStack),
    [legendSegments, maxSideStack]
  );

  // Derive icon components once — avoids inline function calls in JSX
  const CategoryInsightIcon = getCategoryInsightIcon(topCategory?.name || '');
  const PaymentInsightIcon = getPaymentInsightIcon(topPaymentData.originalMode);

  // Day-matched comparison for Weekly & Monthly vs standard comparison for Yearly
  const weeklyDayMatchedComp = useMemo(() => {
    if (period !== 'Weekly') {
      return {
        percentageChange: null,
        isIncrease: false,
        trendLabel: '',
        matchedPrevTotal: 0,
      };
    }
    return computeDayMatchedPreviousComparison(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      new Date()
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset]);

  const monthlyComp = useMemo(() => {
    if (period !== 'Monthly') {
      return {
        percentageChange: null,
        isIncrease: false,
        trendLabel: '',
        matchedPrevTotal: 0,
        currentTotal: 0,
      };
    }
    return computeMonthlyComparison(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      new Date()
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset]);

  const yearlyActiveDays = useMemo(() => {
    if (period !== 'Yearly') return 365;
    return computeActiveDaysInYear(currentInterval.start, focusTime, user?.created_at, offset < 0);
  }, [period, currentInterval.start, focusTime, user?.created_at, offset]);

  const yearlyDailyBurn = useMemo(() => {
    if (period !== 'Yearly') return 0;
    return computeAnnualDailyBurn(currentTotal, yearlyActiveDays);
  }, [period, currentTotal, yearlyActiveDays]);

  const yearlyComparison = useMemo(() => {
    if (period !== 'Yearly') {
      return {
        percentageChange: null,
        isIncrease: false,
        trendLabel: '',
        matchedPrevTotal: 0,
        currentTotal: 0,
      };
    }
    return computeYearlyComparison(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      focusTime,
      user?.created_at
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset, focusTime, user?.created_at]);

  const heroTrend = useMemo(() => {
    if (period === 'Weekly') {
      return {
        percentageChange: weeklyDayMatchedComp.percentageChange,
        isIncrease: weeklyDayMatchedComp.isIncrease,
        trendLabel: weeklyDayMatchedComp.trendLabel,
      };
    }
    if (period === 'Monthly') {
      return {
        percentageChange: monthlyComp.percentageChange,
        isIncrease: monthlyComp.isIncrease,
        trendLabel: monthlyComp.trendLabel,
      };
    }
    return {
      percentageChange: yearlyComparison.percentageChange,
      isIncrease: yearlyComparison.isIncrease,
      trendLabel: yearlyComparison.trendLabel,
    };
  }, [period, weeklyDayMatchedComp, monthlyComp, yearlyComparison]);

  // Weekly Breathing Strip & Analytics calculations
  const effectiveBudgetResult = useMemo(() => {
    return computeEffectiveWeekBudget(
      budgetCadence,
      dailyBudgetAmount,
      weeklyBudgetAmount,
      user?.created_at,
      currentInterval
    );
  }, [budgetCadence, dailyBudgetAmount, weeklyBudgetAmount, user?.created_at, currentInterval]);

  const budgetHealth = useMemo(() => {
    return computeBudgetHealth(effectiveBudgetResult.effectiveBudget, currentTotal);
  }, [effectiveBudgetResult.effectiveBudget, currentTotal]);

  const elapsedDaysInWeek = useMemo(() => {
    if (offset < 0) return 7;
    const now = new Date();
    let dayIdx = now.getDay() - 1;
    if (dayIdx === -1) dayIdx = 6;
    return dayIdx + 1;
  }, [offset]);

  // ─── Monthly Insights Calculations ──────────────────────────────────────────
  const elapsedDaysInMonth = useMemo(() => {
    if (offset < 0) {
      return differenceInCalendarDays(currentInterval.end, currentInterval.start) + 1;
    }
    const now = new Date();
    return now.getDate();
  }, [offset, currentInterval]);

  const monthlyRemainingDays = useMemo(() => {
    if (offset < 0) return 0;
    const totalDays = differenceInCalendarDays(currentInterval.end, currentInterval.start) + 1;
    return Math.max(0, totalDays - elapsedDaysInMonth);
  }, [offset, currentInterval, elapsedDaysInMonth]);

  const monthlyEffectiveBudget = useMemo(() => {
    if (period !== 'Monthly') return { effectiveBudget: 0, activeDays: 0, totalDays: 0, isPartialFirstMonth: false };
    return computeEffectiveMonthBudget(
      budgetCadence,
      dailyBudgetAmount,
      weeklyBudgetAmount,
      monthlyBudgetAmount,
      user?.created_at,
      currentInterval
    );
  }, [period, budgetCadence, dailyBudgetAmount, weeklyBudgetAmount, monthlyBudgetAmount, user?.created_at, currentInterval]);

  const monthlyBudgetHealth = useMemo(() => {
    return computeMonthlyBudgetHealth(monthlyEffectiveBudget.effectiveBudget, currentTotal);
  }, [monthlyEffectiveBudget.effectiveBudget, currentTotal]);

  // ─── Direct Non-Gullak Income Added in Current Interval ───────────────────────
  const currentPeriodIncome = useMemo(() => {
    if (period === 'Yearly') return 0;
    let income = 0;
    for (const exp of expenses) {
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
        if (isIncomeTransaction(exp, cat)) {
          income += exp.amount;
        }
      }
    }
    return round2(income);
  }, [expenses, categories, currentInterval, period]);

  // ─── Active Spending Pool (Estimated Budget + Added Inflow) ───────────────────
  const activeBudgetPool = useMemo(() => {
    if (!isBudgetModeEnabled || period === 'Yearly') {
      return null;
    }

    const baseBudget = period === 'Weekly'
      ? effectiveBudgetResult.effectiveBudget
      : monthlyEffectiveBudget.effectiveBudget;

    const totalPool = round2(baseBudget + currentPeriodIncome);
    const rawRemaining = round2(totalPool - currentTotal);
    const isOver = rawRemaining < 0;
    const overAmount = isOver ? Math.abs(rawRemaining) : 0;
    const remaining = Math.max(0, rawRemaining);
    const progressRatio = totalPool > 0 ? Math.min(1, Math.max(0, currentTotal / totalPool)) : 0;

    return {
      baseBudget,
      totalPool,
      remaining,
      isOver,
      overAmount,
      progressRatio,
      hasIncomeAdded: currentPeriodIncome > 0,
      addedIncome: currentPeriodIncome,
    };
  }, [
    isBudgetModeEnabled,
    period,
    effectiveBudgetResult.effectiveBudget,
    monthlyEffectiveBudget.effectiveBudget,
    currentPeriodIncome,
    currentTotal,
  ]);

  const safeDailyPace = useMemo(() => {
    const effectiveRemaining = activeBudgetPool && period === 'Weekly'
      ? activeBudgetPool.remaining
      : budgetHealth.remaining;
    return computeSafeDailyPace(effectiveRemaining, elapsedDaysInWeek);
  }, [activeBudgetPool, period, budgetHealth.remaining, elapsedDaysInWeek]);

  const monthlySafeDailyPace = useMemo(() => {
    const totalDays = differenceInCalendarDays(currentInterval.end, currentInterval.start) + 1;
    const effectiveRemaining = activeBudgetPool && period === 'Monthly'
      ? activeBudgetPool.remaining
      : monthlyBudgetHealth.remaining;
    return computeMonthlySafeDailyPace(effectiveRemaining, elapsedDaysInMonth, totalDays);
  }, [activeBudgetPool, period, monthlyBudgetHealth.remaining, elapsedDaysInMonth, currentInterval]);

  const weeklyGullak = useMemo(() => {
    return computeWeeklyGullakSavings(dailyRecords, gullakDeposits, currentInterval);
  }, [dailyRecords, gullakDeposits, currentInterval]);

  const weekTransactionCount = useMemo(() => {
    let count = 0;
    for (const exp of expenses) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        count++;
      }
    }
    return count;
  }, [expenses, categories, currentInterval]);

  const peakDayName = maxWeekDay?.day || 'Mon';

  const smartTakeaway = useMemo(() => {
    const isOver = activeBudgetPool && period === 'Weekly' ? activeBudgetPool.isOver : budgetHealth.isOverBudget;
    const overAmt = activeBudgetPool && period === 'Weekly' ? activeBudgetPool.overAmount : budgetHealth.overAmount;

    return computeSmartWeeklyTakeaway({
      currentTotal,
      isBudgetMode: isBudgetModeEnabled,
      isOverBudget: isOver,
      overAmount: overAmt,
      peakDayName,
      savedDaysCount: weeklyGullak.savedDaysCount,
      weekSavings: weeklyGullak.totalSaved,
      topCategory: topCategory ? { name: topCategory.name, percentage: topCategory.percentage } : null,
      safeDailyPace,
      isCurrentWeek: offset === 0,
      transactionCount: weekTransactionCount,
      dailyAverageBurn: Math.round(currentTotal / Math.max(1, elapsedDaysInWeek)),
    });
  }, [
    currentTotal,
    isBudgetModeEnabled,
    activeBudgetPool,
    period,
    budgetHealth,
    peakDayName,
    weeklyGullak,
    topCategory,
    safeDailyPace,
    offset,
    weekTransactionCount,
    elapsedDaysInWeek,
  ]);

  const largestOutflow = useMemo(() => {
    if (period !== 'Weekly') return null;
    return computeLargestSingleOutflow(expenses, categories, currentInterval, currentTotal);
  }, [period, expenses, categories, currentInterval, currentTotal]);

  const weekdayWeekendDynamics = useMemo(() => {
    if (period !== 'Weekly') return null;
    return computeWeekdayVsWeekendDynamics(
      weeklyData,
      currentTotal,
      offset,
      new Date()
    );
  }, [period, weeklyData, currentTotal, offset]);

  const peakDaysSubtitle = useMemo(() => {
    if (period !== 'Weekly') return undefined;
    return computePeakDaysSubtitle(weeklyData);
  }, [period, weeklyData]);

  const monthlyDailyBurnPace = useMemo(() => {
    if (currentTotal <= 0) return 0;
    return Math.round(currentTotal / Math.max(1, elapsedDaysInMonth));
  }, [currentTotal, elapsedDaysInMonth]);

  const monthlyGullakSavings = useMemo(() => {
    if (period !== 'Monthly') return { totalSaved: 0, autoSaved: 0, manualDeposits: 0, savedDaysCount: 0 };
    return computeMonthlyGullakSavings(dailyRecords, gullakDeposits, currentInterval);
  }, [period, dailyRecords, gullakDeposits, currentInterval]);

  const monthlyLargestOutflow = useMemo(() => {
    if (period !== 'Monthly') return null;
    return computeMonthlyLargestOutflow(expenses, categories, currentInterval, currentTotal);
  }, [period, expenses, categories, currentInterval, currentTotal]);

  const monthlyCategoryShift = useMemo(() => {
    if (period !== 'Monthly') return null;
    return computeMonthlyCategoryShift(
      expenses,
      categories,
      currentInterval,
      previousInterval,
      offset,
      new Date(),
      currentTotal
    );
  }, [period, expenses, categories, currentInterval, previousInterval, offset, currentTotal]);

  const monthlyPeakWeek = useMemo(() => {
    if (period !== 'Monthly') return { status: 'empty' as const, text: '' };
    return computeMonthlyPeakWeek(monthlyCashFlowData.weeks, currentTotal);
  }, [period, monthlyCashFlowData.weeks, currentTotal]);

  const monthTransactionCount = useMemo(() => {
    if (period !== 'Monthly') return 0;
    let count = 0;
    for (const exp of expenses) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        count++;
      }
    }
    return count;
  }, [period, expenses, categories, currentInterval]);

  const smartMonthlyTakeaway = useMemo(() => {
    const isOver = activeBudgetPool && period === 'Monthly' ? activeBudgetPool.isOver : monthlyBudgetHealth.isOverBudget;
    const overAmt = activeBudgetPool && period === 'Monthly' ? activeBudgetPool.overAmount : monthlyBudgetHealth.overAmount;
    const remBudget = activeBudgetPool && period === 'Monthly' ? activeBudgetPool.remaining : monthlyBudgetHealth.remaining;

    return computeSmartMonthlyTakeaway({
      currentTotal,
      isBudgetMode: isBudgetModeEnabled,
      isOverBudget: isOver,
      overAmount: overAmt,
      savedDaysCount: monthlyGullakSavings.savedDaysCount,
      totalMonthSavings: monthlyGullakSavings.totalSaved,
      topCategory: topCategory ? { name: topCategory.name, percentage: topCategory.percentage } : null,
      isCurrentMonth: offset === 0,
      safeDailyPace: monthlySafeDailyPace,
      remainingDays: monthlyRemainingDays,
      remainingBudget: remBudget,
      transactionCount: monthTransactionCount,
      monthlyDailyBurnPace,
    });
  }, [
    currentTotal,
    isBudgetModeEnabled,
    activeBudgetPool,
    period,
    monthlyBudgetHealth,
    monthlyGullakSavings,
    topCategory,
    offset,
    monthlySafeDailyPace,
    monthlyRemainingDays,
    monthTransactionCount,
    monthlyDailyBurnPace,
  ]);

  // ─── Yearly Insights Analytics & Engines ────────────────────────────────────
  const yearlyInflow = useMemo(() => {
    if (period !== 'Yearly') return 0;
    return computeYearlyInflow(
      expenses,
      categories,
      dailyRecords,
      gullakDeposits,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      },
      currentInterval,
      focusTime,
      user?.created_at
    );
  }, [
    period,
    expenses,
    categories,
    dailyRecords,
    gullakDeposits,
    isBudgetModeEnabled,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    currentInterval,
    focusTime,
    user?.created_at,
  ]);

  const yearlyNetCashFlow = useMemo(() => {
    return computeAnnualNetCashFlow(yearlyInflow, currentTotal);
  }, [yearlyInflow, currentTotal]);

  const yearlySavingsRate = useMemo(() => {
    const saved = yearlyGullakMetrics?.totalSavedInYear || 0;
    return computeAnnualSavingsRate(saved, yearlyInflow);
  }, [yearlyGullakMetrics, yearlyInflow]);

  const yearlyCashFlowData = useMemo(() => {
    if (period !== 'Yearly') {
      return {
        months: [],
        maxAmount: 0,
        totalIncome: 0,
        totalSpent: 0,
        peakMonthName: 'None',
        peakMonthSpent: 0,
        surplusMonthsCount: 0,
        activeMonthsCount: 0,
        chartSubtitle: '',
      };
    }
    return compute12MonthCashFlow(
      currentInterval.start,
      currentInterval.end,
      expenses,
      categories,
      gullakDeposits,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      },
      user?.created_at,
      focusTime
    );
  }, [
    period,
    currentInterval,
    expenses,
    categories,
    gullakDeposits,
    isBudgetModeEnabled,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    user?.created_at,
    focusTime,
  ]);

  const smartYearlyTakeaway = useMemo(() => {
    const saved = yearlyGullakMetrics?.totalSavedInYear || 0;
    return computeSmartYearlyTakeaway(
      yearlyNetCashFlow.netCashFlow,
      yearlySavingsRate,
      yearlyCashFlowData.activeMonthsCount,
      isBudgetModeEnabled,
      saved
    );
  }, [
    yearlyNetCashFlow.netCashFlow,
    yearlySavingsRate,
    yearlyCashFlowData.activeMonthsCount,
    isBudgetModeEnabled,
    yearlyGullakMetrics,
  ]);

  const annualBudgetDiscipline = useMemo(() => {
    if (period !== 'Yearly' || !isBudgetModeEnabled) {
      return { canDisplay: false, keptMonths: 0, totalCompletedMonths: 0, consistencyRatio: 0, disciplineText: '' };
    }
    return computeAnnualBudgetDiscipline(
      expenses,
      categories,
      currentInterval,
      {
        isBudgetMode: isBudgetModeEnabled,
        cadence: budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
      },
      user?.created_at,
      focusTime
    );
  }, [
    period,
    isBudgetModeEnabled,
    expenses,
    categories,
    currentInterval,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    user?.created_at,
    focusTime,
  ]);

  const yearlyCapitalOutlier = useMemo(() => {
    if (period !== 'Yearly') return null;
    return computeAnnualCapitalOutlier(expenses, categories, currentTotal, currentInterval);
  }, [period, expenses, categories, currentTotal, currentInterval]);

  const yearlyCategoryTrajectory = useMemo(() => {
    if (period !== 'Yearly') return null;
    return computeAnnualCategoryTrajectory(
      expenses,
      categories,
      currentInterval,
      currentTotal,
      user?.created_at,
      focusTime
    );
  }, [period, expenses, categories, currentInterval, currentTotal, user?.created_at, focusTime]);

  const yearTransactionCount = useMemo(() => {
    if (period !== 'Yearly') return 0;
    let count = 0;
    for (const exp of expenses) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        count++;
      }
    }
    return count;
  }, [period, expenses, categories, currentInterval]);

  const gullakDepositsInYearCount = useMemo(() => {
    if (period !== 'Yearly') return 0;
    const startStr = format(currentInterval.start, 'yyyy-MM-dd');
    const endStr = format(currentInterval.end, 'yyyy-MM-dd');
    return gullakDeposits.filter((d) => d.date >= startStr && d.date <= endStr).length;
  }, [period, gullakDeposits, currentInterval]);

  // Left arrow is enabled as long as there is an older period within the available history
  const hasPrevData = offset > minOff;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mintGreen} />
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
              borderWidth: isDark ? 1 : 0,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Gradient Background */}
          <View style={StyleSheet.absoluteFill}>
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

          <Text style={[styles.heroLabel, { fontFamily: FontFamily.bold }]}>
            TOTAL SPENT {periodLabel}
          </Text>

          <View style={styles.heroAmountRow}>
            <AmountText
              role="hero"
              value={currentTotal}
              color="#2D1E1E"
              showDecimals={currentTotal % 1 !== 0}
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

              <Text style={[styles.heroProgressText, { fontFamily: FontFamily.medium }]} numberOfLines={1}>
                {activeBudgetPool.isOver ? (
                  activeBudgetPool.hasIncomeAdded ? (
                    `₹${formatAmountWithCommas(String(activeBudgetPool.overAmount))} over ₹${formatAmountWithCommas(String(activeBudgetPool.totalPool))} pool`
                  ) : (
                    `₹${formatAmountWithCommas(String(activeBudgetPool.overAmount))} over ₹${formatAmountWithCommas(String(activeBudgetPool.baseBudget))} estimated`
                  )
                ) : activeBudgetPool.hasIncomeAdded ? (
                  `₹${formatAmountWithCommas(String(activeBudgetPool.remaining))} left of ₹${formatAmountWithCommas(String(activeBudgetPool.totalPool))} pool (₹${formatAmountWithCommas(String(activeBudgetPool.baseBudget))} est. + ₹${formatAmountWithCommas(String(activeBudgetPool.addedIncome))} income)`
                ) : (
                  `₹${formatAmountWithCommas(String(activeBudgetPool.remaining))} left of ₹${formatAmountWithCommas(String(activeBudgetPool.baseBudget))} estimated`
                )}
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
                { color: '#3E2723', fontFamily: FontFamily.bold },
              ]}>
                {heroTrend.trendLabel}
              </Text>
            </View>
            {period === 'Monthly' && monthlyDailyBurnPace > 0 && (
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(60, 35, 35, 0.06)' }]}>
                <Text style={[styles.trendText, { color: '#3E2723', fontFamily: FontFamily.bold }]}>
                  ₹{monthlyDailyBurnPace}/day avg
                </Text>
              </View>
            )}
            {period === 'Yearly' && yearlyDailyBurn > 0 && (
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(60, 35, 35, 0.06)' }]}>
                <Text style={[styles.trendText, { color: '#3E2723', fontFamily: FontFamily.bold }]}>
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
          <View style={{ marginTop: Spacing.gutter }}>
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
              onPressSavings={() => {
                navigation.navigate('Savings');
              }}
            />
          </View>
        )}

        {/* ── Monthly Financial Breathing Strip (Dual Clean Tiles) ── */}
        {period === 'Monthly' && (
          <View style={{ marginTop: Spacing.gutter }}>
            <MonthlyBreathingStrip
              takeaway={smartMonthlyTakeaway}
              isBudgetMode={isBudgetModeEnabled}
              safeDailyPace={monthlySafeDailyPace}
              isCurrentMonth={offset === 0}
              remainingDays={monthlyRemainingDays}
              transactionCount={monthTransactionCount}
              totalMonthSavings={monthlyGullakSavings.totalSaved}
              savedDaysCount={monthlyGullakSavings.savedDaysCount}
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
          <View style={{ marginTop: Spacing.gutter }}>
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
                      onPress={() => {
                        if (selectedCategoryId === seg.id) {
                          navigation.navigate('CategoryDetail', { categoryId: seg.id });
                        } else {
                          setSelectedCategoryId(seg.id);
                        }
                      }}
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
                      onPress={() => {
                        if (selectedCategoryId === seg.id) {
                          navigation.navigate('CategoryDetail', { categoryId: seg.id });
                        } else {
                          setSelectedCategoryId(seg.id);
                        }
                      }}
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
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold, marginTop: Spacing.section }]}>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.block,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.gutter,
  },
  headerTitle: {
    fontSize: FontSize.titleLarge,
    lineHeight: LineHeight.titleLarge,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    padding: Spacing.micro,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.element,
    borderRadius: BorderRadius.pill,
  },
  segmentText: { fontSize: FontSize.caption },
  heroCard: {
    borderRadius: BorderRadius.cardLarge,
    paddingHorizontal: Spacing.surface,
    paddingTop: Spacing.block,
    paddingBottom: Spacing.block,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCircle1: {
    position: 'absolute', top: -50, right: -20,
    width: 200, height: 200, borderRadius: 100, opacity: 0.5,
  },
  heroCircle2: {
    position: 'absolute', bottom: -80, right: 40,
    width: 150, height: 150, borderRadius: 75, opacity: 0.3,
  },
  heroLabel: { fontSize: FontSize.caption, color: 'rgba(60, 35, 35, 0.8)', letterSpacing: 1, textTransform: 'uppercase' },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.micro },
  heroCurrency: { fontSize: 24, color: '#2D1E1E', marginRight: 6 },
  heroAmount: { fontSize: 48, color: '#2D1E1E' },
  heroProgressSection: {
    marginTop: Spacing.element,
    marginBottom: Spacing.micro,
  },
  heroProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 35, 35, 0.14)',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  heroProgressText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#3E2723',
    marginTop: 4,
  },
  heroComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.group,
    marginTop: Spacing.element,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 35, 35, 0.08)',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: Spacing.micro,
  },
  trendText: { fontSize: 11.5 },

  sectionTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    marginTop: Spacing.section,
    marginBottom: Spacing.gutter,
  },
  byCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  donutLeftContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryStackRight: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 8,
  },
  categoryStackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  categoryStackTextWrapper: {
    flex: 1,
  },
  categoryStackName: {
    fontSize: FontSize.body,
    includeFontPadding: false,
  },
  categoryStackSubtext: {
    fontSize: FontSize.bodySmall,
    marginTop: 1,
    includeFontPadding: false,
  },
  chartContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  legendGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: Spacing.surface,
  },
  legendItem: {
    width: '48%', flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.surface,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.group },
  legendName: { fontSize: FontSize.body },
  legendSubtext: { fontSize: FontSize.bodySmall, marginTop: Spacing.nano },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: Spacing.gutter,
  },
  emptyStateText: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    textAlign: 'center',
    marginBottom: Spacing.block,
  },
  emptyStateCta: {
    minWidth: 160,
  },
  expandCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: Spacing.group,
  },
  expandCategoriesText: {
    fontSize: FontSize.bodySmall,
  },
  behavioralInsightsList: {
    marginTop: Spacing.micro,
  },
  disciplineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginTop: Spacing.group,
    paddingHorizontal: Spacing.micro,
  },
  disciplineText: {
    fontSize: FontSize.bodySmall,
    flex: 1,
  },
  quickInsightsList: { marginTop: Spacing.micro },
  quickInsightRow: { flexDirection: 'row', alignItems: 'center' },
  quickInsightTextWrapper: { flex: 1, marginLeft: Spacing.group, justifyContent: 'center' },
  quickInsightLabel: { fontSize: FontSize.caption, marginBottom: 2 },
  quickInsightValue: { fontSize: FontSize.body },
  quickInsightAmountWrapper: { alignItems: 'flex-end', justifyContent: 'center' },
  quickInsightAmount: { fontSize: FontSize.body },
});
