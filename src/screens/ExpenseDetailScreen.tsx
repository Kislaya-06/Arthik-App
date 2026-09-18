import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, SquarePen, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategoryIcon } from '../lib/iconUtils';
import { getPaymentIcon, getPaymentLabel, isIncomeTransaction } from '../lib/paymentUtils';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

export const ExpenseDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { expenseId } = route.params;
  const expenses = useExpenseStore((s) => s.expenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const expense = expenses.find((e) => e.id === expenseId);
  const category = categories.find((c) => c.id === expense?.category_id);

  if (!expense) {
    return (
      <View style={[styles.notFoundContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={[styles.notFoundText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          Expense not found
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backButtonFallback, { backgroundColor: colors.mint }]}>
          <Text style={[styles.backButtonText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(expense.id);
            useDailyBudgetStore.getState().syncWithExpenses(useExpenseStore.getState().expenses);
            navigation.pop(1);
          },
        },
      ],
    );
  };

  const handleEdit = () => {
    navigation.navigate('EditExpense', { expenseId: expense.id });
  };

  const isIncome = isIncomeTransaction(expense, category);
  const CategoryIcon = getCategoryIcon(category?.icon || (isIncome ? 'Wallet' : ''));
  const PaymentIcon = getPaymentIcon(expense.payment_mode);
  const paymentLabel = getPaymentLabel(expense.payment_mode);

  const formattedDate = expense.expense_date
    ? format(parseISO(expense.expense_date), 'd MMM yyyy')
    : '';
  const categoryColor = category?.color || (isIncome ? colors.mintGreen : '#F4B8AE');
  const categoryBgColor = categoryColor + '33';

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.container}>

        {/* Header Row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
              <ArrowLeft size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              {isIncome ? 'Transaction Detail' : 'Expense Detail'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={handleEdit} hitSlop={10}>
              <SquarePen size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={10} style={{ marginLeft: Spacing.block }}>
              <Trash2 size={20} color={colors.coral} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.section },
          ]}
        >

          {/* Category Icon Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.badgeOuter, { backgroundColor: categoryBgColor }]}>
              <CategoryIcon size={44} color={categoryColor} />
            </View>
            <Text style={[styles.badgeText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              {category?.name || (isIncome ? 'Money Added' : 'Unknown')}
            </Text>
          </View>

          {/* Amount Display */}
          <View style={styles.amountContainer}>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>₹</Text>
              <Text style={[styles.amountValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                {expense.amount.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Type Badge */}
          <View style={styles.typeBadgeContainer}>
            <View style={[styles.typeBadgePill, { backgroundColor: isIncome ? colors.mintGreenSoft : colors.peachSoft }]}>
              <Text style={[styles.typeBadgeText, { color: isIncome ? (isDark ? colors.mintGreen : colors.mintGreenDark) : (isDark ? colors.peachCoral : '#D97757'), fontFamily: FontFamily.bold }]}>
                {isIncome ? 'INCOME' : 'EXPENSE'}
              </Text>
            </View>
          </View>

          {/* Details Card */}
          <View style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderWidth: isDark ? 1 : 0,
              borderColor: colors.borderSubtle,
            }
          ]}>
            {/* Date Row */}
            <View style={[styles.cardRow, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>Date</Text>
              <Text style={[styles.cardValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>{formattedDate}</Text>
            </View>

            {/* Paid Via Row */}
            <View style={[styles.cardRow, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                {isIncome ? 'Added via' : 'Paid via'}
              </Text>
              <View style={styles.paidViaContainer}>
                <PaymentIcon size={14} color={colors.textPrimary} />
                <Text style={[styles.cardValue, { color: colors.textPrimary, marginLeft: 6, fontFamily: FontFamily.bold }]}>
                  {paymentLabel.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Note Row */}
            <View style={[styles.cardRow, styles.cardRowLast, styles.noteRow]}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>Note</Text>
              {expense.note ? (
                <Text
                  style={[styles.noteValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
                  numberOfLines={4}
                  ellipsizeMode="tail"
                >
                  {expense.note}
                </Text>
              ) : (
                <Text style={[styles.notePlaceholder, { color: colors.textTertiary, fontFamily: FontFamily.medium, fontStyle: 'italic' }]}>
                  No note added
                </Text>
              )}
            </View>
          </View>

          {/* Bottom Actions */}
          <View style={styles.actionsContainer}>
            <Pressable onPress={handleEdit} style={[styles.editButton, { backgroundColor: colors.mint }]}>
              <Text style={[styles.editButtonText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>
                Edit Expense
              </Text>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.deleteLink}>
              <Text style={[styles.deleteLinkText, { color: colors.coral, fontFamily: FontFamily.bold }]}>
                Delete Expense
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.gutter,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 18,
    marginBottom: Spacing.block,
  },
  backButtonFallback: {
    paddingVertical: Spacing.group,
    paddingHorizontal: Spacing.gutter,
    borderRadius: BorderRadius.card,
  },
  backButtonText: {
    fontSize: FontSize.body,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: Spacing.block,
    fontSize: 20,
    color: '#1A2B4C',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
  },
  badgeContainer: {
    alignItems: 'center',
    marginTop: Spacing.section,
  },
  badgeOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    marginTop: Spacing.block,
    fontSize: FontSize.body,
    color: '#8A8FA3',
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: Spacing.block,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: FontSize.screenTitle,
    color: '#1A2B4C',
    marginRight: Spacing.micro,
  },
  amountValue: {
    fontSize: 60,
    color: '#1A2B4C',
  },
  typeBadgeContainer: {
    alignItems: 'center',
    marginTop: Spacing.block,
  },
  typeBadgePill: {
    backgroundColor: '#FDEEE4',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.element,
  },
  typeBadgeText: {
    fontSize: FontSize.caption,
    color: '#E8956A',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.card,
    marginTop: Spacing.section,
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.element,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.block,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  cardLabel: {
    fontSize: FontSize.bodySmall,
    color: '#8A8FA3',
  },
  cardValue: {
    fontSize: FontSize.bodySmall,
    color: '#1A2B4C',
  },
  paidViaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteRow: {
    alignItems: 'flex-start',
  },
  noteValue: {
    fontSize: FontSize.bodySmall,
    color: '#1A2B4C',
    textAlign: 'right',
    marginLeft: Spacing.block,
    flex: 1,
  },
  notePlaceholder: {
    fontSize: FontSize.bodySmall,
    color: '#B0B4C0',
    textAlign: 'right',
    marginLeft: Spacing.block,
    flex: 1,
  },
  actionsContainer: {
    marginTop: Spacing.section,
  },
  editButton: {
    borderRadius: BorderRadius.pill,
    backgroundColor: '#B8E0C8',
    paddingVertical: Spacing.surface,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 18,
    color: '#1A2B4C',
  },
  deleteLink: {
    alignItems: 'center',
    marginTop: Spacing.block,
    paddingVertical: Spacing.element,
  },
  deleteLinkText: {
    fontSize: FontSize.body,
    color: '#F4B8AE',
  },
});
