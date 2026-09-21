import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, PanResponder, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  TrendingUp, TrendingDown, CheckSquare, Wallet, CreditCard,
  ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subWeeks, subMonths, subYears,
  isWithinInterval, isBefore, startOfDay, parseISO, format,
} from 'date-fns';

import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useAuthStore } from '../store/authStore';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { TabParamList, RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency } from '../lib/formatters';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Insights'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Period = 'Weekly' | 'Monthly' | 'Yearly';

const CHART_COLORS = [
  '#F4B8AE', '#A8C8EC', '#F0A8C8', '#C9B8E8', '#B8E0C8', '#F5D98B', '#94A3B8',
];

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
  if (period === 'Weekly') return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
  return period === 'Monthly' ? format(start, 'MMM yyyy') : format(start, 'yyyy');
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
          <ChevronLeft size={16} color={isAtOldest ? 'rgba(255,255,255,0.25)' : '#FFFFFF'} />
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
          <ChevronRight size={16} color={isAtCurrent ? 'rgba(255,255,255,0.25)' : '#FFFFFF'} />
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
                    backgroundColor: `rgba(255,255,255,${dotOpacity.toFixed(2)})`,
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
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  arrowDisabled: { opacity: 0.35 },
  labelBlock: { alignItems: 'center', minWidth: 150 },
  dateLabel: { fontSize: FontSize.cta, color: '#FFFFFF' },
  subLabel: { fontSize: FontSize.bodySmall, color: 'rgba(255,255,255,0.6)', marginTop: Spacing.nano },
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
    backgroundColor: '#FFFFFF',
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export const InsightsScreen: React.FC<Props> = ({ navigation }) => {
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const user = useAuthStore((s) => s.user);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();

  const [period, setPeriod] = useState<Period>('Monthly');
  // offset=0 → current period, negative → how many periods back
  const [offset, setOffset] = useState(0);
  const [focusTime, setFocusTime] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const lastFetchTime = useRef<number>(0);

  // Reset to current period when the user switches period type (Weekly/Monthly/Yearly)
  const handlePeriodChange = useCallback((p: Period) => {
    setPeriod(p);
    setOffset(0);
  }, []);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    setFocusTime(now);
    if (!force && now - lastFetchTime.current < 60_000) return;
    lastFetchTime.current = now;
    await Promise.all([fetchExpenses(), fetchCategories()]);
  }, [fetchExpenses, fetchCategories]);

  useFocusEffect(
    useCallback(() => { loadData(false); }, [loadData]),
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
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;
      if (!earliest || exp.expense_date < earliest) {
        earliest = exp.expense_date;
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

    // Sub-label date range shown beneath the main label for older periods
    let sLabel = '';
    if (offset <= -2) {
      if (period === 'Weekly') {
        sLabel = `${format(current.start, 'd MMM')} – ${format(current.end, 'd MMM yyyy')}`;
      } else if (period === 'Monthly') {
        sLabel = format(current.start, 'MMMM yyyy');
      }
    }

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
            setOffset((o) => Math.min(o + 1, 0));
          } else if (gs.dx > 40 && offset > minOff) {
            // Swipe right → go back in time
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

      const date = parseISO(exp.expense_date);
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
      .map((catId) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          id: catId,
          name: cat?.name || (catId === 'others' ? 'Others' : 'Unknown'),
          amount: categoryTotals[catId],
          percentage: currentTotal > 0 ? Math.round((categoryTotals[catId] / currentTotal) * 100) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [categoryTotals, categories, currentTotal]);

  const topCategory = sortedCategories[0] ?? null;

  // Bar chart: shows Mon–Sun data for the selected week.
  // For Monthly/Yearly views it always reflects the current calendar week (same as before).
  const { weeklyData, maxWeekDay } = useMemo(() => {
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = weekDays.map((day) => ({ day, amount: 0 }));

    const weekRef = period === 'Weekly' && offset < 0
      ? subWeeks(new Date(), Math.abs(offset))
      : new Date();

    const weekInterval = {
      start: startOfWeek(weekRef, { weekStartsOn: 1 }),
      end: endOfWeek(weekRef, { weekStartsOn: 1 }),
    };

    for (const exp of expenses) {
      const date = parseISO(exp.expense_date);
      if (isWithinInterval(date, weekInterval)) {
        let dayIndex = date.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6; // Sunday wraps to index 6
        data[dayIndex].amount += exp.amount;
      }
    }

    const maxDay = data.reduce((max, d) => (d.amount > max.amount ? d : max), data[0]);
    return { weeklyData: data, maxWeekDay: maxDay.amount > 0 ? maxDay : null };
  }, [expenses, period, offset]);

  const topPaymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;

    for (const exp of expenses) {
      if (isWithinInterval(parseISO(exp.expense_date), currentInterval)) {
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

  // ─── Donut chart geometry ──────────────────────────────────────────────────
  const SVG_SIZE = 220;
  const STROKE_WIDTH = 28;
  const RADIUS = (SVG_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const CENTER = SVG_SIZE / 2;

  const chartSegments = useMemo(() => {
    let angle = -90;
    return sortedCategories.map((item, i) => {
      const fraction = currentTotal > 0 ? item.amount / currentTotal : 0;
      const arcLength = fraction * CIRCUMFERENCE;
      const startAngle = angle;
      angle += fraction * 360;
      return {
        ...item,
        color: CHART_COLORS[i % CHART_COLORS.length],
        strokeDasharray: `${arcLength} ${CIRCUMFERENCE}`,
        transform: `rotate(${startAngle}, ${CENTER}, ${CENTER})`,
      };
    });
  }, [sortedCategories, currentTotal, CIRCUMFERENCE, CENTER]);

  // Derive icon components once — avoids inline function calls in JSX
  const CategoryInsightIcon = getCategoryInsightIcon(topCategory?.name || '');
  const PaymentInsightIcon = getPaymentInsightIcon(topPaymentData.originalMode);

  // Trend label respects "vs prev week/month/year" for past-period navigation
  const trendLabel = `${percentageChange}% vs prev ${
    period === 'Weekly' ? 'week' : period === 'Monthly' ? 'month' : 'year'
  }`;

  // Bar chart section title
  const barChartTitle = period === 'Weekly' && offset < 0
    ? `Week of ${format(buildInterval('Weekly', offset).start, 'd MMM')}`
    : 'This Week';

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
          <View style={[styles.segmentedControl, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['Weekly', 'Monthly', 'Yearly'] as Period[]).map((p) => {
              const isActive = period === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.segmentBtn, isActive && { backgroundColor: colors.mintGreen }]}
                  onPress={() => handlePeriodChange(p)}
                >
                  <Text style={[
                    styles.segmentText,
                    { color: isActive ? colors.forestGreen : colors.textSecondary },
                    { fontFamily: isActive ? FontFamily.bold : FontFamily.medium },
                  ]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Total Spend Hero Card (swipeable) ── */}
        <View
          {...panResponder.panHandlers}
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? colors.card : '#1A2B4C',
              borderWidth: isDark ? 1 : 0,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Decorative background circles */}
          <View style={[styles.heroCircle1, { backgroundColor: isDark ? '#1A263B' : '#2A3C64' }]} />
          <View style={[styles.heroCircle2, { backgroundColor: isDark ? '#1A263B' : '#2A3C64' }]} />

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
              {isIncrease
                ? <TrendingUp size={12} color="#F4B8AE" />
                : <TrendingDown size={12} color="#B8E0C8" />
              }
              <Text style={[
                styles.trendText,
                { color: isIncrease ? '#F4B8AE' : '#B8E0C8', fontFamily: FontFamily.bold },
              ]}>
                {trendLabel}
              </Text>
            </View>

            <View style={styles.sparklineContainer}>
              <Svg width="100" height="30" viewBox="0 0 100 30">
                <Polyline
                  points={isIncrease ? '0,25 20,20 40,28 60,15 80,10 100,5' : '0,5 20,10 40,8 60,20 80,15 100,25'}
                  fill="none"
                  stroke="#4A5A78"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
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
            onPrev={() => setOffset((o) => Math.max(o - 1, minOff))}
            onNext={() => setOffset((o) => Math.min(o + 1, 0))}
          />
        </View>

        {/* ── By Category Section ── */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          By Category
        </Text>

        {currentTotal > 0 ? (
          <>
            {/* Donut chart */}
            <View style={styles.chartContainer}>
              <Svg width={SVG_SIZE} height={SVG_SIZE}>
                {chartSegments.map((seg) => (
                  <Circle
                    key={seg.id}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    stroke={seg.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={0}
                    strokeLinecap="butt"
                    fill="none"
                    transform={seg.transform}
                  />
                ))}
              </Svg>
              <View style={styles.chartCenterContent}>
                <Text style={[styles.chartCenterLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  Top spend
                </Text>
                <Text style={[styles.chartCenterTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                  {topCategory?.name}
                </Text>
                <Text style={[styles.chartCenterValue, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  {topCategory?.percentage}%
                </Text>
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legendGrid}>
              {chartSegments.map((seg) => (
                <Pressable
                  key={seg.id}
                  style={styles.legendItem}
                  onPress={() => navigation.navigate('CategoryDetail', { categoryId: seg.id })}
                >
                  <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                  <View>
                    <Text style={[styles.legendName, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                      {seg.name}
                    </Text>
                    <Text style={[styles.legendSubtext, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                      {formatCurrency(seg.amount)} · {seg.percentage}%
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* ── Bar Chart Section ── */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold, marginTop: 40 }]}>
              {barChartTitle}
            </Text>

            <View style={styles.barChartContainer}>
              {weeklyData.map((d) => {
                const isMax = maxWeekDay?.day === d.day && d.amount > 0;
                const height = maxWeekDay?.amount
                  ? (d.amount === 0 ? 0 : Math.max(20, (d.amount / maxWeekDay.amount) * 120))
                  : 0;
                return (
                  <View key={d.day} style={styles.barColumn}>
                    <View style={[styles.bar, { height, backgroundColor: isMax ? '#F4B8AE' : '#B8E0C8' }]} />
                    <Text style={[
                      styles.barLabel,
                      { color: isMax ? '#E8956A' : colors.textSecondary },
                      { fontFamily: isMax ? FontFamily.bold : FontFamily.medium },
                    ]}>
                      {d.day}
                    </Text>
                  </View>
                );
              })}
            </View>

            {maxWeekDay && maxWeekDay.amount > 0 && (
              <View style={[styles.highestSpendCallout, { backgroundColor: isDark ? colors.cardSubtle : '#FDEEE4' }]}>
                <View style={styles.highestSpendDot} />
                <Text style={[styles.highestSpendText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  Highest spend:{' '}
                  <Text style={{ fontFamily: FontFamily.bold, color: colors.textPrimary }}>
                    {maxWeekDay.day} — {formatCurrency(maxWeekDay.amount)}
                  </Text>
                </Text>
              </View>
            )}

            {/* ── Quick Insights Section ── */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold, marginTop: 40 }]}>
              Quick Insights
            </Text>

            <View style={styles.quickInsightsGrid}>
              <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <View style={[styles.insightIconBadge, { backgroundColor: colors.peachSoft }]}>
                  <CategoryInsightIcon size={20} color="#E8956A" />
                </View>
                <Text style={[styles.insightLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  Most Spent On
                </Text>
                <Text style={[styles.insightValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                  {topCategory?.name || 'N/A'}
                </Text>
                <Text style={[styles.insightAmount, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  {topCategory ? formatCurrency(topCategory.amount) : '-'}
                </Text>
              </View>

              <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <View style={[styles.insightIconBadge, { backgroundColor: colors.mintGreenSoft }]}>
                  <PaymentInsightIcon size={20} color="#4CAF7D" />
                </View>
                <Text style={[styles.insightLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  Top Payment
                </Text>
                <Text style={[styles.insightValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                  {topPaymentData.mode}
                </Text>
                <Text style={[styles.insightAmount, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  {topPaymentData.percentage}% of txns
                </Text>
              </View>
            </View>
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
  heroLabel: { fontSize: FontSize.caption, color: '#8A93AB', letterSpacing: 1, textTransform: 'uppercase' },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.micro },
  heroCurrency: { fontSize: 24, color: '#FFFFFF', marginRight: 6 },
  heroAmount: { fontSize: 48, color: '#FFFFFF' },
  heroComparisonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.element,
  },
  trendBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.group, paddingVertical: 6, gap: Spacing.micro,
  },
  trendText: { fontSize: FontSize.caption },
  sparklineContainer: { width: 100, height: 30 },
  sectionTitle: { fontSize: FontSize.sectionTitle, marginTop: Spacing.section, marginBottom: Spacing.gutter },
  chartContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  chartCenterContent: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  chartCenterLabel: { fontSize: FontSize.bodySmall },
  chartCenterTitle: { fontSize: 20, marginTop: Spacing.micro },
  chartCenterValue: { fontSize: FontSize.body, marginTop: Spacing.nano },
  legendGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: Spacing.section,
  },
  legendItem: {
    width: '48%', flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.surface,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.group },
  legendName: { fontSize: FontSize.body },
  legendSubtext: { fontSize: FontSize.bodySmall, marginTop: Spacing.nano },
  emptyState: { alignItems: 'center', marginTop: Spacing.section },
  emptyStateText: { fontSize: FontSize.body },
  barChartContainer: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150,
  },
  barColumn: { alignItems: 'center', flex: 1 },
  bar: { width: 32, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  barLabel: { marginTop: Spacing.element, fontSize: FontSize.caption },
  highestSpendCallout: {
    flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block, paddingVertical: Spacing.row, marginTop: Spacing.surface,
  },
  highestSpendDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#F4B8AE', marginRight: Spacing.element,
  },
  highestSpendText: { fontSize: FontSize.bodySmall },
  quickInsightsGrid: { flexDirection: 'row', gap: Spacing.block },
  insightCard: { flex: 1, borderRadius: BorderRadius.card, padding: Spacing.surface, borderWidth: 1 },
  insightIconBadge: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.block,
  },
  insightLabel: { fontSize: FontSize.caption },
  insightValue: { fontSize: 18, marginTop: Spacing.micro },
  insightAmount: { fontSize: FontSize.bodySmall, marginTop: Spacing.nano },
});
