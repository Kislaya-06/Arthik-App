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
  LineHeight,
  Spacing,
  BorderRadius,
} from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { YearlyCashFlowMonth } from '../lib/yearlyInsightsUtils';
import { getCashFlowChartColors } from '../lib/chartUtils';

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
const TRACK_WIDTH = 20;
const TRACK_RADIUS = 10;
const BAR_WIDTH = 14;
const BAR_RADIUS = 7;
const BOTTOM_OFFSET = 3;
const MAX_FILL_HEIGHT = CHART_HEIGHT - BOTTOM_OFFSET * 2;

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
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [triggerKey]);

  // Premium, harmonious palette matching Arthik design system
  const {
    outColor,
    inGradStart,
    inGradEnd,
    outGradStart,
    outGradEnd,
    trackBg,
  } = getCashFlowChartColors(isDark);

  // Exact green matching Auto-Saved to Gullak (colors.mintGreen / colors.forestGreen)
  const inColor = isDark ? colors.mintGreen : colors.forestGreen;

  // Safe ceiling for bar scaling (combined monthly activity across the year)
  const maxActivity = Math.max(
    ...months.map((m) => m.income + m.spent),
    maxAmount,
    100
  );

  return (
    <View style={styles.container}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isDark ? colors.borderSubtle : colors.border,
          },
        ]}
      >
        {/* ── Card Header (Subtitle & Legend) ── */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
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
            const totalActivity = m.income + m.spent;
            const isFuture = m.isFuture;
            const isCurrent = m.isCurrentMonth;
            const colOpacity = isFuture ? 0.28 : 1;

            // Total height of the stacked pill bar
            const totalHeight = totalActivity > 0
              ? Math.max(6, Math.round((totalActivity / maxActivity) * MAX_FILL_HEIGHT))
              : 0;

            let inHeight = 0;
            let outHeight = 0;

            if (totalHeight > 0) {
              if (m.income > 0 && m.spent > 0) {
                // Both Inflow and Outflow exist: partition proportionally
                inHeight = Math.max(3, Math.round((m.income / totalActivity) * totalHeight));
                outHeight = totalHeight - inHeight;
                if (outHeight < 3) {
                  outHeight = 3;
                  inHeight = Math.max(3, totalHeight - 3);
                }
              } else if (m.income > 0) {
                inHeight = totalHeight;
                outHeight = 0;
              } else {
                inHeight = 0;
                outHeight = totalHeight;
              }
            }

            const splitRatio = totalHeight > 0 ? outHeight / totalHeight : 0;

            const animatedTranslateY = animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [totalHeight + 10, 0],
              extrapolate: 'clamp',
            });

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
                {/* Dark Outer Track Capsule */}
                <View style={[styles.trackCapsule, { backgroundColor: trackBg }]}>
                  {totalHeight > 0 && (
                    <Animated.View
                      style={{
                        width: BAR_WIDTH,
                        height: totalHeight,
                        marginBottom: BOTTOM_OFFSET,
                        transform: [{ translateY: animatedTranslateY }],
                      }}
                    >
                      <Svg width={BAR_WIDTH} height={totalHeight}>
                        <Defs>
                          <LinearGradient id={`gradPill_${m.monthIndex}`} x1="0" y1="0" x2="0" y2="1">
                            {outHeight > 0 && inHeight > 0 ? [
                              <Stop key="1" offset="0%" stopColor={outGradStart} />,
                              <Stop key="2" offset={`${Math.max(0, splitRatio - 0.10) * 100}%`} stopColor={outGradEnd} />,
                              <Stop key="3" offset={`${splitRatio * 100}%`} stopColor={isDark ? '#E5C9A1' : '#DFB88A'} />,
                              <Stop key="4" offset={`${Math.min(1, splitRatio + 0.10) * 100}%`} stopColor={inGradStart} />,
                              <Stop key="5" offset="100%" stopColor={inGradEnd} />,
                            ] : outHeight > 0 ? [
                              <Stop key="1" offset="0%" stopColor={outGradStart} />,
                              <Stop key="2" offset="100%" stopColor={outGradEnd} />,
                            ] : [
                              <Stop key="1" offset="0%" stopColor={inGradStart} />,
                              <Stop key="2" offset="100%" stopColor={inGradEnd} />,
                            ]}
                          </LinearGradient>
                        </Defs>
                        <Rect
                          x="0"
                          y="0"
                          width={BAR_WIDTH}
                          height={totalHeight}
                          rx={BAR_RADIUS}
                          ry={BAR_RADIUS}
                          fill={`url(#gradPill_${m.monthIndex})`}
                        />
                      </Svg>
                    </Animated.View>
                  )}
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
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.surface,
  },
  sectionTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    marginBottom: 10,
  },
  card: {
    borderRadius: BorderRadius.cardLarge,
    paddingHorizontal: Spacing.block,
    paddingTop: Spacing.block,
    paddingBottom: Spacing.group,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    paddingRight: Spacing.element,
  },
  subTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
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
  trackCapsule: {
    width: TRACK_WIDTH,
    height: CHART_HEIGHT,
    borderRadius: TRACK_RADIUS,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
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
