import { format, parseISO, addDays, isAfter, differenceInCalendarDays } from 'date-fns';
import { formatCompactCurrency, formatCurrency, round2 } from './formatters';

export interface SegmentInterpolation {
  inputRange: number[];
  outputRange: number[];
}

/**
 * Calculates strictly monotonically increasing inputRange and corresponding outputRange
 * for animating an individual segment's strokeDashoffset during a continuous circle sweep (0 to 1).
 *
 * @param startFraction Fraction where the segment begins (0 to 1)
 * @param endFraction Fraction where the segment ends (0 to 1)
 * @param arcLength Total pixel length of the segment's arc
 */
export function buildSegmentInterpolation(
  startFraction: number,
  endFraction: number,
  arcLength: number
): SegmentInterpolation {
  if (arcLength <= 0 || endFraction <= startFraction) {
    return {
      inputRange: [0, 1],
      outputRange: [0, 0],
    };
  }

  const s = Math.max(0, Math.min(1, startFraction));
  const e = Math.max(s + 0.0001, Math.min(1, endFraction));

  // Case 1: Full circle single segment
  if (s <= 0.0001 && e >= 0.9999) {
    return {
      inputRange: [0, 1],
      outputRange: [arcLength, 0],
    };
  }

  // Case 2: First segment starting at 0
  if (s <= 0.0001 && e < 0.9999) {
    const safeEnd = Math.max(0.001, Math.min(0.999, Number(e.toFixed(4))));
    return {
      inputRange: [0, safeEnd, 1],
      outputRange: [arcLength, 0, 0],
    };
  }

  // Case 3: Final segment ending at 1
  if (s > 0.0001 && e >= 0.9999) {
    const safeStart = Math.max(0.001, Math.min(0.999, Number(s.toFixed(4))));
    return {
      inputRange: [0, safeStart, 1],
      outputRange: [arcLength, arcLength, 0],
    };
  }

  // Case 4: Intermediate segment (0 < s < e < 1)
  const safeS = Math.max(0.001, Math.min(0.998, Number(s.toFixed(4))));
  let safeE = Math.max(safeS + 0.001, Math.min(0.999, Number(e.toFixed(4))));

  return {
    inputRange: [0, safeS, safeE, 1],
    outputRange: [arcLength, arcLength, 0, 0],
  };
}

export interface PreparedSegment {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  fraction: number;
  arcLength: number;
  startAngle: number;
  strokeDasharray: string;
  transform: string;
  interpolation: SegmentInterpolation;
}

/**
 * Prepares geometry, rotation angles, and sweep offsets for all donut segments.
 */
export function prepareCategorySegments(
  categories: Array<{ id: string; name: string; amount: number; percentage: number }>,
  totalAmount: number,
  palette: readonly string[],
  size: number,
  strokeWidth: number
): PreparedSegment[] {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativeFraction = 0;

  return categories.map((cat, index) => {
    const fraction = totalAmount > 0 ? cat.amount / totalAmount : 0;
    const arcLength = fraction * circumference;
    const startFraction = cumulativeFraction;
    const endFraction = cumulativeFraction + fraction;
    const startAngle = -90 + startFraction * 360;

    cumulativeFraction += fraction;

    const interpolation = buildSegmentInterpolation(startFraction, endFraction, arcLength);

    return {
      ...cat,
      color: (cat as any).color || palette[index % palette.length],
      fraction,
      arcLength,
      startAngle,
      strokeDasharray: `${arcLength} ${circumference}`,
      transform: `rotate(${startAngle}, ${center}, ${center})`,
      interpolation,
    };
  });
}

export interface PreparedBlockSegment {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  fraction: number;
  startAngle: number;
  endAngle: number;
  path: string;
}

/**
 * Generates an SVG path for a block-wise donut segment with smooth rounded corners.
 *
 * @param cx Center X
 * @param cy Center Y
 * @param rInner Inner radius
 * @param rOuter Outer radius
 * @param startAngleDeg Start angle in degrees (-90 is 12 o'clock)
 * @param endAngleDeg End angle in degrees
 * @param gapDeg Angular gap between adjacent blocks
 * @param cornerRadius Corner radius for the 4 corners of the block
 */
