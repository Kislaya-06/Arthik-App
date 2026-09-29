import { describe, it, expect } from 'vitest';

/**
 * Re-export of the concentric socket card path builder for unit testing path generation geometry
 */
function buildNotchedCardPath(
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

describe('BrandedHeroCard Concentric Circular Socket Geometry Engine', () => {
  it('generates a valid, closed SVG path with a concentric circular cradle arc', () => {
    const path = buildNotchedCardPath(360, 210, 24, 80, 8);

    expect(path).toBeTruthy();
    expect(path.startsWith('M 24,0')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    // Concentric cradle arc of radius Rcradle = 40 + 8 = 48
    expect(path).toContain('A 48,48 0 0 0');
    // Rounded outer fillets into top and right edges
    expect(path).toContain('A 16,16 0 0 1');
    expect(path).toContain('A 24,24 0 0 1'); // Card corners
    expect(path).not.toContain('NaN');
    expect(path).not.toContain('undefined');
  });

  it('safely handles zero or negative dimensions without crashing or throwing', () => {
    expect(buildNotchedCardPath(0, 0, 24, 80, 8)).toBe('');
    expect(buildNotchedCardPath(-10, 100, 24, 80, 8)).toBe('');
    expect(buildNotchedCardPath(100, -20, 24, 80, 8)).toBe('');
  });

  it('ensures all coordinates in the path are finite numbers', () => {
    const path = buildNotchedCardPath(280, 160, 20, 70, 6);

    expect(path).toBeTruthy();
    expect(path).not.toContain('NaN');
    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (const num of numbers) {
      expect(Number.isFinite(num)).toBe(true);
    }
  });

  it('ensures the cradle arc maintains exact concentric curvature to the chart pod', () => {
    const podSize = 80;
    const gap = 8;
    const Rcradle = podSize / 2 + gap; // 48
    const path = buildNotchedCardPath(363, 210, 24, podSize, gap);

    // Cradle arc radius must exactly match Rcradle = 48
    expect(path).toContain(`A ${Rcradle},${Rcradle} 0 0 0`);
  });
});

import { parseChipNumber } from '../src/lib/homeCalculations';

describe('parseChipNumber parser engine', () => {
  it('correctly parses integer budget chip', () => {
    const parsed = parseChipNumber('₹19,750 budget');
    expect(parsed).toEqual({
      prefix: '₹',
      numericValue: 19750,
      suffix: ' budget',
      hasDecimals: false,
    });
  });

  it('correctly parses decimal income chip with plus sign', () => {
    const parsed = parseChipNumber('+₹2,823.8 income');
    expect(parsed).toEqual({
      prefix: '+₹',
      numericValue: 2823.8,
      suffix: ' income',
      hasDecimals: true,
    });
  });

  it('correctly parses deposits chip', () => {
    const parsed = parseChipNumber('+₹3,630 deposits');
    expect(parsed).toEqual({
      prefix: '+₹',
      numericValue: 3630,
      suffix: ' deposits',
      hasDecimals: false,
    });
  });

  it('correctly parses budget with days suffix', () => {
    const parsed = parseChipNumber('₹500 budget (12 days)');
    expect(parsed).toEqual({
      prefix: '₹',
      numericValue: 500,
      suffix: ' budget (12 days)',
      hasDecimals: false,
    });
  });

  it('correctly parses "of ₹" prefix format', () => {
    const parsed = parseChipNumber('of ₹19,750 total budget');
    expect(parsed).toEqual({
      prefix: 'of ₹',
      numericValue: 19750,
      suffix: ' total budget',
      hasDecimals: false,
    });
  });

  it('correctly parses negative prefix format', () => {
    const parsed = parseChipNumber('-₹1,617 expense');
    expect(parsed).toEqual({
      prefix: '-₹',
      numericValue: 1617,
      suffix: ' expense',
      hasDecimals: false,
    });
  });

  it('safely returns null for empty or non-numeric chip', () => {
    expect(parseChipNumber('')).toBeNull();
    expect(parseChipNumber('No budget set')).toBeNull();
  });
});
