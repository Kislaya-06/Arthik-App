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
  savedPillLabel?: string;
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
  savedPillLabel,
}) => {
  const { colors, isDark } = useTheme();

  const remainingDaysLabel = remainingDays === 1 ? '1 day' : `${remainingDays} days`;
  const showSafePace = isBudgetMode && isCurrentMonth;

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
      takeawayText={takeaway.isEmptyPeriod ? null : takeaway.text}
      takeawayStatus={takeaway.status}
      leftTile={{
        // A finished month has nothing left to pace: it shows what was really spent per day instead.
        label: showSafePace ? 'SAFE DAILY PACE' : 'DAILY BURN',
        value: showSafePace
          ? `₹${formatAmountWithCommas(String(safeDailyPace))}`
          : `₹${formatAmountWithCommas(String(monthlyDailyBurnPace))}`,
        unit: '/ day',
        subtext: leftSubtext,
        accessibilityLabel: showSafePace
          ? `Safe daily spending pace: ${formatCurrency(safeDailyPace)} per day with ${remainingDays} days remaining.`
          : `Average daily burn: ${formatCurrency(monthlyDailyBurnPace)} per day across ${transactionCount} transactions.${isBudgetMode ? ` ${leftSubtext}.` : ''}`,
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
        pillText:
          savedPillLabel ||
          `${savedDaysCount} ${savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}`,
        pillIcon: 'gullak',
        pillVariant: 'neutral',
        onPress: onPressSavings,
        accessibilityLabel: `Gullak savings this month: ${totalMonthSavings > 0
            ? `+${formatCurrency(totalMonthSavings)}`
            : formatCurrency(0)
          } across ${savedPillLabel || `${savedDaysCount} saved days`}. Tap to open Savings.`,
      }}
    />
  );
};