export function generateRoundedBlockPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngleDeg: number,
  endAngleDeg: number,
  gapDeg: number = 4,
  cornerRadius: number = 6
): string {
  const deg2rad = Math.PI / 180;
  const totalSpan = endAngleDeg - startAngleDeg;
  if (totalSpan <= gapDeg) return '';

  const effectiveStartDeg = startAngleDeg + gapDeg / 2;
  const effectiveEndDeg = endAngleDeg - gapDeg / 2;
  const a0 = effectiveStartDeg * deg2rad;
  const a1 = effectiveEndDeg * deg2rad;
  const spanRad = a1 - a0;

  // Max allowable corner radius so corners don't collide
  const maxCornerRadial = (rOuter - rInner) / 2;
  const maxCornerAngular = (rInner * spanRad) / 2;
  const rc = Math.max(0.5, Math.min(cornerRadius, maxCornerRadial, maxCornerAngular));

  const dThetaO = rc / rOuter;
  const dThetaI = rc / rInner;

  const largeArc = (a1 - a0) > Math.PI ? 1 : 0;

  // Outer start & end points
  const p0x = cx + rOuter * Math.cos(a0 + dThetaO);
  const p0y = cy + rOuter * Math.sin(a0 + dThetaO);

  const p1x = cx + rOuter * Math.cos(a1 - dThetaO);
  const p1y = cy + rOuter * Math.sin(a1 - dThetaO);

  // Outer-end corner control vertex & landing on radial edge
  const v1x = cx + rOuter * Math.cos(a1);
  const v1y = cy + rOuter * Math.sin(a1);

  const p2x = cx + (rOuter - rc) * Math.cos(a1);
  const p2y = cy + (rOuter - rc) * Math.sin(a1);

  // Radial landing near inner-end
  const p3x = cx + (rInner + rc) * Math.cos(a1);
  const p3y = cy + (rInner + rc) * Math.sin(a1);

  // Inner-end corner control vertex & landing on inner arc
  const vIn1x = cx + rInner * Math.cos(a1);
  const vIn1y = cy + rInner * Math.sin(a1);

  const p4x = cx + rInner * Math.cos(a1 - dThetaI);
  const p4y = cy + rInner * Math.sin(a1 - dThetaI);

  // Inner start point (landing after inner arc sweep)
  const p5x = cx + rInner * Math.cos(a0 + dThetaI);
  const p5y = cy + rInner * Math.sin(a0 + dThetaI);

  // Inner-start corner control vertex & landing on radial start edge
  const vIn0x = cx + rInner * Math.cos(a0);
  const vIn0y = cy + rInner * Math.sin(a0);

  const p6x = cx + (rInner + rc) * Math.cos(a0);
  const p6y = cy + (rInner + rc) * Math.sin(a0);

  // Radial landing near outer-start
  const p7x = cx + (rOuter - rc) * Math.cos(a0);
  const p7y = cy + (rOuter - rc) * Math.sin(a0);

  // Outer-start corner control vertex
  const v0x = cx + rOuter * Math.cos(a0);
  const v0y = cy + rOuter * Math.sin(a0);

  const f = (n: number) => Number(n.toFixed(2));

  return [
    `M ${f(p0x)} ${f(p0y)}`,
    `A ${f(rOuter)} ${f(rOuter)} 0 ${largeArc} 1 ${f(p1x)} ${f(p1y)}`,
    `Q ${f(v1x)} ${f(v1y)} ${f(p2x)} ${f(p2y)}`,
    `L ${f(p3x)} ${f(p3y)}`,
    `Q ${f(vIn1x)} ${f(vIn1y)} ${f(p4x)} ${f(p4y)}`,
    `A ${f(rInner)} ${f(rInner)} 0 ${largeArc} 0 ${f(p5x)} ${f(p5y)}`,
    `Q ${f(vIn0x)} ${f(vIn0y)} ${f(p6x)} ${f(p6y)}`,
    `L ${f(p7x)} ${f(p7y)}`,
    `Q ${f(v0x)} ${f(v0y)} ${f(p0x)} ${f(p0y)}`,
    'Z',
  ].join(' ');
}

/**
 * Generates an SVG path for a 100% complete, seamless 360-degree donut ring (annulus) with NO gaps or cuts.
 * Uses concentric arcs (counter-clockwise outer, clockwise inner) to produce a hollow circular ring.
 */
export function generateFullAnnulusPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number
): string {
  const f = (n: number) => Number(n.toFixed(2));
  return [
    `M ${f(cx)} ${f(cy - rOuter)}`,
    `A ${f(rOuter)} ${f(rOuter)} 0 1 0 ${f(cx)} ${f(cy + rOuter)}`,
    `A ${f(rOuter)} ${f(rOuter)} 0 1 0 ${f(cx)} ${f(cy - rOuter)}`,
    `M ${f(cx)} ${f(cy - rInner)}`,
    `A ${f(rInner)} ${f(rInner)} 0 1 1 ${f(cx)} ${f(cy + rInner)}`,
    `A ${f(rInner)} ${f(rInner)} 0 1 1 ${f(cx)} ${f(cy - rInner)}`,
    'Z',
  ].join(' ');
}

