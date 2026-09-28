import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import {
  ThemeColors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
} from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { calculatePillFillHeight, MonthlyCashFlowWeek } from '../lib/chartUtils';

export interface CashFlowChartProps {
  title?: string;
  subTitle?: string;
  data: MonthlyCashFlowWeek[];
  maxAmount: number;
  totalIncome: number;
  totalSpent: number;
  isDark: boolean;
  colors: ThemeColors;
  onWeekPress?: (week: MonthlyCashFlowWeek) => void;
  triggerKey?: string | number;
}

const DEFAULT_TRACK_HEIGHT = 120;
const TRACK_WIDTH = 18;
const MIN_FILL_HEIGHT = 20;

/**
 * Compact Rupee formatter for tight weekly pod badges (e.g. ₹1.5k, ₹25k, ₹1.2L).
 */
function formatCompactRupee(val: number): string {
  if (val >= 100000) {
    const formatted = (val / 100000).toFixed(1).replace(/\.0$/, '');
    return `₹${formatted}L`;
  }
  if (val >= 1000) {
    const formatted = (val / 1000).toFixed(1).replace(/\.0$/, '');
    return `₹${formatted}k`;
  }
  return `₹${Math.round(val)}`;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({
  title = 'Cash Flow',
  subTitle,
  data,
  maxAmount,
  totalIncome,
  totalSpent,
  isDark,
  colors,
  onWeekPress,
  triggerKey,
}) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [triggerKey]);

  const inFillColor = isDark ? colors.mintGreen : colors.mintGreenDark;
  const outFillColor = isDark ? '#F4B8AE' : '#E8956A';
  const activeTrackBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';

  // Executive net flow calculation (rounded to whole rupees for clean dashboard display)
  const roundedNet = Math.round(totalIncome - totalSpent);
  const isSurplus = roundedNet > 0;
  const isDeficit = roundedNet < 0;

  const netFlowFormatted = isSurplus
    ? `+${formatCurrency(roundedNet)}`
    : isDeficit
    ? `−${formatCurrency(Math.abs(roundedNet))}`
    : '₹0';

  const netStatusColor = isSurplus
    ? (isDark ? colors.mintGreen : colors.mintGreenDark)
    : isDeficit
    ? (isDark ? colors.peachCoral : '#E8956A')
    : colors.textSecondary;

  const netStatusBg = isSurplus
    ? (isDark ? 'rgba(184, 224, 200, 0.14)' : '#E8F5EE')
    : isDeficit
    ? (isDark ? 'rgba(244, 184, 174, 0.14)' : '#FDEEEC')
    : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)');

  const statusLabel = isSurplus ? 'Surplus' : isDeficit ? 'Deficit' : 'Balanced';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.borderSubtle : colors.border,
        },
      ]}
    >
      {/* ── Card Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            {title}
          </Text>
          {subTitle ? (
            <Text style={[styles.subTitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              {subTitle}
            </Text>
          ) : null}
        </View>

        {/* Legend Capsule with bold, legible typography */}
        <View
          style={[
            styles.legendCapsule,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: inFillColor }]} />
            <Text style={[styles.legendText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              In
            </Text>
          </View>
          <View
            style={[
              styles.legendDivider,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' },
            ]}
          />
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: outFillColor }]} />
            <Text style={[styles.legendText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Out
            </Text>
          </View>
        </View>
      </View>

      {/* ── Executive Summary Banner ── */}
      <View
        style={[
          styles.summaryBanner,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : colors.cardSubtle,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.borderSubtle,
          },
        ]}
      >
        {/* Left: Net Cash Flow Stat + Status Chip */}
        <View style={styles.summaryLeft}>
          <Text
            style={[
              styles.summaryCaption,
              { color: colors.textSecondary, fontFamily: FontFamily.bold },
            ]}
          >
            NET CASH FLOW
          </Text>
          <View style={styles.netAmountRow}>
            <Text
              style={[
                styles.netAmountText,
                { color: netStatusColor, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
            >
              {netFlowFormatted}
            </Text>
            <View style={[styles.statusChip, { backgroundColor: netStatusBg }]}>
              <Text
                style={[
                  styles.statusChipText,
                  { color: netStatusColor, fontFamily: FontFamily.bold },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Subtle Vertical Divider */}
        <View
          style={[
            styles.summaryDivider,
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)' },
          ]}
        />

        {/* Right: In / Out Quick Totals with Circular Icon Badges */}
        <View style={styles.summaryRight}>
          {/* Income Row */}
          <View style={styles.metricRow}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isDark
                    ? 'rgba(184, 224, 200, 0.16)'
                    : '#E8F5EE',
                },
              ]}
            >
              <ArrowUpRight
                size={12}
                color={inFillColor}
                strokeWidth={2.5}
              />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: inFillColor, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
            >
              {`+${formatCurrency(Math.round(totalIncome))}`}
            </Text>
          </View>

          {/* Spent Row */}
          <View style={[styles.metricRow, { marginTop: 6 }]}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isDark
                    ? 'rgba(244, 184, 174, 0.16)'
                    : '#FDEEEC',
                },
              ]}
            >
              <ArrowDownRight
                size={12}
                color={outFillColor}
                strokeWidth={2.5}
              />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: outFillColor, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
            >
              {`−${formatCurrency(Math.round(totalSpent))}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 4 Weekly Dual-Bar Pod Columns ── */}
      <View style={styles.chartContainer}>
        {data.map((w) => {
          const targetInHeight = calculatePillFillHeight(
            w.income,
            maxAmount,
            DEFAULT_TRACK_HEIGHT,
            MIN_FILL_HEIGHT
          );
          const targetOutHeight = calculatePillFillHeight(
            w.spent,
            maxAmount,
            DEFAULT_TRACK_HEIGHT,
            MIN_FILL_HEIGHT
          );

          const animatedInHeight = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, targetInHeight],
          });

          const animatedOutHeight = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, targetOutHeight],
          });

          const weekNet = Math.round(w.income - w.spent);
          const hasActivity = w.income > 0 || w.spent > 0;

          let netDeltaText = '—';
          let netDeltaColor = isDark ? colors.textMuted : colors.textSecondary;

          if (hasActivity) {
            if (weekNet > 0) {
              netDeltaText = `+${formatCompactRupee(weekNet)}`;
              netDeltaColor = isDark ? colors.mintGreen : colors.mintGreenDark;
            } else if (weekNet < 0) {
              netDeltaText = `−${formatCompactRupee(Math.abs(weekNet))}`;
              netDeltaColor = isDark ? colors.peachCoral : '#E8956A';
            } else {
              netDeltaText = '₹0';
              netDeltaColor = colors.textSecondary;
            }
          }

          return (
            <Pressable
              key={w.day}
              style={({ pressed }) => [
                styles.weekPod,
                {
                  backgroundColor: pressed
                    ? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')
                    : (isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.015)'),
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                },
              ]}
              onPress={() => onWeekPress?.(w)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`${w.day} (${w.subLabel}): In ${formatCurrency(w.income)}, Out ${formatCurrency(w.spent)}`}
            >
              {/* Dual Capsule Bars Container */}
              <View style={styles.barsContainer}>
                {/* Money In Bar (Left) */}
                <View
                  style={[
                    styles.track,
                    { backgroundColor: w.income > 0 ? activeTrackBg : 'transparent' },
                  ]}
                >
                  {w.income > 0 ? (
                    <Animated.View
                      style={[
                        styles.fillBar,
                        {
                          height: animatedInHeight,
                          backgroundColor: inFillColor,
                        },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.zeroTick,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Money Out Bar (Right) */}
                <View
                  style={[
                    styles.track,
                    { backgroundColor: w.spent > 0 ? activeTrackBg : 'transparent' },
                  ]}
                >
                  {w.spent > 0 ? (
                    <Animated.View
                      style={[
                        styles.fillBar,
                        {
                          height: animatedOutHeight,
                          backgroundColor: outFillColor,
                        },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.zeroTick,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    />
                  )}
                </View>
              </View>

              {/* Grounding Baseline */}
              <View
                style={[
                  styles.podBaseline,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              />

              {/* Week Tag (W1, W2, W3, W4) */}
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: hasActivity ? colors.textPrimary : colors.textMuted,
                    fontFamily: FontFamily.bold,
                  },
                ]}
              >
                {w.day}
              </Text>

              {/* Date Range Sub-label (1–7, 8–14, 15–21, 22–30) */}
              <Text
                style={[
                  styles.subDateLabel,
                  {
                    color: isDark ? colors.textSecondary : colors.textSecondary,
                    fontFamily: FontFamily.medium,
                  },
                ]}
                numberOfLines={1}
              >
                {w.subLabel}
              </Text>

              {/* Week Net Delta Indicator */}
              <Text
                style={[
                  styles.netDeltaLabel,
                  {
                    color: netDeltaColor,
                    fontFamily: FontFamily.bold,
                  },
                ]}
                numberOfLines={1}
              >
                {netDeltaText}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.cardLarge,
    padding: Spacing.surface,
    borderWidth: 1,
    marginTop: Spacing.section,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.group,
  },
  titleContainer: {
    flex: 1,
    marginRight: Spacing.element,
  },
  title: {
    fontSize: 18,
  },
  subTitle: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.nano,
  },
  legendCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDivider: {
    width: 1,
    height: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.row,
    paddingVertical: 12,
    marginBottom: Spacing.gutter,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryCaption: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  netAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  netAmountText: {
    fontSize: 20,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
  },
  statusChipText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    marginHorizontal: Spacing.element,
  },
  summaryRight: {
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 13,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: Spacing.element,
  },
  weekPod: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    height: DEFAULT_TRACK_HEIGHT,
  },
  track: {
    width: TRACK_WIDTH,
    height: DEFAULT_TRACK_HEIGHT,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fillBar: {
    width: TRACK_WIDTH,
    borderRadius: BorderRadius.pill,
  },
  zeroTick: {
    width: 12,
    height: 3,
    borderRadius: 1.5,
    marginBottom: 2,
  },
  podBaseline: {
    width: '80%',
    height: 1.5,
    marginTop: 8,
    marginBottom: 6,
  },
  dayLabel: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  subDateLabel: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  netDeltaLabel: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.2,
  },
});

