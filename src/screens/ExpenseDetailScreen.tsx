import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, SquarePen, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategoryIcon } from '../lib/iconUtils';
import { getPaymentIcon, getPaymentLabel } from '../lib/paymentUtils';

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
        <Text style={[styles.notFoundText, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
          Expense not found
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backButtonFallback, { backgroundColor: colors.mint }]}>
          <Text style={[styles.backButtonText, { color: colors.forestGreen, fontFamily: 'Quicksand_700Bold' }]}>
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
            navigation.pop(1);
          },
        },
      ],
    );
  };

  const handleEdit = () => {
    navigation.navigate('EditExpense', { expenseId: expense.id });
  };

  const CategoryIcon = getCategoryIcon(category?.icon || '');
  const PaymentIcon = getPaymentIcon(expense.payment_mode);
  const paymentLabel = getPaymentLabel(expense.payment_mode);

  const formattedDate = expense.expense_date
    ? format(parseISO(expense.expense_date), 'd MMM yyyy')
    : '';
  const categoryColor = category?.color || '#F4B8AE';
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
            <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
              Expense Detail
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={handleEdit} hitSlop={10}>
              <SquarePen size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={10} style={{ marginLeft: 16 }}>
              <Trash2 size={20} color={colors.coral} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 32 },
          ]}
        >

          {/* Category Icon Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.badgeOuter, { backgroundColor: categoryBgColor }]}>
              <CategoryIcon size={44} color={categoryColor} />
            </View>
            <Text style={[styles.badgeText, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
              {category?.name || 'Unknown'}
            </Text>
          </View>

          {/* Amount Display */}
          <View style={styles.amountContainer}>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>₹</Text>
              <Text style={[styles.amountValue, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
                {expense.amount.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Type Badge */}
          <View style={styles.typeBadgeContainer}>
            <View style={[styles.typeBadgePill, { backgroundColor: colors.peachSoft }]}>
              <Text style={[styles.typeBadgeText, { color: isDark ? colors.peachCoral : '#D97757', fontFamily: 'Quicksand_700Bold' }]}>
                EXPENSE
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
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>Date</Text>
              <Text style={[styles.cardValue, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>{formattedDate}</Text>
            </View>

            {/* Paid Via Row */}
            <View style={[styles.cardRow, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>Paid via</Text>
              <View style={styles.paidViaContainer}>
                <PaymentIcon size={14} color={colors.textPrimary} />
                <Text style={[styles.cardValue, { color: colors.textPrimary, marginLeft: 6, fontFamily: 'Quicksand_700Bold' }]}>
                  {paymentLabel.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Note Row */}
            <View style={[styles.cardRow, styles.cardRowLast, styles.noteRow]}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>Note</Text>
              {expense.note ? (
                <Text style={[styles.noteValue, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
                  {expense.note}
                </Text>
              ) : (
                <Text style={[styles.notePlaceholder, { color: colors.textTertiary, fontFamily: 'Quicksand_500Medium', fontStyle: 'italic' }]}>
                  No note added
                </Text>
              )}
            </View>
          </View>

          {/* Bottom Actions */}
          <View style={styles.actionsContainer}>
            <Pressable onPress={handleEdit} style={[styles.editButton, { backgroundColor: colors.mint }]}>
              <Text style={[styles.editButtonText, { color: colors.forestGreen, fontFamily: 'Quicksand_700Bold' }]}>
                Edit Expense
              </Text>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.deleteLink}>
              <Text style={[styles.deleteLinkText, { color: colors.coral, fontFamily: 'Quicksand_700Bold' }]}>
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
    paddingHorizontal: 24,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 18,
    marginBottom: 16,
  },
  backButtonFallback: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  backButtonText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 16,
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
    marginTop: 32,
  },
  badgeOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A8FA3',
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 30,
    color: '#1A2B4C',
    marginRight: 4,
  },
  amountValue: {
    fontSize: 60,
    color: '#1A2B4C',
  },
  typeBadgeContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  typeBadgePill: {
    backgroundColor: '#FDEEE4',
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    color: '#E8956A',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 8,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  cardLabel: {
    fontSize: 14,
    color: '#8A8FA3',
  },
  cardValue: {
    fontSize: 14,
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
    fontSize: 14,
    color: '#1A2B4C',
    textAlign: 'right',
    marginLeft: 16,
    flex: 1,
  },
  notePlaceholder: {
    fontSize: 14,
    color: '#B0B4C0',
    textAlign: 'right',
    marginLeft: 16,
    flex: 1,
  },
  actionsContainer: {
    marginTop: 32,
  },
  editButton: {
    borderRadius: 9999,
    backgroundColor: '#B8E0C8',
    paddingVertical: 20,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 18,
    color: '#1A2B4C',
  },
  deleteLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  deleteLinkText: {
    fontSize: 16,
    color: '#F4B8AE',
  },
});
