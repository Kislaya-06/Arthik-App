import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
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
  remainingIncome?: number;
  remainingDeposits?: number;
  isSpendingFromGullak?: boolean;
  gullakDrawnAmount?: number;
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
  cadencePeriodSummary,
  periodIncome = 0,
  remainingIncome = 0,
  isSpendingFromGullak = false,
  gullakDrawnAmount = 0,
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
  const textColorSecondary = isDark ? 'rgba(26, 43, 76, 0.85)' : 'rgba(26, 43, 76, 0.80)';

  // Split breakdown into distinct micro-chips and sort ascending by size (shortest on top, longest on bottom)
  const subtextChipItems = useMemo(() => {
    if (!effectiveSubtext) return [];

    const rawParts = effectiveSubtext.includes(' + ')
      ? effectiveSubtext.split(' + ')
      : [effectiveSubtext];

    const items = rawParts.map((rawPart, index) => {
      const trimmed = rawPart.trim();
      const text = index > 0 && !trimmed.startsWith('+') ? `+${trimmed}` : trimmed;
      const lower = text.toLowerCase();
      const isIncomeChip = lower.includes('income');
      const isGullakChip = lower.includes('gullak');

      const showGullakSpending =
        (isIncomeChip && isSpendingFromGullak) ||
        (!periodIncome && isGullakChip && isSpendingFromGullak);

      let badgeText: string | null = null;
      if (showGullakSpending) {
        if (gullakDrawnAmount > 0) {
          badgeText = `using ₹${formatCurrency(gullakDrawnAmount).replace('₹', '')} from Gullak`;
        } else {
          badgeText = 'now spending from Gullak';
        }
      }

      // Visual length metric: base chip text + badge length
      const approxSize = text.length + (badgeText ? badgeText.length + 6 : 0);

      return {
        id: `${index}_${text}`,
        text,
        badgeText,
        approxSize,
      };
    });

    // Sort chips by size: shortest chip on top, progressively larger chips below
    items.sort((a, b) => a.approxSize - b.approxSize);

    return items;
  }, [effectiveSubtext, isSpendingFromGullak, gullakDrawnAmount, periodIncome]);

  const filterLabelPrefix = activeFilter === 'All' ? 'Total' : activeFilter;

  // ── Smooth number transition for all values (Remaining/Expense, Income, Expense) ──
  const effectiveTargets = useMemo(() => {
    let targetPrimary = isBudgetModeEnabled ? effectivePrimaryAmount : pureMetrics.totalRemaining;
    let targetIncome = pureMetrics.inflow;
    let targetSpent = isBudgetModeEnabled ? periodSpent : pureMetrics.outflow;

    if (isBudgetModeEnabled) {
      if (isCadenceMode && cadencePeriodSummary) {
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
      } else {
        // Daily Cadence (standard budget mode):
        // Total available income/inflow for the period (budget + income + deposits)
        targetIncome = totalAvailable;
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
    pureMetrics.inflow,
    periodSpent,
    pureMetrics.outflow,
    isCadenceMode,
    cadencePeriodSummary,
    budgetCadence,
    activeFilter,
    todayRecordSpent,
    totalAvailable,
    periodIncome,
    remainingIncome,
  ]);

  // Numbers are handed to <RollingText/> as their FINAL value. Each digit rolls on its own (odometer style,
  // native thread) whenever the value changes, and rolls smoothly up from zero on screen entry via rollOnFocus.
  const innerWidth = Math.max(0, (dimensions.width || DEFAULT_WIDTH) - 36); // cardInner: paddingHorizontal 18 x 2
  const metricAmountMaxWidth = Math.max(0, innerWidth / 2 - 30); // half the card minus (trend chip 24 + gap 6)
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
            <Text
              style={[styles.primaryLabel, { color: textColorSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {effectivePrimaryLabel}
            </Text>
            <RollingText
              text={formatCurrency(effectiveTargets.targetPrimary)}
              style={primaryAmountStyle}
              fitWidth={Math.max(0, innerWidth - (podSize + GAP + 6))}
              minScale={0.55}
              rollOnFocus
            />
          </View>

          {/* Subtext Chips (Budget mode only): Full-width row below topSection */}
          {isBudgetModeEnabled && subtextChipItems.length > 0 && (
            <View style={styles.subtextContainer}>
              {subtextChipItems.map((item) => (
                <View key={item.id} style={styles.subtextChipRow}>
                  <View
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
                      {item.text}
                    </Text>
                  </View>
                  {item.badgeText && (
                    <View style={styles.gullakSpendingBadge}>
                      <PiggyBankCoinIcon size={12} color="#DC2626" />
                      <Text style={styles.gullakSpendingText} numberOfLines={1}>
                        {item.badgeText}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

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
                    <ArrowDownLeft size={12} color="#15803D" strokeWidth={2.5} />
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
                    <ArrowUpRight size={12} color="#DC2626" strokeWidth={2.5} />
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
                    <ArrowDownLeft size={12} color="#15803D" strokeWidth={2.5} />
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
                    <ArrowUpRight size={12} color="#DC2626" strokeWidth={2.5} />
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
              total={Math.max(totalAvailable, effectiveTargets.targetSpent)}
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
    minHeight: 160,
  },
  cardInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  topSection: {
    justifyContent: 'flex-start',
  },
  primaryLabel: {
    fontSize: FontSize.body, // 16px (~1.5x of 11px metricColLabel for strong card heading hierarchy)
    fontFamily: FontFamily.bold,
    letterSpacing: 0.15,
    marginBottom: 3,
  },
  primaryAmount: {
    fontSize: 32,
    fontFamily: FontFamily.bold,
    marginTop: 0,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  subtextContainer: {
    marginTop: 6,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 5,
  },
  subtextChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  subtextChip: {
    backgroundColor: 'rgba(26, 43, 76, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  subtextChipText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    color: 'rgba(26, 43, 76, 0.88)',
    includeFontPadding: false,
  },
  gullakSpendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  gullakSpendingText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    color: '#DC2626',
    includeFontPadding: false,
  },
  // Inflow & Outflow unboxed layout matching user reference
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  metricCol: {
    flex: 1,
    minWidth: 0,
  },
  pureMetricCol: {
    flex: 1,
    minWidth: 0,
  },
  metricColLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: 'rgba(26, 43, 76, 0.70)',
    marginBottom: 2,
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
    fontSize: 16,
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  trendChipIncome: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(21, 128, 61, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendChipExpense: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolloverStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
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
    fontSize: FontSize.caption,
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
