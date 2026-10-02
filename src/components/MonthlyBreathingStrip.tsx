import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { SmartMonthlyTakeawayResult } from '../lib/monthlyInsightsUtils';

export interface MonthlyBreathingStripProps {
  takeaway: SmartMonthlyTakeawayResult;
  isBudgetMode: boolean;
  monthSpent: number;
  monthBudget: number;
  remainingBudget: number;
  overAmount: number;
  isOverBudget: boolean;
  budgetRatio: number;
  safeDailyPace: number;
  isCurrentMonth: boolean;
  remainingDays: number;
  transactionCount: number;
  totalMonthSavings: number;
  savedDaysCount: number;
  netCashFlow?: number;
  onPressSavings?: () => void;
}

export const MonthlyBreathingStrip: React.FC<MonthlyBreathingStripProps> = ({
  takeaway,
  isBudgetMode,
  monthSpent,
  monthBudget,
  remainingBudget,
  overAmount,
  isOverBudget,
  budgetRatio,
  safeDailyPace,
  isCurrentMonth,
  remainingDays,
  transactionCount,
  totalMonthSavings,
  savedDaysCount,
  netCashFlow = 0,
  onPressSavings,
}) => {
  const { colors, isDark } = useTheme();

  const progressPercent = Math.min(100, Math.round(budgetRatio * 100));
  const progressFillColor = isOverBudget ? '#FF7A6E' : colors.mintGreen;

  // Vibrant status dot: coral for over-budget alerts, mint green for takeaways/insights
  const dotColor = takeaway.status === 'coral' ? '#FF7A6E' : colors.mintGreen;

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

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      {/* ── Bottom Row: Dual Gauge (Budget Health vs Gullak Impact) ── */}
      <View style={styles.dualGaugeRow}>
        {/* Left Column: Monthly Budget Health OR Pure Mode Outflow */}
        <View
          style={styles.gaugeCol}
          accessible={true}
          accessibilityLabel={
            isBudgetMode
              ? `Monthly budget: ${formatCurrency(monthSpent)} of ${formatCurrency(monthBudget)} spent. ${
                  isOverBudget
                    ? `${formatCurrency(overAmount)} over budget`
                    : `${formatCurrency(remainingBudget)} remaining`
                }.`
              : `Month transactions: ${transactionCount} logged, total ${formatCurrency(monthSpent)}.`
          }
        >
          {isBudgetMode ? (
            <>
              <Text
                style={[
                  styles.colLabel,
                  { color: colors.textSecondary, fontFamily: FontFamily.bold },
                ]}
              >
                MONTHLY BUDGET
              </Text>
              <Text
                style={[
                  styles.colAmount,
                  { color: colors.textPrimary, fontFamily: FontFamily.bold },
                ]}
                numberOfLines={1}
              >
                {formatCurrency(monthSpent)}{' '}
                <Text
                  style={[
                    styles.colCap,
                    { color: colors.textSecondary, fontFamily: FontFamily.medium },
                  ]}
                >
                  / {formatCurrency(monthBudget)}
                </Text>
              </Text>

              {/* Progress track */}
              <View
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.chartTrack,
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: progressFillColor,
                    },
                  ]}
                />
              </View>

              {/* Clean 2-line Subtitle to prevent any truncation */}
              <View style={styles.subtextContainer}>
                <Text
                  style={[
                    styles.colSubtextBold,
                    {
                      color: isOverBudget ? '#FF7A6E' : isDark ? colors.mintGreen : colors.mintGreenDark,
                      fontFamily: FontFamily.bold,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {isOverBudget
                    ? `₹${formatAmountWithCommas(String(overAmount))} over budget`
                    : `₹${formatAmountWithCommas(String(remainingBudget))} left`}
                </Text>

                {isCurrentMonth && safeDailyPace > 0 && !isOverBudget ? (
                  <Text
                    style={[
                      styles.colSubtextMuted,
                      {
                        color: colors.textSecondary,
                        fontFamily: FontFamily.medium,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    ₹{formatAmountWithCommas(String(safeDailyPace))}/day pace · {remainingDays}d left
                  </Text>
                ) : !isCurrentMonth ? (
                  <Text
                    style={[
                      styles.colSubtextMuted,
                      {
                        color: colors.textSecondary,
                        fontFamily: FontFamily.medium,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {isOverBudget ? 'Finalized · Over budget' : 'Finalized · Within budget'}
                  </Text>
                ) : null}
              </View>
            </>
          ) : (
            /* Pure Mode Adaptation */
            <>
              <Text
                style={[
                  styles.colLabel,
                  { color: colors.textSecondary, fontFamily: FontFamily.bold },
                ]}
              >
                MONTH'S TRANSACTIONS
              </Text>
              <Text
                style={[
                  styles.colAmount,
                  { color: colors.textPrimary, fontFamily: FontFamily.bold },
                ]}
                numberOfLines={1}
              >
                {transactionCount} logged
              </Text>
              <Text
                style={[
                  styles.colSubtextMuted,
                  { color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: 4 },
                ]}
                numberOfLines={1}
              >
                {formatCurrency(monthSpent)} total outflow
              </Text>
            </>
          )}
        </View>

        {/* Vertical divider */}
        <View style={[styles.verticalDivider, { backgroundColor: colors.borderSubtle }]} />

        {/* Right Column: Gullak Savings */}
        <Pressable
          style={styles.gaugeColRight}
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
              styles.colLabel,
              { color: colors.textSecondary, fontFamily: FontFamily.bold },
            ]}
          >
            AUTO-SAVED TO GULLAK
          </Text>
          <Text
            style={[
              styles.colAmount,
              {
                color: totalMonthSavings > 0 ? (isDark ? colors.mintGreen : colors.forestGreen) : colors.textPrimary,
                fontFamily: FontFamily.bold,
              },
            ]}
            numberOfLines={1}
          >
            {totalMonthSavings > 0 ? `+${formatCurrency(totalMonthSavings)}` : formatCurrency(0)}
          </Text>

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
    alignItems: 'center',
    gap: Spacing.element,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  dualGaugeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gaugeCol: {
    flex: 1,
    paddingRight: 10,
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 2,
  },
  gaugeColRight: {
    flex: 1,
    paddingLeft: 12,
  },
  colLabel: {
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.nano,
  },
  colAmount: {
    fontSize: FontSize.body, // 16
    lineHeight: 22,
  },
  colCap: {
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  subtextContainer: {
    marginTop: 2,
    gap: 1,
  },
  colSubtextBold: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  colSubtextMuted: {
    fontSize: 11,
    lineHeight: 15,
  },
  savingsPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 0.8,
    marginTop: 6,
  },
  savingsPillText: {
    fontSize: 11,
  },
});
