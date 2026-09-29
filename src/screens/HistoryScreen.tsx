import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  SectionList, RefreshControl, Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore, GullakDeposit } from '../store/dailyBudgetStore';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { Search, Receipt, SearchX, FilterX } from 'lucide-react-native';
import { BouncyCategoryFilter } from '../components/BouncyCategoryFilter';
import { format, isToday, isYesterday, parseISO, isAfter, addDays } from 'date-fns';
import { TabParamList, RootStackParamList } from '../types';
import { getCategoryIcon } from '../lib/iconUtils';
import { getPaymentIcon, getPaymentLabel, isIncomeTransaction } from '../lib/paymentUtils';
import { formatCurrency } from '../lib/formatters';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';
import { ThemeColors, Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'History'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type HistoryItem =
  | { kind: 'expense'; data: Expense; date: string; created_at: string }
  | { kind: 'gullak'; data: GullakDeposit; date: string; created_at: string };

interface Section {
  title: string;
  dateStr: string;
  totalSpent: number;
  totalIncome: number;
  data: HistoryItem[];
}

interface TransactionRowItemProps {
  item: Expense;
  category?: Category;
  onPress: (id: string) => void;
  colors: ThemeColors;
}

const TransactionRowItem = React.memo<TransactionRowItemProps>(({ item, category, onPress, colors }) => {
  const isIncome = isIncomeTransaction(item, category);
  const categoryName = category?.name || (isIncome ? 'Money Added' : 'Other');
  const categoryColor = category?.color || (isIncome ? '#ADEBB3' : '#FF857A');
  const categoryBgColor = categoryColor;
  const IconComp = getCategoryIcon(category?.icon || (isIncome ? 'Wallet' : ''));
  const paymentLabel = getPaymentLabel(item.payment_mode);
  const expenseColor = colors.isDark ? colors.peachCoral : '#E05345';
  const incomeColor = colors.isDark ? colors.mintGreen : colors.mintGreenDark;
  const amountColor = isIncome ? incomeColor : expenseColor;

  const hasNote = Boolean(item.note && item.note.trim().length > 0);
  const mainTitle = hasNote ? item.note!.trim() : categoryName;
  const subtitle = hasNote ? `${categoryName} · ${paymentLabel}` : paymentLabel;

  const timeOrDateStr = useMemo(() => {
    try {
      if (item.created_at) {
        return format(parseISO(item.created_at), 'h:mm a');
      }
      return format(parseISO(item.expense_date), 'd MMM');
    } catch {
      return item.expense_date;
    }
  }, [item.created_at, item.expense_date]);

  return (
    <Pressable
      style={[
        styles.transactionRow,
        {
          borderBottomColor: colors.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
      onPress={() => onPress(item.id)}
      android_ripple={{ color: colors.cardSubtle, borderless: false }}
    >
      <View style={[styles.iconContainer, { backgroundColor: categoryBgColor }]}>
        <IconComp size={22} color="#000000" strokeWidth={2.2} />
      </View>
      <View style={styles.transactionMiddle}>
        <Text style={[styles.transactionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {mainTitle}
        </Text>
        <Text style={[styles.transactionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.transactionAmount, { color: amountColor }]}>
          {isIncome ? `+${formatCurrency(Math.abs(item.amount))}` : `−${formatCurrency(Math.abs(item.amount))}`}
        </Text>
        <Text style={[styles.transactionTime, { color: colors.textMuted }]}>
          {timeOrDateStr}
        </Text>
      </View>
    </Pressable>
  );
});

interface GullakRowItemProps {
  item: GullakDeposit;
  onPress: (id: string) => void;
  colors: ThemeColors;
}

const GullakRowItem = React.memo<GullakRowItemProps>(({ item, onPress, colors }) => {
  const sourceLabel = item.source === 'income' ? 'From Income' : 'External Deposit';
  const iconBg = '#ADEBB3';

  const hasNote = Boolean(item.note && item.note.trim().length > 0);
  const mainTitle = hasNote ? item.note!.trim() : 'Gullak Deposit';
  const subtitle = hasNote ? `Gullak · ${sourceLabel}` : sourceLabel;

  const dateStr = useMemo(() => {
    try {
      return format(parseISO(item.date), 'd MMM');
    } catch {
      return item.date;
    }
  }, [item.date]);

  return (
    <Pressable
      style={[
        styles.transactionRow,
        {
          borderBottomColor: colors.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
      onPress={() => onPress(item.id)}
      android_ripple={{ color: colors.cardSubtle, borderless: false }}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <PiggyBankCoinIcon size={22} color="#000000" />
      </View>
      <View style={styles.transactionMiddle}>
        <Text style={[styles.transactionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {mainTitle}
        </Text>
        <Text style={[styles.transactionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.transactionAmount, { color: colors.isDark ? colors.mintGreen : colors.mintGreenDark }]}>
          {`+${formatCurrency(Math.abs(item.amount))}`}
        </Text>
        <Text style={[styles.transactionTime, { color: colors.textMuted }]}>
          {dateStr}
        </Text>
      </View>
    </Pressable>
  );
});

export const HistoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const sectionListRef = useRef<SectionList<HistoryItem, Section>>(null);

  const lastFetchTime = useRef<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTime.current < 60_000) {
      return;
    }
    lastFetchTime.current = now;
    await Promise.all([fetchExpenses(), fetchCategories()]);
  }, [fetchExpenses, fetchCategories]);

  const enterAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadData(false);
      enterAnim.setValue(0);
      Animated.spring(enterAnim, {
        toValue: 1,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }, [loadData, enterAnim]),
  );

  const screenSlideAnim = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const screenFadeAnim = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 1],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const filteredAndGroupedExpenses = useMemo<Section[]>(() => {
    let filteredExpenses = expenses;
    let filteredDeposits = selectedCategoryId ? [] : gullakDeposits;

    if (selectedCategoryId) {
      filteredExpenses = filteredExpenses.filter((e) => e.category_id === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filteredExpenses = filteredExpenses.filter((e) => {
        const category = e.category_id ? categoryMap.get(e.category_id) : undefined;
        const categoryName = category?.name?.toLowerCase() || (e.type === 'income' ? 'money added' : '');
        const note = e.note?.toLowerCase() || '';
        const amountStr = e.amount?.toString() || '';
        const payment = e.payment_mode?.toLowerCase() || '';
        return categoryName.includes(lowerQuery) || note.includes(lowerQuery) || amountStr.includes(lowerQuery) || payment.includes(lowerQuery);
      });

      filteredDeposits = filteredDeposits.filter((d) => {
        const note = (d.note || '').toLowerCase();
        const amountStr = d.amount.toString();
        const sourceStr = d.source === 'income' ? 'from income' : 'external deposit';
        return 'gullak'.includes(lowerQuery) || 'deposit'.includes(lowerQuery) || note.includes(lowerQuery) || amountStr.includes(lowerQuery) || sourceStr.includes(lowerQuery);
      });
    }

    const grouped: Record<string, HistoryItem[]> = {};
    const spentTotals: Record<string, number> = {};
    const incomeTotals: Record<string, number> = {};

    filteredExpenses.forEach((expense) => {
      const dateKey = expense.expense_date?.split('T')[0]?.trim() || '';
      if (!dateKey) return;
      (grouped[dateKey] ??= []).push({
        kind: 'expense',
        data: expense,
        date: dateKey,
        created_at: expense.created_at || '',
      });

      const category = expense.category_id ? categoryMap.get(expense.category_id) : undefined;
      if (isIncomeTransaction(expense, category)) {
        incomeTotals[dateKey] = (incomeTotals[dateKey] || 0) + expense.amount;
      } else {
        spentTotals[dateKey] = (spentTotals[dateKey] || 0) + expense.amount;
      }
    });

    filteredDeposits.forEach((deposit) => {
      const dateKey = deposit.date?.split('T')[0]?.trim() || '';
      if (!dateKey) return;
      (grouped[dateKey] ??= []).push({
        kind: 'gullak',
        data: deposit,
        date: dateKey,
        created_at: deposit.created_at || '',
      });

      if (deposit.source === 'external') {
        incomeTotals[dateKey] = (incomeTotals[dateKey] || 0) + deposit.amount;
      }
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateStr) => {
      const dateObj = parseISO(dateStr);
      const dayName = format(dateObj, 'EEEE');
      const dateFormatted = format(dateObj, 'd MMM');
      let title = `${dayName}, ${dateFormatted}`.toUpperCase();
      if (isToday(dateObj)) {
        title = `TODAY · ${dayName.toUpperCase()}, ${dateFormatted.toUpperCase()}`;
      } else if (isYesterday(dateObj)) {
        title = `YESTERDAY · ${dayName.toUpperCase()}, ${dateFormatted.toUpperCase()}`;
      }

      const sortedData = grouped[dateStr].slice().sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );

      return {
        title,
        dateStr,
        totalSpent: spentTotals[dateStr] || 0,
        totalIncome: incomeTotals[dateStr] || 0,
        data: sortedData,
      };
    });
  }, [expenses, gullakDeposits, categoryMap, selectedCategoryId, searchQuery]);

  const targetDate = route.params?.targetDate;
  const targetStartDate = route.params?.startDate;
  const targetEndDate = route.params?.endDate;

  const targetIndexRef = useRef<number>(-1);
  const lastHandledKeyRef = useRef<string>('');

  const filteredAndGroupedExpensesRef = useRef(filteredAndGroupedExpenses);
  useEffect(() => {
    filteredAndGroupedExpensesRef.current = filteredAndGroupedExpenses;
  }, [filteredAndGroupedExpenses]);

  // Reset handled key when user navigates away from History
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      lastHandledKeyRef.current = '';
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (!targetDate && !targetStartDate) return;

    const targetKey = `${targetDate || ''}_${targetStartDate || ''}_${targetEndDate || ''}`;
    if (lastHandledKeyRef.current === targetKey) return;
    lastHandledKeyRef.current = targetKey;

    // Reset filters so the target transaction is visible
    setSearchQuery('');
    setSelectedCategoryId(null);

    const target = targetDate;
    const start = targetStartDate;
    const end = targetEndDate;

    let attempts = 0;
    const maxAttempts = 20;

    const performScroll = () => {
      attempts++;
      const sections = filteredAndGroupedExpensesRef.current;
      if (!sectionListRef.current || !sections || sections.length === 0) {
        if (attempts < maxAttempts) {
          setTimeout(performScroll, 50);
        }
        return;
      }

      let targetIndex = -1;

      // 1. If start and end range is provided (e.g. 8 to 14, or 15 to 21):
      // Check each day starting from start in ascending order (e.g. 15, then 16, 17... 21)
      if (start && end) {
        let cur = parseISO(start);
        const endObj = parseISO(end);
        while (!isAfter(cur, endObj)) {
          const curStr = format(cur, 'yyyy-MM-dd');
          const idx = sections.findIndex((s) => s.dateStr === curStr);
          if (idx >= 0) {
            targetIndex = idx;
            break;
          }
          cur = addDays(cur, 1);
        }
      }

      // 2. If not found by range, try exact targetDate
      if (targetIndex < 0 && target) {
        targetIndex = sections.findIndex((s) => s.dateStr === target);
      }

      // 3. Fallback: closest section by date
      if (targetIndex < 0 && target) {
        let minDiff = Infinity;
        let bestIndex = -1;
        const targetTime = parseISO(target).getTime();

        sections.forEach((s, idx) => {
          const sTime = parseISO(s.dateStr).getTime();
          const diff = Math.abs(sTime - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            bestIndex = idx;
          }
        });
        targetIndex = bestIndex;
      }

      if (targetIndex >= 0 && sectionListRef.current) {
        targetIndexRef.current = targetIndex;
        try {
          sectionListRef.current.scrollToLocation({
            sectionIndex: targetIndex,
            itemIndex: 0,
            animated: true,
            viewPosition: 0,
          });
        } catch {
          if (attempts < maxAttempts) {
            setTimeout(performScroll, 80);
          }
        }
      }
    };

    const timer = setTimeout(performScroll, 120);

    return () => {
      clearTimeout(timer);
    };
  }, [targetDate, targetStartDate, targetEndDate]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => {
    let text = '';
    let isIncomeOnly = false;
    if (section.totalSpent > 0 && section.totalIncome > 0) {
      text = `−${formatCurrency(section.totalSpent)}  •  +${formatCurrency(section.totalIncome)}`;
    } else if (section.totalSpent > 0) {
      text = `−${formatCurrency(section.totalSpent)}`;
    } else if (section.totalIncome > 0) {
      text = `+${formatCurrency(section.totalIncome)}`;
      isIncomeOnly = true;
    } else {
      text = `₹0`;
    }

    return (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: FontFamily.bold }]}>
          {section.title}
        </Text>
        <Text
          style={[
            styles.sectionTotal,
            {
              color: isIncomeOnly
                ? (isDark ? colors.mintGreen : colors.mintGreenDark)
                : colors.textMuted,
              fontFamily: FontFamily.bold,
            },
          ]}
        >
          {text}
        </Text>
      </View>
    );
  }, [colors, isDark]);

  const handleItemPress = useCallback((expenseId: string) => {
    navigation.navigate('ExpenseDetail', { expenseId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: HistoryItem }) => {
    if (item.kind === 'gullak') {
      return (
        <GullakRowItem
          item={item.data}
          onPress={(id) => navigation.navigate('GullakDepositDetail', { depositId: id })}
          colors={colors}
        />
      );
    }
    return (
      <TransactionRowItem
        item={item.data}
        category={item.data.category_id ? categoryMap.get(item.data.category_id) : undefined}
        onPress={handleItemPress}
        colors={colors}
      />
    );
  }, [categoryMap, handleItemPress, navigation, colors]);

  const renderEmptyState = useCallback(() => {
    let IconComponent = Receipt;
    let title = 'No transactions yet';
    let subtitle = 'Your expenses will appear here once you add them.';

    if (searchQuery.trim()) {
      IconComponent = SearchX;
      title = 'No results found';
      subtitle = 'Try adjusting your search to find what you are looking for.';
    } else if (selectedCategoryId) {
      const catName = categoryMap.get(selectedCategoryId)?.name || 'this category';
      IconComponent = FilterX;
      title = 'No expenses found';
      subtitle = `There are no expenses in the ${catName} category yet. They will appear here once you add them!`;
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.iconCircle, { backgroundColor: colors.cardSubtle }]}>
          <IconComponent size={32} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>{subtitle}</Text>
      </View>
    );
  }, [searchQuery, selectedCategoryId, categoryMap, colors]);

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Animated.View
        style={[
          styles.container,
          {
            opacity: screenFadeAnim,
            transform: [{ translateY: screenSlideAnim }],
          },
        ]}
      >

        {/* Header Row */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            History
          </Text>
          <Pressable
            style={[styles.searchButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
          >
            <Search size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Search Bar */}
        {isSearchVisible && (
          <View style={[styles.searchContainer, { backgroundColor: colors.inputBg }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}
              placeholder="Search transactions..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}

        {/* Filter Pills — bouncy sliding pill */}
        <View style={[styles.filterWrapper, isSearchVisible && styles.filterWrapperSearchOpen]}>
          <BouncyCategoryFilter
            options={[{ id: null, name: 'All' }, ...categories]}
            value={selectedCategoryId}
            onChange={setSelectedCategoryId}
          />
        </View>

        {/* Transaction List */}
        <SectionList
          ref={sectionListRef}
          sections={filteredAndGroupedExpenses}
          keyExtractor={(item) => `${item.kind}-${item.data.id}`}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {
            setTimeout(() => {
              if (targetIndexRef.current >= 0 && sectionListRef.current) {
                sectionListRef.current.scrollToLocation({
                  sectionIndex: targetIndexRef.current,
                  itemIndex: 0,
                  animated: true,
                  viewPosition: 0,
                });
              }
            }, 80);
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.mintGreen}
            />
          }
          contentContainerStyle={[
            { paddingBottom: insets.bottom + 100 },
            filteredAndGroupedExpenses.length === 0 && { flexGrow: 1 },
          ]}
          stickySectionHeadersEnabled={false}
          onScroll={handleScroll}
          scrollEventThrottle={32}
          initialNumToRender={50}
          maxToRenderPerBatch={30}
          windowSize={21}
          removeClippedSubviews={false}
          updateCellsBatchingPeriod={50}
          ListEmptyComponent={renderEmptyState}
        />

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.gutter,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  headerTitle: {
    fontSize: 36,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterWrapper: {
    marginTop: 24,
    marginBottom: Spacing.element,
  },
  filterWrapperSearchOpen: {
    marginTop: Spacing.element,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.group,
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.element,
    fontSize: FontSize.body,
    padding: 0,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.gutter,
    marginBottom: Spacing.group,
  },
  sectionTitle: {
    fontSize: FontSize.caption,
    letterSpacing: 1,
  },
  sectionTotal: {
    fontSize: FontSize.caption,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMiddle: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  transactionTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  transactionSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    marginTop: 3,
  },
  transactionRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  transactionTime: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginTop: 3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.section,
    marginTop: 64,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.gutter,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: Spacing.element,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
