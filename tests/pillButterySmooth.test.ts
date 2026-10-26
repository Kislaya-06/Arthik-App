/**
 * pillButterySmooth.test.ts
 *
 * Locks the root-cause fix for pill jitter (Home All/Daily/Weekly/Monthly, Expense | Income, History
 * categories). See ADR 0020. Three rules, each guarded here so it can never silently come back:
 *
 *   1. The screen hears about a tap only once the pill has LANDED (both edges within 1px). A React commit
 *      during the glide pauses Reanimated's UI commits (ReanimatedCommitHook) and freezes the pill.
 *   2. The pill animates ONLY transform / opacity / backgroundColor. No `width`, no `left`, no Text `color`
 *      (layout props and text colour force Yoga / text re-measure + a shadow-tree commit every frame).
 *   3. Deferring is safe for money: any other touch delivers the pending value first (touch fence).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CAP_FLAT_PX,
  LEADING_EDGE_SPRING,
  PILL_COMMIT_MS,
  PILL_LANDED_EPSILON_PX,
  PILL_LANDING_MAX_MS,
  PILL_MIN_WIDTH,
  capWidthFor,
  edgeSpringsFor,
  isOpaqueColor,
  pillEdgesFor,
  pillLandingMs,
  pillPiecesFor,
  pillRadiusFor,
  simulateSpring,
  springLandingMs,
  trailingSpringFor,
} from '../src/lib/segmentedMotion';
import {
  __resetSelectionFenceForTests,
  claimTouch,
  clearPendingSelection,
  createFenceOwner,
  flushPendingSelections,
  hasPendingSelection,
  setPendingSelection,
} from '../src/lib/selectionCommitFence';
import { LightColors, DarkColors, AmoledColors } from '../src/config/theme';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

/** Same physics as simulateSpring, with Reanimated's overshootClamping. */
function simulateClamped(spring: { stiffness: number; damping: number; mass: number }, from: number, to: number, ms: number) {
  const dt = 1 / 1000;
  let x = from;
  let v = 0;
  const up = to > from;
  for (let t = 0; t < ms; t++) {
    const a = (-spring.stiffness * (x - to) - spring.damping * v) / spring.mass;
    v += a * dt;
    x += v * dt;
    if (up ? x > to : x < to) {
      x = to;
      v = 0;
    }
  }
  return x;
}

// History SLIDE_SPRING (kept in sync by a source assertion below).
const SLIDE_SPRING = { stiffness: 447.4, damping: 49, mass: 1 };

