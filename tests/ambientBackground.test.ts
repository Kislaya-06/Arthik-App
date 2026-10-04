import { describe, it, expect } from 'vitest';
import {
  AMBIENT_ENABLED,
  AMBIENT_HEADER_BLOCK,
  AMBIENT_INTENSITY,
  FADE_STOPS,
  GLOW_PROFILE,
  GRAIN_TILE_DP,
  GUST_ENVELOPE_STOPS,
  GUST_MAX_TRAVEL,
  GUST_SLOTS,
  GUST_START,
  TONES,
  WASH_BOTTOM_SHARE,
  firstGustDelayMs,
  getAmbientHeight,
  getGrainGrid,
  getPalette,
  gustCentre,
  gustEnvelope,
  nextGustDelayMs,
  planGust,
  smootherstep,
  toneForRoute,
} from '../src/lib/ambientBackground';
import { GRAIN_TILE_URI } from '../src/lib/ambientGrain';
import { WIND_SPRITE_URI } from '../src/lib/ambientWind';

// small deterministic random generator (mulberry32) so these tests never flake
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const W = 411;

describe('ambient background: where it is drawn', () => {
  it('is on by default at the designed strength', () => {
    expect(AMBIENT_ENABLED).toBe(true);
    expect(AMBIENT_INTENSITY).toBe(1);
  });

  it('ends exactly where the Insights hero card begins: status bar + 16 padding + 48 header + 24 gap', () => {
    expect(AMBIENT_HEADER_BLOCK).toBe(16 + 48 + 24);
    expect(getAmbientHeight(0)).toBe(88);
    expect(getAmbientHeight(34)).toBe(122);
    expect(getAmbientHeight(48)).toBe(136);
    expect(getAmbientHeight(-5)).toBe(88);
  });

  it('only the top part of the screen: under a sixth of a tall phone', () => {
    expect(getAmbientHeight(48)).toBeLessThan(905 / 6);
  });
});

describe('ambient background: strongest at the top, eases to NOTHING with no edge', () => {
  it('smootherstep has zero slope at both ends (that is what removes the edge)', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 9);
    const eps = 1e-3;
    expect((smootherstep(eps) - smootherstep(0)) / eps).toBeLessThan(0.01);
    expect((smootherstep(1) - smootherstep(1 - eps)) / eps).toBeLessThan(0.01);
    expect(smootherstep(-3)).toBe(0);
    expect(smootherstep(3)).toBe(1);
  });

  it('the overlay covers the effect gently from the very top and fully at the bottom', () => {
    expect(FADE_STOPS[0]).toEqual({ offset: 0, alpha: 0 });
    expect(FADE_STOPS[FADE_STOPS.length - 1]).toEqual({ offset: 1, alpha: 1 });
    expect(FADE_STOPS.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < FADE_STOPS.length; i++) {
      expect(FADE_STOPS[i].offset).toBeGreaterThan(FADE_STOPS[i - 1].offset);
      expect(FADE_STOPS[i].alpha).toBeGreaterThan(FADE_STOPS[i - 1].alpha);
      expect(FADE_STOPS[i].alpha - FADE_STOPS[i - 1].alpha).toBeLessThanOrEqual(0.2); // no big jump anywhere
    }
  });

  it('the top stays strong: the first fifth of the area is still almost fully lit, the last fifth almost gone', () => {
    const at = (share: number) => 1 - smootherstep(share);
    expect(at(0.2)).toBeGreaterThan(0.9);
    expect(at(0.8)).toBeLessThan(0.1);
    expect(at(0)).toBe(1);
    expect(at(1)).toBe(0);
  });

  it('the top glow is an ellipse centred on the top edge that fades smoothly to zero', () => {
    expect(GLOW_PROFILE[0]).toEqual({ offset: 0, share: 1 });
    expect(GLOW_PROFILE[GLOW_PROFILE.length - 1]).toEqual({ offset: 1, share: 0 });
    for (let i = 1; i < GLOW_PROFILE.length; i++) {
      expect(GLOW_PROFILE[i].share).toBeLessThan(GLOW_PROFILE[i - 1].share);
    }
  });

  it('the tinted base eases off downwards', () => {
    expect(WASH_BOTTOM_SHARE).toBeLessThan(1);
    expect(WASH_BOTTOM_SHARE).toBeGreaterThan(0);
  });
});

