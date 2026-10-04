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
import {
  ThemeColors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
} from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { YearlyCashFlowMonth } from '../lib/yearlyInsightsUtils';

export interface YearlyCashFlowChartProps {
  title?: string;
  subTitle?: string;
  months: YearlyCashFlowMonth[];
  maxAmount: number;
  totalIncome?: number;
  totalSpent?: number;
  isDark: boolean;
  colors: ThemeColors;
  onMonthPress?: (month: YearlyCashFlowMonth) => void;
  triggerKey?: string | number;
}

const CHART_HEIGHT = 100;
const BAR_WIDTH = 6;
const BAR_GAP = 2;
const BAR_RADIUS = 3;

export const YearlyCashFlowChart: React.FC<YearlyCashFlowChartProps> = ({
  title = 'Cash Flow',
  subTitle,
  months,
  maxAmount,
  isDark,
  colors,
  onMonthPress,
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

  // Premium, harmonious palette matching Arthik design system
  const inColor = isDark ? '#7CD49A' : '#3DA862';
  const outColor = isDark ? '#F59682' : '#D9533B';

  const inGradStart = isDark ? '#ADEBB3' : '#7CD49A';
  const inGradEnd = isDark ? '#3DA862' : '#2E8C4A';

  const outGradStart = isDark ? '#FBCAC1' : '#F59682';
  const outGradEnd = isDark ? '#D9533B' : '#C1412A';

  const trackBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';

  // Safe ceiling for bar scaling
  const effectiveMax = Math.max(maxAmount, 100);

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

        {/* Legend Capsule */}
        <View
          style={[
            styles.legendCapsule,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: inColor }]} />
            <Text style={[styles.legendText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              In
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: outColor }]} />
            <Text style={[styles.legendText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Out
            </Text>
          </View>
        </View>
      </View>

      {/* ── 12-Month Dual Bars Grid ── */}
      <View style={styles.chartContainer}>
        <View style={styles.monthsRow}>
          {months.map((m) => {
            const inRatio = Math.min(1, Math.max(0, m.income / effectiveMax));
            const outRatio = Math.min(1, Math.max(0, m.spent / effectiveMax));

            // Bar fill heights
            const inHeight = m.income > 0 ? Math.max(4, Math.round(inRatio * (CHART_HEIGHT - 6))) : 0;
            const outHeight = m.spent > 0 ? Math.max(4, Math.round(outRatio * (CHART_HEIGHT - 6))) : 0;

            const isFuture = m.isFuture;
            const isCurrent = m.isCurrentMonth;
            const colOpacity = isFuture ? 0.28 : 1;

            return (
              <Pressable
                key={m.label}
                style={[styles.monthCol, { opacity: colOpacity }]}
                disabled={isFuture || (!onMonthPress && true)}
                onPress={() => onMonthPress && onMonthPress(m)}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}: Inflow ${formatCurrency(m.income)}, Outflow ${formatCurrency(m.spent)}.${
                  isCurrent ? ' Current month in progress.' : ''
                }${isFuture ? ' Future upcoming month.' : ''}`}
              >
                {/* Visual Dual Bars */}
                <View style={[styles.barPodTrack, { backgroundColor: trackBg }]}>
                  {/* Inflow Bar */}
                  <View style={styles.barSlot}>
                    {inHeight > 0 ? (
                      <Svg width={BAR_WIDTH} height={inHeight}>
                        <Defs>
                          <LinearGradient id={`gradIn_${m.monthIndex}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={inGradStart} stopOpacity="1" />
                            <Stop offset="1" stopColor={inGradEnd} stopOpacity="1" />
                          </LinearGradient>
                        </Defs>
                        <Rect
                          x="0"
                          y="0"
                          width={BAR_WIDTH}
                          height={inHeight}
                          rx={BAR_RADIUS}
                          ry={BAR_RADIUS}
                          fill={`url(#gradIn_${m.monthIndex})`}
                        />
                      </Svg>
                    ) : null}
                  </View>

                  <View style={{ width: BAR_GAP }} />

                  {/* Outflow Bar */}
                  <View style={styles.barSlot}>
                    {outHeight > 0 ? (
                      <Svg width={BAR_WIDTH} height={outHeight}>
                        <Defs>
                          <LinearGradient id={`gradOut_${m.monthIndex}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={outGradStart} stopOpacity="1" />
                            <Stop offset="1" stopColor={outGradEnd} stopOpacity="1" />
                          </LinearGradient>
                        </Defs>
                        <Rect
                          x="0"
                          y="0"
                          width={BAR_WIDTH}
                          height={outHeight}
                          rx={BAR_RADIUS}
                          ry={BAR_RADIUS}
                          fill={`url(#gradOut_${m.monthIndex})`}
                        />
                      </Svg>
                    ) : null}
                  </View>
                </View>

                {/* Month Label with Active MTD indicator */}
                <View style={styles.monthLabelContainer}>
                  <Text
                    style={[
                      styles.monthLabel,
                      {
                        color: isCurrent ? inColor : colors.textSecondary,
                        fontFamily: isCurrent ? FontFamily.bold : FontFamily.medium,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {m.label.charAt(0)}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.currentMonthDot, { backgroundColor: inColor }]} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.cardLarge,
    paddingHorizontal: Spacing.block,
    paddingTop: Spacing.block,
    paddingBottom: Spacing.group,
    borderWidth: 1,
    marginTop: Spacing.section,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.block,
  },
  titleContainer: {
    flex: 1,
    paddingRight: Spacing.element,
  },
  title: {
    fontSize: FontSize.titleSmall,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginTop: 2,
    lineHeight: 18,
  },
  legendCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.pill,
    borderWidth: 0.8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.medium,
  },
  chartContainer: {
    width: '100%',
  },
  monthsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  monthCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  barPodTrack: {
    width: (BAR_WIDTH * 2) + BAR_GAP + 6,
    height: CHART_HEIGHT,
    borderRadius: (BAR_WIDTH * 2 + BAR_GAP + 6) / 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 3,
  },
  barSlot: {
    width: BAR_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  monthLabelContainer: {
    alignItems: 'center',
    marginTop: 6,
    height: 18,
  },
  monthLabel: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  currentMonthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
