import { describe, it, expect } from 'vitest';
import {
  buildSegmentInterpolation,
  prepareCategorySegments,
} from '../src/lib/chartUtils';

describe('Circular Donut Chart Sweep Math Engine', () => {
  describe('buildSegmentInterpolation', () => {
    it('handles single 100% segment sweep cleanly', () => {
      const interp = buildSegmentInterpolation(0, 1, 500);
      expect(interp.inputRange).toEqual([0, 1]);
      expect(interp.outputRange).toEqual([500, 0]);
    });

    it('handles first segment in multi-segment donut (e.g. 0 to 0.70)', () => {
      const interp = buildSegmentInterpolation(0, 0.70, 350);
      expect(interp.inputRange).toEqual([0, 0.7, 1]);
      expect(interp.outputRange).toEqual([350, 0, 0]);
      // Verify strictly monotonically increasing
      expect(interp.inputRange[0]).toBeLessThan(interp.inputRange[1]);
      expect(interp.inputRange[1]).toBeLessThan(interp.inputRange[2]);
    });

    it('handles intermediate segment in multi-segment donut (e.g. 0.70 to 0.90)', () => {
      const interp = buildSegmentInterpolation(0.70, 0.90, 100);
      expect(interp.inputRange).toEqual([0, 0.7, 0.9, 1]);
      expect(interp.outputRange).toEqual([100, 100, 0, 0]);
      // Verify strictly monotonically increasing
      for (let i = 0; i < interp.inputRange.length - 1; i++) {
        expect(interp.inputRange[i]).toBeLessThan(interp.inputRange[i + 1]);
      }
    });

    it('handles final segment in multi-segment donut (e.g. 0.90 to 1.0)', () => {
      const interp = buildSegmentInterpolation(0.90, 1.0, 50);
      expect(interp.inputRange).toEqual([0, 0.9, 1]);
      expect(interp.outputRange).toEqual([50, 50, 0]);
      // Verify strictly monotonically increasing
      expect(interp.inputRange[0]).toBeLessThan(interp.inputRange[1]);
      expect(interp.inputRange[1]).toBeLessThan(interp.inputRange[2]);
    });

    it('safely handles empty or degenerate segments', () => {
      const interpZero = buildSegmentInterpolation(0.5, 0.5, 0);
      expect(interpZero.inputRange).toEqual([0, 1]);
      expect(interpZero.outputRange).toEqual([0, 0]);
    });
  });

  describe('prepareCategorySegments', () => {
    const palette = ['#F4B8AE', '#99C5F1', '#B8E0C8'];

    it('computes correct angles, circumferences, and sweep offsets for a 2-segment breakdown (90% + 10%)', () => {
      const cats = [
        { id: 'c1', name: 'Food & Drinks', amount: 450, percentage: 90 },
        { id: 'c2', name: 'Shopping', amount: 50, percentage: 10 },
      ];
      const segments = prepareCategorySegments(cats, 500, palette, 220, 28);

      expect(segments).toHaveLength(2);

      // Segment 1 (Food & Drinks - 90%)
      const seg1 = segments[0];
      expect(seg1.fraction).toBe(0.9);
      expect(seg1.startAngle).toBe(-90);
      expect(seg1.color).toBe('#F4B8AE');
      expect(seg1.interpolation.inputRange).toEqual([0, 0.9, 1]);

      // Segment 2 (Shopping - 10%)
      const seg2 = segments[1];
      expect(seg2.fraction).toBe(0.1);
      expect(seg2.startAngle).toBeCloseTo(-90 + 0.9 * 360, 1);
      expect(seg2.color).toBe('#99C5F1');
      expect(seg2.interpolation.inputRange).toEqual([0, 0.9, 1]);
      expect(seg2.interpolation.outputRange[0]).toBeCloseTo(seg2.arcLength, 1);
      expect(seg2.interpolation.outputRange[1]).toBeCloseTo(seg2.arcLength, 1);
      expect(seg2.interpolation.outputRange[2]).toBe(0);
    });

    it('handles empty category list gracefully', () => {
      const segments = prepareCategorySegments([], 0, palette, 220, 28);
      expect(segments).toEqual([]);
    });
  });
});
