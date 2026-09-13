import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, ChevronRight, DollarSign } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabParamList, RootStackParamList } from '../types';
import { getCategoryIcon } from '../lib/iconUtils';
import { formatCurrency } from '../lib/formatters';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// TODO: Supabase Integration - When Supabase is connected, income vs expense distinction
// should be driven by a dedicated `type` column ('income' | 'expense') on the expenses table.
// For now we use a hardcoded income category name match ('salary', 'income') as a temporary heuristic.
const INCOME_CATEGORY_NAMES = ['salary', 'income', 'freelance', 'business'];

const isIncomeCategory = (cat: Category | undefined) =>
  cat ? INCOME_CATEGORY_NAMES.some((k) => cat.name.toLowerCase().includes(k)) : false;

// ─── Pastel BG per category color ────────────────────────────────────────────
const pastelBg = (hex: string) => hex + '30'; // 19% opacity overlay

// ─── Donut chart ─────────────────────────────────────────────────────────────
type DonutProps = { spent: number; total: number };

const DonutChartBase: React.FC<DonutProps> = ({ spent, total }) => {
  const { colors } = useTheme();
  const size = 100;
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const safeTotal = total === 0 ? 1 : total;
  const spentRatio = Math.min(spent / safeTotal, 1);
  const incomeRatio = 1 - spentRatio;

  // Spent arc (peach) starts at -90° (top)
  const spentDash = spentRatio * circumference;
  // Income arc (mint) follows
  const incomeDash = incomeRatio * circumference;
  const incomeOffset = -(spentDash);

  return (
    <Svg width={size} height={size}>
      {/* Track (grey bg) */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={colors.chartTrack}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Income arc (mint) */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke="#B8E0C8"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${incomeDash} ${circumference}`}
        strokeDashoffset={incomeOffset}
        rotation={-90}
        origin={`${cx},${cy}`}
        strokeLinecap="round"
      />
      {/* Spent arc (peach) */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke="#F4B8AE"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${spentDash} ${circumference}`}
        strokeDashoffset={0}
        rotation={-90}
        origin={`${cx},${cy}`}
        strokeLinecap="round"
      />
    </Svg>
  );
};

const DonutChart = React.memo(DonutChartBase);

// ─── Transaction Row ──────────────────────────────────────────────────────────
type TxRowProps = {
  expense: Expense;
  category: Category | undefined;
  isIncome: boolean;
};

const TransactionRowBase: React.FC<TxRowProps> = ({ expense, category, isIncome }) => {
  const { colors } = useTheme();
  const IconComp = category ? (getCategoryIcon(category.icon) ?? DollarSign) : DollarSign;
  const catColor = category?.color ?? '#94A3B8';
  const bg = pastelBg(catColor);

  const dateStr = (() => {
    const d = new Date(expense.expense_date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  })();

  const amountLabel = isIncome ? `+${formatCurrency(expense.amount)}` : `−${formatCurrency(expense.amount)}`;
  const amountColor = isIncome ? '#4CAF7D' : colors.textPrimary;

  const modeLabel =
    expense.payment_mode === 'upi'
      ? 'UPI'
      : expense.payment_mode === 'card'
        ? 'Card'
        : 'Cash';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconContainer, { backgroundColor: bg }]}>
        <IconComp size={22} color={catColor} />
      </View>
      <View style={styles.txMiddle}>
        <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {category?.name ?? 'Other'}
        </Text>
        <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {expense.note ? `${expense.note} · ${modeLabel}` : modeLabel}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>{amountLabel}</Text>
        <Text style={[styles.txDate, { color: colors.textSecondary }]}>{dateStr}</Text>
      </View>
    </View>
  );
};

const TransactionRow = React.memo(TransactionRowBase);

// ─── Filter pills ─────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Daily', 'Weekly', 'Monthly'] as const;
type Filter = (typeof FILTERS)[number];