/**
 * Prepares block-wise donut segments with proportional angles, minimum display clamps,
 * uniform gaps, and smooth rounded corners.
 */
export function prepareCategoryBlockSegments(
  categories: Array<{ id: string; name: string; amount: number; percentage: number; color?: string }>,
  totalAmount: number,
  palette: readonly string[],
  size: number = 220,
  strokeWidth: number = 28,
  gapDeg: number = 5,
  cornerRadius: number = 7
): PreparedBlockSegment[] {
  if (!categories || categories.length === 0 || totalAmount <= 0) return [];

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - strokeWidth;

  const positiveCats = categories.filter((c) => c.amount > 0);
  if (categories.length === 1 || positiveCats.length === 1) {
    const singleCat = positiveCats[0] || categories[0];
    const path = generateFullAnnulusPath(cx, cy, rInner, rOuter);
    return [{
      ...singleCat,
      color: singleCat.color || palette[0] || '#FF857A',
      fraction: 1,
      startAngle: -90,
      endAngle: 270,
      path,
    }];
  }

  const n = categories.length;
  const effectiveGap = Math.min(gapDeg, Math.max(2, Math.floor(360 / (n * 3))));
  const minBlockDeg = 8;
  const effectiveMin = Math.min(minBlockDeg, Math.max(4, Math.floor((360 - n * effectiveGap) / n)));

  const rawSpans = categories.map((c) =>
    totalAmount > 0 ? (c.amount / totalAmount) * 360 : 0
  );

  let allocated = 0;
  const spans = rawSpans.map((s) => {
    const span = Math.max(effectiveMin + effectiveGap, s);
    allocated += span;
    return span;
  });

  const scale = 360 / allocated;
  const scaledSpans = spans.map((s) => s * scale);

  let curAngle = -90;
  return categories.map((cat, i) => {
    const startAngle = curAngle;
    const endAngle = curAngle + scaledSpans[i];
    curAngle = endAngle;

    const path = generateRoundedBlockPath(
      cx,
      cy,
      rInner,
      rOuter,
      startAngle,
      endAngle,
      effectiveGap,
      cornerRadius
    );

    return {
      ...cat,
      color: cat.color || palette[i % palette.length],
      fraction: totalAmount > 0 ? cat.amount / totalAmount : 0,
      startAngle,
      endAngle,
      path,
    };
  });
}

export interface PreparedBlockSweepSegment {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  fraction: number;
  strokeStartAngle: number;
  strokeArcLength: number;
  strokeDasharray: string;
  transform: string;
  startFraction: number;
  endFraction: number;
  offsetInterpolation: {
    inputRange: number[];
    outputRange: number[];
  };
  opacityInterpolation: {
    inputRange: number[];
    outputRange: number[];
  };
}

/**
 * Prepares block-wise donut segments designed for a smooth, continuous clockwise
 * sweep animation ("round sweep") with rounded capsule ends and uniform gaps between blocks.
 */
