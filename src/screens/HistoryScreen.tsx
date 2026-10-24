import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { FlashListRef } from '@shopify/flash-list';
import { PressableOpacity } from '../components/ui/PressableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppRefreshControl } from '../components/AppRefreshControl';
import { StatusBar } from 'expo-status-bar';
import { AmbientBackground } from '../components/AmbientBackground';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useNavBarContentInset } from '../hooks/useNavBarMetrics';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore, GullakDeposit } from '../store/dailyBudgetStore';
import Search from 'lucide-react-native/icons/search';
import Receipt from 'lucide-react-native/icons/receipt';
import SearchX from 'lucide-react-native/icons/search-x';
import FilterX from 'lucide-react-native/icons/funnel-x';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import { BouncyCategoryFilter } from '../components/BouncyCategoryFilter';
import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';
import { isYesterday } from 'date-fns/isYesterday';
import { parseISO } from 'date-fns/parseISO';
import { isAfter } from 'date-fns/isAfter';
import { addDays } from 'date-fns/addDays';
import * as Haptics from 'expo-haptics';
import { TabParamList, RootStackParamList } from '../types';
import { formatCurrency } from '../lib/formatters';
import { isIncomeTransaction, isCountedIncome, isCountedExpense } from '../lib/transactionUtils';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';
import { ThemeColors, Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'History'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type { HistoryItem } from '../lib/historyRows';
type Section = HistorySection;

/** Must match `emptyContainer.marginTop` in the styles below. */
const EMPTY_STATE_TOP_MARGIN = 64;

const historyKeyExtractor = (row: HistoryRow): string => row.key;
/** Header rows and the two item kinds are recycled separately (they look different). */
const historyItemType = (row: HistoryRow): string => row.type;


import { TransactionRow } from '../components/TransactionRow';
import { buildHistoryRows, buildHeaderRowIndexes } from '../lib/historyRows';
import type { HistoryItem, HistoryRow, HistorySection } from '../lib/historyRows';
import { GullakDepositRow } from '../components/GullakDepositRow';

interface TransactionRowItemProps {
  item: Expense;
  category?: Category;
  onPress: (id: string) => void;
  colors: ThemeColors;
}

const TransactionRowItem = React.memo<TransactionRowItemProps>(({ item, category, onPress, colors }) => {
  const isIncome = isIncomeTransaction(item, category);
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [onPress, item.id]);

  return (
    <TransactionRow
      expense={item}
      category={category}
      isIncome={isIncome}
      colors={colors}
      isDark={colors.isDark}
      onPress={handlePress}
    />
  );
});

interface GullakRowItemProps {
  item: GullakDeposit;
  onPress: (id: string) => void;
  colors: ThemeColors;
}

const GullakRowItem = React.memo<GullakRowItemProps>(({ item, onPress, colors }) => {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [onPress, item.id]);

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: colors.cardSubtle, borderless: false }}
    >
      <GullakDepositRow
        deposit={item}
        colors={colors}
        isDark={colors.isDark}
      />
    </Pressable>
  );
});

const dateHeaderCache = new Map<string, { day: string; title: string }>();

function getDateHeaderTitle(dateStr: string, todayKey: string): string {
  const cached = dateHeaderCache.get(dateStr);
  if (cached && cached.day === todayKey) return cached.title;
  const dateObj = parseISO(dateStr);
  const dayName = format(dateObj, 'EEEE');
  const dateFormatted = format(dateObj, 'd MMM');
  let title = `${dayName}, ${dateFormatted}`.toUpperCase();
  if (isToday(dateObj)) {
    title = `TODAY · ${dayName.toUpperCase()}, ${dateFormatted.toUpperCase()}`;
  } else if (isYesterday(dateObj)) {
    title = `YESTERDAY · ${dayName.toUpperCase()}, ${dateFormatted.toUpperCase()}`;
  }
  dateHeaderCache.set(dateStr, { day: todayKey, title });
  return title;
}

