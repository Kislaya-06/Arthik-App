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

  const prevPrimaryRef = useRef(effectiveTargets.targetPrimary);
  const prevIncomeRef = useRef(effectiveTargets.targetIncome);
  const prevSpentRef = useRef(effectiveTargets.targetSpent);
  const curPrimaryRef = useRef(effectiveTargets.targetPrimary);
  const curIncomeRef = useRef(effectiveTargets.targetIncome);
  const curSpentRef = useRef(effectiveTargets.targetSpent);
  const isFirstRender = useRef(true);

  const countAnim = useRef(new Animated.Value(0)).current;
  const morphAnim = useRef(new Animated.Value(0)).current;

  const [displayPrimaryAmount, setDisplayPrimaryAmount] = useState(
    () => effectiveTargets.targetPrimary
  );
  const [displayTotalAvailable, setDisplayTotalAvailable] = useState(
    () => effectiveTargets.targetIncome
  );
  const [displayPeriodSpent, setDisplayPeriodSpent] = useState(
    () => effectiveTargets.targetSpent
  );

  const morphOpacity = morphAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0.75, 1],
    extrapolate: 'clamp',
  });

  const morphTranslateY = morphAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, -1.5, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    let isMounted = true;
    const { targetPrimary, targetIncome, targetSpent } = effectiveTargets;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevPrimaryRef.current = targetPrimary;
      prevIncomeRef.current = targetIncome;
      prevSpentRef.current = targetSpent;
      curPrimaryRef.current = targetPrimary;
      curIncomeRef.current = targetIncome;
      curSpentRef.current = targetSpent;
      setDisplayPrimaryAmount(targetPrimary);
      setDisplayTotalAvailable(targetIncome);
      setDisplayPeriodSpent(targetSpent);
      return;
    }

    // Always animate from presentation (current on-screen) value for seamless interruption continuity
    const startPrimary = curPrimaryRef.current;
    const startIncome = curIncomeRef.current;
    const startSpent = curSpentRef.current;

    if (startPrimary === targetPrimary && startIncome === targetIncome && startSpent === targetSpent) {
      return;
    }

    // Trigger native micro-morph in parallel (subtle opacity softening & upward lift)
    morphAnim.setValue(0);
    Animated.timing(morphAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();

    countAnim.setValue(0);
    const animation = Animated.timing(countAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    });

    let lastUpdate = 0;
    const UPDATE_INTERVAL_MS = 16; // 60fps continuous fluid roll; no chart re-rendering bottleneck

    const interpolateValue = (start: number, target: number, progress: number): number => {
      const raw = start + (target - start) * progress;
      // If start and target are whole numbers, keep intermediate frames as integers.
      // This completely eliminates decimal popping (e.g. .50) that causes character count
      // expansion and adjustsFontSizeToFit horizontal jitter.
      const isBothInteger = Number.isInteger(start) && Number.isInteger(target);
      return isBothInteger ? Math.round(raw) : round2(raw);
    };

    const listenerId = countAnim.addListener(({ value }) => {
      if (!isMounted) return;

      const now = Date.now();
      if (now - lastUpdate < UPDATE_INTERVAL_MS && value < 0.98) {
        return;
      }
      lastUpdate = now;

      const curPrimary = interpolateValue(startPrimary, targetPrimary, value);
      const curIncome = interpolateValue(startIncome, targetIncome, value);
      const curSpent = interpolateValue(startSpent, targetSpent, value);

      curPrimaryRef.current = curPrimary;
      curIncomeRef.current = curIncome;
      curSpentRef.current = curSpent;

      setDisplayPrimaryAmount(curPrimary);
      setDisplayTotalAvailable(curIncome);
      setDisplayPeriodSpent(curSpent);
    });

    animation.start(({ finished }) => {
      if (finished && isMounted) {
        prevPrimaryRef.current = targetPrimary;
        prevIncomeRef.current = targetIncome;
        prevSpentRef.current = targetSpent;
        curPrimaryRef.current = targetPrimary;
        curIncomeRef.current = targetIncome;
        curSpentRef.current = targetSpent;
        setDisplayPrimaryAmount(targetPrimary);
        setDisplayTotalAvailable(targetIncome);
        setDisplayPeriodSpent(targetSpent);
      }
    });

    return () => {
      isMounted = false;
      countAnim.removeListener(listenerId);
      animation.stop();
      // On interruption, preserve actual presentation value rather than jumping to target
      prevPrimaryRef.current = curPrimaryRef.current;
      prevIncomeRef.current = curIncomeRef.current;
      prevSpentRef.current = curSpentRef.current;
    };
  }, [effectiveTargets, countAnim, morphAnim]);

  return (
    <View style={styles.outerWrapper}>
      {/* ── Main Container (Measures Content) ── */}
      <View style={styles.cardContainer} onLayout={handleLayout}>
        {/* ── SVG Notched Background ── */}
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="none"
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
            <Animated.View style={{ opacity: morphOpacity, transform: [{ translateY: morphTranslateY }] }}>
              <Text
                style={[
                  styles.primaryAmount,
                  {
                    color: effectiveIsOver ? colors.danger : textColorPrimary,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {formatCurrency(displayPrimaryAmount)}
              </Text>
            </Animated.View>

            {/* Subtext Chips (Budget mode only) */}
            {isBudgetModeEnabled && subtextParts.length > 0 && (
              <View style={styles.subtextContainer}>
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
                <Animated.View
                  style={[
                    styles.metricAmountRow,
                    { opacity: morphOpacity, transform: [{ translateY: morphTranslateY }] },
                  ]}
                >
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
                </Animated.View>
              </View>

              {/* Expense Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>
                  {`${filterLabelPrefix} Expense`}
                </Text>
                <Animated.View
                  style={[
                    styles.metricAmountRow,
                    { opacity: morphOpacity, transform: [{ translateY: morphTranslateY }] },
                  ]}
                >
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
                </Animated.View>
              </View>
            </View>
          ) : (
            /* Pure Mode: 2-Column Footer Row (Inflow +₹, Outflow −₹) */
            <View style={styles.metricsRow}>
              {/* Inflow Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>Inflow</Text>
                <Animated.View
                  style={[
                    styles.metricAmountRow,
                    { opacity: morphOpacity, transform: [{ translateY: morphTranslateY }] },
                  ]}
                >
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
                </Animated.View>
              </View>

              {/* Outflow Column */}
              <View style={styles.metricCol}>
                <Text style={styles.metricColLabel}>Outflow</Text>
                <Animated.View
                  style={[
                    styles.metricAmountRow,
                    { opacity: morphOpacity, transform: [{ translateY: morphTranslateY }] },
                  ]}
                >
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
                </Animated.View>
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
                {rolloverStripText}
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
  subtextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  subtextChip: {
    backgroundColor: 'rgba(26, 43, 76, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  subtextChipText: {
    fontSize: 12.5,
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
