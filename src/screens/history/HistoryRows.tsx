import React, { useCallback } from 'react';
import { Pressable } from 'react-native';
import { Expense } from '../../store/expenseStore';
import { Category } from '../../store/categoryStore';
import { GullakDeposit } from '../../store/dailyBudgetStore';
import { isIncomeTransaction } from '../../lib/transactionUtils';
import { ThemeColors } from '../../config/theme';
import { TransactionRow } from '../../components/TransactionRow';
import { GullakDepositRow } from '../../components/GullakDepositRow';
import { SwipeableHistoryRow } from '../../components/SwipeableHistoryRow';

export interface TransactionRowItemProps {
  item: Expense;
  category?: Category;
  onPress: (id: string) => void;
  onDelete: (expense: Expense) => void;
  colors: ThemeColors;
  isOpen: boolean;
  /** Stable parent handlers; the row passes its own id (an inline arrow per row would defeat React.memo). */
  onSwipeOpen: (id: string) => void;
  onSwipeClose: (id: string) => void;
}

export const TransactionRowItem = React.memo<TransactionRowItemProps>(({
  item,
  category,
  onPress,
  onDelete,
  colors,
  isOpen,
  onSwipeOpen,
  onSwipeClose,
}) => {
  const isIncome = isIncomeTransaction(item);
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [onPress, item.id]);

  const handleDelete = useCallback(() => {
    onDelete(item);
  }, [onDelete, item]);

  const handleSwipeOpen = useCallback(() => onSwipeOpen(item.id), [onSwipeOpen, item.id]);
  const handleSwipeClose = useCallback(() => onSwipeClose(item.id), [onSwipeClose, item.id]);

  return (
    <SwipeableHistoryRow
      onDelete={handleDelete}
      colors={colors}
      isDark={colors.isDark}
      isOpen={isOpen}
      onSwipeOpen={handleSwipeOpen}
      onSwipeClose={handleSwipeClose}
    >
      <TransactionRow
        expense={item}
        category={category}
        isIncome={isIncome}
        colors={colors}
        isDark={colors.isDark}
        onPress={handlePress}
        dateMode="historyTime"
      />
    </SwipeableHistoryRow>
  );
});

export interface GullakRowItemProps {
  item: GullakDeposit;
  onPress: (id: string) => void;
  onDelete: (deposit: GullakDeposit) => void;
  colors: ThemeColors;
  isOpen: boolean;
  /** Stable parent handlers; the row passes its own id (an inline arrow per row would defeat React.memo). */
  onSwipeOpen: (id: string) => void;
  onSwipeClose: (id: string) => void;
}

export const GullakRowItem = React.memo<GullakRowItemProps>(({
  item,
  onPress,
  onDelete,
  colors,
  isOpen,
  onSwipeOpen,
  onSwipeClose,
}) => {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [onPress, item.id]);

  const handleDelete = useCallback(() => {
    onDelete(item);
  }, [onDelete, item]);

  const handleSwipeOpen = useCallback(() => onSwipeOpen(item.id), [onSwipeOpen, item.id]);
  const handleSwipeClose = useCallback(() => onSwipeClose(item.id), [onSwipeClose, item.id]);

  return (
    <SwipeableHistoryRow
      onDelete={handleDelete}
      deleteLabel="Withdraw"
      colors={colors}
      isDark={colors.isDark}
      isOpen={isOpen}
      onSwipeOpen={handleSwipeOpen}
      onSwipeClose={handleSwipeClose}
    >
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: colors.cardSubtle, borderless: false }}
      >
        <GullakDepositRow
          deposit={item}
          colors={colors}
          isDark={colors.isDark}
          hideDate
        />
      </Pressable>
    </SwipeableHistoryRow>
  );
});
