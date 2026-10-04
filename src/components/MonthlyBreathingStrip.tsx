import React from 'react';
import { useTheme } from '../store/themeStore';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { SmartMonthlyTakeawayResult } from '../lib/monthlyInsightsUtils';
import { BreathingStripShell } from './BreathingStripShell';

export interface MonthlyBreathingStripProps {
  takeaway: SmartMonthlyTakeawayResult;
  isBudgetMode: boolean;
  safeDailyPace: number;
  isCurrentMonth: boolean;
  remainingDays: number;
  transactionCount: number;
  totalMonthSavings: number;
  savedDaysCount: number;
  addedIncome?: number;
  isOverBudget?: boolean;
  monthlyDailyBurnPace?: number;
  onPressSavings?: () => void;
}

export const MonthlyBreathingStrip: React.FC<MonthlyBreathingStripProps> = ({
  takeaway,
  isBudgetMode,
  safeDailyPace,
  isCurrentMonth,
  remainingDays,
  transactionCount,
  totalMonthSavings,
  savedDaysCount,
  addedIncome = 0,
  isOverBudget = false,
  monthlyDailyBurnPace = 0,
  onPressSavings,
}) => {
  const { colors, isDark } = useTheme();

  const remainingDaysLabel = remainingDays === 1 ? '1 day' : `${remainingDays} days`;

  const leftSubtext = isBudgetMode
    ? isCurrentMonth
      ? isOverBudget
        ? 'Budget exceeded · spend cautiously'
        : addedIncome > 0
        ? `Boosted by ₹${formatAmountWithCommas(String(addedIncome))} income · ${remainingDays}d left`
        : `${remainingDaysLabel} left to pace safely`
      : isOverBudget
      ? 'Finalized · Over budget'
      : 'Finalized · Within budget'
    : `Across ${transactionCount} logged ${transactionCount === 1 ? 'transaction' : 'transactions'}`;

  return (
    <BreathingStripShell
      takeawayText={takeaway.text}
      takeawayStatus={takeaway.status}
      leftTile={{
        label: isBudgetMode ? 'SAFE DAILY PACE' : 'DAILY BURN',
        value: isBudgetMode
          ? `₹${formatAmountWithCommas(String(safeDailyPace))}`
          : `₹${formatAmountWithCommas(String(monthlyDailyBurnPace))}`,
        unit: '/ day',
        subtext: leftSubtext,
        accessibilityLabel: isBudgetMode
          ? `Safe daily spending pace: ${formatCurrency(safeDailyPace)} per day with ${remainingDays} days remaining.`
          : `Average daily burn: ${formatCurrency(monthlyDailyBurnPace)} per day across ${transactionCount} transactions.`,
      }}
      rightTile={{
        label: 'AUTO-SAVED TO GULLAK',
        value:
          totalMonthSavings > 0
            ? `+${formatCurrency(totalMonthSavings)}`
            : formatCurrency(0),
        valueColor:
          totalMonthSavings > 0
            ? isDark
              ? colors.mintGreen
              : colors.forestGreen
            : colors.textPrimary,
        pillText: `🐷 ${savedDaysCount} ${savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}`,
        onPress: onPressSavings,
        accessibilityLabel: `Gullak savings this month: ${
          totalMonthSavings > 0
            ? `+${formatCurrency(totalMonthSavings)}`
            : formatCurrency(0)
        } across ${savedDaysCount} saved days. Tap to open Savings.`,
      }}
    />
  );
};