export function prepareBlockSweepSegments(
  categories: Array<{ id: string; name: string; amount: number; percentage: number }>,
  totalAmount: number,
  palette: readonly string[],
  size: number = 220,
  strokeWidth: number = 26,
  gapDeg: number = 6
): PreparedBlockSweepSegment[] {
  if (!categories || categories.length === 0 || totalAmount <= 0) return [];

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const capAngleDeg = ((strokeWidth / 2) / radius) * (180 / Math.PI);

  const n = categories.length;

  if (n === 1) {
    const strokeArcLength = Math.max(0.1, circumference - strokeWidth);
    return [{
      ...categories[0],
      color: (categories[0] as any).color || palette[0] || '#FF857A',
      fraction: 1,
      strokeStartAngle: -90 + capAngleDeg,
      strokeArcLength,
      strokeDasharray: `${strokeArcLength} ${circumference}`,
      transform: `rotate(${-90 + capAngleDeg}, ${center}, ${center})`,
      startFraction: 0,
      endFraction: 1,
      offsetInterpolation: {
        inputRange: [0, 1],
        outputRange: [strokeArcLength, 0],
      },
      opacityInterpolation: {
        inputRange: [0, 1],
        outputRange: [1, 1],
      },
    }];
  }

  const effectiveGap = Math.min(gapDeg, Math.max(3, Math.floor(360 / (n * 3))));
  const totalGap = n * effectiveGap;
  const availableSpan = 360 - totalGap;

  // Minimum visible span so even 1% category has room for rounded caps
  const minSpan = Math.max(16, (strokeWidth / radius) * (180 / Math.PI) + 4);
  const rawSpans = categories.map((c) =>
    totalAmount > 0 ? (c.amount / totalAmount) * availableSpan : 0
  );

  let allocated = 0;
  const spans = rawSpans.map((s) => {
    const span = Math.max(minSpan, s);
    allocated += span;
    return span;
  });

  const scale = availableSpan / allocated;
  const scaledSpans = spans.map((s) => s * scale);

  let curTipAngle = -90;
  return categories.map((cat, i) => {
    const spanDeg = scaledSpans[i];
    const tipStartAngle = curTipAngle;
    const strokeStartAngle = tipStartAngle + capAngleDeg;

    const visibleArcLength = (spanDeg / 360) * circumference;
    const strokeArcLength = Math.max(0.1, visibleArcLength - strokeWidth);

    const startFraction = (tipStartAngle - (-90)) / 360;
    const endFraction = (tipStartAngle + spanDeg - (-90)) / 360;

    curTipAngle += spanDeg + effectiveGap;

    const sF = Math.max(0, Math.min(0.998, Number(startFraction.toFixed(4))));
    const eF = Math.max(sF + 0.001, Math.min(1, Number(endFraction.toFixed(4))));

    // Monotonically increasing offset interpolation
    const offsetInputRange = [0];
    const offsetOutputRange = [strokeArcLength];
    if (sF > 0.0001) {
      offsetInputRange.push(sF);
      offsetOutputRange.push(strokeArcLength);
    }
    offsetInputRange.push(eF);
    offsetOutputRange.push(0);
    if (eF < 0.9999) {
      offsetInputRange.push(1);
      offsetOutputRange.push(0);
    }

    // Opacity interpolation so cap doesn't show before sweep reaches it
    const opacityInputRange = [0];
    const opacityOutputRange = [sF <= 0.0001 ? 1 : 0];
    if (sF > 0.001) {
      opacityInputRange.push(sF - 0.0005);
      opacityOutputRange.push(0);
      opacityInputRange.push(sF);
      opacityOutputRange.push(1);
    }
    opacityInputRange.push(1);
    opacityOutputRange.push(1);

    return {
      ...cat,
      color: (cat as any).color || palette[i % palette.length],
      fraction: totalAmount > 0 ? cat.amount / totalAmount : 0,
      strokeStartAngle,
      strokeArcLength,
      strokeDasharray: `${strokeArcLength} ${circumference}`,
      transform: `rotate(${strokeStartAngle}, ${center}, ${center})`,
      startFraction: sF,
      endFraction: eF,
      offsetInterpolation: {
        inputRange: offsetInputRange,
        outputRange: offsetOutputRange,
      },
      opacityInterpolation: {
        inputRange: opacityInputRange,
        outputRange: opacityOutputRange,
      },
    };
  });
}

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

export interface MonthlyWeekSpending {
  day: string; // 'W1', 'W2', 'W3', 'W4'
  dateStr: string; // 'yyyy-MM-dd' (earliest date in week with spending, or start date if none)
  startDate: string; // 'yyyy-MM-dd'
  endDate: string; // 'yyyy-MM-dd'
  amount: number;
  subLabel: string; // e.g. '1–7', '8–14', '15–21', '22–30'
}

/**
 * Splits a calendar month into exactly 4 consecutive weeks (W1–W4)
 * and calculates total non-income spending for each week.
 *
 * W1: 1–7
 * W2: 8–14
 * W3: 15–21
 * W4: 22 to end of month (e.g. 22–30, 22–31, or 22–28)
 *
 * If userCreatedAtStr is provided, any weeks ending before user registration
 * or expenses prior to registration date are excluded (0 spending).
 */