describe('ambient background: colour follows the screen', () => {
  it('Home, History and the add / edit form are green; Savings violet; Insights orange', () => {
    expect(toneForRoute('Home')).toBe('home');
    expect(toneForRoute('History')).toBe('home');
    expect(toneForRoute('AddExpense')).toBe('home');
    expect(toneForRoute('EditExpense')).toBe('home');
    expect(toneForRoute('Savings')).toBe('savings');
    expect(toneForRoute('Insights')).toBe('insights');
    expect(toneForRoute(undefined)).toBe('home');
  });

  it("uses the app's own card colours", () => {
    expect(TONES.home.light).toBe('#B8E0C8');
    expect(TONES.savings.light).toBe('#8B5CF6');
    expect(TONES.insights.light).toBe('#F07167');
    expect(TONES.insights.core).toBe('#FED0A8');
  });

  it('every tone goes from a very dark base to a light, but not glaring, wind colour', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    for (const t of Object.values(TONES)) {
      expect(lum(t.deep)).toBeLessThan(45);
      expect(lum(t.core)).toBeGreaterThan(170);
      expect(lum(t.core)).toBeLessThan(235);
      expect(lum(t.deep)).toBeLessThan(lum(t.mid));
    }
  });
});

describe('ambient background: strength', () => {
  it('the wind is deliberately faint (seen only through the grain), the base is moderate', () => {
    for (const mode of ['light', 'dark', 'amoled'] as const) {
      for (const tone of Object.keys(TONES) as Array<keyof typeof TONES>) {
        const p = getPalette(tone, mode);
        expect(p.gustPeak).toBeLessThanOrEqual(0.22);
        expect(p.gustPeak).toBeGreaterThan(0.08);
        expect(p.washAlpha).toBeLessThanOrEqual(0.8);
        expect(p.glowAlpha).toBeLessThanOrEqual(0.32);
        expect(p.grainOpacity).toBeLessThanOrEqual(0.3);
        expect(p.grainOpacity).toBeGreaterThan(0.1);
      }
    }
  });

  it('AMOLED stays closer to black than the normal dark theme; light theme is a gentle tint', () => {
    const dark = getPalette('home', 'dark');
    const amoled = getPalette('home', 'amoled');
    const light = getPalette('home', 'light');
    expect(amoled.washAlpha).toBeLessThan(dark.washAlpha);
    expect(amoled.gustPeak).toBeLessThan(dark.gustPeak);
    expect(light.washAlpha).toBeLessThan(dark.washAlpha);
    expect(light.wash).toBe(TONES.home.light);
    expect(dark.wash).toBe(TONES.home.deep);
    expect(dark.gust).toBe(TONES.home.core);
  });

  it('intensity scales it and is clamped', () => {
    expect(getPalette('home', 'dark', 0.5).gustPeak).toBeCloseTo(getPalette('home', 'dark', 1).gustPeak * 0.5, 6);
    expect(getPalette('home', 'dark', 0).gustPeak).toBe(0);
    expect(getPalette('home', 'dark', 100).gustPeak).toBeLessThanOrEqual(1);
  });
});

