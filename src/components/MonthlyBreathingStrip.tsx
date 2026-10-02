import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { GradientIconBadge } from './GradientIconBadge';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';

export interface MonthlyBreathingStripProps {
  isBudgetMode: boolean;
  monthSpent: number;
  monthBudget: number;
  remainingBudget: number;
  overAmount: number;
  isOverBudget: boolean;
  safeDailyPace: number;
  isCurrentMonth: boolean;
  remainingDays: number;
  totalMonthSavings: number;
  savedDaysCount: number;
  netCashFlow?: number;
  onPressSavings?: () => void;
}

export const MonthlyBreathingStrip: React.FC<MonthlyBreathingStripProps> = ({
  isBudgetMode,
  monthSpent,
  monthBudget,
  remainingBudget,
  overAmount,
  isOverBudget,
  safeDailyPace,
  isCurrentMonth,
  remainingDays,
  totalMonthSavings,
  savedDaysCount,
  netCashFlow = 0,
  onPressSavings,
}) => {
  const { colors, isDark } = useTheme();

  const isSurplus = netCashFlow >= 0;
  const statusColor = isOverBudget
    ? (isDark ? '#F59682' : '#D9533B')
    : (isDark ? '#7CD49A' : '#3DA862');

  const statusBg = isOverBudget
    ? (isDark ? 'rgba(244, 184, 174, 0.14)' : '#FDEEEC')
    : (isDark ? 'rgba(184, 224, 200, 0.14)' : '#E8F5EE');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.borderSubtle : colors.border,
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <View style={styles.metricsRow}>
        {/* Left Column: Monthly Budget Health OR Pure Mode Net Cash Flow */}
        <View
          style={styles.metricCol}
          accessible={true}
          accessibilityLabel={
            isBudgetMode
              ? `Monthly budget: ${formatCurrency(monthSpent)} of ${formatCurrency(monthBudget)} spent. ${
                  isOverBudget
                    ? `${formatCurrency(overAmount)} over budget`
                    : `${formatCurrency(remainingBudget)} remaining`
                }. Safe pace: ${safeDailyPace} rupees per day.`
              : `Net cash flow: ${isSurplus ? 'Surplus' : 'Deficit'} of ${formatCurrency(Math.abs(netCashFlow))}.`
          }
        >
          <Text style={[styles.colLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
            {isBudgetMode ? 'MONTHLY BUDGET' : 'NET CASH FLOW'}
          </Text>

          {isBudgetMode ? (
            <>
              <Text
                style={[styles.colAmount, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
                numberOfLines={1}
              >
                {formatCurrency(monthSpent)}{' '}
                <Text style={[styles.colCap, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  / {formatCurrency(monthBudget)}
                </Text>
              </Text>

              <View style={styles.statusRow}>
                <View style={[styles.statusChip, { backgroundColor: statusBg }]}>
                  <Text style={[styles.statusChipText, { color: statusColor, fontFamily: FontFamily.bold }]}>
                    {isOverBudget
                      ? `Over by ₹${formatAmountWithCommas(String(overAmount))}`
                      : `₹${formatAmountWithCommas(String(remainingBudget))} left`}
                  </Text>
                </View>
              </View>

              <Text
                style={[styles.subtextMuted, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}
                numberOfLines={1}
              >
                {isCurrentMonth
                  ? isOverBudget
                    ? 'Exceeded · ₹0/day pace'
                    : `₹${formatAmountWithCommas(String(safeDailyPace))}/day safe pace · ${remainingDays}d left`
                  : isOverBudget
                  ? 'Exceeded · Finalized'
                  : 'Under Budget · Finalized'}
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.colAmount,
                  { color: isSurplus ? (isDark ? '#7CD49A' : '#3DA862') : (isDark ? '#F59682' : '#D9533B'), fontFamily: FontFamily.bold },
                ]}
                numberOfLines={1}
              >
                {isSurplus ? `+${formatCurrency(netCashFlow)}` : `−${formatCurrency(Math.abs(netCashFlow))}`}
              </Text>

              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: isSurplus
                        ? (isDark ? 'rgba(184, 224, 200, 0.14)' : '#E8F5EE')
                        : (isDark ? 'rgba(244, 184, 174, 0.14)' : '#FDEEEC'),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: isSurplus ? (isDark ? '#7CD49A' : '#3DA862') : (isDark ? '#F59682' : '#D9533B'), fontFamily: FontFamily.bold },
                    ]}
                  >
                    {isSurplus ? 'Surplus' : 'Deficit'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.subtextMuted, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                Pure Tracking Mode · No budget
              </Text>
            </>
          )}
        </View>

        {/* Vertical Hairline Divider */}
        <View
          style={[
            styles.verticalDivider,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
          ]}
        />

        {/* Right Column: Real Money Gullak Savings (Tappable) */}
        <Pressable
          style={({ pressed }) => [
            styles.metricColRight,
            pressed && { opacity: 0.75 },
          ]}
          onPress={onPressSavings}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Gullak savings this month: +${formatCurrency(totalMonthSavings)}. Tap to view Savings.`}
          hitSlop={8}
        >
          <View style={styles.gullakHeaderRow}>
            <GradientIconBadge size={36} color="#ADEBB3" isDark={isDark}>
              {({ iconColor }) => <PiggyBankCoinIcon size={18} color={iconColor} />}
            </GradientIconBadge>
            <View style={{ flex: 1, marginLeft: Spacing.element }}>
              <Text style={[styles.colLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
                GULLAK SAVINGS
              </Text>
              <Text
                style={[
                  styles.savingsAmount,
                  { color: isDark ? colors.mintGreen : '#2E8C4A', fontFamily: FontFamily.bold },
                ]}
                numberOfLines={1}
              >
                +{formatCurrency(totalMonthSavings)}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.subtextMuted, { color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: Spacing.micro }]}
            numberOfLines={1}
          >
            {savedDaysCount > 0
              ? `${savedDaysCount} ${savedDaysCount === 1 ? 'day' : 'days'} saved this month`
              : 'Real money preserved'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.card,
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.block,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1.1,
    paddingRight: Spacing.group,
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
  },
  metricColRight: {
    flex: 1,
    paddingLeft: Spacing.group,
    justifyContent: 'center',
  },
  colLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  colAmount: {
    fontSize: 19,
    lineHeight: 24,
    marginTop: 2,
  },
  colCap: {
    fontSize: FontSize.bodySmall,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.micro,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
  },
  statusChipText: {
    fontSize: 11,
  },
  subtextMuted: {
    fontSize: FontSize.caption,
    marginTop: Spacing.micro,
  },
  gullakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsAmount: {
    fontSize: 19,
    lineHeight: 24,
    marginTop: 2,
  },
});