export function computeMonthlyWeeksData(
  monthStart: Date,
  monthEnd: Date,
  expenses: Array<{ amount: number; expense_date: string; category_id?: string | null }>,
  isIncomeCheck?: (expense: any) => boolean,
  userCreatedAtStr?: string
): { weeks: MonthlyWeekSpending[]; maxWeek: MonthlyWeekSpending | null } {
  const weeks: MonthlyWeekSpending[] = [];
  const endDay = monthEnd.getDate(); // 28, 29, 30, or 31

  const weekRanges: Array<{ label: string; startDay: number; endDay: number }> = [
    { label: 'W1', startDay: 1, endDay: Math.min(7, endDay) },
    { label: 'W2', startDay: 8, endDay: Math.min(14, endDay) },
    { label: 'W3', startDay: 15, endDay: Math.min(21, endDay) },
    { label: 'W4', startDay: 22, endDay },
  ];

  for (const range of weekRanges) {
    const rangeStart = addDays(monthStart, range.startDay - 1);
    const rangeEnd = addDays(monthStart, range.endDay - 1);
    const startStr = format(rangeStart, 'yyyy-MM-dd');
    const endStr = format(rangeEnd, 'yyyy-MM-dd');

    // If the entire week range ended strictly before account registration, amount is strictly 0
    if (userCreatedAtStr && endStr < userCreatedAtStr) {
      weeks.push({
        day: range.label,
        dateStr: startStr,
        startDate: startStr,
        endDate: endStr,
        amount: 0,
        subLabel: `${range.startDay}–${range.endDay}`,
      });
      continue;
    }

    let sum = 0;
    for (const exp of expenses) {
      if (isIncomeCheck && isIncomeCheck(exp)) continue;
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      // Exclude expenses before account registration
      if (userCreatedAtStr && cleanDate < userCreatedAtStr) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        sum += exp.amount;
      }
    }

    // Find the first date in [rangeStart..rangeEnd] that actually has spending (ascending order)
    let firstSpendingDate: string | null = null;
    let curDay = rangeStart;
    while (!isAfter(curDay, rangeEnd)) {
      const curStr = format(curDay, 'yyyy-MM-dd');
      const hasExpense = expenses.some((exp) => {
        if (isIncomeCheck && isIncomeCheck(exp)) return false;
        const cleanDate = exp.expense_date?.split('T')[0]?.trim();
        if (!cleanDate) return false;
        if (userCreatedAtStr && cleanDate < userCreatedAtStr) return false;
        return cleanDate === curStr && exp.amount > 0;
      });

      if (hasExpense) {
        firstSpendingDate = curStr;
        break;
      }
      curDay = addDays(curDay, 1);
    }

    weeks.push({
      day: range.label,
      dateStr: firstSpendingDate || startStr,
      startDate: startStr,
      endDate: endStr,
      amount: sum,
      subLabel: `${range.startDay}–${range.endDay}`,
    });
  }

  const maxWeek = weeks.reduce((max, w) => (w.amount > max.amount ? w : max), weeks[0]);
  return { weeks, maxWeek: maxWeek.amount > 0 ? maxWeek : null };
}

export interface MonthlyCashFlowWeek {
  day: string; // 'W1', 'W2', 'W3', 'W4'
  subLabel: string; // '1–7', '8–14', '15–21', '22–30'
  income: number;
  spent: number;
  dateStr: string; // earliest date in week with transaction, or startStr
  startDate: string;
  endDate: string;
}

export interface MonthlyCashFlowData {
  weeks: MonthlyCashFlowWeek[];
  totalIncome: number;
  totalSpent: number;
  maxAmount: number;
}

/**
 * Computes 4-week dual-bar cash flow breakdown (Income vs Spent) for a calendar month.
 * W1: 1–7
 * W2: 8–14
 * W3: 15–21
 * W4: 22 to end of month (22–30, 22–31, etc.)
 */
export interface MonthlyCashFlowBudgetConfig {
  isBudgetMode: boolean;
  cadence?: 'daily' | 'weekly' | 'monthly';
  dailyBudgetAmount?: number;
  weeklyBudgetAmount?: number;
  monthlyBudgetAmount?: number;
}

