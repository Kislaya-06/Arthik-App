import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getStreakFlameConfig,
  FLAME_PATHS,
  FLAME_FULL_GROWTH_DAYS,
  FLAME_MIN_GROWTH,
  flameFrameAt,
  flameGrowthFor,
  flameLoopMs,
  flameEnergy,
  flameOutlineAt,
  flameHeartAt,
  flameBitsAt,
  FLAME_BIT_VISIBLE_SHARE,
  FLAME_HEADROOM,
} from '../src/lib/flameUtils';

/** All numbers of an SVG path, in order. */
function pathNumbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

/** Point pairs (x, y) of a path made only of M / C / Z commands. */
function pathPoints(d: string): { x: number; y: number }[] {
  const nums = pathNumbers(d);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

describe('StreakFlame Component & Tier Configuration Engine', () => {
  describe('Streak Tiers & Progression Matrix', () => {
    it('returns dormant tier 0 for 0 days streak (no embers, still)', () => {
      const config = getStreakFlameConfig(0);
      expect(config.tier).toBe(0);
      expect(config.tierName).toBe('dormant');
      expect(config.emberCount).toBe(0);
      expect(config.outerColor).toBe('#D97757');
      expect(config.flickerSpeed).toBe(1800);
      expect(config.lickStretch).toBe(1.05);
    });

    it('returns dormant tier 0 for negative streak as safety fallback', () => {
      const config = getStreakFlameConfig(-5);
      expect(config.tier).toBe(0);
      expect(config.tierName).toBe('dormant');
      expect(config.emberCount).toBe(0);
    });

    it('returns spark tier 1 for 1 to 3 days streak', () => {
      [1, 2, 3].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(1);
        expect(config.tierName).toBe('spark');
        expect(config.emberCount).toBe(1);
        expect(config.outerColor).toBe('#FF5722');
        expect(config.innerColor).toBe('#FFC107');
        expect(config.flickerSpeed).toBe(1100);
      });
    });

    it('returns blaze tier 2 for 4 to 7 days streak', () => {
      [4, 5, 6, 7].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(2);
        expect(config.tierName).toBe('blaze');
        expect(config.emberCount).toBe(2);
        expect(config.outerColor).toBe('#FF3D00');
        expect(config.innerColor).toBe('#FFD54F');
        expect(config.coreColor).toBe('#FFFFFF');
        expect(config.flickerSpeed).toBe(920);
      });
    });

    it('returns inferno tier 3 for 8 to 14 days streak', () => {
      [8, 10, 14].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(3);
        expect(config.tierName).toBe('inferno');
        expect(config.emberCount).toBe(3);
        expect(config.outerColor).toBe('#E62E00');
        expect(config.innerColor).toBe('#FFE082');
        expect(config.flickerSpeed).toBe(760);
      });
    });

    it('returns supernova tier 4 for 15+ days streak', () => {
      [15, 30, 100].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(4);
        expect(config.tierName).toBe('supernova');
        expect(config.emberCount).toBe(4);
        expect(config.outerColor).toBe('#D50000');
        expect(config.innerColor).toBe('#FFEA00');
        expect(config.flickerSpeed).toBe(620);
      });
    });

    it('maintains strict monotonic intensity progression across all tiers', () => {
      const sampleDays = [0, 2, 5, 10, 20];
      const configs = sampleDays.map(getStreakFlameConfig);

      for (let i = 1; i < configs.length; i++) {
        const prev = configs[i - 1];
        const curr = configs[i];

        // Embers increase with streak
        expect(curr.emberCount).toBeGreaterThanOrEqual(prev.emberCount);
        // Flame lick stretch increases with streak
        expect(curr.lickStretch).toBeGreaterThan(prev.lickStretch);
        // Wind sway degrees increase with streak
        expect(curr.swayDegrees).toBeGreaterThan(prev.swayDegrees);
        // Flicker cycle speed becomes faster (lower ms duration)
        expect(curr.flickerSpeed).toBeLessThan(prev.flickerSpeed);
      }
    });
  });

  describe('Flame Vector Geometry', () => {
    it('provides valid, closed SVG paths for outer flame, inner core, and embers', () => {
      expect(FLAME_PATHS.outer.startsWith('M 12 2')).toBe(true);
      expect(FLAME_PATHS.outer.endsWith('Z')).toBe(true);

      expect(FLAME_PATHS.inner.startsWith('M 12 11')).toBe(true);
      expect(FLAME_PATHS.inner.endsWith('Z')).toBe(true);

      expect(FLAME_PATHS.core.startsWith('M 12 15')).toBe(true);
      expect(FLAME_PATHS.core.endsWith('Z')).toBe(true);

      expect(FLAME_PATHS.ember.startsWith('M 2 0.5')).toBe(true);
      expect(FLAME_PATHS.ember.endsWith('Z')).toBe(true);
    });
  });

  describe('Flame grows gradually with the streak', () => {
    it('grows a little with every extra day up to the full size, then stays full', () => {
      let prev = flameGrowthFor(0);
      expect(prev).toBeCloseTo(FLAME_MIN_GROWTH, 9);
      for (let day = 1; day <= FLAME_FULL_GROWTH_DAYS; day++) {
        const g = flameGrowthFor(day);
        expect(g, `day ${day}`).toBeGreaterThan(prev);
        prev = g;
      }
      expect(flameGrowthFor(FLAME_FULL_GROWTH_DAYS)).toBeCloseTo(1, 9);
      expect(flameGrowthFor(365)).toBeCloseTo(1, 9);
    });

    it('early days add more size than later days (gentle curve, no sudden jumps)', () => {
      const firstWeek = flameGrowthFor(7) - flameGrowthFor(0);
      const lastWeek = flameGrowthFor(30) - flameGrowthFor(23);
      expect(firstWeek).toBeGreaterThan(lastWeek);
      for (let day = 1; day <= 30; day++) {
        expect(flameGrowthFor(day) - flameGrowthFor(day - 1)).toBeLessThan(0.07);
      }
    });

    it('bad input never breaks the size', () => {
      expect(flameGrowthFor(-3)).toBeCloseTo(FLAME_MIN_GROWTH, 9);
      expect(flameGrowthFor(Number.NaN)).toBeCloseTo(FLAME_MIN_GROWTH, 9);
    });
  });

  describe('Flame flicker', () => {
    it('the loop ends exactly where it starts (no jump when it repeats)', () => {
      for (const day of [1, 5, 10, 20]) {
        const c = getStreakFlameConfig(day);
        const a = flameFrameAt(0, c.lickStretch, c.swayDegrees);
        const b = flameFrameAt(1, c.lickStretch, c.swayDegrees);
        for (const k of Object.keys(a) as (keyof typeof a)[]) expect(b[k]).toBeCloseTo(a[k], 9);
      }
    });

    it('stays a gentle flicker: height within the tier stretch, lean within the tier sway, core never vanishes', () => {
      for (const day of [0, 2, 5, 10, 20]) {
        const c = getStreakFlameConfig(day);
        for (let i = 0; i <= 240; i++) {
          const f = flameFrameAt(i / 240, c.lickStretch, c.swayDegrees);
          expect(Math.abs(f.scaleY - 1)).toBeLessThanOrEqual(c.lickStretch - 1);
          expect(Math.abs(f.rotateDeg)).toBeLessThanOrEqual(c.swayDegrees);
          expect(f.innerOpacity).toBeGreaterThanOrEqual(0.75);
          expect(f.innerOpacity).toBeLessThanOrEqual(1);
        }
      }
    });

    it('hotter tiers loop faster', () => {
      expect(flameLoopMs(getStreakFlameConfig(20))).toBeLessThan(flameLoopMs(getStreakFlameConfig(2)));
    });

    it('the component has no halo, stops when still is right, and animates on the UI thread', () => {
      const src = fs.readFileSync(path.resolve(__dirname, '../src/components/StreakFlame.tsx'), 'utf8');
      expect(src).not.toMatch(/RadialGradient|Circle/);
      expect(src).toMatch(/const animate = streak > 0 && !reduceMotion && isFocused;/);
      expect(src).toContain('withRepeat(');
      expect(src).toContain('flameGrowthFor(streak)');
      // The fire is redrawn on the UI thread (animated path), never through React state.
      expect(src).toContain('useAnimatedProps(');
      expect(src).not.toMatch(/useState\(/);
    });
  });

  describe('Living fire shapes (animated emoji fire)', () => {
    const tiers = [0, 2, 5, 10, 20].map(getStreakFlameConfig);
    const phases = Array.from({ length: 121 }, (_, i) => i / 120);

    it('every tier has an orange middle colour', () => {
      for (const c of tiers) expect(c.midColor).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('hotter tiers make a livelier fire, always between 0 and 1', () => {
      const energies = tiers.map((c) => flameEnergy(c.lickStretch));
      for (let i = 1; i < energies.length; i++) expect(energies[i]).toBeGreaterThan(energies[i - 1]);
      for (const e of energies) {
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
      expect(flameEnergy(0.5)).toBe(0);
      expect(flameEnergy(3)).toBe(1);
    });

    it('the outline, middle layer and heart loop seamlessly (phase 1 draws phase 0)', () => {
      for (const c of tiers) {
        const e = flameEnergy(c.lickStretch);
        const pairs: [string, string][] = [
          [flameOutlineAt(0, e), flameOutlineAt(1, e)],
          [flameOutlineAt(0, e, 0.7, 1.7), flameOutlineAt(1, e, 0.7, 1.7)],
          [flameHeartAt(0, e), flameHeartAt(1, e)],
          [flameBitsAt(0, 2), flameBitsAt(1, 2)],
        ];
        for (const [a, b] of pairs) {
          const na = pathNumbers(a);
          const nb = pathNumbers(b);
          expect(nb.length).toBe(na.length);
          na.forEach((v, i) => expect(Math.abs(v - nb[i])).toBeLessThanOrEqual(0.011));
        }
      }
    });

    it('every shape is a closed, valid path that stays inside the drawing area', () => {
      for (const c of tiers) {
        const e = flameEnergy(c.lickStretch);
        for (const p of phases) {
          for (const d of [flameOutlineAt(p, e), flameOutlineAt(p, e, 0.7, 1.7), flameHeartAt(p, e), flameBitsAt(p, 2)]) {
            expect(d.startsWith('M ')).toBe(true);
            expect(d.endsWith('Z')).toBe(true);
            for (const pt of pathPoints(d)) {
              expect(Number.isFinite(pt.x) && Number.isFinite(pt.y)).toBe(true);
              expect(pt.x).toBeGreaterThanOrEqual(0);
              expect(pt.x).toBeLessThanOrEqual(24);
              expect(pt.y).toBeGreaterThanOrEqual(-FLAME_HEADROOM);
              expect(pt.y).toBeLessThanOrEqual(24);
            }
          }
        }
      }
    });

    it('layers stay nested: the heart tip is always below the middle tip, which is below the outer tip', () => {
      for (const c of tiers) {
        const e = flameEnergy(c.lickStretch);
        for (const p of phases) {
          const outerTipY = pathPoints(flameOutlineAt(p, e))[0].y;
          const middleTipY = pathPoints(flameOutlineAt(p, e, 0.7, 1.7))[0].y;
          const heartTipY = pathPoints(flameHeartAt(p, e))[0].y;
          expect(middleTipY).toBeGreaterThan(outerTipY);
          expect(heartTipY).toBeGreaterThan(middleTipY);
        }
      }
    });

    it('flame bits: none when count is 0, at most 2, and each is hidden for part of its cycle', () => {
      const empty = 'M 12 23 Z';
      for (const p of phases) expect(flameBitsAt(p, 0)).toBe(empty);
      const subpaths = (d: string) => (d === empty ? 0 : d.split('M ').length - 1);
      for (const p of phases) expect(subpaths(flameBitsAt(p, 9))).toBeLessThanOrEqual(2);
      // A single bit lives for FLAME_BIT_VISIBLE_SHARE of its half-loop and is hidden for the rest.
      const hidden = phases.filter((p) => flameBitsAt(p, 1) === empty).length;
      expect(hidden / phases.length).toBeGreaterThan(1 - FLAME_BIT_VISIBLE_SHARE - 0.05);
      expect(flameBitsAt(0, 1)).toBe(empty); // starts at nothing, so the loop never jumps
    });
  });
});
