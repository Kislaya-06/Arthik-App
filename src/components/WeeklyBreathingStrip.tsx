import React from 'react';
import { useTheme } from '../store/themeStore';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { SmartTakeawayResult } from '../lib/weeklyInsightsUtils';
import { BreathingStripShell } from './BreathingStripShell';

export interface WeeklyBreathingStripProps {
  takeaway: SmartTakeawayResult;
  isBudgetMode: boolean;
  safeDailyPace: number;
  isCurrentWeek: boolean;
  remainingDays: number;
  transactionCount: number;
  totalWeekSavings: number;
  savedDaysCount: number;
  addedIncome?: number;
  isOverBudget?: boolean;
  weeklyDailyBurnPace?: number;
  onPressSavings?: () => void;
}

export const WeeklyBreathingStrip: React.FC<WeeklyBreathingStripProps> = ({
  takeaway,
  isBudgetMode,
  safeDailyPace,
  isCurrentWeek,
  remainingDays,
  transactionCount,
  totalWeekSavings,
  savedDaysCount,
  addedIncome = 0,
  isOverBudget = false,
  weeklyDailyBurnPace = 0,
  onPressSavings,
}) => {
  const { colors, isDark } = useTheme();

  const remainingDaysLabel = remainingDays === 1 ? '1 day' : `${remainingDays} days`;

  const leftSubtext = isBudgetMode
    ? isCurrentWeek
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
          : `₹${formatAmountWithCommas(String(weeklyDailyBurnPace))}`,
        unit: '/ day',
        subtext: leftSubtext,
        accessibilityLabel: isBudgetMode
          ? `Safe daily spending pace: ${formatCurrency(safeDailyPace)} per day with ${remainingDays} days remaining.`
          : `Average daily burn: ${formatCurrency(weeklyDailyBurnPace)} per day across ${transactionCount} transactions.`,
      }}
      rightTile={{
        label: 'AUTO-SAVED TO GULLAK',
        value:
          totalWeekSavings > 0
            ? `+${formatCurrency(totalWeekSavings)}`
            : formatCurrency(0),
        valueColor:
          totalWeekSavings > 0
            ? isDark
              ? colors.mintGreen
              : colors.forestGreen
            : colors.textPrimary,
        pillText: `🐷 ${savedDaysCount} ${savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}`,
        onPress: onPressSavings,
        accessibilityLabel: `Gullak savings this week: ${
          totalWeekSavings > 0
            ? `+${formatCurrency(totalWeekSavings)}`
            : formatCurrency(0)
        } across ${savedDaysCount} saved days. Tap to open Savings.`,
      }}
    />
  );
};
