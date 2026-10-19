import React, { useEffect, useMemo, useState } from 'react';
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
import { formatCurrency } from '../lib/formatters';
import { getDateOwner } from '../lib/budgetPeriods';
import { ArrowLeft, SquarePen, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategoryIcon } from '../lib/iconUtils';
import { getPaymentIcon, getPaymentLabel } from '../lib/paymentUtils';
import { isIncomeTransaction, isRecoveryClass } from '../lib/transactionUtils';
import { SplitDetailCard } from '../components/split/SplitDetailCard';
import { deleteBlockReason, grossAmountOf, recoverySlices, buildPeopleLedger, matchIncomingToPeople, refundCandidates } from '../lib/splitLedger';
import { calculateGullakIncomeDeficit } from '../lib/gullakReconciliation';
import { MoneyBackSheet } from '../components/split/MoneyBackSheet';
import { GradientIconBadge } from '../components/GradientIconBadge';
import { AmountText } from '../components/ui/AmountText';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AppButton } from '../components/ui/AppButton';
import { WhyLoggedCard } from '../components/autolog/WhyLoggedCard';
import { TransferDetailCard } from '../components/transfer/TransferDetailCard';
import { ExpenseFundingCard } from '../components/ExpenseFundingCard';
import { calculateExpenseFunding } from '../lib/transactionFunding';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

