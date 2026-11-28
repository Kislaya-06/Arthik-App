export { DualRingState, computeDualRingState } from './charts/dualRing';

export { GullakMilestoneProgress, YearlyGullakMetrics, computeYearlyGullakMilestones } from './charts/gullakMilestones';

export { MonthlyCashFlowWeek, MonthlyCashFlowData, MonthlyCashFlowBudgetConfig, computeMonthlyCashFlowData } from './charts/monthlyCharts';

export { SegmentInterpolation, buildSegmentInterpolation, PreparedSegment, prepareCategorySegments, PreparedBlockSegment, generateRoundedBlockPath, generateFullAnnulusPath, prepareCategoryBlockSegments, PreparedBlockSweepSegment, prepareBlockSweepSegments } from './charts/donutSegments';

/**
 * Computes the fill height of a vertical capsule pill based on spend ratio.
 * Ensures zero amounts yield zero height, while non-zero amounts maintain
 * at least minFillHeight so the pill dome remains visible.
 */
export function calculatePillFillHeight(
  amount: number,
  maxAmount: number,
  trackHeight: number = 130,
  minFillHeight: number = 28
): number {
  if (amount <= 0 || maxAmount <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, amount / maxAmount));
  return Math.min(
    trackHeight,
    Math.round(minFillHeight + ratio * (trackHeight - minFillHeight))
  );
}

/**
 * Computes tint green highlight fill color based on spend ratio and highlight state.
 * Days with lower spend receive softer/deeper tint, while peak/selected days receive
 * vibrant, fully illuminated tint green.
 */
export function getSpendingFlowFillColor(
  ratio: number,
  isHighlighted: boolean,
  isDark: boolean,
  mintGreen: string = '#B8E0C8',
  mintGreenDark: string = '#7FB896'
): string {
  if (isDark) {
    if (isHighlighted) {
      return mintGreen;
    }
    const alpha = Math.min(0.85, Math.max(0.28, 0.22 + ratio * 0.65));
    return `rgba(184, 224, 200, ${alpha.toFixed(2)})`;
  } else {
    if (isHighlighted) {
      return mintGreenDark;
    }
    const alpha = Math.min(0.85, Math.max(0.32, 0.25 + ratio * 0.60));
    return `rgba(127, 184, 150, ${alpha.toFixed(2)})`;
  }
}

export interface CashFlowChartPalette {
  inColor: string;
  outColor: string;
  inGradStart: string;
  inGradEnd: string;
  outGradStart: string;
  outGradEnd: string;
  trackBg: string;
}

/**
 * Shared executive and harmonious color palette for Cash Flow and Yearly Cash Flow charts.
 */
export function getCashFlowChartColors(isDark: boolean): CashFlowChartPalette {
  return {
    inColor: isDark ? '#B8E0C8' : '#1A2B4C',
    outColor: isDark ? '#F4B8AE' : '#D9533B',
    inGradStart: isDark ? '#B8E0C8' : '#7CD49A',
    inGradEnd: isDark ? '#65A882' : '#2E8C4A',
    outGradStart: isDark ? '#FBCAC1' : '#F59682',
    outGradEnd: isDark ? '#D9533B' : '#C1412A',
    trackBg: isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.035)',
  };
}

/**
 * Compact Rupee formatter for tight cash flow pods and badges (e.g. ₹1.5k, ₹25k, ₹1.2L).
 */
export function formatCompactRupee(val: number): string {
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

