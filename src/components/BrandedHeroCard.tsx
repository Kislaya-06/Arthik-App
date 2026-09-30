import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react-native';
import { DonutChart } from './DonutChart';
import { DualRingChart } from './DualRingChart';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { ThemeColors, FontFamily, FontSize } from '../config/theme';
import { formatCurrency, round2 } from '../lib/formatters';
import { parseChipNumber, calculatePureHeroMetrics } from '../lib/homeCalculations';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';

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
}) => {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: 0,
  });

  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const podSize = isBudgetModeEnabled ? POD_SIZE_BUDGET : POD_SIZE_PURE;
  const showRollover = isBudgetModeEnabled && activeFilter === 'Daily' && todayBudget > 0;

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
    const h = dimensions.height > 0 ? dimensions.height : 210;
    return buildNotchedCardPath(dimensions.width, h, CORNER_RADIUS, podSize, GAP);
  }, [dimensions.width, dimensions.height, podSize]);

  // In Pure Mode, inflow represents all funds deposited/received into the account during this period:
  // (Historical active daily budget allowances + Transaction Income + External deposits)
  const pureInflow = totalAvailable;
  const pureMetrics = useMemo(
    () => calculatePureHeroMetrics(activeFilter, pureInflow, periodSpent),
    [activeFilter, pureInflow, periodSpent]
  );

  // Curated Card Colors (Mint Green signature card)
  // Contrast: Dark Navy typography on Mint Green (#B8E0C8) provides 9.8:1 AAA contrast
  const mintBase = colors.mintGreen; // #B8E0C8
  const cardBorderColor = isDark ? 'rgba(184, 224, 200, 0.35)' : 'rgba(26, 43, 76, 0.12)';
  const textColorPrimary = '#1A2B4C';
  const textColorSecondary = 'rgba(26, 43, 76, 0.65)';

  // Split breakdown into distinct, atomic micro-chips for effortless scanning (Budget mode only)
  const subtextParts = useMemo(() => {
    if (!primarySubtext) return [];
    if (primarySubtext.includes(' + ')) {
      return primarySubtext.split(' + ').map((part, index) => {
        const trimmed = part.trim();
        if (index > 0 && !trimmed.startsWith('+')) {
          return `+${trimmed}`;
        }
        return trimmed;
      });
    }
    return [primarySubtext.trim()];
  }, [primarySubtext]);

  const filterLabelPrefix = activeFilter === 'All' ? 'Total' : activeFilter;

  // ── Rolling number animation for all values (Remaining/Expense, Income, Expense, Chips) ──
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayPrimaryAmount, setDisplayPrimaryAmount] = useState(0);
  const [displayTotalAvailable, setDisplayTotalAvailable] = useState(0);
  const [displayPeriodSpent, setDisplayPeriodSpent] = useState(0);
  const [displaySubtextParts, setDisplaySubtextParts] = useState<string[]>(() => {
    const parsedChips = subtextParts.map((p) => parseChipNumber(p));
    return parsedChips.map((parsed, idx) => {
      if (!parsed) return subtextParts[idx];
      return `${parsed.prefix}0${parsed.suffix}`;
    });
  });

  useEffect(() => {
    let isMounted = true;
    countAnim.setValue(0);
    setDisplayPrimaryAmount(0);
    setDisplayTotalAvailable(0);
    setDisplayPeriodSpent(0);

    const parsedChips = subtextParts.map((p) => parseChipNumber(p));
    if (parsedChips.length > 0) {
      setDisplaySubtextParts(
        parsedChips.map((parsed, idx) => {
          if (!parsed) return subtextParts[idx];
          return `${parsed.prefix}0${parsed.suffix}`;
        })
      );
    } else {
      setDisplaySubtextParts([]);
    }

    const animation = Animated.timing(countAnim, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    const targetPrimary = isBudgetModeEnabled ? primaryAmount : pureMetrics.totalRemaining;
    const targetIncome = isBudgetModeEnabled ? totalAvailable : pureMetrics.inflow;
    const targetSpent = isBudgetModeEnabled ? periodSpent : pureMetrics.outflow;

    const listenerId = countAnim.addListener(({ value }) => {
      if (!isMounted) return;

      // Primary Amount (Total Remaining in Budget Mode, Total Expense in Pure Mode)
      const hasPrimaryDec = !Number.isInteger(targetPrimary);
      const curPrimary = hasPrimaryDec
        ? Math.round(targetPrimary * value * 10) / 10
        : Math.round(targetPrimary * value);
      setDisplayPrimaryAmount(curPrimary);

      // Total Available / Inflow
      const hasIncomeDec = !Number.isInteger(targetIncome);
      const curIncome = hasIncomeDec
        ? Math.round(targetIncome * value * 10) / 10
        : Math.round(targetIncome * value);
      setDisplayTotalAvailable(curIncome);

      // Period Spent / Outflow
      const hasExpenseDec = !Number.isInteger(targetSpent);
      const curExpense = hasExpenseDec
        ? Math.round(targetSpent * value * 10) / 10
        : Math.round(targetSpent * value);
      setDisplayPeriodSpent(curExpense);

      // Chips (budget mode only)
      if (parsedChips.length > 0) {
        setDisplaySubtextParts(
          parsedChips.map((parsed, idx) => {
            if (!parsed) return subtextParts[idx];
            const curChip = parsed.hasDecimals
              ? Math.round(parsed.numericValue * value * 10) / 10
              : Math.round(parsed.numericValue * value);
            const formatted = curChip.toLocaleString('en-IN', {
              maximumFractionDigits: parsed.hasDecimals ? 1 : 0,
            });
            return `${parsed.prefix}${formatted}${parsed.suffix}`;
          })
        );
      }
    });

    animation.start(({ finished }) => {
      if (finished && isMounted) {
        setDisplayPrimaryAmount(targetPrimary);
        setDisplayTotalAvailable(targetIncome);
        setDisplayPeriodSpent(targetSpent);
        setDisplaySubtextParts(subtextParts);
      }
    });

    return () => {
      isMounted = false;
      countAnim.removeListener(listenerId);
      animation.stop();
    };
  }, [
    activeFilter,
    primaryAmount,
    totalAvailable,
    periodSpent,
    primarySubtext,
    countAnim,
    isBudgetModeEnabled,
    pureMetrics.totalExpense,
    pureMetrics.inflow,
    pureMetrics.outflow,
  ]);

  const displayNet = round2(displayTotalAvailable - displayPeriodSpent);
  const isNetPositive = displayNet >= 0;

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
              {isBudgetModeEnabled ? primaryLabel : pureMetrics.title}
            </Text>
            <Text
              style={[
                styles.primaryAmount,
                {
                  color: isBudgetModeEnabled
                    ? (isOverBudgetPeriod ? colors.danger : textColorPrimary)
                    : (pureMetrics.isDeficit ? colors.danger : textColorPrimary),
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(displayPrimaryAmount)}
            </Text>

            {/* Subtext Chips (Budget mode only) */}
            {isBudgetModeEnabled && displaySubtextParts.length > 0 && (
              <View style={styles.subtextContainer}>
                {displaySubtextParts.map((part, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.subtextChip,
                      isOverBudgetPeriod && { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subtextChipText,
                        { color: isOverBudgetPeriod ? '#DC2626' : textColorPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {part}
                    </Text>
                  </View>
                ))}
              </View>
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
                  <Text
                    style={[styles.metricAmount, { color: textColorPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {`+${formatCurrency(displayTotalAvailable)}`}
                  </Text>
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
                  <Text
                    style={[styles.metricAmount, { color: textColorPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {`−${formatCurrency(displayPeriodSpent)}`}
                  </Text>
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
                  <Text
                    style={[styles.metricAmount, { color: textColorPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {`+${formatCurrency(displayTotalAvailable)}`}
                  </Text>
                  <View style={styles.trendChipIncome}>
                    <ArrowDownLeft size={11} color="#15803D" strokeWidth={2.5} />
                  </View>
                </View>
              </View>

              {/* Outflow Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>Outflow</Text>
                <View style={styles.metricAmountRow}>
                  <Text
                    style={[styles.metricAmount, { color: textColorPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {`−${formatCurrency(displayPeriodSpent)}`}
                  </Text>
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
              <Text style={[styles.rolloverText, { color: textColorPrimary }]} numberOfLines={1}>
                {isOverBudget
                  ? `Over limit by ${formatCurrency(todayRecordSpent - todayBudget)} today`
                  : `${formatCurrency(todayRemaining)} rolls over to Gullak tonight`}
              </Text>
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
              spent={displaySpent}
              total={Math.max(totalAvailable, displaySpent)}
              colors={colors}
              trackColor="rgba(255, 255, 255, 0.65)"
              baseColor="rgba(255, 255, 255, 0.92)"
              spentColor={isOverBudgetPeriod ? '#EF4444' : '#E05A47'}
              textColor={isOverBudgetPeriod ? '#EF4444' : textColorPrimary}
              subtextColor={textColorSecondary}
              triggerKey={activeFilter}
            />
          ) : (
            <DualRingChart
              size={podSize}
              income={displayTotalAvailable}
              spent={displayPeriodSpent}
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
  },
  subtextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  subtextChip: {
    backgroundColor: 'rgba(26, 43, 76, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subtextChipText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: 'rgba(26, 43, 76, 0.85)',
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
  },
  pureMetricAmount: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
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