export const ExpenseDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { expenseId } = route.params;
  const expenses = useExpenseStore((s) => s.expenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [showMoneyBack, setShowMoneyBack] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const expense = expenses.find((e) => e.id === expenseId);
  const category = categories.find((c) => c.id === expense?.category_id);

  const fundingInfo = useMemo(() => {
    if (!expense) return null;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayBudget = dailyRecords[todayStr]?.budget ?? dailyBudgetAmount;
    return calculateExpenseFunding({
      expense,
      allExpenses: expenses,
      categories,
      records: dailyRecords,
      planChanges,
      todayBudget,
      dailyBudgetAmount,
      isBudgetModeEnabled,
      isAutoRenew,
      deposits: gullakDeposits,
      todayStr,
    });
  }, [
    expense,
    expenses,
    categories,
    dailyRecords,
    planChanges,
    dailyBudgetAmount,
    isBudgetModeEnabled,
    isAutoRenew,
    gullakDeposits,
  ]);

  // SPL-005: for an ordinary income, offer "was this money back?" - first choice is a person whose name matches.
  const moneyBackHint = useMemo(() => {
    if (!expense || expense.type !== 'income' || expense.transaction_class === 'self_transfer' || isRecoveryClass(expense)) return null;
    const people = buildPeopleLedger(expenses).filter((p) => p.owed > 0);
    const match = matchIncomingToPeople(people, { amount: grossAmountOf(expense), sender: expense.note })[0];
    const canRefund = refundCandidates(expenses).length > 0;
    if (people.length === 0 && !canRefund) return null;
    return { match: match || null };
  }, [expense, expenses]);

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
    // SPL-006: an expense that has money back must lose that money-back entry first.
    const blocked = deleteBlockReason(expense.id, expenses);
    if (blocked) {
      Alert.alert("Can't delete yet", blocked);
      return;
    }
    // SPL-003: deleting a money-back entry puts the spending (and what the person owes) back as it was.
    if (isRecoveryClass(expense)) {
      const days = recoverySlices(expense, expenses)
        .map((s) => {
          const dateStr = s.expense?.expense_date;
          if (!dateStr) return '';
          try {
            return format(parseISO(dateStr), 'd MMM');
          } catch {
            return dateStr;
          }
        })
        .filter(Boolean);
      Alert.alert(
        'Delete money back',
        `${formatCurrency(expense.amount)} will go back to being spent${days.length ? ` on ${Array.from(new Set(days)).join(', ')}` : ''}, and what was settled will be owed again.\n\nDo you want to continue?`,
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
        ]
      );
      return;
    }
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const cleanDate = expense.expense_date?.split('T')[0]?.trim() || '';
    const isPastDate = cleanDate !== '' && cleanDate < todayStr;

    if (isPastDate && !isIncome) {
      const planChanges = useDailyBudgetStore.getState().planChanges;
      const isBudgetModeEnabled = useDailyBudgetStore.getState().isBudgetModeEnabled;
      const dateOwner = isBudgetModeEnabled ? getDateOwner(planChanges, cleanDate) : 'paused';

      const restoreMessage =
        dateOwner === 'daily'
          ? `Deleting this ${formatCurrency(expense.amount)} expense on ${formattedDate} will return ${formatCurrency(expense.amount)} to that day's budget and update your Gullak savings accordingly.\n\nDo you want to continue?`
          : `Deleting this ${formatCurrency(expense.amount)} expense on ${formattedDate} will restore ${formatCurrency(expense.amount)} back to your available spending pool.\n\nDo you want to continue?`;

      Alert.alert(
        'Delete Past Expense',
        restoreMessage,
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
        ]
      );
      return;
    }

    if (isIncome) {
      const gullakDeposits = useDailyBudgetStore.getState().gullakDeposits || [];
      const deficit = calculateGullakIncomeDeficit({
        dateStr: cleanDate,
        expenseId: expense.id,
        newAmount: 0,
        expenses,
        gullakDeposits,
      });

      const title = isPastDate ? 'Delete Past Income' : 'Delete Income';
      const message =
        deficit > 0
          ? `Deleting this ${formatCurrency(expense.amount)} income on ${formattedDate} will also reduce ${formatCurrency(deficit)} from your Gullak savings (funded by this income).\n\nDo you want to continue?`
          : isPastDate
          ? `Deleting this ${formatCurrency(expense.amount)} income on ${formattedDate} will reduce your total available income balance.\n\nAre you sure you want to delete?`
          : `Are you sure you want to delete this income transaction?`;

      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: deficit > 0 ? 'Delete & Adjust Gullak' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deficit > 0) {
              await useDailyBudgetStore.getState().adjustGullakIncomeDeposits(cleanDate, deficit);
            }
            await deleteExpense(expense.id);
            useDailyBudgetStore.getState().syncWithExpenses(useExpenseStore.getState().expenses);
            navigation.pop(1);
          },
        },
      ]);
      return;
    }

    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete this expense?`,
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
      ]
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
  const categoryColor = category?.color || (isIncome ? '#ADEBB3' : '#FF857A');

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
            {!isRecoveryClass(expense) && (
              <Pressable onPress={handleEdit} hitSlop={10}>
                <SquarePen size={20} color={colors.textPrimary} />
              </Pressable>
            )}
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
            <GradientIconBadge size={88} color={categoryColor} isDark={isDark}>
              {({ iconColor }) => <CategoryIcon size={44} color={iconColor} strokeWidth={2.2} />}
            </GradientIconBadge>
            <Text style={[styles.badgeText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              {category?.name || (isIncome ? 'Money Added' : 'Unknown')}
            </Text>
          </View>

          {/* Amount Display */}
          <View style={styles.amountContainer}>
            <AmountText
              role="hero"
              value={grossAmountOf(expense)}
              color={colors.textPrimary}
              showDecimals={grossAmountOf(expense) % 1 !== 0}
            />
          </View>

          {/* Type Badge */}
          <View style={styles.typeBadgeContainer}>
            <StatusBadge
              variant={expense.transaction_class === 'self_transfer' || isRecoveryClass(expense) ? 'neutral' : isIncome ? 'success' : 'danger'}
              label={
                expense.transaction_class === 'self_transfer' ? 'TRANSFER'
                : isRecoveryClass(expense) ? 'MONEY BACK'
                : isIncome ? 'INCOME' : 'EXPENSE'
              }
            />
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

            {/* Deducted From / Destination Row */}
            {fundingInfo && !isRecoveryClass(expense) && (
              <View style={[styles.cardRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  {isIncome ? 'Destination' : 'Deducted from'}
                </Text>
                <Text
                  style={[
                    styles.cardValue,
                    {
                      flex: 1,
                      color: fundingInfo.coveredByGullak > 0
                        ? colors.coral
                        : fundingInfo.coveredByIncome > 0
                        ? (isDark ? colors.mintGreen : colors.mintGreenDark)
                        : colors.textPrimary,
                      fontFamily: FontFamily.bold,
                    },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {fundingInfo.summaryLabel}
                </Text>
              </View>
            )}

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

          {/* Funding Breakdown Card */}
          {fundingInfo && isBudgetModeEnabled && !isRecoveryClass(expense) && <ExpenseFundingCard funding={fundingInfo} />}

          {/* Self-transfer details (renders nothing for normal transactions) */}
          <TransferDetailCard expense={expense} />

          {/* Split expense / money back (SPL-001..SPL-006); renders nothing for ordinary transactions */}
          <SplitDetailCard
            expense={expense}
            allExpenses={expenses}
            onOpen={(id) => navigation.push('ExpenseDetail', { expenseId: id })}
          />

          {/* Income that may really be money coming back (SPL-005) */}
          {moneyBackHint ? (
            <View style={[styles.hintCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.cardValue, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                {moneyBackHint.match
                  ? `${moneyBackHint.match.person.name} owes you ${formatCurrency(moneyBackHint.match.person.owed)}. Is this their payment?`
                  : 'Was this money coming back?'}
              </Text>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                A friend paying you back or a refund is not new income.
              </Text>
              <AppButton
                label={moneyBackHint.match ? 'Yes, settle it' : 'Mark as money back'}
                onPress={() => setShowMoneyBack(true)}
                variant="secondary"
                size="cta"
                style={{ marginTop: Spacing.group }}
              />
            </View>
          ) : null}

          {/* Split an expense that is already logged (for example by Automatic Logging) */}
          {expense.type !== 'income' && !isRecoveryClass(expense) && expense.transaction_class !== 'self_transfer' && !expense.split_person ? (
            <AppButton
              label="Split this expense"
              onPress={() => navigation.navigate('EditExpense', { expenseId: expense.id, splitOn: true })}
              variant="outline"
              size="cta"
              style={{ marginTop: Spacing.block }}
            />
          ) : null}

          {/* Automatic Logging: source + "Why was this logged?" (renders nothing for manual entries) */}
          <WhyLoggedCard
            expenseId={expense.id}
            onEditAmount={() => navigation.navigate('EditExpense', { expenseId: expense.id })}
            onDeleted={() => navigation.goBack()}
          />

          {/* Bottom Actions */}
          <View style={styles.actionsContainer}>
            {isRecoveryClass(expense) ? (
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium, marginBottom: Spacing.block }]}>
                To change this, delete it and add it again.
              </Text>
            ) : (
              <AppButton
                label={isIncome ? 'Edit Transaction' : 'Edit Expense'}
                onPress={handleEdit}
                variant="primary"
                size="cta"
              />
            )}
            <AppButton
              label={isRecoveryClass(expense) ? 'Delete Money Back' : isIncome ? 'Delete Transaction' : 'Delete Expense'}
              onPress={handleDelete}
              variant="danger"
              size="cta"
              style={{ marginTop: isRecoveryClass(expense) ? 0 : Spacing.block }}
            />
          </View>

        </ScrollView>
      </View>

      <MoneyBackSheet
        visible={showMoneyBack}
        incomeId={showMoneyBack ? expense.id : null}
        suggestedPerson={moneyBackHint?.match?.person.name}
        onClose={() => setShowMoneyBack(false)}
        onDone={() => {
          setShowMoneyBack(false);
          useDailyBudgetStore.getState().syncWithExpenses(useExpenseStore.getState().expenses);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hintCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.surface,
    marginTop: Spacing.block,
    borderWidth: 1,
    gap: Spacing.micro,
  },
  safeArea: {
    flex: 1,
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
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
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
    fontSize: FontSize.display,
    marginRight: Spacing.micro,
  },
  amountValue: {
    fontSize: 60,
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
    flexShrink: 0,
    marginRight: Spacing.element,
  },
  cardValue: {
    fontSize: FontSize.bodySmall,
    color: '#1A2B4C',
    textAlign: 'right',
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
    fontSize: FontSize.cta,
    color: '#1A2B4C',
  },
});
