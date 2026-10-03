import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutChangeEvent,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react-native';
import { DonutChart } from './DonutChart';
import { DualRingChart } from './DualRingChart';
import { RollingText } from './RollingText';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { ThemeColors, FontFamily, FontSize } from '../config/theme';
import { formatCurrency, formatAmountWithCommas, round2 } from '../lib/formatters';
import { calculatePureHeroMetrics } from '../lib/homeCalculations';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { PeriodSummaryInfo } from '../lib/budgetPeriods';
import { formatCadenceRolloverStrip } from '../lib/budgetModeUtils';

export type BrandedHeroCardProps = {
  primaryLabel: string;
  primaryAmount: number;
  primarySubtext?: string | null;
  displaySpent: number;
  totalAvailable: number;
  periodSpent: number;
  isOverBudgetPeriod: boolean;
  activeFilter: string;
  todayBudget: number;
  todayRemaining: number;
  todayRecordSpent: number;
  isOverBudget: boolean;
  colors: ThemeColors;
  isDark: boolean;
  onNavigateSavings: () => void;
  periodIncome?: number;
  cadencePeriodSummary?: PeriodSummaryInfo | null;
};

// Corner & layout geometry constants
const DEFAULT_WIDTH = 340;
const CORNER_RADIUS = 24;
const POD_SIZE_BUDGET = 94;
const POD_SIZE_PURE = 98;
const GAP = 8;

/**
 * Generates an SVG path for a card with an organic concentric circular socket in the top-right corner.
 * The cutout follows the exact same circular curvature as the chart pod with an equidistant gap,
 * eliminating any flat corners under the circle.
 */