describe('Rule 1: commit only after the pill has LANDED', () => {
  it('springLandingMs agrees with the spring simulation (and stays landed afterwards)', () => {
    for (const d of [20, 80, 160, 300]) {
      const ms = springLandingMs(LEADING_EDGE_SPRING, 0, d);
      expect(Math.abs(d - simulateSpring(LEADING_EDGE_SPRING, 0, d, ms))).toBeLessThanOrEqual(PILL_LANDED_EPSILON_PX);
      for (const later of [ms + 10, ms + 50, ms + 200]) {
        expect(Math.abs(d - simulateSpring(LEADING_EDGE_SPRING, 0, d, later))).toBeLessThanOrEqual(PILL_LANDED_EPSILON_PX);
      }
      // ...and one millisecond earlier it was NOT landed yet (the number is tight, not padded).
      expect(Math.abs(d - simulateSpring(LEADING_EDGE_SPRING, 0, d, ms - 1))).toBeGreaterThan(PILL_LANDED_EPSILON_PX);
    }
  });

  it('springLandingMs is 0 for no move and never exceeds the ceiling', () => {
    expect(springLandingMs(LEADING_EDGE_SPRING, 50, 50)).toBe(0);
    expect(springLandingMs(LEADING_EDGE_SPRING, 50, 50.5)).toBe(0);
    expect(springLandingMs({ stiffness: 1, damping: 0.1, mass: 1 }, 0, 1e6)).toBeLessThanOrEqual(PILL_LANDING_MAX_MS);
    expect(springLandingMs(LEADING_EDGE_SPRING, NaN, 10)).toBe(0);
  });

  // Every real slot width in the app: 4-option Home (~75-90), 3-option Insights, 2-option Expense | Income
  // (~160-190 on big phones and tablets).
  const widths = [60, 75, 82, 100, 120, 164, 190, 240];
  for (const w of widths) {
    for (const [from, to] of [[0, 1], [1, 0], [0, 2], [3, 0], [0, 3], [2, 1]] as const) {
      it(`segmented pill: both edges are within 1px at pillLandingMs (slot width ${w}, ${from} -> ${to})`, () => {
        const start = pillEdgesFor(from, w);
        const target = pillEdgesFor(to, w);
        const ms = pillLandingMs(start.left, start.right, to, w);
        const springs = edgeSpringsFor(start.left, target.left, w);
        const left = simulateSpring(springs.left, start.left, target.left, ms);
        const right = simulateSpring(springs.right, start.right, target.right, ms);
        expect(Math.abs(target.left - left)).toBeLessThanOrEqual(PILL_LANDED_EPSILON_PX);
        expect(Math.abs(target.right - right)).toBeLessThanOrEqual(PILL_LANDED_EPSILON_PX);
        // Still feels instant: never more than half a second.
        expect(ms).toBeLessThan(500);
      });
    }
  }

  it('documents WHY the old 200ms commit jittered: the pill still had pixels to travel', () => {
    // Expense | Income on a normal phone: ~164px slots.
    const trail = simulateSpring(trailingSpringFor(1), 0, 164, 200);
    expect(164 - trail).toBeGreaterThan(5);
  });

  it('unknown geometry (not measured yet) falls back to PILL_COMMIT_MS', () => {
    expect(pillLandingMs(0, 0, 2, 0)).toBe(PILL_COMMIT_MS);
  });

  it('a tap on the slot the pill already rests on needs no wait', () => {
    const e = pillEdgesFor(2, 80);
    expect(pillLandingMs(e.left, e.right, 2, 80)).toBe(0);
  });

  for (const [x0, w0, x1, w1] of [
    [4, 56, 60, 138],
    [4, 56, 600, 90],
    [600, 90, 4, 56],
    [60, 138, 199, 108],
  ]) {
    it(`history highlight lands within 1px at categoryPillLandingMs (${x0}/${w0} -> ${x1}/${w1})`, async () => {
      vi.resetModules();
      vi.doMock('react-native', () => ({
        View: () => null, Text: () => null, Pressable: () => null, ScrollView: () => null,
        StyleSheet: { create: (s: any) => s }, Platform: { OS: 'android' },
      }));
      vi.doMock('react-native-reanimated', () => ({
        default: { View: () => null, Text: () => null },
        useSharedValue: (v: any) => ({ value: v }), useAnimatedStyle: (f: any) => f(),
        withSpring: (v: any) => v, cancelAnimation: () => {}, interpolate: () => 0,
        Extrapolation: { CLAMP: 'clamp' }, useReducedMotion: () => false,
      }));
      vi.doMock('../src/store/themeStore', () => ({ useTheme: () => ({ colors: LightColors }) }));
      const { categoryPillLandingMs } = await import('../src/components/BouncyCategoryFilter');
      const ms = categoryPillLandingMs({ x: x0, width: w0 }, { x: x1, width: w1 });
      expect(Math.abs(x1 - simulateClamped(SLIDE_SPRING, x0, x1, ms))).toBeLessThanOrEqual(PILL_LANDED_EPSILON_PX);
      expect(Math.abs(w1 - simulateClamped(SLIDE_SPRING, w0, w1, ms))).toBeLessThanOrEqual(PILL_LANDED_EPSILON_PX);
      expect(categoryPillLandingMs(null, { x: x1, width: w1 })).toBe(0);
      vi.doUnmock('react-native');
      vi.doUnmock('react-native-reanimated');
      vi.doUnmock('../src/store/themeStore');
    });
  }

  it('the History spring used by the landing math is the one the component animates with', () => {
    const src = read('src/components/BouncyCategoryFilter.tsx');
    expect(src).toMatch(/stiffness: 447\.4,\s*damping: 49,\s*mass: 1,\s*overshootClamping: true/);
    expect(src).toMatch(/springLandingMs\(SLIDE_SPRING, from\.x, to\.x, undefined, true\)/);
    expect(src).toMatch(/springLandingMs\(SLIDE_SPRING, from\.width, to\.width, undefined, true\)/);
  });
});

