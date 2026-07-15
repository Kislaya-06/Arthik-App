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

const DonutChart: React.FC<DonutProps> = ({ spent, total }) => {
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
        stroke="#E8E9EE"
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

// ─── Transaction Row ──────────────────────────────────────────────────────────
type TxRowProps = {
  expense: Expense;
  category: Category | undefined;
  isIncome: boolean;
};

const TransactionRowBase: React.FC<TxRowProps> = ({ expense, category, isIncome }) => {
  const IconComp = category ? (getCategoryIcon(category.icon) ?? DollarSign) : DollarSign;
  const catColor = category?.color ?? '#94A3B8';
  const bg = pastelBg(catColor);

  const dateStr = (() => {
    const d = new Date(expense.expense_date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  })();

  const amountLabel = isIncome ? `+${formatCurrency(expense.amount)}` : `−${formatCurrency(expense.amount)}`;
  const amountColor = isIncome ? '#4CAF7D' : '#1A2B4C';

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
        <Text style={styles.txTitle} numberOfLines={1}>
          {category?.name ?? 'Other'}
        </Text>
        <Text style={styles.txSubtitle} numberOfLines={1}>
          {expense.note ? `${expense.note} · ${modeLabel}` : modeLabel}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>{amountLabel}</Text>
        <Text style={styles.txDate}>{dateStr}</Text>
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
  const profile = useAuthStore((s) => s.profile);
  const { expenses, fetchExpenses } = useExpenseStore();
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

  const firstName = profile?.first_name ?? 'there';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.helloText}>Hello,</Text>
            <Text style={styles.nameText}>{firstName}</Text>
          </View>
          <Pressable style={styles.bellBtn}>
            <Bell size={20} color="#1A2B4C" />
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
                style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Summary Card ── */}
        <View style={styles.summaryCard}>
          {/* Left column */}
          <View style={styles.summaryLeft}>
            <View style={styles.summaryLabelRow}>
              <View style={[styles.summaryBar, { backgroundColor: '#B8E0C8' }]} />
              <Text style={styles.summaryLabel}>Income</Text>
            </View>
            <Text style={styles.summaryAmount}>{formatCurrency(totalIncome)}</Text>

            <View style={[styles.summaryLabelRow, { marginTop: 20 }]}>
              <View style={[styles.summaryBar, { backgroundColor: '#F4B8AE' }]} />
              <Text style={styles.summaryLabel}>Spent</Text>
            </View>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSpent)}</Text>
          </View>

          {/* Donut */}
          <DonutChart spent={totalSpent} total={totalIncome + totalSpent} />
        </View>

        {/* ── Recent Transactions ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent transactions</Text>
          <TouchableOpacity
            style={styles.seeAllBtn}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.75}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <ChevronRight size={14} color="#8A8FA3" />
          </TouchableOpacity>
        </View>

        {recentTx.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet — tap + to add one!</Text>
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

        {/* Bottom padding so FAB / tab bar don't overlap */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#1A2B4C',
    fontFamily: 'Quicksand_500Medium',
  },
  nameText: {
    fontSize: 36,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
    marginTop: -4,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E9ED',
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
    borderColor: '#B8E0C8',
    backgroundColor: '#F0FAF4',
  },
  pillInactive: {
    borderWidth: 1,
    borderColor: '#E0E2E8',
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    fontSize: 14,
  },
  pillTextActive: {
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  pillTextInactive: {
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#F5F6F9',
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
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
    marginLeft: 8,
  },
  summaryAmount: {
    fontSize: 24,
    color: '#1A2B4C',
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
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E2E8',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  seeAllText: {
    fontSize: 14,
    color: '#8A8FA3',
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
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  txSubtitle: {
    fontSize: 14,
    color: '#8A8FA3',
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
    color: '#8A8FA3',
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
    color: '#B0B4C0',
    fontFamily: 'Quicksand_500Medium',
    textAlign: 'center',
  },
});
