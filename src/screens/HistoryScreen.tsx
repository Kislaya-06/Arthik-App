import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, SectionList, Platform,
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
import { getPaymentIcon, getPaymentLabel } from '../lib/paymentUtils';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useTheme } from '../store/themeStore';
import { ThemeColors } from '../config/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'History'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface Section {
  title: string;
  total: number;
  data: Expense[];
}

interface TransactionRowItemProps {
  item: Expense;
  category?: Category;
  onPress: (id: string) => void;
  colors: ThemeColors;
}

const TransactionRowItem = React.memo<TransactionRowItemProps>(({ item, category, onPress, colors }) => {
  const categoryName = category?.name || 'Unknown';
  const categoryColor = category?.color || '#F4B8AE';
  const categoryBgColor = categoryColor + '33';
  const IconComp = getCategoryIcon(category?.icon || '');
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
        <Text style={[styles.transactionTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]} numberOfLines={1}>
          {categoryName}
        </Text>
        {!!item.note && (
          <Text style={[styles.transactionNote, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]} numberOfLines={1}>
            {item.note}
          </Text>
        )}
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.transactionAmount, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
          −₹{item.amount.toLocaleString('en-IN')}
        </Text>
        <View style={styles.paymentModeRow}>
          <PaymentIcon size={12} color={colors.textSecondary} />
          <Text style={[styles.paymentModeText, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
            {paymentLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { expenses, fetchExpenses } = useExpenseStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const handleScroll = useScrollDirection();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
      fetchCategories();
    }, [fetchExpenses, fetchCategories]),
  );

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
        const category = categoryMap.get(e.category_id);
        const categoryName = category?.name?.toLowerCase() || '';
        const note = e.note?.toLowerCase() || '';
        return categoryName.includes(lowerQuery) || note.includes(lowerQuery);
      });
    }

    const grouped: Record<string, Expense[]> = {};
    const totals: Record<string, number> = {};

    filtered.forEach(expense => {
      const dateKey = expense.expense_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
        totals[dateKey] = 0;
      }
      grouped[dateKey].push(expense);
      totals[dateKey] += expense.amount;
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return sortedDates.map(dateStr => {
      const dateObj = parseISO(dateStr);
      let title = format(dateObj, 'd MMM').toUpperCase();
      if (isToday(dateObj)) title = 'TODAY';
      else if (isYesterday(dateObj)) title = 'YESTERDAY';

      return { title, total: totals[dateStr], data: grouped[dateStr] };
    });
  }, [expenses, categoryMap, selectedCategoryId, searchQuery]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: 'Quicksand_700Bold' }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionTotal, { color: colors.textMuted, fontFamily: 'Quicksand_700Bold' }]}>
        −₹{section.total.toLocaleString('en-IN')}
      </Text>
    </View>
  ), [colors]);

  const handleItemPress = useCallback((expenseId: string) => {
    navigation.navigate('ExpenseDetail', { expenseId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: Expense }) => (
    <TransactionRowItem
      item={item}
      category={categoryMap.get(item.category_id)}
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
        <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>{subtitle}</Text>
      </View>
    );
  }, [searchQuery, selectedCategoryId, categoryMap, colors]);

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.container}>

        {/* Header Row */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
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
              style={[styles.searchInput, { color: colors.textPrimary, fontFamily: 'Quicksand_500Medium' }]}
              placeholder="Search transactions..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}

        {/* Filter Pills */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <Pressable
              style={[
                styles.filterPill,
                selectedCategoryId === null
                  ? [styles.filterPillActive, { backgroundColor: isDark ? colors.mintGreenSoft : '#B8E0C8', borderColor: colors.mintGreen }]
                  : [styles.filterPillInactive, { backgroundColor: colors.card, borderColor: colors.border }],
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCategoryId === null
                    ? [styles.filterPillTextActive, { color: colors.textPrimary }]
                    : [styles.filterPillTextInactive, { color: colors.textSecondary }],
                  { fontFamily: selectedCategoryId === null ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
                ]}
              >
                All
              </Text>
            </Pressable>

            {categories.map(cat => {
              const isActive = selectedCategoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.filterPill,
                    isActive
                      ? [styles.filterPillActive, { backgroundColor: isDark ? colors.mintGreenSoft : '#B8E0C8', borderColor: colors.mintGreen }]
                      : [styles.filterPillInactive, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive
                        ? [styles.filterPillTextActive, { color: colors.textPrimary }]
                        : [styles.filterPillTextInactive, { color: colors.textSecondary }],
                      { fontFamily: isActive ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
                    ]}
                  >
                    {cat.name}
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
          contentContainerStyle={[
            styles.listContent,
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
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
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
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    padding: 0,
  },
  filterScroll: {
    paddingVertical: 20,
    paddingRight: 24,
  },
  filterPill: {
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
  },
  filterPillActive: {
    borderWidth: 1,
  },
  filterPillInactive: {
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 14,
  },
  filterPillTextActive: {},
  filterPillTextInactive: {},
  listContent: {
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
  },
  sectionTotal: {
    fontSize: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  transactionTitle: {
    fontSize: 16,
  },
  transactionNote: {
    fontSize: 14,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  paymentModeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 64,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