describe('Rule 2: transform-only pill geometry (pillPiecesFor)', () => {
  const radii = [0, 4, 16, 20, 24];
  const spans: Array<[number, number]> = [
    [0, 80], [4, 60], [80, 164], [10.37, 97.61], [0, 300], [120, 121], [50, 50], [90, 40], [0, 8], [3.3, 44.9],
  ];

  for (const r of radii) {
    for (const [left, right] of spans) {
      it(`pieces exactly cover the pill with no seam (radius ${r}, ${left} -> ${right})`, () => {
        const bodyBase = 100;
        const shadowBase = 70;
        const p = pillPiecesFor(left, right, r, bodyBase, shadowBase);
        const width = Math.max(right - left, PILL_MIN_WIDTH);
        const end = left + width;
        const capW = capWidthFor(r);

        // Outer extent: left cap starts at the left edge; right cap ends at the right edge (or overlaps).
        expect(p.leftCapX).toBeCloseTo(left, 9);
        if (width >= capW) expect(p.rightCapX + capW).toBeCloseTo(end, 9);
        else expect(p.rightCapX).toBeCloseTo(left, 9);

        // Body (scaled about its centre) spans [a, b].
        const bodyCentre = p.bodyX + bodyBase / 2;
        const half = (bodyBase * p.bodyScaleX) / 2;
        const a = bodyCentre - half;
        const b = bodyCentre + half;
        // Never pokes outside the pill.
        expect(a).toBeGreaterThanOrEqual(left - 1e-6);
        expect(b).toBeLessThanOrEqual(end + 1e-6);
        if (width > capW) {
          // Body cut edges sit on the FLAT part of a cap (x in [cap+r, cap+r+2*CAP_FLAT_PX]) => no AA seam.
          expect(a).toBeGreaterThanOrEqual(p.leftCapX + r - 1e-6);
          expect(a).toBeLessThanOrEqual(p.leftCapX + r + 2 * CAP_FLAT_PX + 1e-6);
          expect(b).toBeGreaterThanOrEqual(p.rightCapX + r - 1e-6);
          expect(b).toBeLessThanOrEqual(p.rightCapX + r + 2 * CAP_FLAT_PX + 1e-6);
        }
        // Scale is always a positive finite number (Android never gets a degenerate matrix).
        expect(Number.isFinite(p.bodyScaleX)).toBe(true);
        expect(p.bodyScaleX).toBeGreaterThan(0);

        // Shadow box spans exactly the pill.
        const sc = p.shadowX + shadowBase / 2;
        expect(sc - (shadowBase * p.shadowScaleX) / 2).toBeCloseTo(left, 6);
        expect(sc + (shadowBase * p.shadowScaleX) / 2).toBeCloseTo(end, 6);
      });
    }
  }

  it('at rest on a slot with base = slot width, the shadow is unscaled (pixel-identical to before)', () => {
    const p = pillPiecesFor(82, 164, 20, 82, 82);
    expect(p.shadowScaleX).toBeCloseTo(1, 9);
    expect(p.shadowX).toBeCloseTo(82, 9);
  });

  it('hidden until placed (never flashes as a dot on first frame)', () => {
    expect(pillPiecesFor(0, 0, 20, 100, 100).visible).toBe(false);
    expect(pillPiecesFor(0, 80, 20, 100, 100).visible).toBe(true);
  });

  it('pillRadiusFor clamps like React Native (half the height at most)', () => {
    expect(pillRadiusFor(9999, 40)).toBe(20);
    expect(pillRadiusFor(9997, 46)).toBe(23);
    expect(pillRadiusFor(6, 40)).toBe(6);
    expect(pillRadiusFor(-3, 40)).toBe(0);
  });

  it('every pill colour in every theme is opaque, so the piece pill is always used', () => {
    for (const c of [LightColors, DarkColors, AmoledColors]) {
      expect(isOpaqueColor(c.mintGreen)).toBe(true);
      expect(isOpaqueColor(c.peachCoral)).toBe(true);
    }
    expect(isOpaqueColor('#FFFFFF')).toBe(true); // BudgetEditModal cadence pill
  });

  it('isOpaqueColor rejects anything see-through (falls back to one scaled box)', () => {
    expect(isOpaqueColor('rgba(255, 255, 255, 0.12)')).toBe(false);
    expect(isOpaqueColor('#FFFFFF80')).toBe(false);
    expect(isOpaqueColor('transparent')).toBe(false);
    expect(isOpaqueColor(undefined)).toBe(false);
    expect(isOpaqueColor('rgba(1,2,3,1)')).toBe(true);
    expect(isOpaqueColor('rgb(1, 2, 3)')).toBe(true);
    expect(isOpaqueColor('#abc')).toBe(true);
    expect(isOpaqueColor('#abcdefff')).toBe(true);
    expect(isOpaqueColor('white')).toBe(true);
  });

  /** All useAnimatedStyle bodies in a file. */
  const animatedStyleBodies = (src: string): string[] => {
    const out: string[] = [];
    let i = src.indexOf('useAnimatedStyle(');
    while (i >= 0) {
      let depth = 0;
      let j = i + 'useAnimatedStyle'.length;
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      out.push(src.slice(i, j + 1));
      i = src.indexOf('useAnimatedStyle(', j);
    }
    return out;
  };

  for (const file of ['src/components/ui/SegmentedControl.tsx', 'src/components/BouncyCategoryFilter.tsx']) {
    it(`${file}: no animated style touches a layout prop or Text colour`, () => {
      const bodies = animatedStyleBodies(read(file));
      expect(bodies.length).toBeGreaterThanOrEqual(5);
      for (const body of bodies) {
        expect(body).not.toMatch(/\b(width|height|left|right|top|bottom|margin\w*|padding\w*|flex\w*)\s*:/);
        expect(body).not.toMatch(/\bcolor\s*:/);
      }
    });
  }

  it('SegmentedControl draws the shadow from a separate box that never has a fill', () => {
    const src = read('src/components/ui/SegmentedControl.tsx');
    expect(src).toMatch(/boxShadow: PILL_BOX_SHADOW \},\s*shadowStyle/);
    expect(src).not.toMatch(/elevation: 2/);
  });
});