export function computeMonthlyCashFlowData(
  monthStart: Date,
  monthEnd: Date,
  expenses: Array<{ amount: number; expense_date: string; type?: string; category_id?: string | null }>,
  gullakDeposits: Array<{ date: string; amount: number; source?: string }>,
  isIncomeCheck?: (expense: any) => boolean,
  userCreatedAtStr?: string,
  budgetConfig?: MonthlyCashFlowBudgetConfig,
  referenceDate: Date = new Date()
): MonthlyCashFlowData {
  const weeks: MonthlyCashFlowWeek[] = [];
  const endDay = monthEnd.getDate();
  const totalDaysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1;

  const weekRanges: Array<{ label: string; startDay: number; endDay: number }> = [
    { label: 'W1', startDay: 1, endDay: Math.min(7, endDay) },
    { label: 'W2', startDay: 8, endDay: Math.min(14, endDay) },
    { label: 'W3', startDay: 15, endDay: Math.min(21, endDay) },
    { label: 'W4', startDay: 22, endDay },
  ];

  let totalIncome = 0;
  let totalSpent = 0;

  for (const range of weekRanges) {
    const rangeStart = addDays(monthStart, range.startDay - 1);
    const rangeEnd = addDays(monthStart, range.endDay - 1);
    const startStr = format(rangeStart, 'yyyy-MM-dd');
    const endStr = format(rangeEnd, 'yyyy-MM-dd');

    if (userCreatedAtStr && endStr < userCreatedAtStr) {
      weeks.push({
        day: range.label,
        subLabel: `${range.startDay}–${range.endDay}`,
        income: 0,
        spent: 0,
        dateStr: startStr,
        startDate: startStr,
        endDate: endStr,
      });
      continue;
    }

    let weekIncome = 0;
    let weekSpent = 0;

    // 1. Budget Allowance Allocation (when Budget Mode is ON)
    // Only elapsed days up to today receive operational liquidity; future weeks remain empty until reached.
    if (budgetConfig?.isBudgetMode) {
      const todayStr = format(referenceDate, 'yyyy-MM-dd');
      let activeDaysInRange = 0;

      let d = rangeStart;
      while (!isAfter(d, rangeEnd)) {
        const dStr = format(d, 'yyyy-MM-dd');
        const isAfterCreated = !userCreatedAtStr || dStr >= userCreatedAtStr;
        const isElapsed = dStr <= todayStr;

        if (isAfterCreated && isElapsed) {
          activeDaysInRange++;
        }
        d = addDays(d, 1);
      }

      if (activeDaysInRange > 0) {
        let dailyRate = 0;
        if (budgetConfig.cadence === 'monthly') {
          dailyRate = (budgetConfig.monthlyBudgetAmount || 0) / totalDaysInMonth;
        } else if (budgetConfig.cadence === 'weekly') {
          dailyRate = (budgetConfig.weeklyBudgetAmount || 0) / 7;
        } else {
          // daily cadence (default)
          dailyRate = budgetConfig.dailyBudgetAmount || 0;
        }
        weekIncome += Math.round(dailyRate * activeDaysInRange);
      }
    }

    // 2. Direct Income Transactions
    for (const exp of expenses) {
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (userCreatedAtStr && cleanDate < userCreatedAtStr) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        const isIncome = isIncomeCheck ? isIncomeCheck(exp) : exp.type === 'income';
        if (isIncome) {
          weekIncome += exp.amount;
        } else {
          weekSpent += exp.amount;
        }
      }
    }

    // 3. External Gullak Deposits
    for (const dep of gullakDeposits) {
      const cleanDate = dep.date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (userCreatedAtStr && cleanDate < userCreatedAtStr) continue;

      if (cleanDate >= startStr && cleanDate <= endStr) {
        if (dep.source === 'external') {
          weekIncome += dep.amount;
        }
      }
    }

    // Find the first date in [rangeStart..rangeEnd] that has an event (ascending order)
    let firstEventDate: string | null = null;
    let curDay = rangeStart;
    while (!isAfter(curDay, rangeEnd)) {
      const curStr = format(curDay, 'yyyy-MM-dd');
      const hasExp = expenses.some((exp) => {
        const c = exp.expense_date?.split('T')[0]?.trim();
        return c === curStr && (!userCreatedAtStr || c >= userCreatedAtStr) && exp.amount > 0;
      });
      const hasDep = gullakDeposits.some((dep) => {
        const c = dep.date?.split('T')[0]?.trim();
        return c === curStr && (!userCreatedAtStr || c >= userCreatedAtStr) && dep.amount > 0;
      });

      if (hasExp || hasDep) {
        firstEventDate = curStr;
        break;
      }
      curDay = addDays(curDay, 1);
    }

    totalIncome += weekIncome;
    totalSpent += weekSpent;

    weeks.push({
      day: range.label,
      subLabel: `${range.startDay}–${range.endDay}`,
      income: weekIncome,
      spent: weekSpent,
      dateStr: firstEventDate || startStr,
      startDate: startStr,
      endDate: endStr,
    });
  }

  totalIncome = round2(totalIncome);
  totalSpent = round2(totalSpent);

  const maxAmount = Math.max(
    ...weeks.map((w) => Math.max(w.income, w.spent)),
    0
  );

  return {
    weeks,
    totalIncome,
    totalSpent,
    maxAmount,
  };
}

export interface GullakMilestoneProgress {
  currentTierName: string;
  nextTierName: string;
  nextTierAmount: number;
  progressRatio: number;
  remainingAmount: number;
}

export interface YearlyGullakMetrics {
  totalSavedInYear: number;
  annualRolloverSavings: number;
  annualDirectDeposits: number;
  bestSavingsMonth: { month: string; amount: number };
  bestStreakInYear: number;
  milestone: GullakMilestoneProgress;
}

