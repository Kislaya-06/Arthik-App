/**
 * Utility functions for circular charts and multi-segment donut animations.
 */

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
  palette: string[],
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
      color: palette[index % palette.length],
      fraction,
      arcLength,
      startAngle,
      strokeDasharray: `${arcLength} ${circumference}`,
      transform: `rotate(${startAngle}, ${center}, ${center})`,
      interpolation,
    };
  });
}
