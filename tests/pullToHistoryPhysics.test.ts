import { describe, it, expect } from 'vitest';
import {
  PULL_CURVE_EXPONENT,
  PULL_MAX_TRAVEL_CAP,
  PULL_MAX_TRAVEL_MIN,
  ARM_PROGRESS,
  DISARM_PROGRESS,
  RELEASE_SPRING,
  getNavTopOffset,
  getMaxTravel,
  getFingerTravel,
  pullDepthFromTravel,
  travelFromPullDepth,
  resolveVisualState,
  rawYFromVisualState,
  clampRawY,
  getPullProgress,
  nextArmedState,
  getRingArc,
  decideRelease,
  PullGeometry,
  ReleaseInput,
} from '../src/lib/pullToHistoryPhysics';

const geo = (over: Partial<PullGeometry> = {}): PullGeometry => ({
  maxScroll: 100,
  maxTravel: 192,
  pullEnabled: true,
  ...over,
});

describe('pullToHistoryPhysics', () => {
  describe('getNavTopOffset', () => {
    it('mirrors BottomNavBar (bottom offset + 68dp pill)', () => {
      expect(getNavTopOffset(0)).toBe(20 + 68);
      expect(getNavTopOffset(24)).toBe(24 + 6 + 68);
    });
  });

  describe('getMaxTravel', () => {
    it('is ~72% of the list height, capped at 192 and floored at 140', () => {
      expect(getMaxTravel(0)).toBe(PULL_MAX_TRAVEL_MIN);
      expect(getMaxTravel(120)).toBe(PULL_MAX_TRAVEL_MIN);
      expect(getMaxTravel(220)).toBeCloseTo(158.4, 5);
      expect(getMaxTravel(286)).toBe(PULL_MAX_TRAVEL_CAP);
      expect(getMaxTravel(900)).toBe(PULL_MAX_TRAVEL_CAP);
    });
  });

  describe('resistance curve', () => {
    const T = 192;

    it('starts exactly 1:1 with the thumb', () => {
      const d = pullDepthFromTravel(1, T);
      expect(d).toBeGreaterThan(0.97);
      expect(d).toBeLessThanOrEqual(1);
    });

    it('is monotonic, never exceeds max travel, and reaches it at the finger travel', () => {
      let prev = 0;
      for (let x = 0; x <= getFingerTravel(T) + 200; x += 5) {
        const d = pullDepthFromTravel(x, T);
        expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(d).toBeLessThanOrEqual(T + 1e-9);
        prev = d;
      }
      expect(pullDepthFromTravel(getFingerTravel(T), T)).toBeCloseTo(T, 6);
    });

    it('gets stiffer: the last 10% of travel costs far more thumb than the first 10%', () => {
      const first = travelFromPullDepth(0.1 * T, T) - travelFromPullDepth(0, T);
      const last = travelFromPullDepth(0.98 * T, T) - travelFromPullDepth(0.88 * T, T);
      expect(last / first).toBeGreaterThan(2);
    });

    it('can be armed with a deliberate (not absurd) swipe', () => {
      const armTravel = travelFromPullDepth(ARM_PROGRESS * T, T);
      expect(armTravel).toBeGreaterThan(180); // not accidental
      expect(armTravel).toBeLessThan(330); // still comfortably reachable on a phone
    });

    it('round-trips depth <-> travel', () => {
      for (const depth of [0, 10, 60, 120, 180, 191]) {
        expect(pullDepthFromTravel(travelFromPullDepth(depth, T), T)).toBeCloseTo(depth, 6);
      }
    });
  });

  describe('resolveVisualState / rawYFromVisualState', () => {
    it('scrolls 1:1 inside the bounds', () => {
      expect(resolveVisualState(0, geo())).toEqual({ scroll: 0, pull: 0 });
      expect(resolveVisualState(63, geo())).toEqual({ scroll: 63, pull: 0 });
      expect(resolveVisualState(100, geo())).toEqual({ scroll: 100, pull: 0 });
    });

    it('pulls up only past the end, continuing smoothly from the scroll position', () => {
      const v = resolveVisualState(130, geo());
      expect(v.scroll).toBe(100);
      expect(v.pull).toBeGreaterThan(25);
      expect(v.pull).toBeLessThanOrEqual(30);
    });

    it('NEVER moves the list down: past the top nothing is drawn (pull-down belongs to the refresh circle)', () => {
      for (const raw of [-1, -30, -500]) {
        expect(resolveVisualState(raw, geo())).toEqual({ scroll: 0, pull: 0 });
      }
    });

    it('respects pullEnabled', () => {
      expect(resolveVisualState(500, geo({ pullEnabled: false })).pull).toBe(0);
    });

    it('inverts so the content can be caught mid-bounce', () => {
      for (const raw of [0, 40, 100, 120, 250, 330]) {
        const g = geo();
        const back = rawYFromVisualState(resolveVisualState(raw, g), g);
        expect(back).toBeCloseTo(raw, 4);
      }
    });
  });

  describe('clampRawY', () => {
    it('limits to the hard edges when pull is off', () => {
      const g = geo({ pullEnabled: false });
      expect(clampRawY(-40, g)).toBe(0);
      expect(clampRawY(400, g)).toBe(g.maxScroll);
      expect(clampRawY(50, g)).toBe(50);
    });

    it('top is always a hard edge; past the end it limits to the finger travel that fills the pull', () => {
      const g = geo();
      expect(clampRawY(10_000, g)).toBeCloseTo(g.maxScroll + getFingerTravel(g.maxTravel), 6);
      expect(clampRawY(-10_000, g)).toBe(0);
    });
  });

  describe('arming', () => {
    it('arms at the threshold and only disarms below the lower threshold (hysteresis)', () => {
      expect(nextArmedState(false, ARM_PROGRESS - 0.001)).toBe(false);
      expect(nextArmedState(false, ARM_PROGRESS)).toBe(true);
      expect(nextArmedState(true, ARM_PROGRESS - 0.01)).toBe(true);
      expect(nextArmedState(true, DISARM_PROGRESS)).toBe(true);
      expect(nextArmedState(true, DISARM_PROGRESS - 0.001)).toBe(false);
    });

    it('computes clamped progress', () => {
      expect(getPullProgress(0, 192)).toBe(0);
      expect(getPullProgress(96, 192)).toBe(0.5);
      expect(getPullProgress(500, 192)).toBe(1);
      expect(getPullProgress(10, 0)).toBe(0);
    });
  });

  describe('getRingArc', () => {
    const C = 2 * Math.PI * 11;

    it('starts fully white', () => {
      const a = getRingArc(0, C);
      expect(a.whiteLength).toBeCloseTo(C, 6);
      expect(a.rotationDeg).toBe(-90);
      expect(a.visible).toBe(true);
    });

    it('white arc always ENDS at 12 o\'clock (Instagram countdown)', () => {
      for (const p of [0, 0.1, 0.37, 0.5, 0.8, 0.95]) {
        const a = getRingArc(p, C);
        const endDeg = a.rotationDeg + (a.whiteLength / C) * 360; // measured from 3 o'clock, clockwise
        expect(((endDeg % 360) + 360) % 360).toBeCloseTo(270, 6); // 270deg == 12 o'clock
      }
    });

    it('shrinks linearly and disappears at 100%', () => {
      expect(getRingArc(0.5, C).whiteLength).toBeCloseTo(C / 2, 6);
      expect(getRingArc(1, C).visible).toBe(false);
      expect(getRingArc(2, C).whiteLength).toBe(0);
    });
  });

  describe('decideRelease', () => {
    const base: ReleaseInput = {
      pull: 0,
      armed: false,
      cancelled: false,
      scrollVelocity: 0,
      maxScroll: 100,
    };

    it('opens History only when released while armed', () => {
      expect(decideRelease({ ...base, pull: 190, armed: true })).toEqual({ kind: 'commit' });
    });

    it('springs back when released before the ring is full', () => {
      expect(decideRelease({ ...base, pull: 150, armed: false })).toEqual({ kind: 'pull-back' });
      expect(decideRelease({ ...base, pull: 3, armed: false })).toEqual({ kind: 'pull-back' });
    });

    it('never opens History on a cancelled gesture', () => {
      expect(decideRelease({ ...base, pull: 190, armed: true, cancelled: true })).toEqual({ kind: 'pull-back' });
    });

    it('flings with momentum only when released with speed inside the bounds', () => {
      expect(decideRelease({ ...base, scrollVelocity: 1.2 })).toEqual({ kind: 'momentum', velocity: 1.2 });
      expect(decideRelease({ ...base, scrollVelocity: -0.9 })).toEqual({ kind: 'momentum', velocity: -0.9 });
      expect(decideRelease({ ...base, scrollVelocity: 0.01 })).toEqual({ kind: 'idle' });
      expect(decideRelease({ ...base, scrollVelocity: 2, maxScroll: 0 })).toEqual({ kind: 'idle' });
    });
  });

  // ─── Regression against the Instagram screen recording (120 fps, measured) ────────────────────
  describe('matches the measured Instagram recording', () => {
    /** Closed-form damped spring, x(0)=1, v(0)=0, normalised to 1 -> 0. */
    const spring = (t: number, { stiffness, damping, mass }: { stiffness: number; damping: number; mass: number }) => {
      if (t <= 0) return 1;
      const w0 = Math.sqrt(stiffness / mass);
      const z = damping / (2 * Math.sqrt(stiffness * mass));
      const wd = w0 * Math.sqrt(1 - z * z);
      return Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    };

    // [seconds since the video's release at t=2.65s, fraction of the pull still remaining]
    const released: Array<[number, number]> = [
      [0.033, 0.986], [0.067, 0.968], [0.1, 0.922], [0.133, 0.839], [0.167, 0.724], [0.2, 0.622],
      [0.233, 0.535], [0.267, 0.465], [0.3, 0.419], [0.333, 0.355], [0.367, 0.304], [0.4, 0.263],
      [0.433, 0.226], [0.467, 0.175], [0.5, 0.134], [0.533, 0.092], [0.567, 0.046], [0.6, 0.023],
    ];

    it('release spring follows Instagram\'s bounce-back curve (RMS < 4% of the travel)', () => {
      const lag = 0.015; // finger-lift to first movement in the recording
      const sq = released.map(([t, v]) => (spring(t - lag, RELEASE_SPRING) - v) ** 2);
      const rms = Math.sqrt(sq.reduce((a, b) => a + b, 0) / sq.length);
      expect(rms).toBeLessThan(0.04);
    });

    it('release spring is critically-damped-ish: well under 2% overshoot', () => {
      const z = RELEASE_SPRING.damping / (2 * Math.sqrt(RELEASE_SPRING.stiffness * RELEASE_SPRING.mass));
      expect(z).toBeGreaterThan(0.8);
      expect(z).toBeLessThan(1);
      let minX = 0;
      for (let t = 0; t < 3; t += 0.005) minX = Math.min(minX, spring(t, RELEASE_SPRING));
      expect(Math.abs(minX)).toBeLessThan(0.02);
    });

    it('settles in under ~1s like the recording', () => {
      expect(spring(0.9, RELEASE_SPRING)).toBeLessThan(0.03);
      expect(spring(0.2, RELEASE_SPRING)).toBeGreaterThan(0.5);
    });

    // [content translation as a fraction of the max (217px), ring progress read off the pixels]
    const ring: Array<[number, number]> = [
      [55 / 217, 0.22], [78 / 217, 0.32], [100 / 217, 0.43], [133 / 217, 0.57], [159 / 217, 0.70],
      [184 / 217, 0.82], [203 / 217, 0.91], [212 / 217, 0.95],
    ];

    it('ring progress is linear in how far the block has travelled', () => {
      for (const [depthFraction, measured] of ring) {
        const ours = getPullProgress(depthFraction * PULL_MAX_TRAVEL_CAP, PULL_MAX_TRAVEL_CAP);
        expect(Math.abs(ours - measured)).toBeLessThan(0.05);
      }
    });

    it('exponent keeps the first part of the pull 1:1 like the recording (~660px/s early on)', () => {
      expect(PULL_CURVE_EXPONENT * PULL_MAX_TRAVEL_CAP / getFingerTravel(PULL_MAX_TRAVEL_CAP)).toBeCloseTo(1, 6);
    });
  });
});
