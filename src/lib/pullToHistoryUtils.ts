/**
 * pullToHistoryUtils.ts
 *
 * Pure, React/RN-free calculation and decision helper functions for the Pull to History feature.
 * All functions are deterministic and side-effect-free — safe to unit-test in Vitest.
 *
 * Specifications:
 * - Product Spec: pull_to_history_spec.md §4.A, §4.B, §4.C
 * - Motion Spec: pull_to_history_motion_spec.md §2, §3
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Authoritative commit threshold in logical pixels. */
export const PULL_TO_HISTORY_THRESHOLD = 72;

/** Maximum resisted visual travel in logical pixels. */
export const MAX_PULL_DEPTH = 88;

/**
 * Scroll distance window (in dp) approaching natural content bottom
 * over which Phase A progress ramps from 0 to 1.
 */
export const PHASE_A_RANGE = 80;

/** Linear damping coefficient for rubber-band resistance. */
export const RESISTANCE_COEFFICIENT = 0.45;

/** Default bottom detection tolerance (in dp). */
export const DEFAULT_BOTTOM_EPSILON = 4;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrollMetrics {
  contentOffsetY: number;
  contentHeight: number;
  layoutHeight: number;
}

export interface IndicatorVisualState {
  opacity: number;
  label: 'Swipe up for History' | 'Release for History';
  isArmed: boolean;
}

export interface PullReleaseDecision {
  shouldCommit: boolean;
  armed: boolean;
}

// ─── computeScrollProgress ───────────────────────────────────────────────────

/**
 * Computes normalized [0.0, 1.0] progress across the final 80dp window approaching
 * the natural content bottom.
 *
 * - 0.0 -> user is >= 80dp above the content bottom (or content does not scroll).
 * - 1.0 -> user is at or beyond the natural content bottom.
 */
export function computeScrollProgress(metrics: ScrollMetrics): number {
  const { contentOffsetY, contentHeight, layoutHeight } = metrics;
  const maxScrollY = contentHeight - layoutHeight;
  if (maxScrollY <= 0) return 0;

  const windowStart = maxScrollY - PHASE_A_RANGE;
  const raw = (contentOffsetY - windowStart) / PHASE_A_RANGE;
  return Math.max(0, Math.min(1, raw));
}

// ─── calculatePullResistance ─────────────────────────────────────────────────

/**
 * Computes resisted travel (0dp to 88dp max) from raw upward touch displacement.
 * Provides physical rubber-band resistance.
 *
 * For rawDeltaY <= 0, returns 0.
 * Caps strictly at MAX_PULL_DEPTH (88dp).
 */
export function calculatePullResistance(
  rawDeltaY: number,
  maxPull: number = MAX_PULL_DEPTH,
  coefficient: number = RESISTANCE_COEFFICIENT
): number {
  if (rawDeltaY <= 0) return 0;
  return Math.min(maxPull, rawDeltaY * coefficient);
}

/**
 * Computes progressive elastic rubber-band resistance (Instagram Vanish Mode style).
 * - Responsive and natural at initial pull
 * - Progressively stiffens and demands extra pull as depth nears 72dp
 * - Natural thumb pull travel (~80px) reaches the 72dp commit threshold
 * - Formula: depth = (MAX_CAP * rawPull) / (rawPull + K)
 */
export function calculateProgressiveResistance(
  rawDeltaY: number,
  maxCap: number = 99,
  k: number = 30
): number {
  if (rawDeltaY <= 0) return 0;
  const depth = (maxCap * rawDeltaY) / (rawDeltaY + k);
  return Math.min(MAX_PULL_DEPTH, depth);
}

/**
 * Target raw upward displacement (in dp) required to fully fill the progress ring.
 * Calibrated to ~140dp of deliberate thumb movement (Instagram Vanish Mode feel).
 */
export const PULL_TRAVEL_MAX = 140;

/**
 * Computes progressive elastic rubber-band resistance (Instagram Vanish Mode style).
 * - Fast, responsive initial fill
 * - Progressively stiffens and demands extra thumb travel as depth nears 100%
 * - Formula: progress = 1 - (1 - min(1, rawPull / travel))^1.6
 * - Returns { depth, progress, isArmed }
 */
export function calculateWeightedPullProgress(
  rawDeltaY: number,
  travelDistance: number = PULL_TRAVEL_MAX,
  threshold: number = PULL_TO_HISTORY_THRESHOLD
): {
  depth: number;
  progress: number;
  isArmed: boolean;
} {
  if (rawDeltaY <= 0) {
    return { depth: 0, progress: 0, isArmed: false };
  }
  const u = Math.min(1, rawDeltaY / travelDistance);
  const progress = Math.min(1, Math.max(0, 1 - Math.pow(1 - u, 1.6)));
  const depth = progress * threshold;
  return {
    depth,
    progress,
    isArmed: progress >= 1,
  };
}

// ─── isAtScrollBottom ────────────────────────────────────────────────────────

/**
 * Determines whether the ScrollView is settled within epsilon (default <= 4dp)
 * of its natural content bottom.
 */
export function isAtScrollBottom(
  contentOffsetY: number,
  layoutHeight: number,
  contentHeight: number,
  epsilon: number = DEFAULT_BOTTOM_EPSILON
): boolean {
  if (layoutHeight <= 0 || contentHeight <= 0) return false;
  const maxScrollY = contentHeight - layoutHeight;
  if (maxScrollY <= 0) {
    // Content fits entirely in viewport
    return contentOffsetY >= -epsilon;
  }
  return contentOffsetY >= maxScrollY - epsilon;
}

// ─── evaluatePullRelease ─────────────────────────────────────────────────────

/**
 * Evaluates whether an in-progress pull gesture has satisfied the authoritative
 * 72dp commit threshold upon release.
 *
 * Exact rules:
 * - pullDepth < 72dp -> shouldCommit: false, armed: false (Cancel / Spring)
 * - pullDepth >= 72dp -> shouldCommit: true, armed: true (Commit -> History)
 */
export function evaluatePullRelease(
  pullDepth: number,
  threshold: number = PULL_TO_HISTORY_THRESHOLD
): PullReleaseDecision {
  const armed = pullDepth >= threshold;
  return {
    shouldCommit: armed,
    armed,
  };
}

// ─── getIndicatorVisualState ─────────────────────────────────────────────────

/**
 * Maps live pull depth to indicator opacity, label, and armed state.
 *
 * - Opacity: 0.0 at 0dp, ramps linearly to 1.0 at 36dp, maintains 1.0 through 88dp.
 * - Label: 'Pull for History' below 72dp; 'Release for History' at/above 72dp.
 * - isArmed: true only when pullDepth >= 72dp.
 */
export function getIndicatorVisualState(
  pullDepth: number,
  threshold: number = PULL_TO_HISTORY_THRESHOLD
): IndicatorVisualState {
  const isArmed = pullDepth >= threshold;
  const clampedDepth = Math.max(0, Math.min(MAX_PULL_DEPTH, pullDepth));
  const opacity = Math.min(1, clampedDepth / 36);
  const label = isArmed ? 'Release for History' : 'Swipe up for History';

  return {
    opacity,
    label,
    isArmed,
  };
}
