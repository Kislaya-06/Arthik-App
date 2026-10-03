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
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { TransactionRow } from '../components/TransactionRow';
import { AmountText } from '../components/ui/AmountText';

import { RootStackParamList } from '../types';
import { useCategoryStore } from '../store/categoryStore';
import { useExpenseStore, Expense } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

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
  const categoryColor = category?.color || '#ADEBB3';
  const categoryBgColor = categoryColor;

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
    return (
      <TransactionRow
        expense={item}
        category={category}
        isIncome={isIncome}
        colors={colors}
        isDark={isDark}
        onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
      />
    );
  }, [navigation, category, colors, isDark]);

  if (!category) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={[styles.notFoundText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
          Category not found
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.notFoundBack, { backgroundColor: colors.mint }]}>
          <Text style={[styles.notFoundBackText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>
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
          <GradientIconBadge size={36} color={categoryColor} isDark={isDark}>
            {({ iconColor }) => <CategoryIcon size={18} color={iconColor} strokeWidth={2.2} />}
          </GradientIconBadge>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
          >
            {category.name}
          </Text>
        </View>
        {/* Spacer to balance the back button — literal 24 tracks ArrowLeft icon size, not Spacing.gutter */}
        <View style={{ width: 24 }} />
      </View>

      {/* Summary Card */}
      <View style={[
        styles.summaryCard,
        {
          backgroundColor: categoryColor,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
          borderWidth: 1,
        }
      ]}>
        {/* Gradient Overlay for 3D effect */}
        <View style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="catCardGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#000000" stopOpacity={0.05} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.3} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#catCardGrad)" />
          </Svg>
        </View>

        {/* Decorative circles from InsightsScreen */}
        <View style={styles.summaryCircle1} />
        <View style={styles.summaryCircle2} />

        <Text style={[styles.summaryLabel, { fontFamily: FontFamily.bold }]}>
          TOTAL SPENT
        </Text>
        <View style={styles.summaryAmountRow}>
          <AmountText
            role="hero"
            value={totalSpent}
            color="#2D1E1E"
            showDecimals={totalSpent % 1 !== 0}
            rolling
          />
        </View>
        <Text style={[styles.summaryCount, { fontFamily: FontFamily.medium }]}>
          {categoryExpenses.length}{' '}
          {categoryExpenses.length === 1 ? 'transaction' : 'transactions'}
        </Text>
      </View>

      {/* Transactions Section Header */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
        Transactions
      </Text>

      {/* List */}
      {categoryExpenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textTertiary, fontFamily: FontFamily.medium }]}>
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
            { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.section },
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
    paddingHorizontal: Spacing.gutter,
  },
  notFound: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: FontSize.body,
    color: '#8A8FA3',
    marginBottom: Spacing.block,
  },
  notFoundBack: {
    backgroundColor: '#B8E0C8',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.group,
  },
  notFoundBackText: {
    fontSize: FontSize.body,
    color: '#1A2B4C',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.block,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
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
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
  },

  // Summary Card
  summaryCard: {
    borderRadius: BorderRadius.cardLarge,
    padding: Spacing.gutter,
    marginTop: Spacing.gutter,
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  summaryCircle2: {
    position: 'absolute',
    bottom: -60,
    right: 40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(60, 35, 35, 0.8)',
  },
  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.element,
  },
  summaryCount: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.element,
    color: 'rgba(45, 30, 30, 0.7)',
  },

  // Section
  sectionTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    marginTop: Spacing.section,
    marginBottom: Spacing.block,
  },
  listContent: {
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
