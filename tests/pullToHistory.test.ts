import { describe, it, expect } from 'vitest';
import {
  PULL_TO_HISTORY_THRESHOLD,
  MAX_PULL_DEPTH,
  PHASE_A_RANGE,
  RESISTANCE_COEFFICIENT,
  PULL_TRAVEL_MAX,
  computeScrollProgress,
  calculatePullResistance,
  calculateProgressiveResistance,
  calculateWeightedPullProgress,
  isAtScrollBottom,
  evaluatePullRelease,
  getIndicatorVisualState,
} from '../src/lib/pullToHistoryUtils';

describe('pullToHistoryUtils', () => {
  describe('Constants', () => {
    it('enforces authoritative 72dp threshold', () => {
      expect(PULL_TO_HISTORY_THRESHOLD).toBe(72);
    });

    it('enforces max pull depth of 88dp', () => {
      expect(MAX_PULL_DEPTH).toBe(88);
    });

    it('enforces Phase A 80dp approach range', () => {
      expect(PHASE_A_RANGE).toBe(80);
    });

    it('enforces 0.45 resistance coefficient', () => {
      expect(RESISTANCE_COEFFICIENT).toBe(0.45);
    });
  });

  describe('computeScrollProgress', () => {
    const layoutHeight = 800;
    const contentHeight = 1600;
    // maxScrollY = 1600 - 800 = 800.
    // Window starts at: 800 - 80 = 720.

    it('returns 0 when scroll is well above the 80dp window', () => {
      expect(computeScrollProgress({ contentOffsetY: 500, layoutHeight, contentHeight })).toBe(0);
      expect(computeScrollProgress({ contentOffsetY: 720, layoutHeight, contentHeight })).toBe(0);
    });

    it('returns linear fraction inside the 80dp window', () => {
      // 760 is halfway through [720, 800]
      const progress = computeScrollProgress({ contentOffsetY: 760, layoutHeight, contentHeight });
      expect(progress).toBeCloseTo(0.5, 4);
    });

    it('returns 1.0 at content bottom and clamps for any overscroll', () => {
      expect(computeScrollProgress({ contentOffsetY: 800, layoutHeight, contentHeight })).toBe(1);
      expect(computeScrollProgress({ contentOffsetY: 850, layoutHeight, contentHeight })).toBe(1);
    });

    it('returns 0 when content fits in viewport without scrolling', () => {
      expect(computeScrollProgress({ contentOffsetY: 0, layoutHeight: 800, contentHeight: 600 })).toBe(0);
    });
  });

  describe('calculatePullResistance', () => {
    it('returns 0 for negative or zero delta', () => {
      expect(calculatePullResistance(0)).toBe(0);
      expect(calculatePullResistance(-20)).toBe(0);
    });

    it('calculates linear resisted displacement with 0.45 coefficient', () => {
      expect(calculatePullResistance(40)).toBeCloseTo(18, 4);
      expect(calculatePullResistance(80)).toBeCloseTo(36, 4);
      expect(calculatePullResistance(160)).toBeCloseTo(72, 4);
    });

    it('caps strictly at MAX_PULL_DEPTH (88dp)', () => {
      expect(calculatePullResistance(200)).toBe(88);
      expect(calculatePullResistance(500)).toBe(88);
    });
  });

  describe('calculateProgressiveResistance', () => {
    it('returns 0 for negative or zero delta', () => {
      expect(calculateProgressiveResistance(0)).toBe(0);
      expect(calculateProgressiveResistance(-20)).toBe(0);
    });

    it('provides responsive initial movement and progressively stiffens', () => {
      const depth15 = calculateProgressiveResistance(15);
      const depth30 = calculateProgressiveResistance(30);
      const depth80 = calculateProgressiveResistance(80);

      // Initial 15px yields 33dp (responsive visual start)
      expect(depth15).toBeCloseTo(33, 1);
      // At 30px yields 49.5dp (circle is ~69% full)
      expect(depth30).toBeCloseTo(49.5, 1);
      // At natural 80px thumb pull, reaches exactly 72dp threshold (100% full)
      expect(depth80).toBeCloseTo(72, 1);
    });

    it('caps strictly at MAX_PULL_DEPTH (88dp)', () => {
      expect(calculateProgressiveResistance(600)).toBe(88);
      expect(calculateProgressiveResistance(1000)).toBe(88);
    });
  });

  describe('calculateWeightedPullProgress', () => {
    it('enforces 140dp travel distance constant', () => {
      expect(PULL_TRAVEL_MAX).toBe(140);
    });

    it('returns 0 for non-positive displacement', () => {
      expect(calculateWeightedPullProgress(0)).toEqual({ depth: 0, progress: 0, isArmed: false });
      expect(calculateWeightedPullProgress(-30)).toEqual({ depth: 0, progress: 0, isArmed: false });
    });

    it('exhibits Instagram-style progressive resistance (fast initial, stiffening end)', () => {
      const p35 = calculateWeightedPullProgress(35); // 25% travel
      const p70 = calculateWeightedPullProgress(70); // 50% travel
      const p105 = calculateWeightedPullProgress(105); // 75% travel
      const p140 = calculateWeightedPullProgress(140); // 100% travel

      // First 25% travel yields ~37% progress
      expect(p35.progress).toBeCloseTo(0.37, 2);
      expect(p35.isArmed).toBe(false);

      // At 50% travel yields ~67% progress
      expect(p70.progress).toBeCloseTo(0.67, 2);
      expect(p70.isArmed).toBe(false);

      // At 75% travel yields ~89% progress
      expect(p105.progress).toBeCloseTo(0.89, 2);
      expect(p105.isArmed).toBe(false);

      // At 140dp travel, reaches exactly 100% progress and is armed
      expect(p140.progress).toBe(1);
      expect(p140.depth).toBe(72);
      expect(p140.isArmed).toBe(true);
    });

    it('clamps cleanly when over-pulled beyond 140dp', () => {
      const pOver = calculateWeightedPullProgress(250);
      expect(pOver.progress).toBe(1);
      expect(pOver.depth).toBe(72);
      expect(pOver.isArmed).toBe(true);
    });
  });

  describe('isAtScrollBottom', () => {
    const layoutHeight = 800;
    const contentHeight = 1600;
    // maxScrollY = 800

    it('returns false when scrolled to top or middle', () => {
      expect(isAtScrollBottom(0, layoutHeight, contentHeight)).toBe(false);
      expect(isAtScrollBottom(500, layoutHeight, contentHeight)).toBe(false);
      expect(isAtScrollBottom(790, layoutHeight, contentHeight)).toBe(false);
    });

    it('returns true when within default 4dp epsilon of bottom', () => {
      expect(isAtScrollBottom(796, layoutHeight, contentHeight)).toBe(true);
      expect(isAtScrollBottom(800, layoutHeight, contentHeight)).toBe(true);
      expect(isAtScrollBottom(810, layoutHeight, contentHeight)).toBe(true);
    });

    it('handles content smaller than viewport', () => {
      expect(isAtScrollBottom(0, 800, 600)).toBe(true);
      expect(isAtScrollBottom(-10, 800, 600)).toBe(false);
    });
  });

  describe('evaluatePullRelease', () => {
    it('returns shouldCommit: false below 72dp threshold', () => {
      expect(evaluatePullRelease(0)).toEqual({ shouldCommit: false, armed: false });
      expect(evaluatePullRelease(36)).toEqual({ shouldCommit: false, armed: false });
      expect(evaluatePullRelease(71.99)).toEqual({ shouldCommit: false, armed: false });
    });

    it('returns shouldCommit: true at or above 72dp threshold', () => {
      expect(evaluatePullRelease(72)).toEqual({ shouldCommit: true, armed: true });
      expect(evaluatePullRelease(72.01)).toEqual({ shouldCommit: true, armed: true });
      expect(evaluatePullRelease(88)).toEqual({ shouldCommit: true, armed: true });
    });
  });

  describe('getIndicatorVisualState', () => {
    it('returns opacity 0 at 0dp', () => {
      const state = getIndicatorVisualState(0);
      expect(state.opacity).toBe(0);
      expect(state.label).toBe('Swipe up for History');
      expect(state.isArmed).toBe(false);
    });

    it('ramps opacity linearly from 0 to 36dp', () => {
      const state18 = getIndicatorVisualState(18);
      expect(state18.opacity).toBeCloseTo(0.5, 2);
      expect(state18.label).toBe('Swipe up for History');
      expect(state18.isArmed).toBe(false);

      const state36 = getIndicatorVisualState(36);
      expect(state36.opacity).toBe(1);
      expect(state36.label).toBe('Swipe up for History');
      expect(state36.isArmed).toBe(false);
    });

    it('maintains opacity 1.0 and switches label/armed at 72dp', () => {
      const state71 = getIndicatorVisualState(71.9);
      expect(state71.opacity).toBe(1);
      expect(state71.label).toBe('Swipe up for History');
      expect(state71.isArmed).toBe(false);

      const state72 = getIndicatorVisualState(72);
      expect(state72.opacity).toBe(1);
      expect(state72.label).toBe('Release for History');
      expect(state72.isArmed).toBe(true);

      const state88 = getIndicatorVisualState(88);
      expect(state88.opacity).toBe(1);
      expect(state88.label).toBe('Release for History');
      expect(state88.isArmed).toBe(true);
    });
  });
});
