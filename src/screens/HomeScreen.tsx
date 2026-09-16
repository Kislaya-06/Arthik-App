import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, ChevronRight, DollarSign, User, Wallet } from 'lucide-react-native';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import Svg, { Circle } from 'react-native-svg';
import {
  format,
  parseISO,
  isSameWeek,
  isSameMonth,
  isSameYear,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabParamList, RootStackParamList } from '../types';
import { getCategoryIcon } from '../lib/iconUtils';
import { formatCurrency } from '../lib/formatters';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

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

  const hasData = total > 0;
  const spentRatio = hasData ? Math.max(0, Math.min(spent / total, 1)) : 0;
  const incomeRatio = hasData ? Math.max(0, 1 - spentRatio) : 0;

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
      {incomeRatio > 0 && (
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={colors.mintGreen}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${incomeDash} ${circumference}`}
          strokeDashoffset={incomeOffset}
          rotation={-90}
          origin={`${cx},${cy}`}
          strokeLinecap={incomeRatio >= 0.999 ? 'butt' : 'round'}
        />
      )}
      {/* Spent arc (peach) */}
      {spentRatio > 0 && (
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={colors.peachCoral}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${spentDash} ${circumference}`}
          strokeDashoffset={0}
          rotation={-90}
          origin={`${cx},${cy}`}
          strokeLinecap={spentRatio >= 0.999 ? 'butt' : 'round'}
        />
      )}
    </Svg>
  );
};

const DonutChart = React.memo(DonutChartBase);

// ─── Transaction Row ──────────────────────────────────────────────────────────
type TxRowProps = {
  expense: Expense;
  category: Category | undefined;
  isIncome: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
};