describe('Rule 3: touch fence (deferred selection can never be read stale)', () => {
  beforeEach(() => __resetSelectionFenceForTests());

  it('delivers every pending selection on the next touch, each exactly once', () => {
    const a = vi.fn();
    const b = vi.fn();
    const o1 = createFenceOwner();
    const o2 = createFenceOwner();
    setPendingSelection(o1, a);
    setPendingSelection(o2, b);
    expect(flushPendingSelections({})).toBe(2);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(flushPendingSelections({})).toBe(0);
    expect(a).toHaveBeenCalledTimes(1);
    expect(hasPendingSelection()).toBe(false);
  });

  it('a touch that started ON the pill (re-tap) does not flush that pill mid-glide', () => {
    const own = vi.fn();
    const other = vi.fn();
    const pill = createFenceOwner();
    const otherPill = createFenceOwner();
    setPendingSelection(pill, own);
    setPendingSelection(otherPill, other);
    const touch = { timestamp: 1 };
    claimTouch(pill, touch);
    flushPendingSelections(touch);
    expect(own).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(1);
    // The claim is per touch: the next unrelated touch does flush it.
    flushPendingSelections({ timestamp: 2 });
    expect(own).toHaveBeenCalledTimes(1);
  });

  it('a stale claim from an earlier touch never protects a pill on a later touch', () => {
    const own = vi.fn();
    const pill = createFenceOwner();
    setPendingSelection(pill, own);
    claimTouch(pill, { timestamp: 1 }); // root never saw this one (e.g. touch inside a Modal)
    flushPendingSelections({ timestamp: 2 });
    expect(own).toHaveBeenCalledTimes(1);
  });

  it('one failing flush never blocks the others', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    setPendingSelection(createFenceOwner(), () => {
      throw new Error('boom');
    });
    setPendingSelection(createFenceOwner(), good);
    expect(flushPendingSelections({})).toBe(1);
    expect(good).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('cleared selections are not delivered', () => {
    const f = vi.fn();
    const o = createFenceOwner();
    setPendingSelection(o, f);
    clearPendingSelection(o);
    flushPendingSelections({});
    expect(f).not.toHaveBeenCalled();
  });

  it('App root listens to every touch start and flushes the fence', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/flushPendingSelections\(e\?\.nativeEvent\)/);
    expect(app).toMatch(/onTouchStart=\{handleRootTouchStart\}/);
  });

  it('both pills claim their own touches and register with the fence', () => {
    for (const f of ['src/components/ui/SegmentedControl.tsx', 'src/components/BouncyCategoryFilter.tsx']) {
      const src = read(f);
      expect(src).toMatch(/onTouchStart=\{handleTouchStart\}/);
      expect(src).toMatch(/claimTouch\(fenceOwnerRef\.current, e\?\.nativeEvent\)/);
      expect(src).toMatch(/setPendingSelection\(fenceOwnerRef\.current, \(\) => deliverPending\(false\)\)/);
      // Unmount never loses a tap.
      expect(src).toMatch(/if \(pendingKeyRef\.current !== null\) \{\s*deliverPending\(false\);/);
    }
  });

  it('the three requested pills defer their screen update until landing', () => {
    expect(read('src/screens/HomeScreen.tsx')).toMatch(/<BouncyFilterToggle[\s\S]*?commitOnSettle[\s\S]*?\/>/);
    expect(read('src/components/BouncyTypeToggle.tsx')).toMatch(/commitOnSettle/);
    expect(read('src/screens/HistoryScreen.tsx')).toMatch(/<BouncyCategoryFilter[^>]*commitOnSettle/);
  });
});
