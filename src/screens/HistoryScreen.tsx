import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, SectionList, Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { Search, Receipt, SearchX, FilterX } from 'lucide-react-native';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
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

interface Section {
  title: string;
  totalSpent: number;
  totalIncome: number;
  data: Expense[];
}

interface TransactionRowItemProps {
  item: Expense;
  category?: Category;
  onPress: (id: string) => void;
  colors: ThemeColors;
}

const TransactionRowItem = React.memo<TransactionRowItemProps>(({ item, category, onPress, colors }) => {
  const isIncome = isIncomeTransaction(item, category);
  const categoryName = category?.name || (isIncome ? 'Money Added' : 'Unknown');
  const categoryColor = category?.color || (isIncome ? colors.mintGreen : '#F4B8AE');
  const categoryBgColor = categoryColor + '33';
  const IconComp = getCategoryIcon(category?.icon || (isIncome ? 'Wallet' : ''));
  const PaymentIcon = getPaymentIcon(item.payment_mode);
  const paymentLabel = getPaymentLabel(item.payment_mode);

  return (
    <Pressable
      style={[styles.transactionRow, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
      onPress={() => onPress(item.id)}
      android_ripple={{ color: colors.cardSubtle, borderless: false }}
    >
      <View style={[styles.iconContainer, { backgroundColor: categoryBgColor }]}>
        <IconComp size={20} color={categoryColor} />
      </View>
      <View style={styles.transactionMiddle}>
        <Text style={[styles.transactionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]} numberOfLines={1}>
          {categoryName}
        </Text>
        {!!item.note && (
          <Text style={[styles.transactionNote, { color: colors.textSecondary, fontFamily: FontFamily.medium }]} numberOfLines={1}>
            {item.note}
          </Text>
        )}
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.transactionAmount, { color: isIncome ? (colors.isDark ? colors.mintGreen : colors.mintGreenDark) : colors.textPrimary, fontFamily: FontFamily.bold }]}>
          {isIncome ? `+${formatCurrency(Math.abs(item.amount))}` : `−${formatCurrency(Math.abs(item.amount))}`}
        </Text>
        <View style={styles.paymentModeRow}>
          <PaymentIcon size={12} color={colors.textSecondary} />
          <Text style={[styles.paymentModeText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            {paymentLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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

  const filteredAndGroupedExpenses = useMemo<Section[]>(() => {
    let filtered = expenses;

    if (selectedCategoryId) {
      filtered = filtered.filter(e => e.category_id === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(e => {
        const category = e.category_id ? categoryMap.get(e.category_id) : undefined;
        const categoryName = category?.name?.toLowerCase() || (e.type === 'income' ? 'money added' : '');
        const note = e.note?.toLowerCase() || '';
        const amountStr = e.amount?.toString() || '';
        const payment = e.payment_mode?.toLowerCase() || '';
        return categoryName.includes(lowerQuery) || note.includes(lowerQuery) || amountStr.includes(lowerQuery) || payment.includes(lowerQuery);
      });
    }

    const grouped: Record<string, Expense[]> = {};
    const spentTotals: Record<string, number> = {};
    const incomeTotals: Record<string, number> = {};

    filtered.forEach(expense => {
      const dateKey = expense.expense_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
        spentTotals[dateKey] = 0;
        incomeTotals[dateKey] = 0;
      }
      grouped[dateKey].push(expense);

      const category = expense.category_id ? categoryMap.get(expense.category_id) : undefined;
      const isIncome = isIncomeTransaction(expense, category);
      if (isIncome) {
        incomeTotals[dateKey] += expense.amount;
      } else {
        spentTotals[dateKey] += expense.amount;
      }
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return sortedDates.map(dateStr => {
      const dateObj = parseISO(dateStr);
      let title = format(dateObj, 'd MMM').toUpperCase();
      if (isToday(dateObj)) title = 'TODAY';
      else if (isYesterday(dateObj)) title = 'YESTERDAY';

      const sortedData = [...grouped[dateStr]].sort((a, b) =>
        (b.created_at || '').localeCompare(a.created_at || '')
      );

      return {
        title,
        totalSpent: spentTotals[dateStr] || 0,
        totalIncome: incomeTotals[dateStr] || 0,
        data: sortedData,
      };
    });
  }, [expenses, categoryMap, selectedCategoryId, searchQuery]);

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

  const renderItem = useCallback(({ item }: { item: Expense }) => (
    <TransactionRowItem
      item={item}
      category={item.category_id ? categoryMap.get(item.category_id) : undefined}
      onPress={handleItemPress}
      colors={colors}
    />
  ), [categoryMap, handleItemPress, colors]);

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

        {/* Filter Pills — unified: "All" + categories in one map */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {([{ id: null as string | null, name: 'All' }, ...categories]).map(item => {
              const isActive = selectedCategoryId === item.id;
              return (
                <Pressable
                  key={item.id ?? 'all'}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isActive ? (isDark ? colors.mintGreenSoft : '#B8E0C8') : colors.card,
                      borderColor: isActive ? colors.mintGreen : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategoryId(item.id)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      {
                        color: isActive ? colors.textPrimary : colors.textSecondary,
                        fontFamily: isActive ? FontFamily.bold : FontFamily.medium,
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Transaction List */}
        <SectionList
          sections={filteredAndGroupedExpenses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          showsVerticalScrollIndicator={false}
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
          scrollEventThrottle={16}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          updateCellsBatchingPeriod={50}
          ListEmptyComponent={renderEmptyState}
        />

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.block,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.input,
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
  filterScroll: {
    paddingVertical: Spacing.surface,
    paddingRight: Spacing.gutter,
  },
  filterPill: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    paddingVertical: 10,
    marginRight: Spacing.group,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: FontSize.bodySmall,
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
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.row,
    marginBottom: Spacing.group,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMiddle: {
    flex: 1,
    marginLeft: Spacing.group,
  },
  transactionTitle: {
    fontSize: FontSize.body,
  },
  transactionNote: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.nano,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: FontSize.body,
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.nano,
  },
  paymentModeText: {
    fontSize: FontSize.caption,
    marginLeft: Spacing.micro,
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
