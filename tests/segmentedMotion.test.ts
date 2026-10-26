import { describe, it, expect } from 'vitest';
import {
  LEADING_EDGE_SPRING,
  TRAILING_EDGE_SPRING,
  PILL_COMMIT_MS,
  PILL_SETTLE_MS,
  edgeSpringsFor,
  labelActiveProgress,
  pillEdgesFor,
  simulateSpring,
  trailingSpringFor,
  optionWidthFor,
  inactiveLabelOpacity,
} from '../src/lib/segmentedMotion';

describe('segmentedMotion: liquid pill rules', () => {
  const W = 84; // one option, typical phone

  it.each([1, 2, 3, 4])('both edges are within ~1.5px of the target by PILL_SETTLE_MS on a %i-slot jump', (slots) => {
    const dist = slots * W;
    const trailing = trailingSpringFor(slots);
    const lead = simulateSpring(LEADING_EDGE_SPRING, 0, dist, PILL_SETTLE_MS);
    const trail = simulateSpring(trailing, 0, dist, PILL_SETTLE_MS);
    expect(Math.abs(dist - lead)).toBeLessThan(1.5);
    expect(Math.abs(dist - trail)).toBeLessThan(1.5);
  });

  it.each([1, 2, 3, 4])('the fallback PILL_COMMIT_MS is a true landing (both edges within ~1.5px) on a %i-slot jump', (slots) => {
    const dist = slots * W;
    const trailing = trailingSpringFor(slots);
    const lead = simulateSpring(LEADING_EDGE_SPRING, 0, dist, PILL_COMMIT_MS);
    const trail = simulateSpring(trailing, 0, dist, PILL_COMMIT_MS);
    expect(Math.abs(dist - lead)).toBeLessThan(1.5);
    expect(Math.abs(dist - trail)).toBeLessThan(1.5);
  });

  it('every jump length lands in about the same time (duration does not grow with distance)', () => {
    const landTime = (slots: number) => {
      const dist = slots * W;
      const trailing = trailingSpringFor(slots);
      for (let ms = 1; ms <= 700; ms++) {
        const ok =
          Math.abs(dist - simulateSpring(LEADING_EDGE_SPRING, 0, dist, ms)) < 1.5 &&
          Math.abs(dist - simulateSpring(trailing, 0, dist, ms)) < 1.5;
        if (ok) return ms;
      }
      return 999;
    };
    const times = [1, 2, 3, 4].map(landTime);
    expect(Math.max(...times)).toBeLessThanOrEqual(PILL_SETTLE_MS - 20);
    expect(Math.max(...times) - Math.min(...times)).toBeLessThan(40);
  });

  it('pill stretches in flight (visible but tasteful) and never overshoots more than 1px', () => {
    let maxStretch = 0;
    let maxOvershoot = 0;
    for (let ms = 1; ms <= 600; ms += 1) {
      const lead = simulateSpring(LEADING_EDGE_SPRING, 0, W, ms);
      const trail = simulateSpring(TRAILING_EDGE_SPRING, 0, W, ms);
      maxStretch = Math.max(maxStretch, lead - trail);
      maxOvershoot = Math.max(maxOvershoot, lead - W, trail - W);
    }
    expect(maxStretch / W).toBeGreaterThan(0.08);
    expect(maxStretch / W).toBeLessThan(0.35);
    expect(maxOvershoot).toBeLessThan(1);
  });

  it('the edge in the direction of travel leads', () => {
    expect(edgeSpringsFor(0, W, W).right).toBe(LEADING_EDGE_SPRING);
    expect(edgeSpringsFor(0, W, W).left).toEqual(trailingSpringFor(1));
    expect(edgeSpringsFor(2 * W, 0, W).left).toBe(LEADING_EDGE_SPRING);
    expect(edgeSpringsFor(2 * W, 0, W).right).toEqual(trailingSpringFor(2));
  });

  it('pill edges map to exact option slots', () => {
    expect(pillEdgesFor(2, W)).toEqual({ left: 2 * W, right: 3 * W });
  });

  it('label colour follows the pill: full on its slot, zero one slot away, half-way in between', () => {
    expect(labelActiveProgress(W, 2 * W, 1, W)).toBe(1);
    expect(labelActiveProgress(0, W, 1, W)).toBe(0);
    expect(labelActiveProgress(W / 2, W * 1.5, 1, W)).toBeCloseTo(0.5);
    expect(labelActiveProgress(0, W, 3, W)).toBe(0);
    expect(labelActiveProgress(0, W, 0, 0)).toBe(0);
  });

  it('option slots use the real inner width (border excluded): pill never drifts from the labels', () => {
    const container = 350;
    const n = 4;
    const inset = 4;
    const ow = optionWidthFor(container, n, inset);
    expect(ow).toBe((350 - 2 - 8) / 4); // 85
    // The pill's last slot ends exactly `inset` before the inner edge, same as the left side.
    const innerEdge = container - 2;
    expect(inset + n * ow).toBeCloseTo(innerEdge - inset, 9);
    expect(optionWidthFor(0, 4, 4)).toBe(0);
    expect(optionWidthFor(350, 0, 4)).toBe(0);
  });

  it('inactive label copy fades out under the pill (no grey fringe around the active text)', () => {
    expect(inactiveLabelOpacity(0)).toBe(1);
    expect(inactiveLabelOpacity(0.6)).toBe(1);
    expect(inactiveLabelOpacity(1)).toBe(0);
    expect(inactiveLabelOpacity(0.8)).toBeCloseTo(0.5);
    // Never both fully visible while the pill is fully under the label.
    expect(labelActiveProgress(0, 85, 0, 85) + inactiveLabelOpacity(labelActiveProgress(0, 85, 0, 85))).toBe(1);
  });

  describe('frame-by-frame simulation at 120fps, every slot-to-slot move of a 4-option control', () => {
    const OW = 85;
    const N = 4;
    const FRAME_MS = 1000 / 120;
    for (let from = 0; from < N; from++) {
      for (let to = 0; to < N; to++) {
        if (from === to) continue;
        it(`slot ${from} -> ${to}`, () => {
          const f = pillEdgesFor(from, OW);
          const t = pillEdgesFor(to, OW);
          const movingRight = to > from;
          const springs = edgeSpringsFor(f.left, t.left, OW);
          let prevLeft = f.left;
          let prevRight = f.right;
          let maxWidth = 0;
          for (let ms = 0; ms <= 700; ms += FRAME_MS) {
            const t1 = Math.round(ms);
            const left = simulateSpring(springs.left, f.left, t.left, t1);
            const right = simulateSpring(springs.right, f.right, t.right, t1);
            const width = right - left;
            maxWidth = Math.max(maxWidth, width);
            // Stays inside the track (0 .. N*OW) with at most 1px of overshoot past the target.
            expect(left).toBeGreaterThanOrEqual(-1);
            expect(right).toBeLessThanOrEqual(N * OW + 1);
            // Never thinner than a resting pill minus the tiny leading-edge overshoot, never inverted.
            expect(width).toBeGreaterThan(OW - 1.5);
            // Edges only move toward the target (no wobble backwards).
            if (movingRight) {
              expect(left).toBeGreaterThanOrEqual(prevLeft - 0.5);
              expect(right).toBeGreaterThanOrEqual(prevRight - 0.5);
            } else {
              expect(left).toBeLessThanOrEqual(prevLeft + 0.5);
              expect(right).toBeLessThanOrEqual(prevRight + 0.5);
            }
            prevLeft = left;
            prevRight = right;
          }
          // Landed: exact slot, exact width.
          const endL = simulateSpring(springs.left, f.left, t.left, 700);
          const endR = simulateSpring(springs.right, f.right, t.right, 700);
          expect(Math.abs(endL - t.left)).toBeLessThan(0.1);
          expect(Math.abs(endR - t.right)).toBeLessThan(0.1);
          // Stretch is visible but tasteful: at most ~35% wider than resting, even on the longest jump
          // (it was 56% before the trailing spring got distance-aware).
          expect(maxWidth / OW).toBeLessThan(1.35);
          expect(maxWidth / OW).toBeGreaterThan(1.1);
        });
      }
    }
  });
});