const MILESTONES = [
  { amount: 1000, name: 'Starter Piggy' },
  { amount: 5000, name: 'Smart Builder' },
  { amount: 10000, name: 'Silver Vault' },
  { amount: 25000, name: 'Gold Treasury' },
  { amount: 50000, name: 'Diamond Safe' },
  { amount: 100000, name: 'Wealth Champion' },
];

/**
 * Aggregates annual Gullak savings, calculates best savings month,
 * highest savings streak in that year, and evaluates gamified milestone progress.
 */
export function computeYearlyGullakMilestones(
  yearStart: Date,
  yearEnd: Date,
  dailyRecords: Array<{ date: string; saved: number; status: string }>,
  gullakDeposits: Array<{ date: string; amount: number }>,
  allTimeGullakSavings: number,
  budgetPeriods?: Array<{ activeStart: string; amountSaved: number; status: string }>
): YearlyGullakMetrics {
  const startStr = format(yearStart, 'yyyy-MM-dd');
  const endStr = format(yearEnd, 'yyyy-MM-dd');

  let rolloverSum = 0;
  const monthSavings: Record<string, number> = {};

  const sortedRecords = dailyRecords
    .filter((r) => r.date >= startStr && r.date <= endStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  let currentStreak = 0;
  let bestStreakInYear = 0;

  for (const r of sortedRecords) {
    if (r.status === 'saved' && r.saved > 0) {
      rolloverSum += r.saved;
      currentStreak += 1;
      if (currentStreak > bestStreakInYear) {
        bestStreakInYear = currentStreak;
      }
      const m = format(parseISO(r.date), 'MMMM');
      monthSavings[m] = (monthSavings[m] || 0) + r.saved;
    } else {
      currentStreak = 0;
    }
  }

  // Include weekly and monthly period savings
  if (budgetPeriods && budgetPeriods.length > 0) {
    for (const p of budgetPeriods) {
      if (p.activeStart >= startStr && p.activeStart <= endStr && p.amountSaved > 0) {
        rolloverSum += p.amountSaved;
        const m = format(parseISO(p.activeStart), 'MMMM');
        monthSavings[m] = (monthSavings[m] || 0) + p.amountSaved;
      }
    }
  }

  let depositsSum = 0;
  for (const d of gullakDeposits) {
    if (d.date >= startStr && d.date <= endStr) {
      depositsSum += d.amount;
      const m = format(parseISO(d.date), 'MMMM');
      monthSavings[m] = (monthSavings[m] || 0) + d.amount;
    }
  }

  const totalSavedInYear = rolloverSum + depositsSum;

  let bestMonth = 'None';
  let bestMonthAmount = 0;
  for (const [month, amt] of Object.entries(monthSavings)) {
    if (amt > bestMonthAmount) {
      bestMonthAmount = amt;
      bestMonth = month;
    }
  }

  const effectiveSavings = Math.max(allTimeGullakSavings, totalSavedInYear);
  let currentTierName = 'Seed Saver';
  let nextTierName = MILESTONES[0].name;
  let nextTierAmount = MILESTONES[0].amount;

  for (let i = 0; i < MILESTONES.length; i++) {
    if (effectiveSavings >= MILESTONES[i].amount) {
      currentTierName = MILESTONES[i].name;
      if (i + 1 < MILESTONES.length) {
        nextTierName = MILESTONES[i + 1].name;
        nextTierAmount = MILESTONES[i + 1].amount;
      } else {
        nextTierName = 'Max Milestone Unlocked! 🎉';
        nextTierAmount = MILESTONES[i].amount;
      }
    } else {
      nextTierName = MILESTONES[i].name;
      nextTierAmount = MILESTONES[i].amount;
      break;
    }
  }

  const prevTierAmount =
    effectiveSavings >= nextTierAmount
      ? nextTierAmount
      : MILESTONES.find((m) => m.name === currentTierName)?.amount || 0;

  const rangeSpan = Math.max(1, nextTierAmount - prevTierAmount);
  const progressRatio =
    effectiveSavings >= nextTierAmount
      ? 1
      : Math.min(1, Math.max(0, (effectiveSavings - prevTierAmount) / rangeSpan));
  const remainingAmount = Math.max(0, nextTierAmount - effectiveSavings);

  return {
    totalSavedInYear,
    annualRolloverSavings: rolloverSum,
    annualDirectDeposits: depositsSum,
    bestSavingsMonth: { month: bestMonth, amount: bestMonthAmount },
    bestStreakInYear,
    milestone: {
      currentTierName,
      nextTierName,
      nextTierAmount,
      progressRatio,
      remainingAmount,
    },
  };
}

export interface DualRingState {
  outerProgress: number;     // 0 to 1
  innerProgress: number;     // 0 to 1
  outerColor: string;        // Mint inflow (#10B981)
  innerColor: string;        // Coral outflow (#E05A47) or Red (#EF4444) when spent > income
  centerPrimary: string;     // Top text in center hole (e.g. "45%", "125%", "999%+", "₹500", "₹0")
  centerSecondary?: string;  // Bottom label in center hole (e.g. "spent" or undefined for "₹0")
  centerText: string;        // Full combined string (e.g. "45% spent", "₹0", "₹500 spent")
  percentage: number | null; // e.g. 45, 125, null when income is 0
  isOverIncome: boolean;     // true when spent > income (or spent > 0 when income = 0)
  accessibilityLabel: string;
}

/**
 * Computes the concentric dual-ring visualization state strictly adhering to Table D9:
 * 
 * | Income | Spent | Outer (green) | Inner | Center text |
 * |---|---|---|---|---|
 * | 0 | 0 | faint track (0) | faint track (0) | `₹0` |
 * | 0 | >0 | faint track (0) | 100% coral (1.0) | `₹X spent` (no %, divide-by-zero) |
 * | >0 | ≤ income | 100% (1.0) | spent/income % coral | `45% spent` |
 * | >0 | > income | 100% (1.0) | 100% red (#EF4444) | `125% spent`, cap `999%+` |
 */
export function computeDualRingState(
  income: number,
  spent: number
): DualRingState {
  const safeIncome = Math.max(0, Number(income) || 0);
  const safeSpent = Math.max(0, Number(spent) || 0);

  const MINT_COLOR = '#10B981';
  const CORAL_COLOR = '#E05A47';
  const RED_COLOR = '#EF4444';

  // D9 Row 1: 0 Income, 0 Spent
  if (safeIncome === 0 && safeSpent === 0) {
    return {
      outerProgress: 0,
      innerProgress: 0,
      outerColor: MINT_COLOR,
      innerColor: CORAL_COLOR,
      centerPrimary: '₹0',
      centerSecondary: undefined,
      centerText: '₹0',
      percentage: null,
      isOverIncome: false,
      accessibilityLabel: 'No income and no expenses. ₹0.',
    };
  }

  // D9 Row 2: 0 Income, >0 Spent (No %, divide-by-zero)
  if (safeIncome === 0 && safeSpent > 0) {
    const compactSpent = formatCompactCurrency(safeSpent);
    return {
      outerProgress: 0,
      innerProgress: 1,
      outerColor: MINT_COLOR,
      innerColor: CORAL_COLOR,
      centerPrimary: compactSpent,
      centerSecondary: 'spent',
      centerText: `${compactSpent} spent`,
      percentage: null,
      isOverIncome: true,
      accessibilityLabel: `Income ₹0, spent ${formatCurrency(safeSpent)}.`,
    };
  }

  // safeIncome > 0
  const isOver = safeSpent > safeIncome;
  const ratio = safeSpent / safeIncome;
  const rawPercentage = Math.round(ratio * 100);

  // D9 Row 4: >0 Income, > income Spent
  if (isOver) {
    const isCapped = rawPercentage > 999;
    const pctStr = isCapped ? '999%+' : `${rawPercentage}%`;
    return {
      outerProgress: 1,
      innerProgress: 1,
      outerColor: MINT_COLOR,
      innerColor: RED_COLOR,
      centerPrimary: pctStr,
      centerSecondary: 'spent',
      centerText: `${pctStr} spent`,
      percentage: rawPercentage,
      isOverIncome: true,
      accessibilityLabel: `Inflow ${formatCurrency(safeIncome)}, outflow ${formatCurrency(safeSpent)}, ${pctStr} spent. Over income.`,
    };
  }

  // D9 Row 3: >0 Income, ≤ income Spent
  const innerProgress = round2(Math.min(1, Math.max(0, ratio)));
  return {
    outerProgress: 1,
    innerProgress,
    outerColor: MINT_COLOR,
    innerColor: CORAL_COLOR,
    centerPrimary: `${rawPercentage}%`,
    centerSecondary: 'spent',
    centerText: `${rawPercentage}% spent`,
    percentage: rawPercentage,
    isOverIncome: false,
    accessibilityLabel: `Inflow ${formatCurrency(safeIncome)}, outflow ${formatCurrency(safeSpent)}, ${rawPercentage}% spent.`,
  };
}

