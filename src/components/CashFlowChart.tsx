import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  useAnimatedValue,
} from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react-native';
import {
  ThemeColors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
} from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { calculatePillFillHeight, MonthlyCashFlowWeek, getCashFlowChartColors, formatCompactRupee } from '../lib/chartUtils';

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

const DEFAULT_TRACK_HEIGHT = 115;
const TRACK_WIDTH = 18;
const MIN_FILL_HEIGHT = 18;

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
  const animValue = useAnimatedValue(0);

  useEffect(() => {
    animValue.setValue(0);
    Animated.spring(animValue, {
      toValue: 1,
      tension: 55,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [triggerKey]);

  // Vibrant, executive palette matching app's theme
  const {
    inColor: inAccent,
    outColor: outAccent,
    inGradStart,
    inGradEnd,
    outGradStart,
    outGradEnd,
    trackBg,
  } = getCashFlowChartColors(isDark);

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
    ? inAccent
    : isDeficit
    ? outAccent
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
            <View style={[styles.legendDot, { backgroundColor: inAccent }]} />
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
            <View style={[styles.legendDot, { backgroundColor: outAccent }]} />
            <Text style={[styles.legendText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Out
            </Text>
          </View>
        </View>
      </View>

      {/* ── Executive Summary Section (Clean, Non-boxy) ── */}
      <View style={styles.summarySection}>
        {/* Left: Net Cash Flow Stat + Status Chip */}
        <View style={styles.summaryLeft}>
          <Text
            style={[
              styles.summaryCaption,
              { color: colors.textSecondary, fontFamily: FontFamily.semibold },
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
            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
          ]}
        />

        {/* Right: In / Out Quick Totals with Icons */}
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
                size={11}
                color={inAccent}
                strokeWidth={2.5}
              />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: inAccent, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
            >
              {`+${formatCurrency(Math.round(totalIncome))}`}
            </Text>
          </View>

          {/* Spent Row */}
          <View style={[styles.metricRow, { marginTop: 5 }]}>
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
                size={11}
                color={outAccent}
                strokeWidth={2.5}
              />
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: outAccent, fontFamily: FontFamily.bold },
              ]}
              numberOfLines={1}
            >
              {`−${formatCurrency(Math.round(totalSpent))}`}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Divider Line (like Recent Transactions & Yearly Milestones) ── */}
      <View
        style={[
          styles.dividerLine,
          { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
        ]}
      />

      {/* ── 4 Weekly Dual-Bar Columns (Seamless, Non-boxy) ── */}
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

          const animatedInTranslateY = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [DEFAULT_TRACK_HEIGHT, DEFAULT_TRACK_HEIGHT - targetInHeight],
          });

          const animatedOutTranslateY = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [DEFAULT_TRACK_HEIGHT, DEFAULT_TRACK_HEIGHT - targetOutHeight],
          });

          const weekNet = Math.round(w.income - w.spent);
          const hasActivity = w.income > 0 || w.spent > 0;

          let netDeltaText = '—';
          let netDeltaColor = isDark ? colors.textMuted : colors.textSecondary;

          if (hasActivity) {
            if (weekNet > 0) {
              netDeltaText = `+${formatCompactRupee(weekNet)}`;
              netDeltaColor = inAccent;
            } else if (weekNet < 0) {
              netDeltaText = `−${formatCompactRupee(Math.abs(weekNet))}`;
              netDeltaColor = outAccent;
            } else {
              netDeltaText = '₹0';
              netDeltaColor = colors.textSecondary;
            }
          }

          return (
            <Pressable
              key={w.day}
              style={({ pressed }) => [
                styles.weekCol,
                pressed && { opacity: 0.75 },
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
                    { backgroundColor: trackBg },
                  ]}
                >
                  {w.income > 0 ? (
                    <Animated.View
                      style={[
                        styles.fillBar,
                        {
                          transform: [{ translateY: animatedInTranslateY }],
                        },
                      ]}
                    >
                      <Svg width={TRACK_WIDTH} height={DEFAULT_TRACK_HEIGHT}>
                        <Defs>
                          <LinearGradient id={`gradIn_${w.day}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={inGradStart} />
                            <Stop offset="1" stopColor={inGradEnd} />
                          </LinearGradient>
                        </Defs>
                        <Rect
                          width={TRACK_WIDTH}
                          height={DEFAULT_TRACK_HEIGHT}
                          rx={TRACK_WIDTH / 2}
                          ry={TRACK_WIDTH / 2}
                          fill={`url(#gradIn_${w.day})`}
                        />
                      </Svg>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Money Out Bar (Right) */}
                <View
                  style={[
                    styles.track,
                    { backgroundColor: trackBg },
                  ]}
                >
                  {w.spent > 0 ? (
                    <Animated.View
                      style={[
                        styles.fillBar,
                        {
                          transform: [{ translateY: animatedOutTranslateY }],
                        },
                      ]}
                    >
                      <Svg width={TRACK_WIDTH} height={DEFAULT_TRACK_HEIGHT}>
                        <Defs>
                          <LinearGradient id={`gradOut_${w.day}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={outGradStart} />
                            <Stop offset="1" stopColor={outGradEnd} />
                          </LinearGradient>
                        </Defs>
                        <Rect
                          width={TRACK_WIDTH}
                          height={DEFAULT_TRACK_HEIGHT}
                          rx={TRACK_WIDTH / 2}
                          ry={TRACK_WIDTH / 2}
                          fill={`url(#gradOut_${w.day})`}
                        />
                      </Svg>
                    </Animated.View>
                  ) : null}
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
                    color: colors.textSecondary,
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
    paddingVertical: 5,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDivider: {
    width: 1,
    height: 10,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 12,
  },
  summarySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.micro,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryCaption: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  netAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  netAmountText: {
    fontSize: 22,
    letterSpacing: -0.2,
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
    height: 36,
    marginHorizontal: Spacing.group,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 13,
  },
  dividerLine: {
    height: 1,
    width: '100%',
    marginVertical: Spacing.block,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: Spacing.element,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
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
    height: DEFAULT_TRACK_HEIGHT,
    borderRadius: TRACK_WIDTH / 2,
    overflow: 'hidden',
  },
  podBaseline: {
    width: '75%',
    height: 1.5,
    marginTop: 8,
    marginBottom: 6,
  },
  dayLabel: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  subDateLabel: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  netDeltaLabel: {
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.2,
  },
});

