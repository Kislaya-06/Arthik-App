import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency, formatCompactCurrency } from '../lib/formatters';
import { SmartYearlyTakeawayResult } from '../lib/yearlyInsightsUtils';

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
  isCurrentYear,
  transactionCount,
  isBudgetMode,
  onPressSavings,
}) => {
  const { colors, isDark } = useTheme();

  // Vibrant status dot: coral for alerts, mint green for positive/takeaways
  const dotColor = takeaway.status === 'coral' ? '#FF7A6E' : colors.mintGreen;

  // Title for Left Tile:
  // If surplus: "NET SURPLUS"
  // If deficit: "NET DEFICIT"
  // If pure mode with 0 inflow: "NET OUTFLOW"
  const leftTileTitle = totalInflow === 0 && !isBudgetMode
    ? 'NET OUTFLOW'
    : isSurplus
    ? 'NET SURPLUS'
    : 'NET DEFICIT';

  const leftTileColor = totalInflow === 0 && !isBudgetMode
    ? colors.textPrimary
    : isSurplus
    ? (isDark ? colors.mintGreen : colors.forestGreen)
    : (isDark ? '#FF7A6E' : '#E06D53');

  const absNet = Math.abs(netCashFlow);
  const netSign = netCashFlow > 0 ? '+' : netCashFlow < 0 ? '−' : '';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      {/* ── Top Row: Smart Annual Takeaway ── */}
      <View style={styles.takeawayRow}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text
          style={[
            styles.takeawayText,
            { color: colors.textPrimary, fontFamily: FontFamily.semibold },
          ]}
          numberOfLines={2}
        >
          {takeaway.text}
        </Text>
      </View>

      {/* Subtle Divider */}
      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      {/* ── Bottom Row: Dual Spacious Tiles (Net Cash Flow & Annual Gullak Wealth) ── */}
      <View style={styles.dualTilesRow}>
        {/* Left Tile: Net Cash Flow / Surplus */}
        <View
          style={styles.tileCol}
          accessible={true}
          accessibilityLabel={`Annual Net Cash Flow: ${netSign}${formatCurrency(absNet)}. Total inflow: ${formatCurrency(totalInflow)}, total outflow: ${formatCurrency(totalOutflow)}.`}
        >
          <Text
            style={[
              styles.tileLabel,
              { color: colors.textSecondary, fontFamily: FontFamily.bold },
            ]}
          >
            {leftTileTitle}
          </Text>

          <View style={styles.valueRow}>
            <Text
              style={[
                styles.tileAmount,
                { color: leftTileColor, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
            >
              {formatCompactCurrency(netCashFlow, { showPlus: true, trimTrailingZero: true })}
            </Text>
          </View>

          <Text
            style={[
              styles.tileSubtext,
              { color: colors.textSecondary, fontFamily: FontFamily.semibold },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {totalInflow > 0
              ? `${formatCompactCurrency(totalInflow, { trimTrailingZero: true })} In · ${formatCompactCurrency(totalOutflow, { trimTrailingZero: true })} Out`
              : `Across ${transactionCount} logged ${transactionCount === 1 ? 'transaction' : 'transactions'}`}
          </Text>
        </View>

        {/* Vertical Divider */}
        <View style={[styles.verticalDivider, { backgroundColor: colors.borderSubtle }]} />

        {/* Right Tile: Gullak Annual Wealth */}
        <Pressable
          style={styles.tileColRight}
          onPress={onPressSavings}
          disabled={!onPressSavings}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Annual Gullak savings: ${
            totalYearSavings > 0 ? `+${formatCurrency(Math.round(totalYearSavings))}` : formatCurrency(0)
          } ${savingsRate !== null ? `with ${savingsRate}% savings rate` : ''}. Tap to open Savings.`}
        >
          <Text
            style={[
              styles.tileLabel,
              { color: colors.textSecondary, fontFamily: FontFamily.bold },
            ]}
          >
            ANNUAL GULLAK WEALTH
          </Text>

          <View style={styles.valueRow}>
            <Text
              style={[
                styles.tileAmount,
                {
                  color: totalYearSavings > 0 ? (isDark ? colors.mintGreen : colors.forestGreen) : colors.textPrimary,
                  fontFamily: FontFamily.bold,
                },
              ]}
              numberOfLines={1}
            >
              {totalYearSavings > 0 ? `+${formatCurrency(Math.round(totalYearSavings))}` : formatCurrency(0)}
            </Text>
          </View>

          {/* Savings rate pill badge */}
          <View
            style={[
              styles.savingsPill,
              {
                backgroundColor: isDark ? 'rgba(184, 224, 200, 0.14)' : colors.mintGreenSoft,
                borderColor: colors.mintGreen,
              },
            ]}
          >
            <Text
              style={[
                styles.savingsPillText,
                { color: isDark ? colors.mintGreen : colors.mintGreenDark, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
            >
              {savingsRate !== null && savingsRate > 0
                ? `🐷 ${savingsRate}% Saved · ${savedDaysCount}d`
                : `🐷 ${savedDaysCount} ${savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}`}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.card,
    padding: Spacing.block,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  takeawayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.element,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  takeawayText: {
    fontSize: FontSize.bodySmall,
    lineHeight: 19,
    flex: 1,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 12,
  },
  dualTilesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tileCol: {
    flex: 1,
    paddingRight: 10,
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 2,
  },
  tileColRight: {
    flex: 1,
    paddingLeft: 12,
  },
  tileLabel: {
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.nano,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tileAmount: {
    fontSize: 20,
    lineHeight: 26,
  },
  tileSubtext: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
  },
  savingsPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 0.8,
    marginTop: 5,
  },
  savingsPillText: {
    fontSize: 11,
  },
});