describe('ambient background: the wind', () => {
  const plans = Array.from({ length: 2000 }, (_, i) => planGust(seeded(i + 1), W));

  it('three independent gust timelines', () => {
    expect(GUST_SLOTS).toBe(3);
  });

  it('comes from BOTH sides, about equally often', () => {
    const left = plans.filter((p) => p.side === 'left').length;
    expect(left / plans.length).toBeGreaterThan(0.44);
    expect(left / plans.length).toBeLessThan(0.56);
  });

  it('is soft and wide, not a line: as wide as the screen, and tall', () => {
    for (const p of plans) {
      expect(p.widthDp).toBeGreaterThanOrEqual(Math.round(W * 0.85));
      expect(p.widthDp).toBeLessThanOrEqual(Math.round(W * 1.25));
      expect(p.heightDp).toBeGreaterThanOrEqual(90);
      expect(p.heightDp).toBeLessThanOrEqual(140);
    }
  });

  it('is calm: every gust lasts 7-12 seconds, and drifts in from just outside an edge', () => {
    for (const p of plans) {
      expect(p.durationMs).toBeGreaterThanOrEqual(7000);
      expect(p.durationMs).toBeLessThanOrEqual(12000);
    }
    expect(GUST_START).toBeLessThan(0);
  });

  it('melts away before the middle: the centre never travels past 46% of the width', () => {
    expect(GUST_MAX_TRAVEL).toBeLessThanOrEqual(0.46);
    for (const p of plans) {
      expect(p.travel).toBeLessThanOrEqual(GUST_MAX_TRAVEL);
      expect(p.travel).toBeGreaterThanOrEqual(0.34);
      expect(gustCentre(p, 1)).toBeLessThanOrEqual(GUST_MAX_TRAVEL);
      expect(gustCentre(p, 0)).toBe(GUST_START);
    }
  });

  it('spreads and rolls gently: modest stretch, small drift and tilt', () => {
    for (const p of plans) {
      expect(p.spread).toBeGreaterThanOrEqual(1.15);
      expect(p.spread).toBeLessThanOrEqual(1.5);
      expect(Math.abs(p.lift)).toBeLessThanOrEqual(10);
      expect(Math.abs(p.tiltDeg)).toBeLessThanOrEqual(5);
    }
  });

  it('is biased to the top of the area (where the light is strongest) and always inside it', () => {
    for (const p of plans) {
      expect(p.y).toBeGreaterThanOrEqual(0.04);
      expect(p.y).toBeLessThanOrEqual(0.54);
    }
    const topHalf = plans.filter((p) => p.y < 0.25).length / plans.length;
    expect(topHalf).toBeGreaterThan(0.5);
  });

  it('NEVER repeats: no two gusts are alike, so there is no cycle and no loop point to stutter at', () => {
    const keys = new Set(plans.map((p) => `${p.side}|${p.y.toFixed(6)}|${p.durationMs}|${p.travel.toFixed(6)}|${p.lift.toFixed(6)}`));
    expect(keys.size).toBe(plans.length);
    // consecutive gusts from ONE generator also differ
    const rand = seeded(99);
    const seq = Array.from({ length: 200 }, () => planGust(rand, W));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toEqual(seq[i - 1]);
  });

  it('the pause between gusts is random (1.2-5.2 s); the first gust comes within a second, the others follow later', () => {
    const rand = seeded(5);
    const gaps = Array.from({ length: 1000 }, () => nextGustDelayMs(rand));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1200);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(5200);
    expect(new Set(gaps).size).toBeGreaterThan(500);
    for (let i = 0; i < 200; i++) {
      const r = seeded(i);
      expect(firstGustDelayMs(0, r)).toBeLessThanOrEqual(900);
      expect(firstGustDelayMs(1, r)).toBeGreaterThanOrEqual(1800);
      expect(firstGustDelayMs(2, r)).toBeGreaterThanOrEqual(4200);
    }
  });

  it('strength varies a little from gust to gust, but never gets bright', () => {
    for (const p of plans) {
      expect(p.strength).toBeGreaterThanOrEqual(0.75);
      expect(p.strength).toBeLessThanOrEqual(1);
    }
  });

  it('the envelope fades in from nothing and out to nothing with zero slope at both ends: nothing pops', () => {
    expect(gustEnvelope(0)).toBe(0);
    expect(gustEnvelope(1)).toBeCloseTo(0, 9);
    // starts very gently (first 2% of the life: under 4% of full), and ends with zero slope
    expect(gustEnvelope(0.02)).toBeLessThan(0.04);
    const eps = 1e-3;
    expect((gustEnvelope(1 - eps) - gustEnvelope(1)) / eps).toBeLessThan(0.05);
    let prev = 0;
    for (let i = 0; i <= 396; i++) {
      const v = gustEnvelope(i / 1000); // rises monotonically up to its peak (at 0.397)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
    let peak = 0;
    let peakAt = 0;
    for (let i = 0; i <= 1000; i++) {
      const v = gustEnvelope(i / 1000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      if (v > peak) { peak = v; peakAt = i / 1000; }
    }
    expect(peak).toBeCloseTo(1, 3);
    expect(peakAt).toBeGreaterThan(0.3);
    expect(peakAt).toBeLessThan(0.5); // arrives, then takes its time to melt away
  });

  it('the stops given to the native interpolation follow the envelope closely (no visible kinks)', () => {
    expect(GUST_ENVELOPE_STOPS[0]).toEqual({ life: 0, opacity: 0 });
    expect(GUST_ENVELOPE_STOPS[GUST_ENVELOPE_STOPS.length - 1].life).toBe(1);
    for (let i = 1; i < GUST_ENVELOPE_STOPS.length; i++) {
      expect(GUST_ENVELOPE_STOPS[i].life).toBeGreaterThan(GUST_ENVELOPE_STOPS[i - 1].life);
      expect(Math.abs(GUST_ENVELOPE_STOPS[i].opacity - GUST_ENVELOPE_STOPS[i - 1].opacity)).toBeLessThanOrEqual(0.3);
    }
    // piecewise-linear value vs the exact curve, anywhere in the gust
    for (let k = 0; k <= 400; k++) {
      const life = k / 400;
      let i = 1;
      while (i < GUST_ENVELOPE_STOPS.length - 1 && GUST_ENVELOPE_STOPS[i].life < life) i++;
      const a = GUST_ENVELOPE_STOPS[i - 1];
      const b = GUST_ENVELOPE_STOPS[i];
      const lin = a.opacity + ((life - a.life) / (b.life - a.life)) * (b.opacity - a.opacity);
      expect(Math.abs(lin - gustEnvelope(life))).toBeLessThan(0.04);
    }
  });
});

describe('ambient background: grain', () => {
  it('is bigger than before (each speck about 0.7 dp)', () => {
    expect(GRAIN_TILE_DP / 128).toBeGreaterThan(0.6);
    expect(GRAIN_TILE_DP / 128).toBeLessThan(1.1);
  });

  it('a small embedded PNG (no asset file needed)', () => {
    expect(GRAIN_TILE_URI.startsWith('data:image/png;base64,')).toBe(true);
    const b64 = GRAIN_TILE_URI.slice('data:image/png;base64,'.length);
    expect(b64.length).toBeLessThan(12000);
    const bytes = Buffer.from(b64, 'base64');
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.readUInt32BE(16)).toBe(128);
    expect(bytes.readUInt32BE(20)).toBe(128);
  });

  it('tiles cover the whole area with a handful of images', () => {
    const { cols, rows } = getGrainGrid(411, 122);
    expect(cols * GRAIN_TILE_DP).toBeGreaterThanOrEqual(411);
    expect(rows * GRAIN_TILE_DP).toBeGreaterThanOrEqual(122);
    expect(cols * rows).toBeLessThanOrEqual(16);
  });

  it('the wind sprite is a small embedded PNG, 192 x 64', () => {
    expect(WIND_SPRITE_URI.startsWith('data:image/png;base64,')).toBe(true);
    const bytes = Buffer.from(WIND_SPRITE_URI.slice('data:image/png;base64,'.length), 'base64');
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.readUInt32BE(16)).toBe(192);
    expect(bytes.readUInt32BE(20)).toBe(64);
    expect(bytes.length).toBeLessThan(12000);
  });
});
