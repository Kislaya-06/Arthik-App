import { describe, it, expect } from 'vitest';
import {
  buildSegmentInterpolation,
  prepareCategorySegments,
  generateRoundedBlockPath,
  generateFullAnnulusPath,
  prepareCategoryBlockSegments,
  prepareBlockSweepSegments,
  calculatePillFillHeight,
  getSpendingFlowFillColor,
  computeMonthlyWeeksData,
  computeMonthlyCashFlowData,
  computeYearlyGullakMilestones,
  computeDualRingState,
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

  describe('Block-Wise Donut Chart Engine', () => {
    const palette = ['#F4B8AE', '#99C5F1', '#B8E0C8', '#C9B8E8'];

    describe('generateRoundedBlockPath', () => {
      it('generates a valid SVG path with rounded corners for an arc slice', () => {
        const path = generateRoundedBlockPath(110, 110, 80, 108, -90, 45, 5, 7);
        expect(path).toContain('M ');
        expect(path).toContain('A 108 108');
        expect(path).toContain('A 80 80');
        expect(path.endsWith('Z')).toBe(true);
        expect(path.includes('NaN')).toBe(false);
      });

      it('returns empty string if totalSpan is smaller than gap', () => {
        const path = generateRoundedBlockPath(110, 110, 80, 108, 0, 3, 5, 7);
        expect(path).toBe('');
      });
    });

    describe('prepareCategoryBlockSegments', () => {
      it('handles single 100% category with a seamless full 360-degree circular annulus without gap', () => {
        const cats = [{ id: 'c1', name: 'Rent', amount: 15000, percentage: 100 }];
        const segments = prepareCategoryBlockSegments(cats, 15000, palette, 220, 28);
        expect(segments).toHaveLength(1);
        expect(segments[0].startAngle).toBe(-90);
        expect(segments[0].endAngle).toBe(270);
        expect(segments[0].path).toContain('M ');
        expect(segments[0].path.endsWith('Z')).toBe(true);
        // Verify it equals the full annulus path
        const expectedPath = generateFullAnnulusPath(110, 110, 80, 108);
        expect(segments[0].path).toBe(expectedPath);
      });

      it('computes proportional block angles and paths for multiple categories summing to 360 degrees', () => {
        const cats = [
          { id: 'c1', name: 'Food', amount: 500, percentage: 50 },
          { id: 'c2', name: 'Shopping', amount: 300, percentage: 30 },
          { id: 'c3', name: 'Travel', amount: 200, percentage: 20 },
        ];
        const segments = prepareCategoryBlockSegments(cats, 1000, palette, 220, 28);
        expect(segments).toHaveLength(3);

        expect(segments[0].startAngle).toBe(-90);
        const lastSeg = segments[segments.length - 1];
        expect(lastSeg.endAngle - segments[0].startAngle).toBeCloseTo(360, 1);

        segments.forEach((seg) => {
          expect(seg.path).toContain('M ');
          expect(seg.path.endsWith('Z')).toBe(true);
          expect(seg.path.includes('NaN')).toBe(false);
        });
      });

      it('allocates minimum visible block angle so tiny categories are clearly visible', () => {
        const cats = [
          { id: 'c1', name: 'Bills', amount: 990, percentage: 99 },
          { id: 'c2', name: 'Candy', amount: 10, percentage: 1 },
        ];
        const segments = prepareCategoryBlockSegments(cats, 1000, palette, 220, 28);
        expect(segments).toHaveLength(2);
        const tinySeg = segments[1];
        const tinySpan = tinySeg.endAngle - tinySeg.startAngle;
        // Even 1% category gets at least a visible block span (> 10 degrees)
        expect(tinySpan).toBeGreaterThanOrEqual(10);
        expect(tinySeg.path).toContain('M ');
      });

      it('returns empty array when categories is empty or totalAmount is 0', () => {
        expect(prepareCategoryBlockSegments([], 0, palette, 220, 28)).toEqual([]);
        expect(prepareCategoryBlockSegments([{ id: 'c1', name: 'A', amount: 0, percentage: 0 }], 0, palette)).toEqual([]);
      });
    });

    describe('prepareBlockSweepSegments', () => {
      it('handles single category smoothly', () => {
        const cats = [{ id: 'c1', name: 'Rent', amount: 1000, percentage: 100 }];
        const segments = prepareBlockSweepSegments(cats, 1000, palette, 220, 26);
        expect(segments).toHaveLength(1);
        expect(segments[0].offsetInterpolation.inputRange).toEqual([0, 1]);
        expect(segments[0].offsetInterpolation.outputRange[1]).toBe(0);
      });

      it('computes monotonic interpolations and gap-separated strokes for multi-category breakdown', () => {
        const cats = [
          { id: 'c1', name: 'Food', amount: 600, percentage: 60 },
          { id: 'c2', name: 'Travel', amount: 400, percentage: 40 },
        ];
        const segments = prepareBlockSweepSegments(cats, 1000, palette, 220, 26);
        expect(segments).toHaveLength(2);

        segments.forEach((seg) => {
          expect(seg.strokeArcLength).toBeGreaterThan(0);
          expect(seg.strokeDasharray).toContain(String(seg.strokeArcLength));

          // Ensure monotonic ranges
          for (let i = 0; i < seg.offsetInterpolation.inputRange.length - 1; i++) {
            expect(seg.offsetInterpolation.inputRange[i]).toBeLessThan(seg.offsetInterpolation.inputRange[i + 1]);
          }
          for (let i = 0; i < seg.opacityInterpolation.inputRange.length - 1; i++) {
            expect(seg.opacityInterpolation.inputRange[i]).toBeLessThan(seg.opacityInterpolation.inputRange[i + 1]);
          }
        });
      });

      it('returns empty array when categories is empty or totalAmount is 0', () => {
        expect(prepareBlockSweepSegments([], 0, palette)).toEqual([]);
        expect(prepareBlockSweepSegments([{ id: 'c1', name: 'A', amount: 0, percentage: 0 }], 0, palette)).toEqual([]);
      });
    });
  });

  describe('Spending Flow Capsule Pill Math Engine', () => {
    describe('calculatePillFillHeight', () => {
      it('returns 0 for zero amount or zero max amount', () => {
        expect(calculatePillFillHeight(0, 500, 130, 28)).toBe(0);
        expect(calculatePillFillHeight(100, 0, 130, 28)).toBe(0);
        expect(calculatePillFillHeight(-50, 500, 130, 28)).toBe(0);
      });

      it('returns minFillHeight for very small amounts to ensure visible rounded pill dome', () => {
        const height = calculatePillFillHeight(1, 1000, 130, 28);
        expect(height).toBeGreaterThanOrEqual(28);
        expect(height).toBeLessThan(35);
      });

      it('returns full trackHeight for peak/max amount', () => {
        const height = calculatePillFillHeight(500, 500, 130, 28);
        expect(height).toBe(130);
      });

      it('computes proportional intermediate height for 50% spend', () => {
        // 28 + 0.5 * (130 - 28) = 28 + 51 = 79
        const height = calculatePillFillHeight(250, 500, 130, 28);
        expect(height).toBe(79);
      });
    });

    describe('getSpendingFlowFillColor', () => {
      it('returns vibrant mint green for peak / highlighted state in dark mode', () => {
        const color = getSpendingFlowFillColor(1.0, true, true, '#B8E0C8', '#7FB896');
        expect(color).toBe('#B8E0C8');
      });

      it('returns mintGreenDark for peak / highlighted state in light mode', () => {
        const color = getSpendingFlowFillColor(1.0, true, false, '#B8E0C8', '#7FB896');
        expect(color).toBe('#7FB896');
      });

      it('returns scaled translucent tint green for low spend in dark mode', () => {
        const color = getSpendingFlowFillColor(0.1, false, true, '#B8E0C8', '#7FB896');
        expect(color).toContain('rgba(184, 224, 200,');
        // Low ratio should have low opacity
        const match = color.match(/rgba\(184, 224, 200, ([\d.]+)\)/);
        expect(match).not.toBeNull();
        const alpha = parseFloat(match![1]);
        expect(alpha).toBeGreaterThanOrEqual(0.28);
        expect(alpha).toBeLessThan(0.40);
      });

      it('returns brighter translucent tint green for high spend in dark mode', () => {
        const color = getSpendingFlowFillColor(0.85, false, true, '#B8E0C8', '#7FB896');
        const match = color.match(/rgba\(184, 224, 200, ([\d.]+)\)/);
        expect(match).not.toBeNull();
        const alpha = parseFloat(match![1]);
        expect(alpha).toBeGreaterThan(0.70);
      });
    });

    describe('computeMonthlyWeeksData', () => {
      it('correctly divides a 30-day month into exactly 4 weeks (W1–W4) and finds firstSpendingDate', () => {
        const monthStart = new Date(2026, 8, 1); // 1 Sep 2026
        const monthEnd = new Date(2026, 8, 30);  // 30 Sep 2026

        const expenses = [
          { amount: 500, expense_date: '2026-09-03' }, // W1 (first: 2026-09-03)
          { amount: 200, expense_date: '2026-09-07' }, // W1
          { amount: 800, expense_date: '2026-09-10' }, // W2 (first: 2026-09-10)
          { amount: 1500, expense_date: '2026-09-18' }, // W3 (first: 2026-09-18)
          { amount: 300, expense_date: '2026-09-25' }, // W4 (first: 2026-09-25)
          { amount: 450, expense_date: '2026-09-30' }, // W4
        ];

        const { weeks, maxWeek } = computeMonthlyWeeksData(monthStart, monthEnd, expenses);

        // Always exactly 4 weeks — no awkward 2-day W5
        expect(weeks).toHaveLength(4);

        expect(weeks[0].day).toBe('W1');
        expect(weeks[0].amount).toBe(700);
        expect(weeks[0].subLabel).toBe('1–7');
        expect(weeks[0].dateStr).toBe('2026-09-03'); // earliest spend in W1

        expect(weeks[1].day).toBe('W2');
        expect(weeks[1].amount).toBe(800);
        expect(weeks[1].subLabel).toBe('8–14');
        expect(weeks[1].dateStr).toBe('2026-09-10'); // earliest spend in W2

        expect(weeks[2].day).toBe('W3');
        expect(weeks[2].amount).toBe(1500);
        expect(weeks[2].subLabel).toBe('15–21');
        expect(weeks[2].dateStr).toBe('2026-09-18'); // earliest spend in W3

        // W4 absorbs all remaining days to month end (22–30)
        expect(weeks[3].day).toBe('W4');
        expect(weeks[3].amount).toBe(750); // 300 + 450
        expect(weeks[3].subLabel).toBe('22–30');
        expect(weeks[3].dateStr).toBe('2026-09-25'); // earliest spend in W4
        expect(weeks[3].startDate).toBe('2026-09-22');
        expect(weeks[3].endDate).toBe('2026-09-30');

        expect(maxWeek?.day).toBe('W3');
        expect(maxWeek?.amount).toBe(1500);
      });

      it('ignores income transactions when classifier is provided', () => {
        const monthStart = new Date(2026, 8, 1);
        const monthEnd = new Date(2026, 8, 30);

        const expenses = [
          { amount: 500, expense_date: '2026-09-03', isIncome: false },
          { amount: 50000, expense_date: '2026-09-05', isIncome: true },
        ];

        const { weeks } = computeMonthlyWeeksData(
          monthStart,
          monthEnd,
          expenses as any,
          (exp: any) => exp.isIncome
        );

        expect(weeks[0].amount).toBe(500);
      });

      it('strictly zeroes out pre-registration weeks when user joined mid-month (e.g. 15 Sep)', () => {
        const monthStart = new Date(2026, 8, 1);
        const monthEnd = new Date(2026, 8, 30);

        // Pre-registration dirty/test data on Sep 05 and Sep 12
        const expenses = [
          { amount: 400, expense_date: '2026-09-05' }, // W1 (1–7)
          { amount: 900, expense_date: '2026-09-12' }, // W2 (8–14)
          { amount: 1200, expense_date: '2026-09-16' }, // W3 (15–21)
          { amount: 800, expense_date: '2026-09-24' },  // W4 (22–30)
        ];

        const { weeks, maxWeek } = computeMonthlyWeeksData(
          monthStart,
          monthEnd,
          expenses,
          undefined,
          '2026-09-15' // User joined on 15 Sep
        );

        expect(weeks).toHaveLength(4);

        // W1 (1–7) strictly 0
        expect(weeks[0].day).toBe('W1');
        expect(weeks[0].amount).toBe(0);

        // W2 (8–14) strictly 0 (prior to join date)
        expect(weeks[1].day).toBe('W2');
        expect(weeks[1].amount).toBe(0);

        // W3 (15–21) has the 1200 expense from 16 Sep
        expect(weeks[2].day).toBe('W3');
        expect(weeks[2].amount).toBe(1200);
        expect(weeks[2].dateStr).toBe('2026-09-16');

        // W4 has 800
        expect(weeks[3].amount).toBe(800);

        // Peak week should be W3
        expect(maxWeek?.day).toBe('W3');
        expect(maxWeek?.amount).toBe(1200);
      });

      it('keeps all weeks active when user joined in an earlier month (e.g. 15 July vs Sep view)', () => {
        const monthStart = new Date(2026, 8, 1); // September
        const monthEnd = new Date(2026, 8, 30);

        const expenses = [
          { amount: 250, expense_date: '2026-09-02' },
          { amount: 350, expense_date: '2026-09-09' },
          { amount: 600, expense_date: '2026-09-17' },
          { amount: 700, expense_date: '2026-09-24' },
        ];

        const { weeks } = computeMonthlyWeeksData(
          monthStart,
          monthEnd,
          expenses,
          undefined,
          '2026-07-15' // User joined 15 July
        );

        expect(weeks).toHaveLength(4);
        expect(weeks[0].amount).toBe(250);
        expect(weeks[1].amount).toBe(350);
        expect(weeks[2].amount).toBe(600);
        expect(weeks[3].amount).toBe(700);
      });
    });

    describe('computeMonthlyCashFlowData', () => {
      it('correctly aggregates income and spent across 4 weeks with firstEventDate detection', () => {
        const monthStart = new Date(2026, 8, 1); // 1 Sep 2026
        const monthEnd = new Date(2026, 8, 30);  // 30 Sep 2026

        const expenses = [
          // W1 (1–7)
          { amount: 500, expense_date: '2026-09-02', type: 'expense' },
          { amount: 2000, expense_date: '2026-09-04', type: 'income' },
          // W2 (8–14) - transactions on 10th and 13th
          { amount: 800, expense_date: '2026-09-10', type: 'expense' },
          { amount: 400, expense_date: '2026-09-13', type: 'expense' },
          // W3 (15–21) - income on 15th, expense on 18th
          { amount: 5000, expense_date: '2026-09-15', type: 'income' },
          { amount: 1500, expense_date: '2026-09-18', type: 'expense' },
          // W4 (22–30)
          { amount: 900, expense_date: '2026-09-25', type: 'expense' },
        ];

        const gullakDeposits = [
          { date: '2026-09-05', amount: 500, source: 'external' }, // W1 external deposit
        ];

        const res = computeMonthlyCashFlowData(
          monthStart,
          monthEnd,
          expenses,
          gullakDeposits,
          (exp) => exp.type === 'income'
        );

        expect(res.weeks).toHaveLength(4);

        // W1: In = 2000 + 500 = 2500, Out = 500
        expect(res.weeks[0].day).toBe('W1');
        expect(res.weeks[0].income).toBe(2500);
        expect(res.weeks[0].spent).toBe(500);
        expect(res.weeks[0].subLabel).toBe('1–7');
        expect(res.weeks[0].dateStr).toBe('2026-09-02');

        // W2: In = 0, Out = 1200 (earliest event: 2026-09-10)
        expect(res.weeks[1].day).toBe('W2');
        expect(res.weeks[1].income).toBe(0);
        expect(res.weeks[1].spent).toBe(1200);
        expect(res.weeks[1].subLabel).toBe('8–14');
        expect(res.weeks[1].dateStr).toBe('2026-09-10');

        // W3: In = 5000, Out = 1500 (earliest event: 2026-09-15)
        expect(res.weeks[2].day).toBe('W3');
        expect(res.weeks[2].income).toBe(5000);
        expect(res.weeks[2].spent).toBe(1500);
        expect(res.weeks[2].subLabel).toBe('15–21');
        expect(res.weeks[2].dateStr).toBe('2026-09-15');

        // W4: In = 0, Out = 900
        expect(res.weeks[3].day).toBe('W4');
        expect(res.weeks[3].income).toBe(0);
        expect(res.weeks[3].spent).toBe(900);
        expect(res.weeks[3].subLabel).toBe('22–30');
        expect(res.weeks[3].dateStr).toBe('2026-09-25');

        // Totals & Max
        expect(res.totalIncome).toBe(7500);
        expect(res.totalSpent).toBe(4100);
        expect(res.maxAmount).toBe(5000); // highest bar
      });

      it('allocates budget allowance only for elapsed days in in-progress month, keeping future weeks empty', () => {
        const monthStart = new Date(2026, 9, 1); // 1 Oct 2026 (31 days)
        const monthEnd = new Date(2026, 9, 31);  // 31 Oct 2026

        const expenses = [
          { amount: 260, expense_date: '2026-10-02', type: 'expense' },
        ];
        const gullakDeposits: Array<{ date: string; amount: number; source?: string }> = [];

        // Today is October 2nd (W1 in progress, W2/W3/W4 in future)
        const today = new Date(2026, 9, 2);

        const res = computeMonthlyCashFlowData(
          monthStart,
          monthEnd,
          expenses,
          gullakDeposits,
          (exp) => exp.type === 'income',
          undefined,
          {
            isBudgetMode: true,
            cadence: 'daily',
            dailyBudgetAmount: 250,
          },
          today
        );

        expect(res.weeks).toHaveLength(4);

        // W1 (1–7): Only 2 days elapsed (Oct 1 + Oct 2) = 2 * 250 = 500. Spent = 260
        expect(res.weeks[0].income).toBe(500);
        expect(res.weeks[0].spent).toBe(260);

        // Future weeks (W2, W3, W4) have 0 elapsed days -> income = 0, spent = 0 (empty bars!)
        expect(res.weeks[1].income).toBe(0);
        expect(res.weeks[1].spent).toBe(0);
        expect(res.weeks[2].income).toBe(0);
        expect(res.weeks[2].spent).toBe(0);
        expect(res.weeks[3].income).toBe(0);
        expect(res.weeks[3].spent).toBe(0);

        // Total In so far = 500, Total Spent = 260
        expect(res.totalIncome).toBe(500);
        expect(res.totalSpent).toBe(260);
      });

      it('allocates full month budget allowance when all weeks have elapsed', () => {
        const monthStart = new Date(2026, 9, 1); // 1 Oct 2026 (31 days)
        const monthEnd = new Date(2026, 9, 31);  // 31 Oct 2026

        const expenses = [
          { amount: 260, expense_date: '2026-10-02', type: 'expense' },
          { amount: 500, expense_date: '2026-10-10', type: 'income' }, // W2 direct income
        ];
        const gullakDeposits = [
          { date: '2026-10-05', amount: 300, source: 'external' }, // W1 external deposit
        ];

        // Month is fully completed
        const monthCompletedDate = new Date(2026, 9, 31);

        const res = computeMonthlyCashFlowData(
          monthStart,
          monthEnd,
          expenses,
          gullakDeposits,
          (exp) => exp.type === 'income',
          undefined,
          {
            isBudgetMode: true,
            cadence: 'daily',
            dailyBudgetAmount: 250,
          },
          monthCompletedDate
        );

        expect(res.weeks).toHaveLength(4);

        // W1 (1–7 = 7 days): Allowance 7*250 = 1750 + External Deposit 300 = 2050. Spent = 260
        expect(res.weeks[0].income).toBe(2050);
        expect(res.weeks[0].spent).toBe(260);

        // W2 (8–14 = 7 days): Allowance 7*250 = 1750 + Direct Income 500 = 2250. Spent = 0
        expect(res.weeks[1].income).toBe(2250);
        expect(res.weeks[1].spent).toBe(0);

        // W3 (15–21 = 7 days): Allowance 7*250 = 1750. Spent = 0
        expect(res.weeks[2].income).toBe(1750);
        expect(res.weeks[2].spent).toBe(0);

        // W4 (22–31 = 10 days): Allowance 10*250 = 2500. Spent = 0
        expect(res.weeks[3].income).toBe(2500);
        expect(res.weeks[3].spent).toBe(0);

        // Total In = 2050 + 2250 + 1750 + 2500 = 8550 (Allowance 7750 + Income 500 + Deposit 300)
        expect(res.totalIncome).toBe(8550);
        expect(res.totalSpent).toBe(260);
      });
    });

    describe('computeYearlyGullakMilestones', () => {
      it('aggregates annual rollover savings and deposits, finds best month and streak', () => {
        const yearStart = new Date(2026, 0, 1);
        const yearEnd = new Date(2026, 11, 31);

        const dailyRecords = [
          { date: '2026-01-05', saved: 200, status: 'saved' },
          { date: '2026-01-06', saved: 300, status: 'saved' },
          { date: '2026-01-07', saved: 150, status: 'saved' }, // 3-day streak
          { date: '2026-01-08', saved: 0, status: 'exceeded' },
          { date: '2026-09-10', saved: 500, status: 'saved' },
        ];

        const gullakDeposits = [
          { date: '2026-09-15', amount: 2000 },
        ];

        const metrics = computeYearlyGullakMilestones(
          yearStart,
          yearEnd,
          dailyRecords,
          gullakDeposits,
          3150
        );

        // Rollover: 200 + 300 + 150 + 500 = 1150
        // Deposits: 2000
        // Total saved in year: 3150
        expect(metrics.totalSavedInYear).toBe(3150);
        expect(metrics.annualRolloverSavings).toBe(1150);
        expect(metrics.annualDirectDeposits).toBe(2000);
        expect(metrics.bestStreakInYear).toBe(3);
        expect(metrics.savedDaysCount).toBe(4);
        // September has 500 (rollover) + 2000 (deposit) = 2500
        expect(metrics.bestSavingsMonth.month).toBe('September');
        expect(metrics.bestSavingsMonth.amount).toBe(2500);

        // Milestone evaluation
        expect(metrics.milestone.currentTierName).toBe('Starter Piggy'); // >= 1000
        expect(metrics.milestone.nextTierName).toBe('Smart Builder');   // 5000
        expect(metrics.milestone.nextTierAmount).toBe(5000);
        expect(metrics.milestone.remainingAmount).toBe(5000 - 3150);
      });

      it('handles empty year records safely without crashing', () => {
        const yearStart = new Date(2026, 0, 1);
        const yearEnd = new Date(2026, 11, 31);

        const metrics = computeYearlyGullakMilestones(yearStart, yearEnd, [], [], 0);
        expect(metrics.totalSavedInYear).toBe(0);
        expect(metrics.bestSavingsMonth.month).toBe('None');
        expect(metrics.bestStreakInYear).toBe(0);
        expect(metrics.milestone.progressRatio).toBe(0);
        expect(metrics.milestone.remainingAmount).toBe(1000);
      });

      it('includes budget period savings (weekly/monthly) into annual rollover totals', () => {
        const yearStart = new Date(2026, 0, 1);
        const yearEnd = new Date(2026, 11, 31);
        const budgetPeriods = [
          { activeStart: '2026-03-01', amountSaved: 5000, status: 'saved' },
          { activeStart: '2026-03-15', amountSaved: 3000, status: 'saved' },
        ];

        const metrics = computeYearlyGullakMilestones(yearStart, yearEnd, [], [], 8000, budgetPeriods);
        expect(metrics.totalSavedInYear).toBe(8000);
        expect(metrics.annualRolloverSavings).toBe(8000);
        expect(metrics.bestSavingsMonth.month).toBe('March');
        expect(metrics.bestSavingsMonth.amount).toBe(8000);
      });
    });
  });

  describe('computeDualRingState (Table D9 Specification)', () => {
    describe('D9 Row 1: 0 Income, 0 Spent (New Account / Empty Period)', () => {
      it('returns faint tracks for both rings and ₹0 center text', () => {
        const state = computeDualRingState(0, 0);
        expect(state.outerProgress).toBe(0);
        expect(state.innerProgress).toBe(0);
        expect(state.outerColor).toBe('#10B981');
        expect(state.innerColor).toBe('#E05A47');
        expect(state.centerPrimary).toBe('₹0');
        expect(state.centerSecondary).toBeUndefined();
        expect(state.centerText).toBe('₹0');
        expect(state.percentage).toBeNull();
        expect(state.isOverIncome).toBe(false);
        expect(state.accessibilityLabel).toBe('No income and no expenses. ₹0.');
      });

      it('handles negative or NaN inputs cleanly as zero', () => {
        const state = computeDualRingState(-50, NaN);
        expect(state.outerProgress).toBe(0);
        expect(state.innerProgress).toBe(0);
        expect(state.centerPrimary).toBe('₹0');
      });
    });

    describe('D9 Row 2: 0 Income, >0 Spent (Expense Only, No Percentage / Zero Division)', () => {
      it('returns faint outer track, 100% coral inner ring, and compact spent amount with "spent" suffix', () => {
        const state = computeDualRingState(0, 500);
        expect(state.outerProgress).toBe(0);
        expect(state.innerProgress).toBe(1);
        expect(state.outerColor).toBe('#10B981');
        expect(state.innerColor).toBe('#E05A47');
        expect(state.centerPrimary).toBe('₹500');
        expect(state.centerSecondary).toBe('spent');
        expect(state.centerText).toBe('₹500 spent');
        expect(state.percentage).toBeNull();
        expect(state.isOverIncome).toBe(true);
        expect(state.accessibilityLabel).toContain('Income ₹0');
        expect(state.accessibilityLabel).toContain('spent ₹500');
      });

      it('formats thousands with compact k suffix', () => {
        const state = computeDualRingState(0, 2500);
        expect(state.centerPrimary).toBe('₹2.5k');
        expect(state.centerText).toBe('₹2.5k spent');
        expect(state.percentage).toBeNull();
        expect(state.innerProgress).toBe(1);
      });
    });

    describe('D9 Row 3: >0 Income, ≤ income Spent (Within Budget / Normal Spending)', () => {
      it('returns 100% outer mint, proportional coral inner ring, and percentage spent', () => {
        const state = computeDualRingState(1000, 450);
        expect(state.outerProgress).toBe(1);
        expect(state.innerProgress).toBe(0.45);
        expect(state.outerColor).toBe('#10B981');
        expect(state.innerColor).toBe('#E05A47');
        expect(state.percentage).toBe(45);
        expect(state.centerPrimary).toBe('45%');
        expect(state.centerSecondary).toBe('spent');
        expect(state.centerText).toBe('45% spent');
        expect(state.isOverIncome).toBe(false);
      });

      it('handles 0 spent with positive income correctly', () => {
        const state = computeDualRingState(5000, 0);
        expect(state.outerProgress).toBe(1);
        expect(state.innerProgress).toBe(0);
        expect(state.percentage).toBe(0);
        expect(state.centerPrimary).toBe('0%');
        expect(state.centerSecondary).toBe('spent');
        expect(state.centerText).toBe('0% spent');
        expect(state.isOverIncome).toBe(false);
      });

      it('handles exactly 100% spent (spent === income) correctly', () => {
        const state = computeDualRingState(2000, 2000);
        expect(state.outerProgress).toBe(1);
        expect(state.innerProgress).toBe(1);
        expect(state.percentage).toBe(100);
        expect(state.centerPrimary).toBe('100%');
        expect(state.centerSecondary).toBe('spent');
        expect(state.innerColor).toBe('#E05A47'); // Coral at 100%, not red
        expect(state.isOverIncome).toBe(false);
      });
    });

    describe('D9 Row 4: >0 Income, > income Spent (Over Budget / Deficit)', () => {
      it('returns 100% outer mint, 100% red inner ring, and over-income percentage', () => {
        const state = computeDualRingState(1000, 1250);
        expect(state.outerProgress).toBe(1);
        expect(state.innerProgress).toBe(1); // Capped at 1.0 arc
        expect(state.outerColor).toBe('#10B981');
        expect(state.innerColor).toBe('#EF4444'); // Red when over
        expect(state.percentage).toBe(125);
        expect(state.centerPrimary).toBe('125%');
        expect(state.centerSecondary).toBe('spent');
        expect(state.centerText).toBe('125% spent');
        expect(state.isOverIncome).toBe(true);
        expect(state.accessibilityLabel).toContain('Over income');
      });

      it('caps display at 999%+ when percentage exceeds 999%', () => {
        const state = computeDualRingState(100, 1500); // 1500%
        expect(state.outerProgress).toBe(1);
        expect(state.innerProgress).toBe(1);
        expect(state.innerColor).toBe('#EF4444');
        expect(state.percentage).toBe(1500);
        expect(state.centerPrimary).toBe('999%+');
        expect(state.centerSecondary).toBe('spent');
        expect(state.centerText).toBe('999%+ spent');
        expect(state.isOverIncome).toBe(true);
      });
    });
  });

  describe('prepareCategoryBlockSegments Geometry & Arc Precision', () => {
    it('produces valid SVG paths for dominant category with span near 180 degrees', () => {
      const categories = [
        { id: '1', name: 'Food & Drinks', amount: 517.5, percentage: 54 },
        { id: '2', name: 'Transport', amount: 352.5, percentage: 37 },
        { id: '3', name: 'Subscription', amount: 50, percentage: 5 },
        { id: '4', name: 'Others', amount: 29, percentage: 3 },
        { id: '5', name: 'Studies', amount: 10, percentage: 1 },
      ];
      const segments = prepareCategoryBlockSegments(categories, 959, ['#FF857A', '#5B9EE1'], 140, 20, 5, 6);

      expect(segments).toHaveLength(5);
      segments.forEach((seg) => {
        expect(seg.path).toContain('M ');
        expect(seg.path).toContain('A ');
        expect(seg.path).toContain('Z');
        // Ensure no NaN coordinates exist
        expect(seg.path).not.toContain('NaN');
      });

      // Dominant category (Food & Drinks) has a raw span > 180 deg, but rounded arc span <= 180 deg.
      // Large arc flags must be 0 to prevent inverted arc loops.
      const dominant = segments[0];
      expect(dominant.name).toBe('Food & Drinks');
      expect(dominant.path).toMatch(/A \d+(\.\d+)? \d+(\.\d+)? 0 0 1/);
    });

    it('returns empty array when categories is empty or totalAmount <= 0', () => {
      expect(prepareCategoryBlockSegments([], 100, ['#FF857A'])).toEqual([]);
      expect(prepareCategoryBlockSegments([{ id: '1', name: 'Test', amount: 0, percentage: 0 }], 0, ['#FF857A'])).toEqual([]);
    });

    it('handles single category as full annulus ring', () => {
      const single = [{ id: '1', name: 'Food', amount: 500, percentage: 100 }];
      const segments = prepareCategoryBlockSegments(single, 500, ['#FF857A'], 140, 20);
      expect(segments).toHaveLength(1);
      expect(segments[0].path).toContain('M ');
      expect(segments[0].path).toContain('Z');
      expect(segments[0].startAngle).toBe(-90);
      expect(segments[0].endAngle).toBe(270);
    });
  });
});


