import { describe, it, expect } from 'vitest';
import {
  computeScrollProgress,
  evaluatePullRelease,
  PULL_TO_HISTORY_THRESHOLD,
  PHASE_A_START_OFFSET,
  PHASE_A_RANGE,
} from '../src/lib/pullToHistoryUtils';

// ─── evaluatePullRelease ──────────────────────────────────────────────────────

describe('evaluatePullRelease', () => {
  // contentHeight=800, layoutHeight=600 → maxScrollY=200
  // At contentOffsetY=200 we are exactly at natural bottom (overscroll=0)
  // overscroll = max(0, contentOffsetY + layoutHeight - contentHeight)

  it('not at bottom: contentOffsetY=100, contentHeight=800, layoutHeight=600', () => {
    const result = evaluatePullRelease({
      contentOffsetY: 100,
      contentHeight: 800,
      layoutHeight: 600,
      hasTransactions: true,
    });
    expect(result.overscroll).toBe(0);
    expect(result.shouldCommit).toBe(false);
  });

  it('exactly at natural bottom: contentOffsetY=200, contentHeight=800, layoutHeight=600', () => {
    const result = evaluatePullRelease({
      contentOffsetY: 200,
      contentHeight: 800,
      layoutHeight: 600,
      hasTransactions: true,
    });
    expect(result.overscroll).toBe(0);
    expect(result.shouldCommit).toBe(false);
  });

  it('under threshold: overscroll = 40 dp', () => {
    const result = evaluatePullRelease({
      contentOffsetY: 240, // 200 + 40
      contentHeight: 800,
      layoutHeight: 600,
      hasTransactions: true,
    });
    expect(result.overscroll).toBe(40);
    expect(result.shouldCommit).toBe(false);
  });

  it('exactly at threshold: overscroll = 72 dp', () => {
    const result = evaluatePullRelease({
      contentOffsetY: 272, // 200 + 72
      contentHeight: 800,
      layoutHeight: 600,
      hasTransactions: true,
    });
    expect(result.overscroll).toBe(PULL_TO_HISTORY_THRESHOLD);
    expect(result.shouldCommit).toBe(true);
  });

  it('above threshold: overscroll = 120 dp', () => {
    const result = evaluatePullRelease({
      contentOffsetY: 320, // 200 + 120
      contentHeight: 800,
      layoutHeight: 600,
      hasTransactions: true,
    });
    expect(result.overscroll).toBe(120);
    expect(result.shouldCommit).toBe(true);
  });

  it('zero transactions guard: hasTransactions=false, overscroll > threshold → shouldCommit=false', () => {
    const result = evaluatePullRelease({
      contentOffsetY: 400, // 200 + 200 — well above threshold
      contentHeight: 800,
      layoutHeight: 600,
      hasTransactions: false,
    });
    expect(result.overscroll).toBe(200);
    expect(result.shouldCommit).toBe(false);
  });

  it('overscroll is never negative', () => {
    const result = evaluatePullRelease({
      contentOffsetY: 0,
      contentHeight: 800,
      layoutHeight: 600,
      hasTransactions: true,
    });
    expect(result.overscroll).toBeGreaterThanOrEqual(0);
  });
});

// ─── computeScrollProgress ───────────────────────────────────────────────────

describe('computeScrollProgress', () => {
  // contentHeight=800, layoutHeight=600
  // maxScrollY = 200
  // windowStart = 200 - PHASE_A_START_OFFSET (120) = 80
  // windowEnd   = 80 + PHASE_A_RANGE (80) = 160
  // At contentOffsetY=80:  progress = (80-80)/80 = 0.0
  // At contentOffsetY=120: progress = (120-80)/80 = 0.5
  // At contentOffsetY=160: progress = (160-80)/80 = 1.0
  // At contentOffsetY=200: progress = clamped → 1.0

  it('well above bottom: progress = 0.0', () => {
    const progress = computeScrollProgress({
      contentOffsetY: 0,
      contentHeight: 800,
      layoutHeight: 600,
    });
    expect(progress).toBe(0);
  });

  it('before window start: progress = 0.0', () => {
    const progress = computeScrollProgress({
      contentOffsetY: 60, // below windowStart=80
      contentHeight: 800,
      layoutHeight: 600,
    });
    expect(progress).toBe(0);
  });

  it('at window start: progress = 0.0', () => {
    const progress = computeScrollProgress({
      contentOffsetY: 80, // exactly windowStart
      contentHeight: 800,
      layoutHeight: 600,
    });
    expect(progress).toBe(0);
  });

  it('at 50% into exit zone: progress ≈ 0.5', () => {
    const progress = computeScrollProgress({
      contentOffsetY: 120, // midpoint of window (80 + 40)
      contentHeight: 800,
      layoutHeight: 600,
    });
    expect(Math.abs(progress - 0.5)).toBeLessThanOrEqual(0.05);
  });

  it('at window end (natural bottom): progress = 1.0', () => {
    const progress = computeScrollProgress({
      contentOffsetY: 160, // 80 + PHASE_A_RANGE
      contentHeight: 800,
      layoutHeight: 600,
    });
    expect(progress).toBe(1);
  });

  it('past natural bottom: progress clamped to 1.0', () => {
    const progress = computeScrollProgress({
      contentOffsetY: 250, // beyond maxScrollY
      contentHeight: 800,
      layoutHeight: 600,
    });
    expect(progress).toBe(1);
  });

  it('scrolled back above exit zone: progress = 0.0 (no negative)', () => {
    const progress = computeScrollProgress({
      contentOffsetY: 10,
      contentHeight: 800,
      layoutHeight: 600,
    });
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBe(0);
  });

  it('constants are exported and have expected values', () => {
    expect(PULL_TO_HISTORY_THRESHOLD).toBe(72);
    expect(PHASE_A_START_OFFSET).toBe(120);
    expect(PHASE_A_RANGE).toBe(80);
  });
});
