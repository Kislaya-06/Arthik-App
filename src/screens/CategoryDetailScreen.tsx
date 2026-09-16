import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';

import { RootStackParamList } from '../types';
import { useCategoryStore } from '../store/categoryStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';
import { formatCurrency } from '../lib/formatters';
import { getPaymentIcon, getPaymentLabel, isIncomeTransaction } from '../lib/paymentUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDetail'>;

export const CategoryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { categories, fetchCategories } = useCategoryStore();
  const { expenses, fetchExpenses } = useExpenseStore();

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchExpenses();
    }, [fetchCategories, fetchExpenses]),
  );

  const category = categories.find(c => c.id === categoryId);
  const CategoryIcon = getCategoryIcon(category?.icon || '');
  const categoryColor = category?.color || '#94A3B8';
  const categoryBgColor = categoryColor + '33';

  const categoryExpenses = useMemo(() =>
    expenses
      .filter(e => e.category_id === categoryId)
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
  [expenses, categoryId]);

  const totalSpent = useMemo(() =>
    categoryExpenses.reduce((sum, e) => {
      return isIncomeTransaction(e, category) ? sum : sum + e.amount;
    }, 0),
  [categoryExpenses, category]);

  const renderItem = useCallback(({ item }: { item: Expense }) => {
    const isIncome = isIncomeTransaction(item, category);
    const PaymentIcon = getPaymentIcon(item.payment_mode);
    const paymentLabel = getPaymentLabel(item.payment_mode);
    const dateStr = format(parseISO(item.expense_date), 'd MMM yyyy');
    const amountLabel = isIncome ? `+${formatCurrency(item.amount)}` : formatCurrency(item.amount);
    const amountColor = isIncome ? (isDark ? colors.mintGreen : colors.mintGreenDark) : colors.textPrimary;

    return (
      <Pressable
        style={[
          styles.expenseRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.borderSubtle,
          }
        ]}
        onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
      >
        <View style={styles.expenseLeft}>
          <Text style={[styles.expenseAmount, { color: amountColor, fontFamily: 'Quicksand_700Bold' }]}>
            {amountLabel}
          </Text>
          {!!item.note && (
            <Text
              style={[styles.expenseNote, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}
              numberOfLines={1}
            >
              {item.note}
            </Text>
          )}
        </View>
        <View style={styles.expenseRight}>
          <Text style={[styles.expenseDate, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
            {dateStr}
          </Text>
          <View style={styles.paymentRow}>
            <PaymentIcon size={12} color={colors.textTertiary} />
            <Text style={[styles.paymentLabel, { color: colors.textTertiary, fontFamily: 'Quicksand_500Medium' }]}>
              {paymentLabel}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }, [navigation, colors]);

  if (!category) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={[styles.notFoundText, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
          Category not found
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.notFoundBack, { backgroundColor: colors.mint }]}>
          <Text style={[styles.notFoundBackText, { color: colors.forestGreen, fontFamily: 'Quicksand_700Bold' }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIconBadge, { backgroundColor: categoryBgColor }]}>
            <CategoryIcon size={20} color={categoryColor} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
            {category.name}
          </Text>
        </View>
        {/* Spacer to balance the back button */}
        <View style={{ width: 24 }} />
      </View>

      {/* Summary Card */}
      <View style={[
        styles.summaryCard,
        isDark && {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        }
      ]}>
        {/* Decorative circles */}
        <View style={styles.summaryCircle1} />
        <View style={styles.summaryCircle2} />

        <Text style={[styles.summaryLabel, { fontFamily: 'Quicksand_700Bold' }]}>
          TOTAL SPENT
        </Text>
        <View style={styles.summaryAmountRow}>
          <Text style={[styles.summaryCurrency, { fontFamily: 'Quicksand_700Bold' }]}>₹</Text>
          <Text style={[styles.summaryAmount, { fontFamily: 'Quicksand_700Bold' }]}>
            {Math.round(totalSpent).toLocaleString('en-IN')}
          </Text>
        </View>
        <Text style={[styles.summaryCount, { fontFamily: 'Quicksand_500Medium' }]}>
          {categoryExpenses.length}{' '}
          {categoryExpenses.length === 1 ? 'transaction' : 'transactions'}
        </Text>
      </View>

      {/* Transactions Section Header */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
        Transactions
      </Text>

      {/* List */}
      {categoryExpenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textTertiary, fontFamily: 'Quicksand_500Medium' }]}>
            No transactions in this category yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={categoryExpenses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 32 },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    paddingHorizontal: 24,
  },
  notFound: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: '#8A8FA3',
    marginBottom: 16,
  },
  notFoundBack: {
    backgroundColor: '#B8E0C8',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  notFoundBackText: {
    fontSize: 16,
    color: '#1A2B4C',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#1A2B4C',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#1A2B4C',
    borderRadius: 28,
    padding: 24,
    marginTop: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  summaryCircle1: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#2A3C64',
    opacity: 0.5,
  },
  summaryCircle2: {
    position: 'absolute',
    bottom: -60,
    right: 40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2A3C64',
    opacity: 0.3,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8A93AB',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  summaryCurrency: {
    fontSize: 20,
    color: '#FFFFFF',
    marginRight: 4,
  },
  summaryAmount: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  summaryCount: {
    fontSize: 14,
    color: '#8A93AB',
    marginTop: 8,
  },

  // Section
  sectionTitle: {
    fontSize: 20,
    color: '#1A2B4C',
    marginTop: 32,
    marginBottom: 16,
  },
  listContent: {
  },

  // Expense Row
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F1F4',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  expenseLeft: {
    flex: 1,
    marginRight: 12,
  },
  expenseAmount: {
    fontSize: 16,
    color: '#1A2B4C',
  },
  expenseNote: {
    fontSize: 13,
    color: '#8A8FA3',
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseDate: {
    fontSize: 13,
    color: '#8A8FA3',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#B0B4C0',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#B0B4C0',
  },
});
