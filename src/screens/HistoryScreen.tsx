import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { Search, Receipt, SearchX, FilterX } from 'lucide-react-native';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { TabParamList, RootStackParamList } from '../types';
import { getCategoryIcon } from '../lib/iconUtils';
import { getPaymentIcon, getPaymentLabel } from '../lib/paymentUtils';
import { useScrollDirection } from '../hooks/useScrollDirection';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'History'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface Section {
  title: string;
  total: number;
  data: Expense[];
}

export const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { expenses, fetchExpenses } = useExpenseStore();
  const { categories, fetchCategories } = useCategoryStore();
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

  const filteredAndGroupedExpenses = useMemo<Section[]>(() => {
    let filtered = expenses;

    if (selectedCategoryId) {
      filtered = filtered.filter(e => e.category_id === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(e => {
        const category = categories.find(c => c.id === e.category_id);
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
  }, [expenses, categories, selectedCategoryId, searchQuery]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { fontFamily: 'Quicksand_700Bold' }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionTotal, { fontFamily: 'Quicksand_700Bold' }]}>
        −₹{section.total.toLocaleString('en-IN')}
      </Text>
    </View>
  ), []);

  const renderItem = useCallback(({ item }: { item: Expense }) => {
    const category = categories.find(c => c.id === item.category_id);
    const categoryName = category?.name || 'Unknown';
    const categoryColor = category?.color || '#F4B8AE';
    const categoryBgColor = categoryColor + '33';
    const IconComp = getCategoryIcon(category?.icon || '');
    const PaymentIcon = getPaymentIcon(item.payment_mode);
    const paymentLabel = getPaymentLabel(item.payment_mode);

    return (
      <Pressable
        style={styles.transactionRow}
        onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
      >
        <View style={[styles.iconContainer, { backgroundColor: categoryBgColor }]}>
          <IconComp size={20} color={categoryColor} />
        </View>
        <View style={styles.transactionMiddle}>
          <Text style={[styles.transactionTitle, { fontFamily: 'Quicksand_700Bold' }]} numberOfLines={1}>
            {categoryName}
          </Text>
          {!!item.note && (
            <Text style={[styles.transactionNote, { fontFamily: 'Quicksand_500Medium' }]} numberOfLines={1}>
              {item.note}
            </Text>
          )}
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: '#1A2B4C', fontFamily: 'Quicksand_700Bold' }]}>
            −₹{item.amount.toLocaleString('en-IN')}
          </Text>
          <View style={styles.paymentModeRow}>
            <PaymentIcon size={12} color="#B0B4C0" />
            <Text style={[styles.paymentModeText, { fontFamily: 'Quicksand_500Medium' }]}>
              {paymentLabel}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }, [categories, navigation]);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.container}>

        {/* Header Row */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontFamily: 'Quicksand_700Bold' }]}>
            History
          </Text>
          <Pressable
            style={styles.searchButton}
            onPress={() => setIsSearchVisible(!isSearchVisible)}
          >
            <Search size={20} color="#1A2B4C" />
          </Pressable>
        </View>

        {/* Search Bar */}
        {isSearchVisible && (
          <View style={styles.searchContainer}>
            <Search size={16} color="#8A8FA3" />
            <TextInput
              style={[styles.searchInput, { fontFamily: 'Quicksand_500Medium' }]}
              placeholder="Search transactions..."
              placeholderTextColor="#8A8FA3"
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
                selectedCategoryId === null ? styles.filterPillActive : styles.filterPillInactive,
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCategoryId === null ? styles.filterPillTextActive : styles.filterPillTextInactive,
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
                    isActive ? styles.filterPillActive : styles.filterPillInactive,
                  ]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive ? styles.filterPillTextActive : styles.filterPillTextInactive,
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
          contentContainerStyle={[styles.listContent, filteredAndGroupedExpenses.length === 0 && { flexGrow: 1 }]}
          stickySectionHeadersEnabled={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={() => {
            let IconComponent = Receipt;
            let title = 'No transactions yet';
            let subtitle = 'Your expenses will appear here once you add them.';

            if (searchQuery.trim()) {
              IconComponent = SearchX;
              title = 'No results found';
              subtitle = 'Try adjusting your search to find what you are looking for.';
            } else if (selectedCategoryId) {
              const catName = categories.find(c => c.id === selectedCategoryId)?.name || 'this category';
              IconComponent = FilterX;
              title = 'No expenses found';
              subtitle = `There are no expenses in the ${catName} category yet. They will appear here once you add them!`;
            }

            return (
              <View style={styles.emptyContainer}>
                <View style={styles.iconCircle}>
                  <IconComponent size={32} color="#8A8FA3" />
                </View>
                <Text style={[styles.emptyTitle, { fontFamily: 'Quicksand_700Bold' }]}>{title}</Text>
                <Text style={[styles.emptySubtitle, { fontFamily: 'Quicksand_500Medium' }]}>{subtitle}</Text>
              </View>
            );
          }}
        />

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#1A2B4C',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E9ED',
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
    backgroundColor: '#F1F2F5',
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
    color: '#1A2B4C',
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
    backgroundColor: '#B8E0C8',
    borderWidth: 1,
    borderColor: '#B8E0C8',
  },
  filterPillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E2E8',
  },
  filterPillText: {
    fontSize: 14,
  },
  filterPillTextActive: {
    color: '#1A2B4C',
  },
  filterPillTextInactive: {
    color: '#8A8FA3',
  },
  listContent: {
    paddingBottom: 120,
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
    color: '#B0B4C0',
    letterSpacing: 1,
  },
  sectionTotal: {
    fontSize: 12,
    color: '#B0B4C0',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F1F4',
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
    color: '#1A2B4C',
  },
  transactionNote: {
    fontSize: 14,
    color: '#8A8FA3',
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
    color: '#8A8FA3',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    color: '#1A2B4C',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8A8FA3',
    textAlign: 'center',
    lineHeight: 22,
  },
});
