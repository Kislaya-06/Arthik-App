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
import { Bell, ChevronRight, User, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { TransactionRow } from '../components/TransactionRow';
import { DonutChart } from '../components/DonutChart';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { FILTERS, Filter, filterExpenses } from '../lib/expenseFilters';
import { calculatePeriodSummary } from '../lib/homeCalculations';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabParamList, RootStackParamList } from '../types';
import { formatCurrency } from '../lib/formatters';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;






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
  const [todayKey, setTodayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const referenceDate = useMemo(() => parseISO(todayKey), [todayKey]);

  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const getTodayRecord = useDailyBudgetStore((s) => s.getTodayRecord);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const syncWithExpenses = useDailyBudgetStore((s) => s.syncWithExpenses);

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const lastFetchTime = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    const currentUser = useAuthStore.getState().user;
    if (currentUser && useDailyBudgetStore.getState().hydratedForUserId !== currentUser.id) {
      await useDailyBudgetStore.getState().hydrateFromSupabase(currentUser.id);
    }
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
      const nowKey = format(new Date(), 'yyyy-MM-dd');
      setTodayKey((prev) => (prev !== nowKey ? nowKey : prev));
      loadData(false);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      await useDailyBudgetStore.getState().hydrateFromSupabase(currentUser.id);
    }
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

  const userCreatedAtStr = user?.created_at?.split('T')[0]?.trim();

  const filtered = useMemo(
    () => filterExpenses(expenses, activeFilter, referenceDate, userCreatedAtStr),
    [expenses, activeFilter, userCreatedAtStr, todayKey]
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

  const isBudgetConfigured = isAutoRenew && dailyBudgetAmount > 0;
  const todayRecord = useMemo(
    () => getTodayRecord(),
    [getTodayRecord, dailyRecords, dailyBudgetAmount, expenses, isAutoRenew]
  );
  const todayBudget = isBudgetConfigured ? todayRecord.budget : 0;
  // Calculate today's spent directly from expenses for today to guarantee 0-lag live reactivity
  const todayLiveSpent = useMemo(() => {
    const todayStr = todayKey;
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
  }, [expenses, catMap, todayKey]);

  const todayRecordSpent = activeFilter === 'Daily' ? totalSpent : todayLiveSpent;
  const todayRemaining = Math.max(0, todayBudget - todayRecordSpent);
  const isOverBudget = todayBudget > 0 && todayRecordSpent > todayBudget;

  // Comprehensive financial aggregation for the Hero Summary Card (Option A: Remaining Balance Model):
  // Directly reflects user expenses (minus) and income/allowance (plus) in real-time.
  const {
    primaryAmount,
    primaryLabel,
    primarySubtext,
    displaySpent,
    totalAvailable,
    isOverBudgetPeriod,
    periodIncome,
    periodSpent,
  } = useMemo(
    () =>
      calculatePeriodSummary({
        activeFilter,
        dailyBudgetAmount,
        isAutoRenew,
        todayBudget,
        dailyRecords,
        totalIncome,
        totalSpent,
        filtered,
        userCreatedAtStr,
        referenceDate,
      }),
    [activeFilter, todayBudget, dailyBudgetAmount, isAutoRenew, dailyRecords, totalIncome, totalSpent, filtered, userCreatedAtStr, todayKey]
  );

  // Date range label shown below filter pills for quick orientation
  const filterDateLabel = useMemo(() => {
    const t = referenceDate;
    if (activeFilter === 'All') return userCreatedAtStr ? `Since ${format(parseISO(userCreatedAtStr), 'd MMM yyyy')}` : 'All time';
    if (activeFilter === 'Daily') return format(t, 'EEEE, d MMM');
    const periodStart = format(activeFilter === 'Weekly' ? startOfWeek(t, { weekStartsOn: 1 }) : startOfMonth(t), 'yyyy-MM-dd');
    const startStr = (userCreatedAtStr && userCreatedAtStr > periodStart) ? userCreatedAtStr : periodStart;
    const start = parseISO(startStr);
    if (startStr === format(t, 'yyyy-MM-dd')) return format(t, 'd MMM');
    const sameMonth = format(start, 'M') === format(t, 'M');
    return activeFilter === 'Monthly'
      ? `${format(start, 'd')}\u2013${format(t, 'd MMM yyyy')}`
      : sameMonth ? `${format(start, 'd')}\u2013${format(t, 'd MMM')}` : `${format(start, 'd MMM')} \u2013 ${format(t, 'd MMM')}`;
  }, [activeFilter, referenceDate, userCreatedAtStr]);

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
        scrollEventThrottle={32}
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
        <View style={styles.filterDateRow}>
          <Text style={[styles.filterDateLabel, { color: colors.textMuted }]}>
            {filterDateLabel}
          </Text>
          {activeFilter === 'Daily' && todayBudget === 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Savings' as any)}
              style={styles.setLimitAffordance}
            >
              <Text style={[styles.setLimitDot, { color: colors.textMuted }]}>•</Text>
              <Text style={[styles.setLimitText, { color: isDark ? colors.mintGreen : colors.mintGreenDark }]}>
                Set daily limit ›
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Summary Card ── */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          {/* Top row: stats + donut */}
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryStats}>
              {/* Remaining / Balance */}
              <View style={styles.summaryLabelRow}>
                <View style={[styles.summaryBar, { backgroundColor: isOverBudgetPeriod ? colors.danger : colors.mintGreen }]} />
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{primaryLabel}</Text>
              </View>
              <Text
                style={[styles.summaryAmount, { color: isOverBudgetPeriod ? colors.danger : colors.textPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatCurrency(primaryAmount)}
              </Text>

              {primarySubtext ? (
                <Text style={[styles.summarySubtext, { color: colors.textSecondary }]} numberOfLines={2}>
                  {primarySubtext}
                </Text>
              ) : null}
            </View>

            {/* Donut */}
            <DonutChart spent={displaySpent} total={Math.max(totalAvailable, displaySpent)} colors={colors} />
          </View>

          {/* Dual Metric Tiles: Inflow (Income / Total Available) & Outflow (Spent) */}
          <View style={styles.metricTilesRow}>
            {/* Income Tile */}
            <View style={[styles.metricTile, { backgroundColor: colors.mintGreenSoft }]}>
              <View style={styles.metricTileHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: isDark ? 'rgba(184,224,200,0.2)' : 'rgba(127,184,150,0.2)' }]}>
                  <ArrowDownLeft size={13} color={isDark ? colors.mintGreen : colors.mintGreenDark} />
                </View>
                <Text style={[styles.metricTileLabel, { color: colors.textSecondary }]}>
                  Income
                </Text>
              </View>
              <Text style={[styles.metricTileAmount, { color: isDark ? colors.mintGreen : colors.mintGreenDark }]} numberOfLines={1}>
                {`+${formatCurrency(totalAvailable)}`}
              </Text>
            </View>

            {/* Spent Tile */}
            <View style={[styles.metricTile, { backgroundColor: colors.peachSoft }]}>
              <View style={styles.metricTileHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: isDark ? 'rgba(244,184,174,0.2)' : 'rgba(244,184,174,0.3)' }]}>
                  <ArrowUpRight size={13} color={colors.peachCoral} />
                </View>
                <Text style={[styles.metricTileLabel, { color: colors.textSecondary }]}>Spent</Text>
              </View>
              <Text style={[styles.metricTileAmount, { color: colors.textPrimary }]} numberOfLines={1}>
                {`−${formatCurrency(periodSpent)}`}
              </Text>
            </View>
          </View>

          {/* Daily Gullak Rollover Teaser (Only on Daily, and ONLY if user has active budget) */}
          {activeFilter === 'Daily' && todayBudget > 0 && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => navigation.navigate('Savings' as any)}
              style={[styles.dailyRolloverStrip, { backgroundColor: colors.mintGreenSoft }]}
            >
              <PiggyBankCoinIcon size={18} color={isDark ? colors.mintGreen : colors.mintGreenDark} />
              <Text style={[styles.dailyRolloverText, { color: colors.textPrimary }]} numberOfLines={1}>
                {isOverBudget
                  ? `Over limit by ${formatCurrency(todayRecordSpent - todayBudget)} today`
                  : `${formatCurrency(todayRemaining)} rolls over to Gullak tonight`}
              </Text>
              <ChevronRight size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
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
    paddingHorizontal: Spacing.gutter,
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
    fontFamily: FontFamily.medium,
  },
  nameText: {
    fontSize: 36,
    fontFamily: FontFamily.bold,
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

  // Filter pills
  pillsScroll: {
    marginTop: 18,
  },
  filterDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.block,
  },
  filterDateLabel: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    opacity: 0.65,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  setLimitAffordance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  setLimitDot: {
    fontSize: 13,
    opacity: 0.5,
    marginRight: 6,
  },
  setLimitText: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
  },
  pillsContent: {
    paddingRight: Spacing.element,
  },
  pill: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    paddingVertical: 10,
    marginRight: Spacing.group,
  },
  pillActive: {
    borderWidth: 2,
  },
  pillInactive: {
    borderWidth: 1,
  },
  pillText: {
    fontSize: FontSize.bodySmall,
  },
  pillTextActive: {
    fontFamily: FontFamily.bold,
  },
  pillTextInactive: {
    fontFamily: FontFamily.medium,
  },

  // Summary Card
  summaryCard: {
    borderRadius: BorderRadius.cardLarge,
    paddingVertical: Spacing.block,
    paddingHorizontal: Spacing.surface,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryStats: {
    flex: 1,
    paddingRight: Spacing.group,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  summaryBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  summaryLabel: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginLeft: Spacing.element,
  },
  summaryAmount: {
    fontSize: 32,
    fontFamily: FontFamily.bold,
    marginTop: Spacing.micro,
    includeFontPadding: false,
  },
  summarySubtext: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.micro,
    opacity: 0.8,
  },
  dailyRolloverStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginTop: Spacing.group,
    paddingVertical: 10,
    paddingHorizontal: Spacing.group,
    borderRadius: BorderRadius.input,
  },
  dailyRolloverText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.semibold,
  },
  metricTilesRow: {
    flexDirection: 'row',
    gap: Spacing.group,
    marginTop: Spacing.group,
  },
  metricTile: {
    flex: 1,
    borderRadius: BorderRadius.input,
    paddingVertical: 10,
    paddingHorizontal: Spacing.group,
  },
  metricTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metricIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTileLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricTileAmount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.section,
  },
  sectionTitle: {
    fontSize: FontSize.sectionTitle,
    fontFamily: FontFamily.bold,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.element,
  },
  seeAllText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginRight: Spacing.micro,
  },


  // Empty state
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: Spacing.surface,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
});
