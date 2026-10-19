import React from 'react';
import { useTheme } from '../store/themeStore';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { SmartTakeawayResult, WeeklyMonthlyBudgetShare } from '../lib/weeklyInsightsUtils';
import type { BudgetCadence } from '../types';
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
  budgetCadence?: BudgetCadence;
  savedPillLabel?: string;
  monthlyBudgetShare?: WeeklyMonthlyBudgetShare | null;
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
  budgetCadence,
  savedPillLabel,
  monthlyBudgetShare,
}) => {
  const { colors, isDark } = useTheme();

  const remainingDaysLabel = remainingDays === 1 ? '1 day' : `${remainingDays} days`;

  const leftSubtext = isBudgetMode
    ? isCurrentWeek
      ? isOverBudget
        ? 'Budget exceeded\nspend cautiously'
        : addedIncome > 0
        ? `Boosted by ₹${formatAmountWithCommas(String(addedIncome))} income · ${remainingDays}d left`
        : `${remainingDaysLabel} left to pace safely`
      : isOverBudget
      ? 'Finalized · Over budget'
      : 'Finalized · Within budget'
    : `Across ${transactionCount} logged ${transactionCount === 1 ? 'transaction' : 'transactions'}`;

  const isMonthlyCadence = isBudgetMode && budgetCadence === 'monthly';

  const rightTileConfig =
    isMonthlyCadence && monthlyBudgetShare
      ? {
          label: 'MONTH BUDGET SHARE',
          value: `${monthlyBudgetShare.percentage}%`,
          valueColor:
            monthlyBudgetShare.status !== 'on_track'
              ? isDark
                ? colors.peachCoral
                : '#E05638'
              : colors.textPrimary,
          pillText: monthlyBudgetShare.pillText,
          pillVariant: monthlyBudgetShare.status === 'on_track' ? ('mint' as const) : ('neutral' as const),
          subtext: monthlyBudgetShare.subtext,
          onPress: onPressSavings,
          accessibilityLabel: `Monthly budget share: ${monthlyBudgetShare.percentage}%. ${monthlyBudgetShare.subtext}.`,
        }
      : {
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
          pillText:
            savedPillLabel ||
            `🐷 ${savedDaysCount} ${savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}`,
          pillVariant: 'neutral' as const,
          onPress: onPressSavings,
          accessibilityLabel: `Gullak savings this week: ${
            totalWeekSavings > 0
              ? `+${formatCurrency(totalWeekSavings)}`
              : formatCurrency(0)
          } across ${savedPillLabel || `${savedDaysCount} saved days`}. Tap to open Savings.`,
        };

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
      rightTile={rightTileConfig}
    />
  );
};
