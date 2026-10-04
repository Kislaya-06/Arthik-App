import React from 'react';
import { useTheme } from '../store/themeStore';
import { FontFamily } from '../config/theme';
import { formatCurrency, formatCompactCurrency } from '../lib/formatters';
import { SmartYearlyTakeawayResult } from '../lib/yearlyInsightsUtils';
import { BreathingStripShell } from './BreathingStripShell';

export interface YearlyBreathingStripProps {
  takeaway: SmartYearlyTakeawayResult;
  netCashFlow: number;
  isSurplus: boolean;
  totalInflow: number;
  totalOutflow: number;
  totalYearSavings: number;
  savingsRate: number | null;
  savedDaysCount: number;
  isCurrentYear: boolean;
  transactionCount: number;
  isBudgetMode: boolean;
  onPressSavings?: () => void;
}

export const YearlyBreathingStrip: React.FC<YearlyBreathingStripProps> = ({
  takeaway,
  netCashFlow,
  isSurplus,
  totalInflow,
  totalOutflow,
  totalYearSavings,
  savingsRate,
  savedDaysCount,
  transactionCount,
  isBudgetMode,
  onPressSavings,
}) => {
  const { colors, isDark } = useTheme();

  // Title for Left Tile:
  // If surplus: "NET SURPLUS"
  // If deficit: "NET DEFICIT"
  // If pure mode with 0 inflow: "NET OUTFLOW"
  const leftTileTitle =
    totalInflow === 0 && !isBudgetMode
      ? 'NET OUTFLOW'
      : isSurplus
      ? 'NET SURPLUS'
      : 'NET DEFICIT';

  const leftTileColor =
    totalInflow === 0 && !isBudgetMode
      ? colors.textPrimary
      : isSurplus
      ? isDark
        ? colors.mintGreen
        : colors.forestGreen
      : isDark
      ? '#FF7A6E'
      : '#E06D53';

  const absNet = Math.abs(netCashFlow);
  const netSign = netCashFlow > 0 ? '+' : netCashFlow < 0 ? '−' : '';

  const leftSubtext =
    totalInflow > 0
      ? `${formatCompactCurrency(totalInflow, { trimTrailingZero: true })} In · ${formatCompactCurrency(totalOutflow, { trimTrailingZero: true })} Out`
      : `Across ${transactionCount} logged ${transactionCount === 1 ? 'transaction' : 'transactions'}`;

  const rightPillText =
    savingsRate !== null && savingsRate > 0
      ? `🐷 ${savingsRate}% Saved · ${savedDaysCount}d`
      : `🐷 ${savedDaysCount} ${savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}`;

  return (
    <BreathingStripShell
      takeawayText={takeaway.text}
      takeawayStatus={takeaway.status}
      leftTile={{
        label: leftTileTitle,
        value: formatCompactCurrency(netCashFlow, {
          showPlus: true,
          trimTrailingZero: true,
        }),
        valueColor: leftTileColor,
        subtext: leftSubtext,
        subtextFontFamily: FontFamily.semibold,
        subtextStyle: { fontSize: 12.5, lineHeight: 17 },
        adjustsFontSizeToFit: true,
        minimumFontScale: 0.85,
        accessibilityLabel: `Annual Net Cash Flow: ${netSign}${formatCurrency(absNet)}. Total inflow: ${formatCurrency(totalInflow)}, total outflow: ${formatCurrency(totalOutflow)}.`,
      }}
      rightTile={{
        label: 'SAVINGS & GULLAK',
        value:
          totalYearSavings > 0
            ? `+${formatCurrency(Math.round(totalYearSavings))}`
            : formatCurrency(0),
        valueColor:
          totalYearSavings > 0
            ? isDark
              ? colors.mintGreen
              : colors.forestGreen
            : colors.textPrimary,
        pillText: rightPillText,
        onPress: onPressSavings,
        accessibilityLabel: `Annual Gullak savings: ${
          totalYearSavings > 0
            ? `+${formatCurrency(Math.round(totalYearSavings))}`
            : formatCurrency(0)
        } ${savingsRate !== null ? `with ${savingsRate}% savings rate` : ''}. Tap to open Savings.`,
      }}
    />
  );
};
