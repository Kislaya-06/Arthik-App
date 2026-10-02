import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, PanResponder, Animated, Easing,
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
  subWeeks, subMonths, subYears, addDays,
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
import { Spacing, BorderRadius, FontSize, FontFamily, CATEGORY_PALETTE } from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { AnimatedCategoryDonut } from '../components/AnimatedCategoryDonut';
import { SpendingFlowChart } from '../components/SpendingFlowChart';
import { CashFlowChart } from '../components/CashFlowChart';
import { BouncyFilterToggle } from '../components/BouncyFilterToggle';
import { YearlySavingsMilestoneCard } from '../components/YearlySavingsMilestoneCard';
import { WeeklyBreathingStrip } from '../components/WeeklyBreathingStrip';
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
      }
    );
  }, [period, currentInterval, expenses, gullakDeposits, categories]);

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

  const DONUT_SIZE = 160;
  const DONUT_STROKE = 22;
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

  // Day-matched comparison for Weekly vs standard comparison for Monthly/Yearly
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

  const heroTrend = useMemo(() => {
    if (period === 'Weekly') {
      return {
        percentageChange: weeklyDayMatchedComp.percentageChange,
        isIncrease: weeklyDayMatchedComp.isIncrease,
        trendLabel: weeklyDayMatchedComp.trendLabel,
      };
    }
    const label = `${percentageChange}% vs prev ${period === 'Monthly' ? 'month' : 'year'}`;
    return {
      percentageChange,
      isIncrease,
      trendLabel: label,
    };
  }, [period, weeklyDayMatchedComp, percentageChange, isIncrease]);

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

  const safeDailyPace = useMemo(() => {
    return computeSafeDailyPace(budgetHealth.remaining, elapsedDaysInWeek);
  }, [budgetHealth.remaining, elapsedDaysInWeek]);

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
    return computeSmartWeeklyTakeaway({
      currentTotal,
      isBudgetMode: isBudgetModeEnabled,
      isOverBudget: budgetHealth.isOverBudget,
      overAmount: budgetHealth.overAmount,
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
    budgetHealth.isOverBudget,
    budgetHealth.overAmount,
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
            <BouncyFilterToggle
              value={period}
              onChange={handlePeriodChange}
              options={['Weekly', 'Monthly', 'Yearly']}
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
            <Text style={[styles.heroCurrency, { fontFamily: FontFamily.bold }]}>₹</Text>
            <Text style={[styles.heroAmount, { fontFamily: FontFamily.bold }]}>
              {currentTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
          </View>

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

        {/* ── Weekly Breathing Strip (Variation A) ── */}
        {period === 'Weekly' && (
          <View style={{ marginTop: Spacing.gutter }}>
            <WeeklyBreathingStrip
              takeaway={smartTakeaway}
              isBudgetMode={isBudgetModeEnabled}
              weekSpent={currentTotal}
              weekBudget={effectiveBudgetResult.effectiveBudget}
              remainingBudget={budgetHealth.remaining}
              overAmount={budgetHealth.overAmount}
              isOverBudget={budgetHealth.isOverBudget}
              budgetRatio={budgetHealth.ratio}
              safeDailyPace={safeDailyPace}
              isCurrentWeek={offset === 0}
              transactionCount={weekTransactionCount}
              totalWeekSavings={weeklyGullak.totalSaved}
              savedDaysCount={weeklyGullak.savedDaysCount}
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

        {/* ── By Category Section ── */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          By Category
        </Text>

        {currentTotal > 0 ? (
          <>
            {/* Top row: Donut on Left, up to 4 categories stacked on Right */}
            <View style={styles.byCategoryRow}>
              {/* Donut chart on left */}
              <View style={styles.donutLeftContainer}>
                <AnimatedCategoryDonut
                  categories={sortedCategories}
                  totalAmount={currentTotal}
                  topCategory={topCategory}
                  palette={CHART_COLORS}
                  size={DONUT_SIZE}
                  strokeWidth={DONUT_STROKE}
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

            {/* Overflow Categories: Progressive Disclosure for Weekly */}
            {period === 'Weekly' && bottomCategories.length > 0 && (
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

            {/* Expanded categories (Weekly when showAllCategories is true, or always for Monthly/Yearly if bottomCategories exist) */}
            {((period === 'Weekly' && showAllCategories && bottomCategories.length > 0) ||
              (period !== 'Weekly' && bottomCategories.length > 0)) && (
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

            {/* ── Monthly Dual-Bar Cash Flow Section (Money In vs Money Out) ── */}
            {period === 'Monthly' && (
              <CashFlowChart
                title="Cash Flow"
                subTitle={format(currentInterval.start, 'MMMM yyyy')}
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

            {/* ── Yearly Savings & Gullak Milestones Section ── */}
            {isBudgetModeEnabled && period === 'Yearly' && yearlyGullakMetrics && (
              <YearlySavingsMilestoneCard
                metrics={yearlyGullakMetrics}
                yearLabel={format(currentInterval.start, 'yyyy')}
                isDark={isDark}
                colors={colors}
                onOpenSavings={() => navigation.navigate('Savings')}
              />
            )}

            {/* ── Behavioral Insights (Weekly) / Quick Insights (Monthly / Yearly) ── */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold, marginTop: Spacing.section }]}>
              {period === 'Weekly' ? 'Behavioral Insights' : 'Quick Insights'}
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
            ) : (
              <View style={styles.quickInsightsList}>
                <View style={styles.quickInsightRow}>
                  <GradientIconBadge size={48} color={topCategory?.color || '#F07167'} isDark={isDark}>
                    {({ iconColor }) => <CategoryInsightIcon size={22} color={iconColor} strokeWidth={2.2} />}
                  </GradientIconBadge>
                  <View style={styles.quickInsightTextWrapper}>
                    <Text style={[styles.quickInsightLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]} numberOfLines={1}>
                      Most Spent On
                    </Text>
                    <Text style={[styles.quickInsightValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]} numberOfLines={1}>
                      {topCategory?.name || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.quickInsightAmountWrapper}>
                    <Text style={[styles.quickInsightAmount, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                      {topCategory ? formatCurrency(topCategory.amount) : '-'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.quickInsightRow, { marginTop: Spacing.group }]}>
                  <GradientIconBadge size={48} color={isDark ? colors.mintGreen : '#4CAF7D'} isDark={isDark}>
                    {({ iconColor }) => <PaymentInsightIcon size={22} color={iconColor} strokeWidth={2.2} />}
                  </GradientIconBadge>
                  <View style={styles.quickInsightTextWrapper}>
                    <Text style={[styles.quickInsightLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]} numberOfLines={1}>
                      Top Payment
                    </Text>
                    <Text style={[styles.quickInsightValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]} numberOfLines={1}>
                      {topPaymentData.mode}
                    </Text>
                  </View>
                  <View style={styles.quickInsightAmountWrapper}>
                    <Text style={[styles.quickInsightAmount, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                      {topPaymentData.percentage}% of txns
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
              No expenses found for this period.
            </Text>
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
  headerTitle: { fontSize: FontSize.screenTitle },
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
  heroComparisonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.element,
  },
  trendBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(60, 35, 35, 0.08)', borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.group, paddingVertical: 6, gap: Spacing.micro,
  },
  trendText: { fontSize: FontSize.caption },

  sectionTitle: { fontSize: FontSize.sectionTitle, marginTop: Spacing.section, marginBottom: Spacing.gutter },
  byCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  donutLeftContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryStackRight: {
    flex: 1,
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
  emptyState: { alignItems: 'center', marginTop: Spacing.section },
  emptyStateText: { fontSize: FontSize.body },
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
  quickInsightsList: { marginTop: Spacing.micro },
  quickInsightRow: { flexDirection: 'row', alignItems: 'center' },
  quickInsightTextWrapper: { flex: 1, marginLeft: Spacing.group, justifyContent: 'center' },
  quickInsightLabel: { fontSize: FontSize.caption, marginBottom: 2 },
  quickInsightValue: { fontSize: FontSize.body },
  quickInsightAmountWrapper: { alignItems: 'flex-end', justifyContent: 'center' },
  quickInsightAmount: { fontSize: FontSize.body },
});
