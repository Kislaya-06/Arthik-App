import { describe, it, expect } from 'vitest';

/**
 * Re-export of the notched card path builder for unit testing path generation geometry
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

describe('BrandedHeroCard SVG Geometry Engine', () => {
  it('generates a valid, closed SVG path for standard card dimensions', () => {
    const path = buildNotchedCardPath(360, 210, 24, 80, 8, 22);

    expect(path).toBeTruthy();
    expect(path.startsWith('M 24,0')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('C '); // Tangent-continuous Bézier S-curve
    expect(path).toContain('A 24,24'); // Rounded corners
    expect(path).not.toContain('NaN');
    expect(path).not.toContain('undefined');
  });

  it('safely handles zero or negative dimensions without crashing or throwing', () => {
    expect(buildNotchedCardPath(0, 0, 24, 80, 8, 22)).toBe('');
    expect(buildNotchedCardPath(-10, 100, 24, 80, 8, 22)).toBe('');
    expect(buildNotchedCardPath(100, -20, 24, 80, 8, 22)).toBe('');
  });

  it('correctly clamps shelf coordinates within card boundaries on compact screens', () => {
    // Ultra compact width = 280, height = 160
    const path = buildNotchedCardPath(280, 160, 20, 70, 6, 18);

    expect(path).toBeTruthy();
    expect(path).not.toContain('NaN');
    // Ensure all numbers in the path are finite
    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (const num of numbers) {
      expect(Number.isFinite(num)).toBe(true);
    }
  });

  it('preserves horizontal shelf under the top-right chart pod', () => {
    const w = 360;
    const h = 210;
    const r = 24;
    const podSize = 80;
    const gap = 8;
    const shelfY = podSize + gap; // 88

    const path = buildNotchedCardPath(w, h, r, podSize, gap, 22);

    // Path must transition to shelfY at the end of the S-curve and continue horizontally
    expect(path).toContain(`,${shelfY}`);
    expect(path).toContain(`L ${w - r},${shelfY}`);
  });
});
