/**
 * pullToHistoryUtils.ts
 *
 * Pure, React/RN-free helper functions for the Pull to History feature.
 * All functions are deterministic and side-effect-free — safe to unit-test in Vitest
 * without any React Native mocking.
 *
 * Architecture spec: pull_to_history_spec.md §D3, D4, D5
 * Motion spec: pull_to_history_motion_spec.md §2.2, §3.2
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Overscroll depth (in logical pixels) required to commit the pull gesture. */
export const PULL_TO_HISTORY_THRESHOLD = 72;

/**
 * How many dp above the natural content bottom the Phase A fade begins.
 * At this point scrollProgress starts rising from 0.
 */
export const PHASE_A_START_OFFSET = 120;

/**
 * The dp window over which scrollProgress ramps from 0 to 1.
 * Effect completes at: (contentHeight - layoutHeight - PHASE_A_START_OFFSET + PHASE_A_RANGE)
 * i.e. exactly at the natural bottom.
 */
export const PHASE_A_RANGE = 80;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrollMetrics {
  contentOffsetY: number;
  contentHeight: number;
  layoutHeight: number;
}

export interface PullReleaseMetrics extends ScrollMetrics {
  /** Whether any transactions are currently displayed. Phase B is disabled when false. */
  hasTransactions: boolean;
}

export interface PullReleaseResult {
  /** Computed overscroll in logical pixels (always >= 0). */
  overscroll: number;
  /** True only if overscroll >= threshold AND hasTransactions is true. */
  shouldCommit: boolean;
}

// ─── computeScrollProgress ───────────────────────────────────────────────────

/**
 * Returns a clamped [0, 1] float representing how far through the Phase A
 * row-exit window the current scroll position is.
 *
 * - 0.0 → scroll position is at or before the start of the fade window
 * - 1.0 → scroll position is at or past the natural content bottom
 *
 * Formula (from motion spec §2.2):
 *   progress = clamp(
 *     (contentOffsetY − (contentHeight − layoutHeight − PHASE_A_START_OFFSET)) / PHASE_A_RANGE,
 *     0, 1
 *   )
 *
 * The natural scroll maximum (where content bottom meets viewport bottom) is:
 *   maxScrollY = contentHeight - layoutHeight
 *
 * The fade window starts PHASE_A_START_OFFSET dp before that maximum.
 */
export function computeScrollProgress(metrics: ScrollMetrics): number {
  const { contentOffsetY, contentHeight, layoutHeight } = metrics;
  const maxScrollY = contentHeight - layoutHeight;
  const windowStart = maxScrollY - PHASE_A_START_OFFSET;
  const raw = (contentOffsetY - windowStart) / PHASE_A_RANGE;
  return Math.max(0, Math.min(1, raw));
}

// ─── evaluatePullRelease ──────────────────────────────────────────────────────

/**
 * Evaluates scroll metrics at the moment of finger-up (onScrollEndDrag) and
 * returns the overscroll amount and whether the gesture should commit.
 *
 * Overscroll formula (from spec §D4):
 *   overscroll = max(0, contentOffsetY + layoutHeight − contentHeight)
 *
 * shouldCommit is true only when:
 *   - overscroll >= PULL_TO_HISTORY_THRESHOLD, AND
 *   - hasTransactions is true (Phase B is disabled for empty state)
 */
export function evaluatePullRelease(metrics: PullReleaseMetrics): PullReleaseResult {
  const { contentOffsetY, contentHeight, layoutHeight, hasTransactions } = metrics;
  const overscroll = Math.max(0, contentOffsetY + layoutHeight - contentHeight);
  const shouldCommit = hasTransactions && overscroll >= PULL_TO_HISTORY_THRESHOLD;
  return { overscroll, shouldCommit };
}
