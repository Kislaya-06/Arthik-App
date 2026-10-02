import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { SmartTakeawayResult } from '../lib/weeklyInsightsUtils';

export interface WeeklyBreathingStripProps {
  takeaway: SmartTakeawayResult;
  isBudgetMode: boolean;
  weekSpent: number;
  weekBudget: number;
  remainingBudget: number;
  overAmount: number;
  isOverBudget: boolean;
  budgetRatio: number;
  safeDailyPace: number;
  isCurrentWeek: boolean;
  transactionCount: number;
  totalWeekSavings: number;
  savedDaysCount: number;
  onPressBudget?: () => void;
  onPressSavings?: () => void;
}

export const WeeklyBreathingStrip: React.FC<WeeklyBreathingStripProps> = ({
  takeaway,
  isBudgetMode,
  weekSpent,
  weekBudget,
  remainingBudget,
  overAmount,
  isOverBudget,
  budgetRatio,
  safeDailyPace,
  isCurrentWeek,
  transactionCount,
  totalWeekSavings,
  savedDaysCount,
  onPressBudget,
  onPressSavings,
}) => {
  const { colors, isDark } = useTheme();

  const progressPercent = Math.min(100, Math.round(budgetRatio * 100));
  const progressFillColor = isOverBudget ? '#FF7A6E' : colors.mintGreen;

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
      {/* ── Top Row: Smart Weekly Takeaway ── */}
      <View style={styles.takeawayRow}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                takeaway.status === 'coral'
                  ? '#FF7A6E'
                  : takeaway.status === 'mint'
                  ? colors.mintGreen
                  : colors.textMuted,
            },
          ]}
        />
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
        {/* Left Column: Budget Health OR Pure Mode Outflow */}
        <Pressable
          style={styles.gaugeCol}
          onPress={onPressBudget}
          disabled={!onPressBudget}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={
            isBudgetMode
              ? `Weekly budget: ${formatCurrency(weekSpent)} of ${formatCurrency(weekBudget)} spent. ${
                  isOverBudget ? `${formatCurrency(overAmount)} over budget` : `${formatCurrency(remainingBudget)} remaining`
                }. Tap to edit budget.`
              : `Week transactions: ${transactionCount} logged, total ${formatCurrency(weekSpent)}.`
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
                WEEKLY BUDGET
              </Text>
              <Text
                style={[
                  styles.colAmount,
                  { color: colors.textPrimary, fontFamily: FontFamily.bold },
                ]}
                numberOfLines={1}
              >
                {formatCurrency(weekSpent)}{' '}
                <Text
                  style={[
                    styles.colCap,
                    { color: colors.textSecondary, fontFamily: FontFamily.medium },
                  ]}
                >
                  / {formatCurrency(weekBudget)}
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

              {/* Subtitle: margin or pace */}
              <Text
                style={[
                  styles.colSubtext,
                  {
                    color: isOverBudget ? '#FF7A6E' : isDark ? colors.mintGreen : colors.mintGreenDark,
                    fontFamily: FontFamily.semibold,
                  },
                ]}
                numberOfLines={1}
              >
                {isOverBudget
                  ? `₹${formatAmountWithCommas(String(overAmount))} over weekly budget`
                  : isCurrentWeek && safeDailyPace > 0
                  ? `₹${formatAmountWithCommas(String(remainingBudget))} margin · ₹${formatAmountWithCommas(String(safeDailyPace))}/day pace`
                  : `₹${formatAmountWithCommas(String(remainingBudget))} safe margin`}
              </Text>
            </>
          ) : (
            /* Pure Mode Adaptation (No dummy budget) */
            <>
              <Text
                style={[
                  styles.colLabel,
                  { color: colors.textSecondary, fontFamily: FontFamily.bold },
                ]}
              >
                WEEK'S TRANSACTIONS
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
                  styles.colSubtext,
                  { color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: 4 },
                ]}
                numberOfLines={1}
              >
                {formatCurrency(weekSpent)} total outflow
              </Text>
            </>
          )}
        </Pressable>

        {/* Vertical divider */}
        <View style={[styles.verticalDivider, { backgroundColor: colors.borderSubtle }]} />

        {/* Right Column: Gullak Savings */}
        <Pressable
          style={styles.gaugeColRight}
          onPress={onPressSavings}
          disabled={!onPressSavings}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Gullak savings this week: ${
            totalWeekSavings > 0 ? `+${formatCurrency(totalWeekSavings)}` : formatCurrency(0)
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
                color: totalWeekSavings > 0 ? (isDark ? colors.mintGreen : colors.forestGreen) : colors.textPrimary,
                fontFamily: FontFamily.bold,
              },
            ]}
            numberOfLines={1}
          >
            {totalWeekSavings > 0 ? `+${formatCurrency(totalWeekSavings)}` : formatCurrency(0)}
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
    marginBottom: Spacing.surface, // 20
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
    fontSize: 13.5,
    lineHeight: 18,
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
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  colSubtext: {
    fontSize: 11,
    marginTop: 2,
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
