import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { SmartMonthlyTakeawayResult } from '../lib/monthlyInsightsUtils';

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

  // Vibrant status dot: coral for alerts, mint green for positive/takeaways
  const dotColor = takeaway.status === 'coral' ? '#FF7A6E' : colors.mintGreen;
  const remainingDaysLabel = remainingDays === 1 ? '1 day' : `${remainingDays} days`;

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
      {/* ── Top Row: Smart Monthly Takeaway ── */}
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

      {/* ── Bottom Row: Dual Spacious Tiles (Daily Spending Power & Gullak Savings) ── */}
      <View style={styles.dualTilesRow}>
        {/* Left Tile: Safe Daily Spending Power */}
        <View
          style={styles.tileCol}
          accessible={true}
          accessibilityLabel={
            isBudgetMode
              ? `Safe daily spending pace: ${formatCurrency(safeDailyPace)} per day with ${remainingDays} days remaining.`
              : `Average daily burn: ${formatCurrency(monthlyDailyBurnPace)} per day across ${transactionCount} transactions.`
          }
        >
          <Text
            style={[
              styles.tileLabel,
              { color: colors.textSecondary, fontFamily: FontFamily.bold },
            ]}
          >
            {isBudgetMode ? 'SAFE DAILY PACE' : 'DAILY BURN'}
          </Text>

          <View style={styles.valueRow}>
            <Text
              style={[
                styles.tileAmount,
                { color: colors.textPrimary, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {isBudgetMode
                ? `₹${formatAmountWithCommas(String(safeDailyPace))}`
                : `₹${formatAmountWithCommas(String(monthlyDailyBurnPace))}`}
            </Text>
            <Text
              style={[
                styles.tileUnit,
                { color: colors.textSecondary, fontFamily: FontFamily.medium },
              ]}
            >
              / day
            </Text>
          </View>

          <Text
            style={[
              styles.tileSubtext,
              { color: colors.textSecondary, fontFamily: FontFamily.medium },
            ]}
            numberOfLines={1}
          >
            {isBudgetMode ? (
              isCurrentMonth ? (
                isOverBudget ? (
                  'Budget exceeded · spend cautiously'
                ) : addedIncome > 0 ? (
                  `Boosted by ₹${formatAmountWithCommas(String(addedIncome))} income · ${remainingDays}d left`
                ) : (
                  `${remainingDaysLabel} left to pace safely`
                )
              ) : (
                isOverBudget ? 'Finalized · Over budget' : 'Finalized · Within budget'
              )
            ) : (
              `Across ${transactionCount} logged ${transactionCount === 1 ? 'transaction' : 'transactions'}`
            )}
          </Text>
        </View>

        {/* Vertical Divider */}
        <View style={[styles.verticalDivider, { backgroundColor: colors.borderSubtle }]} />

        {/* Right Tile: Gullak Savings (Locked Savings) */}
        <Pressable
          style={styles.tileColRight}
          onPress={onPressSavings}
          disabled={!onPressSavings}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Gullak savings this month: ${
            totalMonthSavings > 0 ? `+${formatCurrency(totalMonthSavings)}` : formatCurrency(0)
          } across ${savedDaysCount} saved days. Tap to open Savings.`}
        >
          <Text
            style={[
              styles.tileLabel,
              { color: colors.textSecondary, fontFamily: FontFamily.bold },
            ]}
          >
            AUTO-SAVED TO GULLAK
          </Text>

          <View style={styles.valueRow}>
            <Text
              style={[
                styles.tileAmount,
                {
                  color: totalMonthSavings > 0 ? (isDark ? colors.mintGreen : colors.forestGreen) : colors.textPrimary,
                  fontFamily: FontFamily.bold,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {totalMonthSavings > 0 ? `+${formatCurrency(totalMonthSavings)}` : formatCurrency(0)}
            </Text>
          </View>

          {/* Saved days pill badge */}
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
              🐷 {savedDaysCount} {savedDaysCount === 1 ? 'Saved Day' : 'Saved Days'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.card, // 20
    padding: Spacing.block, // 16
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
    fontSize: FontSize.bodySmall, // 14
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
    flexShrink: 1,
  },
  tileUnit: {
    fontSize: 12.5,
  },
  tileSubtext: {
    fontSize: 11,
    lineHeight: 15,
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
