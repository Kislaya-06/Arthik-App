import React, { useCallback, useEffect } from 'react';
import { Animated, useAnimatedValue } from 'react-native';
import { PressableOpacity } from '../../components/ui/PressableOpacity';
import { TransactionRow } from '../../components/TransactionRow';
import { Expense } from '../../store/expenseStore';
import { Category } from '../../store/categoryStore';
import { GullakDeposit } from '../../store/dailyBudgetStore';
import { useTheme } from '../../store/themeStore';
import { GullakDepositRow } from '../../components/GullakDepositRow';

// ─── Staggered Transaction Row ───────────────────────────────────────────────
export const StaggerRow: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  const anim = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      delay: Math.min(index * 35, 140),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
};

export interface HomeTransactionItemProps {
  expense: Expense;
  category: Category | undefined;
  isIncome: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  onPress: (id: string) => void;
  index: number;
}

export const HomeTransactionItem = React.memo<HomeTransactionItemProps>(({
  expense,
  category,
  isIncome,
  colors,
  isDark,
  onPress,
  index,
}) => {
  const handlePress = useCallback(() => onPress(expense.id), [onPress, expense.id]);
  return (
    <StaggerRow index={index}>
      <TransactionRow
        expense={expense}
        category={category}
        isIncome={isIncome}
        colors={colors}
        isDark={isDark}
        onPress={handlePress}
      />
    </StaggerRow>
  );
});

export interface HomeGullakItemProps {
  deposit: GullakDeposit;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  onPress: (id: string) => void;
  index: number;
}

export const HomeGullakItem = React.memo<HomeGullakItemProps>(({
  deposit,
  colors,
  isDark,
  onPress,
  index,
}) => {
  const handlePress = useCallback(() => onPress(deposit.id), [onPress, deposit.id]);
  return (
    <StaggerRow index={index}>
      <PressableOpacity
        activeOpacity={0.75}
        onPress={handlePress}
      >
        <GullakDepositRow
          deposit={deposit}
          colors={colors}
          isDark={isDark}
        />
      </PressableOpacity>
    </StaggerRow>
  );
});