export const HistoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // Bottom padding follows the responsive nav bar.
  const navBarInset = useNavBarContentInset();
  const handleScroll = useScrollDirection();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const listRef = useRef<FlashListRef<HistoryRow>>(null);
  // Tapping the active History tab scrolls the list back to the top.
  const scrollToTopRef = useRef({
    scrollToTop: () => {
      try {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch {
        // List not ready / empty: nothing to scroll.
      }
    },
  });
  useScrollToTop(scrollToTopRef);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Progressive section pagination: bounds initial mount to 4 days (sections),
  // expandable via "See More" button to eliminate Main UI thread frame drops
  const INITIAL_SECTION_COUNT = 4;
  const PAGE_SIZE_SECTIONS = 4;
  const [visibleSectionCount, setVisibleSectionCount] = useState(INITIAL_SECTION_COUNT);

  // Synchronously reset visibleSectionCount on category change to prevent mounting stale large section windows
  const handleCategoryChange = useCallback((id: string | null) => {
    setVisibleSectionCount(INITIAL_SECTION_COUNT);
    if (typeof React.startTransition === 'function') {
      React.startTransition(() => {
        setSelectedCategoryId(id);
      });
    } else {
      setSelectedCategoryId(id);
    }
  }, []);

  // Reset pagination window whenever category or search filter changes
  useEffect(() => {
    setVisibleSectionCount(INITIAL_SECTION_COUNT);
  }, [selectedCategoryId, searchQuery]);

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

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const categoryFilterOptions = useMemo(
    () => [{ id: null, name: 'All' }, ...categories],
    [categories]
  );

  const filteredAndGroupedExpenses = useMemo<Section[]>(() => {
    let filteredExpenses = expenses;
    let filteredDeposits = (!isBudgetModeEnabled || selectedCategoryId) ? [] : gullakDeposits;

    if (selectedCategoryId) {
      filteredExpenses = filteredExpenses.filter((e) => e.category_id === selectedCategoryId);
    }

    if (debouncedQuery.trim()) {
      const lowerQuery = debouncedQuery.toLowerCase();
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
      if (isCountedIncome(expense, category)) {
        incomeTotals[dateKey] = (incomeTotals[dateKey] || 0) + expense.amount;
      } else if (isCountedExpense(expense, category)) {
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

    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateStr) => {
      const title = getDateHeaderTitle(dateStr, todayKey);

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
  }, [expenses, gullakDeposits, categoryMap, selectedCategoryId, debouncedQuery, isBudgetModeEnabled]);

  // Sliced sections for progressive rendering
  const displayedSections = useMemo(() => {
    if (filteredAndGroupedExpenses.length <= visibleSectionCount) {
      return filteredAndGroupedExpenses;
    }
    return filteredAndGroupedExpenses.slice(0, visibleSectionCount);
  }, [filteredAndGroupedExpenses, visibleSectionCount]);

  const hasMoreSections = filteredAndGroupedExpenses.length > visibleSectionCount;

  // Flat rows for FlashList. `displayedSections` is always a prefix of the full list of days, so the
  // header row index of day k is the same in the paginated rows and in the full list.
  const rows = useMemo(() => buildHistoryRows(displayedSections), [displayedSections]);
  const headerRowIndexBySection = useMemo(
    () => buildHeaderRowIndexes(filteredAndGroupedExpenses),
    [filteredAndGroupedExpenses]
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const headerRowIndexRef = useRef(headerRowIndexBySection);
  headerRowIndexRef.current = headerRowIndexBySection;

  const handleSeeMore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setVisibleSectionCount((prev) => prev + PAGE_SIZE_SECTIONS);
  }, []);

  const renderFooter = useCallback(() => {
    if (!hasMoreSections) return null;

    return (
      <PressableOpacity
        style={[
          styles.seeMoreBtn,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={handleSeeMore}
        activeOpacity={0.7}
      >
        <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>
          See More
        </Text>
        <ChevronDown size={16} color={colors.textSecondary} />
      </PressableOpacity>
    );
  }, [hasMoreSections, isDark, colors, handleSeeMore]);

  const targetDate = route.params?.targetDate;
  const targetStartDate = route.params?.startDate;
  const targetEndDate = route.params?.endDate;

  // Day (section index) the date-jump wants to scroll to once its rows are mounted.
  const pendingScrollSectionRef = useRef<number | null>(null);
  const pendingScrollAttemptsRef = useRef(0);
  // A jump that could not finish in this time is dropped, so it can never fire later by surprise.
  const pendingScrollExpiresAtRef = useRef(0);
  const lastHandledKeyRef = useRef<string>('');

  const tryPendingScroll = useCallback(() => {
    const sectionIndex = pendingScrollSectionRef.current;
    if (sectionIndex === null) return;
    if (Date.now() > pendingScrollExpiresAtRef.current) {
      pendingScrollSectionRef.current = null;
      return;
    }
    const list = listRef.current;
    const rowIndex = headerRowIndexRef.current[sectionIndex];
    // Rows of that day are not mounted yet (See More window still growing): wait for the next rows update.
    if (!list || rowIndex === undefined || rowIndex >= rowsRef.current.length) return;
    pendingScrollSectionRef.current = null;
    try {
      list.scrollToIndex({ index: rowIndex, animated: true, viewPosition: 0 }).catch(() => {
        if (pendingScrollAttemptsRef.current < 20) {
          pendingScrollAttemptsRef.current += 1;
          pendingScrollSectionRef.current = sectionIndex;
          setTimeout(tryPendingScroll, 80);
        }
      });
    } catch {
      if (pendingScrollAttemptsRef.current < 20) {
        pendingScrollAttemptsRef.current += 1;
        pendingScrollSectionRef.current = sectionIndex;
        setTimeout(tryPendingScroll, 80);
      }
    }
  }, []);

  // When the visible window grows to include the jump target, finish the scroll.
  useEffect(() => {
    if (pendingScrollSectionRef.current === null) return;
    const timer = setTimeout(tryPendingScroll, 60);
    return () => clearTimeout(timer);
  }, [rows, tryPendingScroll]);

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
      if (!listRef.current || !sections || sections.length === 0) {
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

      if (targetIndex >= 0) {
        // Expand visible sections window so the target section is mounted before scrolling
        setVisibleSectionCount((prev) => Math.max(prev, targetIndex + 5));
      }

      if (targetIndex >= 0 && listRef.current) {
        pendingScrollSectionRef.current = targetIndex;
        pendingScrollAttemptsRef.current = 0;
        pendingScrollExpiresAtRef.current = Date.now() + 4000;
        tryPendingScroll();
      }
    };

    const timer = setTimeout(performScroll, 120);

    return () => {
      clearTimeout(timer);
    };
  }, [targetDate, targetStartDate, targetEndDate, tryPendingScroll]);

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
        <Text
          style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: FontFamily.bold }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
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
          numberOfLines={1}
        >
          {text}
        </Text>
      </View>
    );
  }, [colors, isDark]);

  const handleItemPress = useCallback((expenseId: string) => {
    navigation.navigate('ExpenseDetail', { expenseId });
  }, [navigation]);

  const handleGullakPress = useCallback((depositId: string) => {
    navigation.navigate('GullakDepositDetail', { depositId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: HistoryItem }) => {
    if (item.kind === 'gullak') {
      return (
        <GullakRowItem
          item={item.data}
          onPress={handleGullakPress}
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
  }, [categoryMap, handleItemPress, handleGullakPress, colors]);

  const renderRow = useCallback(({ item: row }: { item: HistoryRow }) => {
    if (row.type === 'header') return renderSectionHeader({ section: row.section });
    return renderItem({ item: row.item });
  }, [renderSectionHeader, renderItem]);

  // Rows only re-render when data or this value changes, so list every non-data input of renderRow.
  const listExtraData = useMemo(() => ({ colors, isDark, categoryMap }), [colors, isDark, categoryMap]);

  // The empty state used to fill the list through flexGrow on the content container, which FlashList
  // does not support. Give it the same height by measuring the list area instead.
  const [listHeight, setListHeight] = useState(0);
  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setListHeight((prev) => (prev === h ? prev : h));
  }, []);

  const renderEmptyState = useCallback(() => {
    let IconComponent = Receipt;
    let title = 'No transactions yet';
    let subtitle = 'Your expenses will appear here once you add them.';

    if (debouncedQuery.trim()) {
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
      <View
        style={[
          styles.emptyContainer,
          // Same area the old flexGrow content container gave it: list height minus nav inset minus top margin.
          { minHeight: Math.max(0, listHeight - navBarInset - EMPTY_STATE_TOP_MARGIN), opacity: listHeight > 0 ? 1 : 0 },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.cardSubtle }]}>
          <IconComponent size={32} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>{subtitle}</Text>
      </View>
    );
  }, [debouncedQuery, selectedCategoryId, categoryMap, colors, listHeight, navBarInset]);

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <AmbientBackground />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.container}>

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
            options={categoryFilterOptions}
            value={selectedCategoryId}
            onChange={handleCategoryChange}
          />
        </View>

        {/* Transaction List */}
        <View style={styles.listArea} onLayout={handleListLayout}>
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={historyKeyExtractor}
            getItemType={historyItemType}
            renderItem={renderRow}
            extraData={listExtraData}
            showsVerticalScrollIndicator={false}
            refreshControl={
              // List starts below the fixed header + filters, so no status-bar offset here.
              <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} topOffset={0} />
            }
            contentContainerStyle={{ paddingBottom: navBarInset }}
            // A new transaction added at the very top must show up at the top (same as SectionList),
            // not push the list down to keep the old first row in place.
            maintainVisibleContentPosition={{ disabled: true }}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmptyState}
          />
        </View>

      </View>
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
  listArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.block,
    marginBottom: Spacing.block,
  },
  headerTitle: {
    fontSize: FontSize.titleLarge,
    lineHeight: LineHeight.titleLarge,
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
    marginTop: 0,
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
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  sectionTitle: {
    fontSize: FontSize.caption,
    letterSpacing: 1,
    flex: 1,
    marginRight: Spacing.element,
  },
  sectionTotal: {
    fontSize: FontSize.caption,
    flexShrink: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.section,
    marginTop: EMPTY_STATE_TOP_MARGIN,
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
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
    marginBottom: Spacing.element,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.element,
    paddingVertical: 10,
    paddingHorizontal: Spacing.surface,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  seeMoreText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
});
