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
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { ThemeColors, FontFamily, FontSize } from '../config/theme';
import { formatCurrency } from '../lib/formatters';

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
};

// Corner & layout geometry constants
const DEFAULT_WIDTH = 340;
const CORNER_RADIUS = 24;
const POD_SIZE = 80;
const GAP = 8;
const SCOOP_RADIUS = 22;

/**
 * Generates an SVG path for a card with an organic scooped notch in the top-right corner.
 * Tangent-continuous cubic Bézier curves ensure a seamless S-curve transition.
 */
function buildNotchedCardPath(
  w: number,
  h: number,
  r: number,
  podSize: number,
  gap: number,
  scoopRadius: number
): string {
  if (w <= 0 || h <= 0) return '';

  const shelfY = Math.min(podSize + gap, h - r * 2);
  const shelfX = Math.max(r * 2, w - podSize - gap);
  const scoopR = Math.min(scoopRadius, (shelfX - r) * 0.4, shelfY * 0.5);

  const startX = shelfX - scoopR;
  const endX = shelfX + scoopR;

  // Tangent continuous control points for S-curve
  const cp1X = startX + scoopR * 0.55;
  const cp1Y = 0;
  const cp2X = endX - scoopR * 0.55;
  const cp2Y = shelfY;

  return [
    `M ${r},0`,
    `L ${startX},0`,
    `C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${shelfY}`,
    `L ${w - r},${shelfY}`,
    `A ${r},${r} 0 0 1 ${w},${shelfY + r}`,
    `L ${w},${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    `L ${r},${h}`,
    `A ${r},${r} 0 0 1 0,${h - r}`,
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
}) => {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: 0,
  });

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
    return buildNotchedCardPath(dimensions.width, h, CORNER_RADIUS, POD_SIZE, GAP, SCOOP_RADIUS);
  }, [dimensions.width, dimensions.height]);

  const showRollover = activeFilter === 'Daily' && todayBudget > 0;

  // Curated Card Colors (Mint Green signature card)
  // Contrast: Dark Navy typography on Mint Green (#B8E0C8) provides 9.8:1 AAA contrast
  const mintBase = colors.mintGreen; // #B8E0C8
  const cardBorderColor = isDark ? 'rgba(184, 224, 200, 0.35)' : 'rgba(26, 43, 76, 0.12)';
  const textColorPrimary = '#1A2B4C';
  const textColorSecondary = 'rgba(26, 43, 76, 0.72)';
  const textMuted = 'rgba(26, 43, 76, 0.55)';
  const tileBg = 'rgba(255, 255, 255, 0.82)';
  const tileBorder = 'rgba(255, 255, 255, 0.95)';

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
          <View style={styles.topSection}>
            {/* Brand / Period Tag */}
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>ARTHIK</Text>
              <View style={styles.periodPill}>
                <Text style={styles.periodPillText}>{activeFilter.toUpperCase()}</Text>
              </View>
            </View>

            {/* Label & Amount */}
            <Text style={[styles.primaryLabel, { color: textColorSecondary }]}>
              {primaryLabel}
            </Text>
            <Text
              style={[
                styles.primaryAmount,
                { color: isOverBudgetPeriod ? colors.danger : textColorPrimary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(primaryAmount)}
            </Text>

            {primarySubtext ? (
              <Text
                style={[styles.primarySubtext, { color: textMuted }]}
                numberOfLines={2}
              >
                {primarySubtext}
              </Text>
            ) : null}
          </View>

          {/* Metric Tiles Row: Income & Spent */}
          <View style={styles.metricTilesRow}>
            {/* Income Tile */}
            <View style={[styles.metricTile, { backgroundColor: tileBg, borderColor: tileBorder }]}>
              <View style={styles.metricTileHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(21, 128, 61, 0.14)' }]}>
                  <ArrowDownLeft size={13} color="#15803D" />
                </View>
                <Text style={[styles.metricTileLabel, { color: '#15803D' }]}>Income</Text>
              </View>
              <Text
                style={[styles.metricTileAmount, { color: textColorPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {`+${formatCurrency(totalAvailable)}`}
              </Text>
            </View>

            {/* Spent Tile */}
            <View style={[styles.metricTile, { backgroundColor: tileBg, borderColor: tileBorder }]}>
              <View style={styles.metricTileHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(220, 38, 38, 0.14)' }]}>
                  <ArrowUpRight size={13} color="#DC2626" />
                </View>
                <Text style={[styles.metricTileLabel, { color: '#DC2626' }]}>Spent</Text>
              </View>
              <Text
                style={[styles.metricTileAmount, { color: textColorPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {`−${formatCurrency(periodSpent)}`}
              </Text>
            </View>
          </View>

          {/* Daily Gullak Rollover Strip */}
          {showRollover && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onNavigateSavings}
              style={[styles.rolloverStrip, { backgroundColor: tileBg, borderColor: tileBorder }]}
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
              backgroundColor: mintBase,
              borderColor: cardBorderColor,
            },
          ]}
          pointerEvents="none"
        >
          <DonutChart
            size={70}
            strokeWidth={9}
            spent={displaySpent}
            total={Math.max(totalAvailable, displaySpent)}
            colors={colors}
            trackColor="rgba(255, 255, 255, 0.65)"
            baseColor="rgba(255, 255, 255, 0.92)"
            spentColor={isOverBudgetPeriod ? '#EF4444' : '#E05A47'}
            textColor={isOverBudgetPeriod ? '#EF4444' : textColorPrimary}
            subtextColor={textColorSecondary}
          />
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
    // Leave room on the right for the notched chart pod
    paddingRight: POD_SIZE + GAP + 6,
    minHeight: 88,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  brandText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.2,
    color: '#1A2B4C',
  },
  periodPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
    backgroundColor: 'rgba(26, 43, 76, 0.08)',
  },
  periodPillText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: '#1A2B4C',
    letterSpacing: 0.5,
  },
  primaryLabel: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  primaryAmount: {
    fontSize: 29,
    fontFamily: FontFamily.bold,
    marginTop: 1,
    includeFontPadding: false,
  },
  primarySubtext: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginTop: 3,
    lineHeight: 15,
  },
  metricTilesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  metricTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  metricTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metricIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTileLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricTileAmount: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
  },
  rolloverStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
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
    width: POD_SIZE,
    height: POD_SIZE,
    borderRadius: POD_SIZE / 2,
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