const TransactionRowBase: React.FC<TxRowProps> = ({ expense, category, isIncome, colors, isDark }) => {
  const IconComp = category ? (getCategoryIcon(category.icon) ?? DollarSign) : (isIncome ? Wallet : DollarSign);
  const catColor = category?.color ?? (isIncome ? colors.mintGreen : '#94A3B8');
  const bg = pastelBg(catColor);

  const dateStr = useMemo(() => {
    try {
      return format(parseISO(expense.expense_date), 'd MMM');
    } catch {
      return expense.expense_date;
    }
  }, [expense.expense_date]);

  const amountLabel = isIncome ? `+${formatCurrency(expense.amount)}` : `−${formatCurrency(expense.amount)}`;
  const amountColor = isIncome ? (isDark ? colors.mintGreen : colors.mintGreenDark) : colors.textPrimary;

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
          {category?.name ?? (isIncome ? 'Money Added' : 'Other')}
        </Text>
        <View style={styles.txSubtitleRow}>
          {expense.note ? (
            <>
              <Text
                style={[styles.txSubtitle, styles.txNoteText, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {expense.note}
              </Text>
              <Text
                style={[styles.txSubtitle, styles.txModeText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {` · ${modeLabel}`}
              </Text>
            </>
          ) : (
            <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {modeLabel}
            </Text>
          )}
        </View>
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
  const todayStr = format(now, 'yyyy-MM-dd');

  return expenses.filter((e) => {
    if (!e.expense_date) return false;

    const cleanDate = e.expense_date.split('T')[0]?.trim();
    if (!cleanDate) return false;

    if (filter === 'Daily') {
      return cleanDate === todayStr;
    }

    try {
      const expenseDate = parseISO(cleanDate);
      if (filter === 'Weekly') {
        return isSameWeek(expenseDate, now, { weekStartsOn: 1 });
      }
      if (filter === 'Monthly') {
        return isSameMonth(expenseDate, now) && isSameYear(expenseDate, now);
      }
    } catch {
      return false;
    }
    return true;
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

  const [activeFilter, setActiveFilter] = useState<Filter>('Daily');

  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
  const getTodayRecord = useDailyBudgetStore((s) => s.getTodayRecord);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const syncWithExpenses = useDailyBudgetStore((s) => s.syncWithExpenses);

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const lastFetchTime = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
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
      loadData(false);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const catMap = useMemo(() => {
    const m: Record<string, Category> = {};
    for (let i = 0; i < categories.length; i++) {
      m[categories[i].id] = categories[i];
    }
    return m;
  }, [categories]);

  const filtered = useMemo(
    () => filterExpenses(expenses, activeFilter),
    [expenses, activeFilter]
  );

  const { totalIncome, totalSpent } = useMemo(() => {
    let income = 0;
    let spent = 0;
    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      const isIncome = isIncomeTransaction(e, cat);
      if (isIncome) income += Number(e.amount) || 0;
      else spent += Number(e.amount) || 0;
    }
    return { totalIncome: income, totalSpent: spent };
  }, [filtered, catMap]);

  const recentTx = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => {
          const dateCmp = b.expense_date.localeCompare(a.expense_date);
          if (dateCmp !== 0) return dateCmp;
          return (b.created_at || '').localeCompare(a.created_at || '');
        })
        .slice(0, 4),
    [expenses]
  );

  const { colors, isDark } = useTheme();
  const nameFromMeta = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.first_name;
  const dbName = profile?.first_name === 'User' ? null : profile?.first_name;
  const firstName = dbName || nameFromMeta?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  const nameFontSize = useMemo(() => {
    const len = firstName.length;
    if (len <= 8) return 36;
    if (len <= 11) return 30;
    if (len <= 14) return 26;
    if (len <= 18) return 22;
    return 19;
  }, [firstName]);

  const todayRecord = useMemo(
    () => getTodayRecord(),
    [getTodayRecord, dailyRecords, dailyBudgetAmount, expenses]
  );
  const todayBudget = todayRecord.budget;
  // Calculate today's spent directly from expenses for today to guarantee 0-lag live reactivity
  const todayLiveSpent = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let spent = 0;
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const cleanDate = e.expense_date?.split('T')[0]?.trim();
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      const isIncome = isIncomeTransaction(e, cat);
      if (cleanDate === todayStr && !isIncome) {
        spent += Number(e.amount) || 0;
      }
    }
    return spent;
  }, [expenses, catMap]);

  const todayRecordSpent = activeFilter === 'Daily' ? totalSpent : todayLiveSpent;
  const todayRemaining = Math.max(0, todayBudget - todayRecordSpent);
  const isOverBudget = todayBudget > 0 && todayRecordSpent > todayBudget;
  const budgetRatio = todayBudget > 0 ? Math.min(todayRecordSpent / todayBudget, 1) : 0;

  // Comprehensive financial aggregation for the Hero Summary Card (Option A: Remaining Balance Model):
  // Directly reflects user expenses (minus) and income/allowance (plus) in real-time.
  const {
    primaryAmount,
    primaryLabel,
    primarySubtext,
    displaySpent,
    totalAvailable,
    isOverBudgetPeriod,
  } = useMemo(() => {
    const activeDailyBudget = todayBudget > 0 ? todayBudget : (dailyBudgetAmount || 500);
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    const userCreatedAtStr = user?.created_at?.split('T')[0]?.trim();

    // Determine the complete calendar days belonging to the active period
    const periodDates: string[] = [];

    if (activeFilter === 'Daily') {
      periodDates.push(todayStr);
    } else if (activeFilter === 'Weekly') {
      // Current full week (Monday through Sunday)
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      days.forEach((d) => {
        const dStr = format(d, 'yyyy-MM-dd');
        if (!userCreatedAtStr || dStr >= userCreatedAtStr) {
          periodDates.push(dStr);
        }
      });
    } else if (activeFilter === 'Monthly') {
      // Current full month (1st through end of month)
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      days.forEach((d) => {
        const dStr = format(d, 'yyyy-MM-dd');
        if (!userCreatedAtStr || dStr >= userCreatedAtStr) {
          periodDates.push(dStr);
        }
      });
    } else {
      // 'All' filter: all past dates tracked up to today
      const allDates = new Set<string>();
      allDates.add(todayStr);
      for (let i = 0; i < filtered.length; i++) {
        const d = filtered[i].expense_date?.split('T')[0]?.trim();
        if (d && d <= todayStr && (!userCreatedAtStr || d >= userCreatedAtStr)) {
          allDates.add(d);
        }
      }
      Object.keys(dailyRecords).forEach((d) => {
        const cleanD = d.split('T')[0]?.trim();
        if (cleanD && cleanD <= todayStr && (!userCreatedAtStr || cleanD >= userCreatedAtStr)) {
          allDates.add(cleanD);
        }
      });
      allDates.forEach((d) => periodDates.push(d));
    }

    let periodBudget = 0;
    periodDates.forEach((d) => {
      if (d === todayStr && todayBudget > 0) {
        periodBudget += todayBudget;
      } else if (dailyRecords[d]?.budget) {
        periodBudget += dailyRecords[d].budget;
      } else {
        periodBudget += activeDailyBudget;
      }
    });

    const daysCount = periodDates.length;
    const income = totalIncome;
    const spent = totalSpent;

    let budgetPool = activeDailyBudget;
    if (activeFilter === 'Weekly' || activeFilter === 'Monthly' || activeFilter === 'All') {
      budgetPool = periodBudget > 0 ? periodBudget : activeDailyBudget;
    }

    const available = budgetPool + income;
    const isOver = spent > available && available > 0;
    const remaining = Math.max(0, available - spent);
    const overAmount = isOver ? spent - available : 0;

    let label = 'Remaining to Spend';
    let subtext: string | null = null;

    if (activeFilter === 'Daily') {
      if (isOver) {
        label = 'Daily Budget Exceeded';
        subtext = `Exceeded daily limit by ₹${Math.round(overAmount).toLocaleString('en-IN')}`;
      } else {
        label = 'Remaining to Spend';
        if (budgetPool > 0 && income > 0) {
          subtext = `₹${Math.round(budgetPool).toLocaleString('en-IN')} budget + ₹${Math.round(income).toLocaleString('en-IN')} income`;
        } else if (income > 0) {
          subtext = `of ₹${Math.round(income).toLocaleString('en-IN')} total income`;
        } else {
          subtext = `of ₹${Math.round(budgetPool).toLocaleString('en-IN')} daily allowance`;
        }
      }
    } else if (activeFilter === 'Weekly') {
      if (isOver) {
        label = 'Weekly Budget Exceeded';
        subtext = `Exceeded weekly limit by ₹${Math.round(overAmount).toLocaleString('en-IN')}`;
      } else {
        label = 'Weekly Remaining';
        if (budgetPool > 0 && income > 0) {
          subtext = `₹${Math.round(budgetPool).toLocaleString('en-IN')} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'}) + ₹${Math.round(income).toLocaleString('en-IN')} income`;
        } else if (income > 0) {
          subtext = `of ₹${Math.round(income).toLocaleString('en-IN')} total income`;
        } else {
          subtext = `of ₹${Math.round(budgetPool).toLocaleString('en-IN')} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'})`;
        }
      }
    } else if (activeFilter === 'Monthly') {
      if (isOver) {
        label = 'Monthly Budget Exceeded';
        subtext = `Exceeded monthly limit by ₹${Math.round(overAmount).toLocaleString('en-IN')}`;
      } else {
        label = 'Monthly Remaining';
        if (budgetPool > 0 && income > 0) {
          subtext = `₹${Math.round(budgetPool).toLocaleString('en-IN')} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'}) + ₹${Math.round(income).toLocaleString('en-IN')} income`;
        } else if (income > 0) {
          subtext = `of ₹${Math.round(income).toLocaleString('en-IN')} total income`;
        } else {
          subtext = `of ₹${Math.round(budgetPool).toLocaleString('en-IN')} budget (${daysCount} ${daysCount === 1 ? 'day' : 'days'})`;
        }
      }
    } else {
      // 'All' filter
      if (isOver) {
        label = 'Total Budget Exceeded';
        subtext = `Exceeded total limit by ₹${Math.round(overAmount).toLocaleString('en-IN')}`;
      } else {
        label = 'Total Remaining';
        if (budgetPool > 0 && income > 0) {
          subtext = `₹${Math.round(budgetPool).toLocaleString('en-IN')} budget + ₹${Math.round(income).toLocaleString('en-IN')} income`;
        } else if (income > 0) {
          subtext = `of ₹${Math.round(income).toLocaleString('en-IN')} total income`;
        } else {
          subtext = `of ₹${Math.round(budgetPool).toLocaleString('en-IN')} total budget`;
        }
      }
    }

    return {
      primaryAmount: isOver ? overAmount : remaining,
      primaryLabel: label,
      primarySubtext: subtext,
      displaySpent: spent,
      totalAvailable: available,
      isOverBudgetPeriod: isOver,
    };
  }, [activeFilter, todayBudget, dailyBudgetAmount, dailyRecords, totalIncome, totalSpent, filtered]);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.mintGreen}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerGreeting}>
            <Text style={[styles.helloText, { color: colors.textSecondary }]}>Hello</Text>
            <Text
              style={[
                styles.nameText,
                { color: colors.textPrimary, fontSize: nameFontSize },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {firstName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Notifications' as any)}
            >
              <Bell size={20} color={colors.textPrimary} />
              {unreadCount > 0 && <View style={styles.badgeDot} />}
            </Pressable>
            <Pressable
              style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Profile' as any)}
            >
              <User size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
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
                    ? [styles.pillActive, { backgroundColor: colors.mintGreenSoft, borderColor: colors.mintGreen }]
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
              <View
                style={[
                  styles.summaryBar,
                  { backgroundColor: isOverBudgetPeriod ? colors.danger : colors.mintGreen },
                ]}
              />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{primaryLabel}</Text>
            </View>
            <Text
              style={[
                styles.summaryAmount,
                { color: isOverBudgetPeriod ? colors.danger : colors.textPrimary },
              ]}
            >
              {formatCurrency(primaryAmount)}
            </Text>
            {primarySubtext ? (
              <Text style={[styles.summarySubtext, { color: colors.textSecondary }]}>{primarySubtext}</Text>
            ) : null}

            <View style={[styles.summaryLabelRow, { marginTop: primarySubtext ? 14 : 20 }]}>
              <View style={[styles.summaryBar, { backgroundColor: colors.peachCoral }]} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Spent</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.textPrimary }]}>{formatCurrency(displaySpent)}</Text>
          </View>

          {/* Donut */}
          <DonutChart spent={displaySpent} total={Math.max(totalAvailable, displaySpent)} />
        </View>

        {/* ── Compact Daily Allowance & Gullak Banner (Senior UI/UX Design) ── */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Savings' as any)}
          style={[
            styles.dailyCompactCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <View style={[styles.dailyCompactIconWrap, { backgroundColor: colors.mintGreenSoft }]}>
            <PiggyBankCoinIcon size={22} color={colors.mintGreenDark} />
          </View>

          <View style={styles.dailyCompactContent}>
            <View style={styles.dailyCompactTopRow}>
              <View style={styles.dailyCompactTitleGroup}>
                <Text style={[styles.dailyCompactTitle, { color: colors.textPrimary }]}>
                  Daily Allowance
                </Text>
              </View>

              <View style={styles.currencyRow}>
                <Text
                  style={[
                    styles.dailyCompactAmount,
                    { color: isOverBudget ? colors.danger : colors.mintGreenDark },
                  ]}
                >
                  {isOverBudget
                    ? `+₹${Math.round(todayRecordSpent - todayBudget).toLocaleString('en-IN')} over`
                    : `₹${Math.round(todayRemaining).toLocaleString('en-IN')} left`}
                </Text>
                <ChevronRight size={15} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            </View>

            {/* Mini Progress Bar */}
            <View style={[styles.dailyCompactProgressTrack, { backgroundColor: colors.chartTrack }]}>
              <View
                style={[
                  styles.dailyCompactProgressFill,
                  {
                    width: `${Math.round(budgetRatio * 100)}%`,
                    backgroundColor: isOverBudget
                      ? colors.danger
                      : budgetRatio >= 0.8
                      ? '#F59E0B'
                      : colors.mintGreen,
                  },
                ]}
              />
            </View>
          </View>
        </TouchableOpacity>

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
          recentTx.map((e) => {
            const cat = e.category_id ? catMap[e.category_id] : undefined;
            const isIncome = isIncomeTransaction(e, cat);
            return (
              <TouchableOpacity
                key={e.id}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('ExpenseDetail', { expenseId: e.id })}
              >
                <TransactionRow
                  expense={e}
                  category={cat}
                  isIncome={isIncome}
                  colors={colors}
                  isDark={isDark}
                />
              </TouchableOpacity>
            );
          })
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
    alignItems: 'center',
  },
  headerGreeting: {
    flex: 1,
    marginRight: 14,
    justifyContent: 'center',
  },
  helloText: {
    fontSize: 22,
    fontFamily: 'Quicksand_500Medium',
  },
  nameText: {
    fontSize: 36,
    fontFamily: 'Quicksand_700Bold',
    marginTop: -4,
    includeFontPadding: false,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
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
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Compact Daily Allowance Widget Banner
  dailyCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  dailyCompactIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dailyCompactContent: {
    flex: 1,
  },
  dailyCompactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dailyCompactTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dailyCompactTitle: {
    fontSize: 13,
    fontFamily: 'Quicksand_700Bold',
  },
  dailyGullakPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dailyGullakPillText: {
    fontSize: 10,
    fontFamily: 'Quicksand_700Bold',
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyCompactAmount: {
    fontSize: 13,
    fontFamily: 'Quicksand_700Bold',
  },
  dailyCompactProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  dailyCompactProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Filter pills
  pillsScroll: {
    marginTop: 18,
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
  summarySubtext: {
    fontSize: 11,
    fontFamily: 'Quicksand_600SemiBold',
    marginTop: 2,
    opacity: 0.75,
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
  txSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  txSubtitle: {
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
  },
  txNoteText: {
    flexShrink: 1,
  },
  txModeText: {
    flexShrink: 0,
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
