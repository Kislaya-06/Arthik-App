

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
  categories: Array<{ id: string; name: string; amount: number; percentage: number; color?: string }>,
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
      color: cat.color || palette[index % palette.length],
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

  // Exact arc spans between the rounded corner tangent points
  const outerArcSpan = (a1 - dThetaO) - (a0 + dThetaO);
  const innerArcSpan = (a1 - dThetaI) - (a0 + dThetaI);
  const largeArcOuter = outerArcSpan > Math.PI ? 1 : 0;
  const largeArcInner = innerArcSpan > Math.PI ? 1 : 0;

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
    `A ${f(rOuter)} ${f(rOuter)} 0 ${largeArcOuter} 1 ${f(p1x)} ${f(p1y)}`,
    `Q ${f(v1x)} ${f(v1y)} ${f(p2x)} ${f(p2y)}`,
    `L ${f(p3x)} ${f(p3y)}`,
    `Q ${f(vIn1x)} ${f(vIn1y)} ${f(p4x)} ${f(p4y)}`,
    `A ${f(rInner)} ${f(rInner)} 0 ${largeArcInner} 0 ${f(p5x)} ${f(p5y)}`,
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
  categories: Array<{ id: string; name: string; amount: number; percentage: number; color?: string }>,
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
      color: categories[0].color || palette[0] || '#FF857A',
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
      color: cat.color || palette[i % palette.length],
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