const filterExpenses = (expenses: Expense[], filter: Filter): Expense[] => {
  if (filter === 'All') return expenses;
  const now = new Date();
  return expenses.filter((e) => {
    const d = new Date(e.expense_date);
    if (filter === 'Daily') {
      return d.toDateString() === now.toDateString();
    } else if (filter === 'Weekly') {
      const diff = (now.getTime() - d.getTime()) / 86400000;
      return diff >= 0 && diff < 7;
    } else {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
  });
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();

  const [activeFilter, setActiveFilter] = useState<Filter>('Monthly');

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [fetchExpenses])
  );

  const catMap = useMemo(() => {
    const m: Record<string, Category> = {};
    categories.forEach((c) => (m[c.id] = c));
    return m;
  }, [categories]);

  const filtered = useMemo(
    () => filterExpenses(expenses, activeFilter),
    [expenses, activeFilter]
  );

  const { totalIncome, totalSpent } = useMemo(() => {
    let income = 0;
    let spent = 0;
    filtered.forEach((e) => {
      if (isIncomeCategory(catMap[e.category_id])) income += e.amount;
      else spent += e.amount;
    });
    return { totalIncome: income, totalSpent: spent };
  }, [filtered, catMap]);

  const recentTx = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
        .slice(0, 4),
    [expenses]
  );

  const { colors, isDark } = useTheme();
  const nameFromMeta = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.first_name;
  const dbName = profile?.first_name === 'User' ? null : profile?.first_name;
  const firstName = dbName || nameFromMeta?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.helloText, { color: colors.textSecondary }]}>Hello,</Text>
            <Text style={[styles.nameText, { color: colors.textPrimary }]}>{firstName}</Text>
          </View>
          <Pressable
            style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Notifications' as any)}
          >
            <Bell size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* ── Filter Pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsContent}
        >
          {FILTERS.map((f) => {
            const active = f === activeFilter;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[
                  styles.pill,
                  active
                    ? [styles.pillActive, { backgroundColor: isDark ? colors.mintGreenSoft : '#F0FAF4', borderColor: colors.mintGreen }]
                    : [styles.pillInactive, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.pillText,
                    active
                      ? [styles.pillTextActive, { color: colors.textPrimary }]
                      : [styles.pillTextInactive, { color: colors.textSecondary }],
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Summary Card ── */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          {/* Left column */}
          <View style={styles.summaryLeft}>
            <View style={styles.summaryLabelRow}>
              <View style={[styles.summaryBar, { backgroundColor: colors.mintGreen }]} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Income</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.textPrimary }]}>{formatCurrency(totalIncome)}</Text>

            <View style={[styles.summaryLabelRow, { marginTop: 20 }]}>
              <View style={[styles.summaryBar, { backgroundColor: colors.peachCoral }]} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Spent</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.textPrimary }]}>{formatCurrency(totalSpent)}</Text>
          </View>

          {/* Donut */}
          <DonutChart spent={totalSpent} total={totalIncome + totalSpent} />
        </View>

        {/* ── Recent Transactions ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent transactions</Text>
          <TouchableOpacity
            style={[styles.seeAllBtn, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.75}
          >
            <Text style={[styles.seeAllText, { color: colors.textSecondary }]}>See All</Text>
            <ChevronRight size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {recentTx.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions yet — tap + to add one!</Text>
          </View>
        ) : (
          recentTx.map((e) => (
            <TouchableOpacity
              key={e.id}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('ExpenseDetail', { expenseId: e.id })}
            >
              <TransactionRow
                expense={e}
                category={catMap[e.category_id]}
                isIncome={isIncomeCategory(catMap[e.category_id])}
              />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 24,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  helloText: {
    fontSize: 22,
    fontFamily: 'Quicksand_500Medium',
  },
  nameText: {
    fontSize: 36,
    fontFamily: 'Quicksand_700Bold',
    marginTop: -4,
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
  },

  // Filter pills
  pillsScroll: {
    marginTop: 24,
  },
  pillsContent: {
    paddingRight: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
  },
  pillActive: {
    borderWidth: 2,
  },
  pillInactive: {
    borderWidth: 1,
  },
  pillText: {
    fontSize: 14,
  },
  pillTextActive: {
    fontFamily: 'Quicksand_700Bold',
  },
  pillTextInactive: {
    fontFamily: 'Quicksand_500Medium',
  },

  // Summary Card
  summaryCard: {
    borderRadius: 28,
    marginTop: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
    marginLeft: 8,
  },
  summaryAmount: {
    fontSize: 24,
    fontFamily: 'Quicksand_700Bold',
    marginTop: 4,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Quicksand_700Bold',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
    marginRight: 4,
  },

  // Transaction rows
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  txIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: 16,
  },
  txTitle: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
  },
  txSubtitle: {
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
  },
  txDate: {
    fontSize: 12,
    fontFamily: 'Quicksand_500Medium',
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: 20,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Quicksand_500Medium',
    textAlign: 'center',
  },
});
