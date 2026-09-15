import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { TrendingUp, TrendingDown, CheckSquare, Wallet, CreditCard } from 'lucide-react-native';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  subWeeks, subMonths, subYears, isWithinInterval, parseISO,
} from 'date-fns';

import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { TabParamList, RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Insights'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Period = 'Weekly' | 'Monthly' | 'Yearly';

const CHART_COLORS = [
  '#F4B8AE',
  '#A8C8EC',
  '#F0A8C8',
  '#C9B8E8',
  '#B8E0C8',
  '#F5D98B',
  '#94A3B8',
];

// Returns the appropriate icon component for the "Most Spent On" insight card
const getCategoryInsightIcon = (categoryName: string) => {
  const name = categoryName.toLowerCase();
  if (name.includes('food') || name.includes('eat')) return Wallet;
  if (name.includes('card') || name.includes('credit')) return CreditCard;
  return CheckSquare;
};

// Returns the appropriate icon component for the "Top Payment" insight card
const getPaymentInsightIcon = (mode: string) => {
  if (mode === 'card') return CreditCard;
  if (mode === 'cash') return Wallet;
  return CheckSquare;
};

export const InsightsScreen: React.FC<Props> = ({ navigation }) => {
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();

  const [period, setPeriod] = useState<Period>('Monthly');

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
      fetchCategories();
    }, [fetchExpenses, fetchCategories]),
  );

  const { currentInterval, previousInterval, periodLabel } = useMemo(() => {
    const now = new Date();
    let current, previous, label;

    if (period === 'Weekly') {
      current = { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
      previous = {
        start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
        end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
      };
      label = 'THIS WEEK';
    } else if (period === 'Monthly') {
      current = { start: startOfMonth(now), end: now };
      previous = {
        start: startOfMonth(subMonths(now, 1)),
        end: endOfMonth(subMonths(now, 1)),
      };
      label = 'THIS MONTH';
    } else {
      current = { start: startOfYear(now), end: now };
      previous = {
        start: startOfYear(subYears(now, 1)),
        end: endOfYear(subYears(now, 1)),
      };
      label = 'THIS YEAR';
    }
    return { currentInterval: current, previousInterval: previous, periodLabel: label };
  }, [period]);

  const { currentTotal, previousTotal, categoryTotals } = useMemo(() => {
    let currTotal = 0;
    let prevTotal = 0;
    const catTotals: Record<string, number> = {};

    expenses.forEach(exp => {
      if (exp.type === 'income') return;
      const expDate = parseISO(exp.expense_date);
      if (isWithinInterval(expDate, currentInterval)) {
        currTotal += exp.amount;
        if (exp.category_id) {
          catTotals[exp.category_id] = (catTotals[exp.category_id] || 0) + exp.amount;
        }
      } else if (isWithinInterval(expDate, previousInterval)) {
        prevTotal += exp.amount;
      }
    });

    return { currentTotal: currTotal, previousTotal: prevTotal, categoryTotals: catTotals };
  }, [expenses, currentInterval, previousInterval]);

  const { percentageChange, isIncrease } = useMemo(() => {
    if (previousTotal === 0) {
      return { percentageChange: currentTotal > 0 ? 100 : 0, isIncrease: true };
    }
    const diff = currentTotal - previousTotal;
    const perc = Math.round((Math.abs(diff) / previousTotal) * 100);
    return { percentageChange: perc, isIncrease: diff >= 0 };
  }, [currentTotal, previousTotal]);

  const sortedCategories = useMemo(() => {
    const arr = Object.keys(categoryTotals).map(catId => {
      const cat = categories.find(c => c.id === catId);
      return {
        id: catId,
        name: cat?.name || 'Unknown',
        amount: categoryTotals[catId],
        percentage: currentTotal > 0 ? Math.round((categoryTotals[catId] / currentTotal) * 100) : 0,
      };
    });
    return arr.sort((a, b) => b.amount - a.amount);
  }, [categoryTotals, categories, currentTotal]);

  const topCategory = sortedCategories.length > 0 ? sortedCategories[0] : null;

  const { weeklyData, maxWeekDay } = useMemo(() => {
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = weekDays.map(day => ({ day, amount: 0 }));

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const currentWeekInterval = { start: weekStart, end: weekEnd };

    expenses.forEach(exp => {
      const expDate = parseISO(exp.expense_date);
      if (isWithinInterval(expDate, currentWeekInterval)) {
        let dayIndex = expDate.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6;
        data[dayIndex].amount += exp.amount;
      }
    });

    let maxDay = data[0];
    let maxAmt = 0;
    data.forEach(d => {
      if (d.amount > maxAmt) {
        maxAmt = d.amount;
        maxDay = d;
      }
    });

    return { weeklyData: data, maxWeekDay: maxAmt > 0 ? maxDay : null };
  }, [expenses]);

  const topPaymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    expenses.forEach(exp => {
      if (isWithinInterval(parseISO(exp.expense_date), currentInterval)) {
        counts[exp.payment_mode] = (counts[exp.payment_mode] || 0) + 1;
        total++;
      }
    });

    let topMode = 'None';
    let maxCount = 0;
    for (const mode in counts) {
      if (counts[mode] > maxCount) {
        maxCount = counts[mode];
        topMode = mode;
      }
    }

    let formattedMode = topMode;
    if (topMode.toLowerCase() === 'upi') formattedMode = 'UPI';
    else if (topMode !== 'None') formattedMode = topMode.charAt(0).toUpperCase() + topMode.slice(1);

    return {
      mode: formattedMode,
      percentage: total > 0 ? Math.round((maxCount / total) * 100) : 0,
      originalMode: topMode,
    };
  }, [expenses, currentInterval]);

  // Derive icon components once — avoids inline IIFEs in JSX
  const CategoryInsightIcon = getCategoryInsightIcon(topCategory?.name || '');
  const PaymentInsightIcon = getPaymentInsightIcon(topPaymentData.originalMode);

  const SVG_SIZE = 220;
  const STROKE_WIDTH = 28;
  const RADIUS = (SVG_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const CENTER = SVG_SIZE / 2;

  let currentAngle = -90;
  const chartSegments = sortedCategories.map((item, index) => {
    const fraction = currentTotal > 0 ? item.amount / currentTotal : 0;
    const arcLength = fraction * CIRCUMFERENCE;
    const startAngle = currentAngle;
    currentAngle += fraction * 360;

    return {
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      strokeDasharray: `${arcLength} ${CIRCUMFERENCE}`,
      transform: `rotate(${startAngle}, ${CENTER}, ${CENTER})`,
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
            Insights
          </Text>
          <View style={[styles.segmentedControl, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['Weekly', 'Monthly', 'Yearly'] as Period[]).map((p) => {
              const isActive = period === p;
              return (
                <Pressable
                  key={p}
                  style={[
                    styles.segmentBtn,
                    isActive && { backgroundColor: colors.mintGreen },
                  ]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[
                    styles.segmentText,
                    { color: isActive ? colors.forestGreen : colors.textSecondary },
                    { fontFamily: isActive ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
                  ]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Total Spend Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? colors.card : '#1A2B4C', borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}>
          <View style={[styles.heroCircle1, { backgroundColor: isDark ? '#1A263B' : '#2A3C64' }]} />
          <View style={[styles.heroCircle2, { backgroundColor: isDark ? '#1A263B' : '#2A3C64' }]} />

          <Text style={[styles.heroLabel, { fontFamily: 'Quicksand_700Bold' }]}>
            TOTAL SPENT {periodLabel}
          </Text>

          <View style={styles.heroAmountRow}>
            <Text style={[styles.heroCurrency, { fontFamily: 'Quicksand_700Bold' }]}>₹</Text>
            <Text style={[styles.heroAmount, { fontFamily: 'Quicksand_700Bold' }]}>
              {currentTotal.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.heroComparisonRow}>
            <View style={styles.trendBadge}>
              {isIncrease ? (
                <TrendingUp size={12} color="#F4B8AE" />
              ) : (
                <TrendingDown size={12} color="#B8E0C8" />
              )}
              <Text style={[
                styles.trendText,
                { color: isIncrease ? '#F4B8AE' : '#B8E0C8', fontFamily: 'Quicksand_700Bold' },
              ]}>
                {percentageChange}% vs last {period.replace('ly', '').toLowerCase()}
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
        </View>

        {/* By Category Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
          By Category
        </Text>

        {currentTotal > 0 ? (
          <>
            <View style={styles.chartContainer}>
              <Svg width={SVG_SIZE} height={SVG_SIZE}>
                {chartSegments.map((segment) => (
                  <Circle
                    key={segment.id}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    stroke={segment.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={segment.strokeDasharray}
                    strokeDashoffset={0}
                    strokeLinecap="butt"
                    fill="none"
                    transform={segment.transform}
                  />
                ))}
              </Svg>
              <View style={styles.chartCenterContent}>
                <Text style={[styles.chartCenterLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>Top spend</Text>
                <Text style={[styles.chartCenterTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>{topCategory?.name}</Text>
                <Text style={[styles.chartCenterValue, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>{topCategory?.percentage}%</Text>
              </View>
            </View>

            <View style={styles.legendGrid}>
              {chartSegments.map(segment => (
                <Pressable
                  key={segment.id}
                  style={styles.legendItem}
                  onPress={() => navigation.navigate('CategoryDetail', { categoryId: segment.id })}
                >
                  <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                  <View>
                    <Text style={[styles.legendName, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>{segment.name}</Text>
                    <Text style={[styles.legendSubtext, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
                      ₹{segment.amount.toLocaleString('en-IN')} · {segment.percentage}%
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* This Week Bar Chart Section */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold', marginTop: 40 }]}>
              This Week
            </Text>

            <View style={styles.barChartContainer}>
              {weeklyData.map(d => {
                const isMax = maxWeekDay && maxWeekDay.day === d.day && d.amount > 0;
                const height = maxWeekDay?.amount
                  ? (d.amount === 0 ? 0 : Math.max(20, (d.amount / maxWeekDay.amount) * 120))
                  : 0;

                return (
                  <View key={d.day} style={styles.barColumn}>
                    <View style={[styles.bar, { height, backgroundColor: isMax ? '#F4B8AE' : '#B8E0C8' }]} />
                    <Text style={[
                      styles.barLabel,
                      { color: isMax ? '#E8956A' : colors.textSecondary },
                      { fontFamily: isMax ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
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
                <Text style={[styles.highestSpendText, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
                  Highest spend:{' '}
                  <Text style={{ fontFamily: 'Quicksand_700Bold', color: colors.textPrimary }}>
                    {maxWeekDay.day} — ₹{maxWeekDay.amount.toLocaleString('en-IN')}
                  </Text>
                </Text>
              </View>
            )}

            {/* Quick Insights Section */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold', marginTop: 40 }]}>
              Quick Insights
            </Text>

            <View style={styles.quickInsightsGrid}>
              {/* Card 1 - Most Spent On */}
              <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <View style={[styles.insightIconBadge, { backgroundColor: colors.peachSoft }]}>
                  <CategoryInsightIcon size={20} color="#E8956A" />
                </View>
                <Text style={[styles.insightLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>Most Spent On</Text>
                <Text style={[styles.insightValue, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>{topCategory?.name || 'N/A'}</Text>
                <Text style={[styles.insightAmount, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
                  {topCategory ? `₹${topCategory.amount.toLocaleString('en-IN')}` : '-'}
                </Text>
              </View>

              {/* Card 2 - Top Payment */}
              <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                <View style={[styles.insightIconBadge, { backgroundColor: colors.mintGreenSoft }]}>
                  <PaymentInsightIcon size={20} color="#4CAF7D" />
                </View>
                <Text style={[styles.insightLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>Top Payment</Text>
                <Text style={[styles.insightValue, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>{topPaymentData.mode}</Text>
                <Text style={[styles.insightAmount, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
                  {topPaymentData.percentage}% of txns
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textMuted, fontFamily: 'Quicksand_500Medium' }]}>
              No expenses found for this period.
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 30,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  segmentText: {
    fontSize: 12,
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCircle1: {
    position: 'absolute',
    top: -50,
    right: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.5,
  },
  heroCircle2: {
    position: 'absolute',
    bottom: -80,
    right: 40,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.3,
  },
  heroLabel: {
    fontSize: 12,
    color: '#8A93AB',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  heroCurrency: {
    fontSize: 24,
    color: '#FFFFFF',
    marginRight: 6,
  },
  heroAmount: {
    fontSize: 48,
    color: '#FFFFFF',
  },
  heroComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
  },
  sparklineContainer: {
    width: 100,
    height: 30,
  },
  sectionTitle: {
    fontSize: 20,
    marginTop: 32,
    marginBottom: 24,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chartCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenterLabel: {
    fontSize: 14,
  },
  chartCenterTitle: {
    fontSize: 20,
    marginTop: 4,
  },
  chartCenterValue: {
    fontSize: 16,
    marginTop: 2,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  legendItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  legendName: {
    fontSize: 16,
  },
  legendSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 32,
  },
  emptyStateText: {
    fontSize: 16,
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 32,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 12,
  },

  highestSpendCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 20,
  },
  highestSpendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F4B8AE',
    marginRight: 8,
  },
  highestSpendText: {
    fontSize: 14,
  },
  quickInsightsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  insightCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  insightIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  insightLabel: {
    fontSize: 12,
  },
  insightValue: {
    fontSize: 18,
    marginTop: 4,
  },
  insightAmount: {
    fontSize: 14,
    marginTop: 2,
  },
});