export function buildNotchedCardPath(
  w: number,
  h: number,
  r: number,
  podSize: number,
  gap: number
): string {
  if (w <= 0 || h <= 0) return '';

  const Rc = podSize / 2;
  const Cx = w - Rc;
  const Cy = Rc;
  const Rcradle = Rc + gap;
  const r1 = 16;
  const r2 = 16;

  // Top fillet blending horizontal top edge into concentric circular arc
  const d1 = Math.sqrt(Math.max(1, Math.pow(Rcradle + r1, 2) - Math.pow(Cy - r1, 2)));
  const x_f1 = Cx - d1;
  const T1_x = x_f1 + r1 * (d1 / (Rcradle + r1));
  const T1_y = r1 + r1 * ((Cy - r1) / (Rcradle + r1));

  // Right fillet blending concentric circular arc into vertical right edge
  const d2 = Math.sqrt(Math.max(1, Math.pow(Rcradle + r2, 2) - Math.pow(Rc - r2, 2)));
  const y_f2 = Cy + d2;
  const T2_x = Cx + Rcradle * ((Rc - r2) / (Rcradle + r2));
  const T2_y = Cy + Rcradle * (d2 / (Rcradle + r2));

  return [
    `M ${r},0`,
    `L ${x_f1.toFixed(2)},0`,
    `A ${r1},${r1} 0 0 1 ${T1_x.toFixed(2)},${T1_y.toFixed(2)}`,
    `A ${Rcradle},${Rcradle} 0 0 0 ${T2_x.toFixed(2)},${T2_y.toFixed(2)}`,
    `A ${r2},${r2} 0 0 1 ${w},${y_f2.toFixed(2)}`,
    `L ${w},${(h - r).toFixed(2)}`,
    `A ${r},${r} 0 0 1 ${(w - r).toFixed(2)},${h}`,
    `L ${r},${h}`,
    `A ${r},${r} 0 0 1 0,${(h - r).toFixed(2)}`,
    `L 0,${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    'Z',
  ].join(' ');
}

export const BrandedHeroCard: React.FC<BrandedHeroCardProps> = ({
  primaryLabel,
  primaryAmount,
  primarySubtext,
  displaySpent,
  totalAvailable,
  periodSpent,
  isOverBudgetPeriod,
  activeFilter,
  todayBudget,
  todayRemaining,
  todayRecordSpent,
  isOverBudget,
  colors,
  isDark,
  onNavigateSavings,
  periodIncome,
  cadencePeriodSummary,
}) => {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: 250,
  });

  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const isCadenceMode = isBudgetModeEnabled && budgetCadence !== 'daily';
  const podSize = isBudgetModeEnabled ? POD_SIZE_BUDGET : POD_SIZE_PURE;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions((prev) => {
        if (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) {
          return prev;
        }
        return { width: Math.round(width), height: Math.round(height) };
      });
    }
  }, []);

  const cardPath = useMemo(() => {
    const h = dimensions.height > 0 ? dimensions.height : 250;
    return buildNotchedCardPath(dimensions.width, h, CORNER_RADIUS, podSize, GAP);
  }, [dimensions.width, dimensions.height, podSize]);

  // In Pure Mode, inflow represents all funds deposited/received into the account during this period:
  // (Historical active daily budget allowances + Transaction Income + External deposits)
  const pureInflow = totalAvailable;
  const pureMetrics = useMemo(
    () => calculatePureHeroMetrics(activeFilter, pureInflow, periodSpent),
    [activeFilter, pureInflow, periodSpent]
  );

  // Cadence-aware primary values with dynamic non-binding pace guidance:
  const effectivePrimaryLabel = useMemo(() => {
    if (!isBudgetModeEnabled) return pureMetrics.title;
    if (isCadenceMode && cadencePeriodSummary) {
      if (budgetCadence === 'weekly') {
        if (activeFilter === 'Weekly') {
          return cadencePeriodSummary.isOver ? 'Over this week' : 'Left this week';
        }
        if (activeFilter === 'Daily') {
          return "Today's Spent";
        }
        if (activeFilter === 'Monthly') {
          return 'Projected Monthly Spend';
        }
      } else if (budgetCadence === 'monthly') {
        if (activeFilter === 'Monthly') {
          return cadencePeriodSummary.isOver ? 'Over this month' : 'Left this month';
        }
        if (activeFilter === 'Weekly') {
          return 'Suggested Weekly Pace';
        }
        if (activeFilter === 'Daily') {
          return "Today's Spent";
        }
      }
    }
    return primaryLabel;
  }, [isBudgetModeEnabled, isCadenceMode, cadencePeriodSummary, budgetCadence, activeFilter, pureMetrics.title, primaryLabel]);

  const effectivePrimaryAmount = useMemo(() => {
    if (!isBudgetModeEnabled) return pureMetrics.totalRemaining;
    if (isCadenceMode && cadencePeriodSummary) {
      if (budgetCadence === 'weekly') {
        if (activeFilter === 'Weekly') {
          return cadencePeriodSummary.isOver ? cadencePeriodSummary.overBy : cadencePeriodSummary.remaining;
        }
        if (activeFilter === 'Daily') {
          return todayRecordSpent;
        }
        if (activeFilter === 'Monthly') {
          return cadencePeriodSummary.projectedMonthlyBudget ?? Math.round((cadencePeriodSummary.budget / 7) * 31);
        }
      } else if (budgetCadence === 'monthly') {
        if (activeFilter === 'Monthly') {
          return cadencePeriodSummary.isOver ? cadencePeriodSummary.overBy : cadencePeriodSummary.remaining;
        }
        if (activeFilter === 'Weekly') {
          return cadencePeriodSummary.suggestedWeeklyPace ?? Math.round((cadencePeriodSummary.remaining / cadencePeriodSummary.remainingDays) * 7);
        }
        if (activeFilter === 'Daily') {
          return todayRecordSpent;
        }
      }
    }
    return primaryAmount;
  }, [isBudgetModeEnabled, isCadenceMode, cadencePeriodSummary, budgetCadence, activeFilter, todayRecordSpent, pureMetrics.totalRemaining, primaryAmount]);

  const effectiveIsOver = useMemo(() => {
    if (!isBudgetModeEnabled) return pureMetrics.isDeficit;
    if (isCadenceMode && cadencePeriodSummary) {
      if (budgetCadence === 'weekly') {
        if (activeFilter === 'Weekly') return cadencePeriodSummary.isOver;
        if (activeFilter === 'Daily') return cadencePeriodSummary.isOver;
        if (activeFilter === 'Monthly') return false;
      } else if (budgetCadence === 'monthly') {
        if (activeFilter === 'Monthly') return cadencePeriodSummary.isOver;
        if (activeFilter === 'Weekly') return false;
        if (activeFilter === 'Daily') return cadencePeriodSummary.isOver;
      }
    }
    return isOverBudgetPeriod;
  }, [isBudgetModeEnabled, isCadenceMode, cadencePeriodSummary, budgetCadence, activeFilter, pureMetrics.isDeficit, isOverBudgetPeriod]);

  const effectiveSubtext = useMemo(() => {
    if (!isBudgetModeEnabled) return null;
    if (isCadenceMode && cadencePeriodSummary) {
      if (budgetCadence === 'weekly') {
        if (activeFilter === 'Weekly') {
          return `Spent ₹${formatAmountWithCommas(String(cadencePeriodSummary.spent))} of ₹${formatAmountWithCommas(String(cadencePeriodSummary.budget))}`;
        }
        if (activeFilter === 'Daily') {
          return cadencePeriodSummary.isOver
            ? `Weekly budget exceeded by ₹${formatAmountWithCommas(String(cadencePeriodSummary.overBy))}`
            : `of ~₹${formatAmountWithCommas(String(cadencePeriodSummary.suggestedDailyPace))} suggested pace`;
        }
        if (activeFilter === 'Monthly') {
          return `Based on ₹${formatAmountWithCommas(String(cadencePeriodSummary.budget))}/wk pace for calendar month`;
        }
      } else if (budgetCadence === 'monthly') {
        if (activeFilter === 'Monthly') {
          return `Spent ₹${formatAmountWithCommas(String(cadencePeriodSummary.spent))} of ₹${formatAmountWithCommas(String(cadencePeriodSummary.budget))}`;
        }
        if (activeFilter === 'Weekly') {
          return `to stay within ₹${formatAmountWithCommas(String(cadencePeriodSummary.budget))} monthly budget`;
        }
        if (activeFilter === 'Daily') {
          return cadencePeriodSummary.isOver
            ? `Monthly budget exceeded by ₹${formatAmountWithCommas(String(cadencePeriodSummary.overBy))}`
            : `of ~₹${formatAmountWithCommas(String(cadencePeriodSummary.suggestedDailyPace))} suggested pace`;
        }
      }
    }
    return primarySubtext;
  }, [isBudgetModeEnabled, isCadenceMode, cadencePeriodSummary, budgetCadence, activeFilter, primarySubtext]);

  const showRollover = useMemo(() => {
    if (!isBudgetModeEnabled) return false;
    if (isCadenceMode) {
      return cadencePeriodSummary !== null && cadencePeriodSummary !== undefined && cadencePeriodSummary.budget > 0;
    }
    return activeFilter === 'Daily' && todayBudget > 0;
  }, [isBudgetModeEnabled, isCadenceMode, cadencePeriodSummary, activeFilter, todayBudget]);

  const rolloverStripText = useMemo(() => {
    if (isCadenceMode && cadencePeriodSummary) {
      if (budgetCadence === 'weekly') {
        if (activeFilter === 'Weekly') {
          return formatCadenceRolloverStrip(cadencePeriodSummary, 'weekly');
        }
        if (activeFilter === 'Daily') {
          return cadencePeriodSummary.isOver
            ? `Weekly budget exceeded · 0 daily pace remaining`
            : `Suggested daily pace: ~₹${formatAmountWithCommas(String(cadencePeriodSummary.suggestedDailyPace))}/day`;
        }
        if (activeFilter === 'Monthly') {
          return `Weekly budget active · ${cadencePeriodSummary.remainingDays} days left this week`;
        }
      } else if (budgetCadence === 'monthly') {
        if (activeFilter === 'Monthly') {
          return formatCadenceRolloverStrip(cadencePeriodSummary, 'monthly');
        }
        if (activeFilter === 'Weekly') {
          return `${cadencePeriodSummary.remainingDays} days left in month · ~₹${formatAmountWithCommas(String(cadencePeriodSummary.suggestedDailyPace))}/day pace`;
        }
        if (activeFilter === 'Daily') {
          return cadencePeriodSummary.isOver
            ? `Monthly budget exceeded · 0 daily pace remaining`
            : `Suggested daily pace: ~₹${formatAmountWithCommas(String(cadencePeriodSummary.suggestedDailyPace))}/day`;
        }
      }
      return formatCadenceRolloverStrip(cadencePeriodSummary, budgetCadence);
    }
    return isOverBudget
      ? `Over limit by ${formatCurrency(todayRecordSpent - todayBudget)} today`
      : `${formatCurrency(todayRemaining)} rolls over to Gullak tonight`;
  }, [isCadenceMode, cadencePeriodSummary, budgetCadence, activeFilter, isOverBudget, todayRecordSpent, todayBudget, todayRemaining]);

  // Curated Card Colors (Mint Green signature card)
  // Contrast: Dark Navy typography on Mint Green (#B8E0C8) provides 9.8:1 AAA contrast
  const mintBase = colors.mintGreen; // #B8E0C8
  const cardBorderColor = isDark ? 'rgba(184, 224, 200, 0.35)' : 'rgba(26, 43, 76, 0.12)';
  const textColorPrimary = '#1A2B4C';
  const textColorSecondary = 'rgba(26, 43, 76, 0.65)';

  // Split breakdown into distinct, atomic micro-chips for effortless scanning (Budget mode only)
  const subtextParts = useMemo(() => {
    if (!effectiveSubtext) return [];
    if (effectiveSubtext.includes(' + ')) {
      return effectiveSubtext.split(' + ').map((part, index) => {
        const trimmed = part.trim();
        if (index > 0 && !trimmed.startsWith('+')) {
          return `+${trimmed}`;
        }
        return trimmed;
      });
    }
    return [effectiveSubtext.trim()];
  }, [effectiveSubtext]);

  const filterLabelPrefix = activeFilter === 'All' ? 'Total' : activeFilter;

  // ── Smooth number transition for all values (Remaining/Expense, Income, Expense) ──
  const effectiveTargets = useMemo(() => {
    let targetPrimary = isBudgetModeEnabled ? effectivePrimaryAmount : pureMetrics.totalRemaining;
    let targetIncome = isBudgetModeEnabled ? totalAvailable : pureMetrics.inflow;
    let targetSpent = isBudgetModeEnabled ? periodSpent : pureMetrics.outflow;

    if (isBudgetModeEnabled && isCadenceMode && cadencePeriodSummary) {
      if (budgetCadence === 'weekly') {
        if (activeFilter === 'Weekly') {
          targetIncome = cadencePeriodSummary.budget;
          targetSpent = cadencePeriodSummary.spent;
        } else if (activeFilter === 'Daily') {
          targetIncome = Math.max(cadencePeriodSummary.suggestedDailyPace, todayRecordSpent);
          targetSpent = todayRecordSpent;
        } else if (activeFilter === 'Monthly') {
          targetIncome = cadencePeriodSummary.projectedMonthlyBudget ?? totalAvailable;
          targetSpent = periodSpent;
        }
      } else if (budgetCadence === 'monthly') {
        if (activeFilter === 'Monthly') {
          targetIncome = cadencePeriodSummary.budget;
          targetSpent = cadencePeriodSummary.spent;
        } else if (activeFilter === 'Weekly') {
          targetIncome = cadencePeriodSummary.suggestedWeeklyPace ?? totalAvailable;
          targetSpent = periodSpent;
        } else if (activeFilter === 'Daily') {
          targetIncome = Math.max(cadencePeriodSummary.suggestedDailyPace, todayRecordSpent);
          targetSpent = todayRecordSpent;
        }
      }
    }

    return {
      targetPrimary: round2(targetPrimary),
      targetIncome: round2(targetIncome),
      targetSpent: round2(targetSpent),
    };
  }, [
    isBudgetModeEnabled,
    effectivePrimaryAmount,
    pureMetrics.totalRemaining,
    totalAvailable,
    pureMetrics.inflow,
    periodSpent,
    pureMetrics.outflow,
    isCadenceMode,
    cadencePeriodSummary,
    budgetCadence,
    activeFilter,
    todayRecordSpent,
  ]);

  // Numbers are handed to <RollingText/> as their FINAL value. Each digit rolls on its own (odometer style,
  // native thread) whenever the value changes, and rolls smoothly up from zero on screen entry via rollOnFocus.
  const innerWidth = Math.max(0, (dimensions.width || DEFAULT_WIDTH) - 40); // cardInner: paddingHorizontal 20 x 2
  const metricAmountMaxWidth = Math.max(0, innerWidth / 2 - 26); // half the card minus (trend chip 20 + gap 6)
  const primaryAmountStyle = StyleSheet.flatten([
    styles.primaryAmount,
    { color: effectiveIsOver ? colors.danger : textColorPrimary },
  ]);
  const metricAmountStyle = StyleSheet.flatten([styles.metricAmount, { color: textColorPrimary }]);

  return (
    <View style={styles.outerWrapper}>
      {/* ── Main Container (Measures Content) ── */}
      <View style={styles.cardContainer} onLayout={handleLayout}>
        {/* ── SVG Notched Background ── */}
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Svg
            width={dimensions.width}
            height={dimensions.height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="mintCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#C4EBD4" />
                <Stop offset="50%" stopColor={mintBase} />
                <Stop offset="100%" stopColor="#A8DCBE" />
              </LinearGradient>
            </Defs>
            <Path
              d={cardPath}
              fill="url(#mintCardGrad)"
              stroke={cardBorderColor}
              strokeWidth={1}
            />
          </Svg>
        )}

        {/* ── Inner Content ── */}
        <View style={styles.cardInner}>
          {/* Top Section: Constrained width to clear the notched chart pod */}
          <View style={[styles.topSection, { paddingRight: podSize + GAP + 6 }]}>
            {/* Label & Amount */}
            <Text style={[styles.primaryLabel, { color: textColorSecondary }]}>
              {effectivePrimaryLabel}
            </Text>
            <RollingText
              text={formatCurrency(effectiveTargets.targetPrimary)}
              style={primaryAmountStyle}
              minScale={0.6}
              rollOnFocus
            />

            {/* Subtext Chips (Budget mode only): horizontal single-row scroll keeps card height 100% stable */}
            {isBudgetModeEnabled && subtextParts.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.subtextScroll}
                contentContainerStyle={styles.subtextContainer}
              >
                {subtextParts.map((part, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.subtextChip,
                      effectiveIsOver && { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subtextChipText,
                        { color: effectiveIsOver ? '#DC2626' : textColorPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {part}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Inflow & Outflow / Net Footer Row ── */}
          {isBudgetModeEnabled ? (
            /* Budget Mode: 2-Column Unboxed Layout */
            <View style={styles.metricsRow}>
              {/* Income Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>
                  {`${filterLabelPrefix} Income`}
                </Text>
                <View style={styles.metricAmountRow}>
                  <RollingText
                    text={`+${formatCurrency(effectiveTargets.targetIncome)}`}
                    style={metricAmountStyle}
                    fitWidth={metricAmountMaxWidth}
                    minScale={0.6}
                    rollOnFocus
                  />
                  <View style={styles.trendChipIncome}>
                    <ArrowDownLeft size={11} color="#15803D" strokeWidth={2.5} />
                  </View>
                </View>
              </View>

              {/* Expense Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>
                  {`${filterLabelPrefix} Expense`}
                </Text>
                <View style={styles.metricAmountRow}>
                  <RollingText
                    text={`−${formatCurrency(effectiveTargets.targetSpent)}`}
                    style={metricAmountStyle}
                    fitWidth={metricAmountMaxWidth}
                    minScale={0.6}
                    rollOnFocus
                  />
                  <View style={styles.trendChipExpense}>
                    <ArrowUpRight size={11} color="#DC2626" strokeWidth={2.5} />
                  </View>
                </View>
              </View>
            </View>
          ) : (
            /* Pure Mode: 2-Column Footer Row (Inflow +₹, Outflow −₹) */
            <View style={styles.metricsRow}>
              {/* Inflow Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>Inflow</Text>
                <View style={styles.metricAmountRow}>
                  <RollingText
                    text={`+${formatCurrency(effectiveTargets.targetIncome)}`}
                    style={metricAmountStyle}
                    fitWidth={metricAmountMaxWidth}
                    minScale={0.6}
                    rollOnFocus
                  />
                  <View style={styles.trendChipIncome}>
                    <ArrowDownLeft size={11} color="#15803D" strokeWidth={2.5} />
                  </View>
                </View>
              </View>

              {/* Outflow Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>Outflow</Text>
                <View style={styles.metricAmountRow}>
                  <RollingText
                    text={`−${formatCurrency(effectiveTargets.targetSpent)}`}
                    style={metricAmountStyle}
                    fitWidth={metricAmountMaxWidth}
                    minScale={0.6}
                    rollOnFocus
                  />
                  <View style={styles.trendChipExpense}>
                    <ArrowUpRight size={11} color="#DC2626" strokeWidth={2.5} />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Daily Gullak Rollover Strip (Budget mode only) */}
          {showRollover && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onNavigateSavings}
              style={styles.rolloverStrip}
            >
              <PiggyBankCoinIcon size={16} color="#15803D" />
              <RollingText
                text={rolloverStripText}
                style={StyleSheet.flatten([styles.rolloverTextFont, { color: textColorPrimary }])}
                containerStyle={styles.rolloverText}
                fitWidth={Math.max(0, innerWidth - 70)}
                minScale={0.8}
              />
              <ChevronRight size={14} color={textColorSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Top-Right Chart Pod (Docked in the Notched Pocket) ── */}
        <View
          style={[
            styles.chartPod,
            {
              width: podSize,
              height: podSize,
              borderRadius: podSize / 2,
              backgroundColor: mintBase,
              borderColor: cardBorderColor,
            },
          ]}
          pointerEvents={isBudgetModeEnabled ? 'none' : 'auto'}
        >
          {isBudgetModeEnabled ? (
            <DonutChart
              size={82}
              strokeWidth={9.5}
              spent={effectiveTargets.targetSpent}
              total={Math.max(effectiveTargets.targetIncome, effectiveTargets.targetSpent)}
              colors={colors}
              trackColor="rgba(255, 255, 255, 0.65)"
              baseColor="rgba(255, 255, 255, 0.92)"
              spentColor={effectiveIsOver ? '#EF4444' : '#E05A47'}
              textColor={effectiveIsOver ? '#EF4444' : textColorPrimary}
              subtextColor={textColorSecondary}
              triggerKey={activeFilter}
            />
          ) : (
            <DualRingChart
              size={podSize}
              income={effectiveTargets.targetIncome}
              spent={effectiveTargets.targetSpent}
              isDark={isDark}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardContainer: {
    width: '100%',
    position: 'relative',
    minHeight: 195,
  },
  cardInner: {
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  topSection: {
    minHeight: 84,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
  },
  primaryAmount: {
    fontSize: 30,
    fontFamily: FontFamily.bold,
    marginTop: 1,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  subtextScroll: {
    marginTop: 8,
    maxHeight: 28,
  },
  subtextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtextChip: {
    backgroundColor: 'rgba(26, 43, 76, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subtextChipText: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    color: 'rgba(26, 43, 76, 0.88)',
    includeFontPadding: false,
  },
  // Inflow & Outflow unboxed layout matching user reference
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  metricCol: {
    flex: 1,
  },
  pureMetricCol: {
    flex: 1,
    minWidth: 0,
  },
  metricColLabel: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: 'rgba(26, 43, 76, 0.65)',
    marginBottom: 4,
  },
  metricAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricAmount: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  pureMetricAmount: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  trendChipIncome: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(21, 128, 61, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendChipExpense: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolloverStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 43, 76, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(26, 43, 76, 0.08)',
  },
  rolloverText: {
    flex: 1,
  },
  rolloverTextFont: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
  },
  chartPod: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
});
