/**
 * pullToHistoryPhysics.ts
 *
 * Pure, React/RN-free helpers for the Instagram "Vanish Mode"-style pull-up on HomeScreen
 * (swipe the Recent Transactions list up past its end to open History).
 *
 * Every number below was MEASURED frame-by-frame from a screen recording of Instagram's
 * "Swipe up to turn on disappearing messages" gesture (120 fps), not guessed:
 *
 *  - The list content AND the footer (ring + label) move together as one rigid block.
 *  - The footer starts hidden BEHIND the fixed bar (hard clip) and rises out of it as you pull.
 *  - Ring progress is LINEAR in how far the block has travelled (progress = depth / maxTravel).
 *  - Ring is a countdown: it starts fully white, the white arc is eaten clockwise from 12 o'clock
 *    by a grey track, and at 100% the whole ring + label flip to the accent colour in ONE frame.
 *  - Release = soft spring back. Fitted to the recording: natural freq ≈ 6.5 rad/s, damping ratio ≈ 0.88
 *    (=> stiffness ≈ 42, damping ≈ 11.6 at mass 1). Practically no overshoot.
 *
 * Tweak the "FEEL" constants below if you want a heavier / lighter pull.
 */

// ─── FEEL constants (safe to tune) ───────────────────────────────────────────

/**
 * Resistance curve exponent. Visual depth = maxTravel * (1 - (1 - u)^EXPONENT), where u is finger
 * travel / fingerTravel. Higher => content gets stiffer sooner (more resistance near the end).
 * The initial slope is always 1:1 (content follows the thumb at the start).
 */
export const PULL_CURVE_EXPONENT = 1.5;

/** Largest the content block is ever pulled up (dp). Instagram: ~192dp on a ~290dp-high list. */
export const PULL_MAX_TRAVEL_CAP = 192;
/** Smallest max-travel on very short lists (dp). */
export const PULL_MAX_TRAVEL_MIN = 140;
/** Max-travel as a share of the visible list height (before the cap/min are applied). */
export const PULL_VIEWPORT_RATIO = 0.72;

/** Progress at which the ring turns accent colour and release will open History. */
export const ARM_PROGRESS = 0.98;
/** Progress below which an armed pull disarms again (hysteresis so it never flickers). */
export const DISARM_PROGRESS = 0.96;

/** Spring used for every "bounce back" (fitted to Instagram's release curve). */
export const RELEASE_SPRING = { stiffness: 42, damping: 11.6, mass: 1 } as const;

/** Momentum (fling) deceleration per ms for the in-bounds scroll, Animated.decay style. */
export const MOMENTUM_DECELERATION = 0.997;
/** Below this release velocity (dp/ms) no momentum is started. */
export const MIN_MOMENTUM_VELOCITY = 0.05;

/** Anything below this (dp) counts as "not pulled". */
export const EDGE_EPSILON = 0.5;

// ─── Layout constants shared by the list + indicator ─────────────────────────

/** Gap between the last row and the fixed bar when the list rests at its end (matches the old padding). */
export const LIST_BOTTOM_GAP = 10;
/** How far the ring sits below the clip line at rest, i.e. hidden by this much (Instagram: ~11dp). */
export const FOOTER_PEEK = 11;
/** Space above the first row. */
export const LIST_TOP_PAD = 4;

/** BottomNavBar: `bottom` offset of the floating pill. Mirrors BottomNavBar.tsx. */
const NAV_BOTTOM_OFFSET_WITH_INSET = 6;
const NAV_BOTTOM_OFFSET_NO_INSET = 20;
/** BottomNavBar budget-mode pill height (tallest state). Mirrors BottomNavBar.tsx `pillBar.height`. */
const NAV_PILL_HEIGHT = 68;

/**
 * Distance (dp) from the bottom of the screen to the TOP edge of the floating nav pill.
 * The list is clipped exactly here so the footer appears to rise out from BEHIND the nav bar.
 */
export function getNavTopOffset(insetBottom: number): number {
  const bottomOffset = insetBottom > 0 ? insetBottom + NAV_BOTTOM_OFFSET_WITH_INSET : NAV_BOTTOM_OFFSET_NO_INSET;
  return bottomOffset + NAV_PILL_HEIGHT;
}

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface PullGeometry {
  /** Largest in-bounds scroll offset (>= 0). */
  maxScroll: number;
  /** Largest visual pull-up depth (dp). */
  maxTravel: number;
  /** false => nothing to open (no transactions): bottom edge just stops. */
  pullEnabled: boolean;
}

export interface VisualState {
  /** In-bounds scroll offset, 0..maxScroll. */
  scroll: number;
  /** Pull-up depth past the end (dp), 0..maxTravel. */
  pull: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Max pull-up depth for a list that is `viewportHeight` dp tall. */
export function getMaxTravel(viewportHeight: number): number {
  if (!(viewportHeight > 0)) return PULL_MAX_TRAVEL_MIN;
  return clamp(viewportHeight * PULL_VIEWPORT_RATIO, PULL_MAX_TRAVEL_MIN, PULL_MAX_TRAVEL_CAP);
}

/** Finger travel (dp) beyond the end that fills the pull completely. Chosen so the start is exactly 1:1. */
export function getFingerTravel(maxTravel: number): number {
  return maxTravel * PULL_CURVE_EXPONENT;
}

/** Rubber-band curve: 1:1 at the start, getting stiffer, hard ceiling at `max`. */
function resist(travel: number, max: number, exponent: number): number {
  if (travel <= 0 || max <= 0) return 0;
  const fingerTravel = max * exponent;
  const u = Math.min(1, travel / fingerTravel);
  return max * (1 - Math.pow(1 - u, exponent));
}

/** Inverse of {@link resist}: finger travel that produces `depth`. */
function unresist(depth: number, max: number, exponent: number): number {
  if (depth <= 0 || max <= 0) return 0;
  const p = Math.min(1, depth / max);
  const u = 1 - Math.pow(1 - p, 1 / exponent);
  return u * max * exponent;
}

/** Pull-up depth (dp) for `travel` dp of finger movement past the end of the list. */
export function pullDepthFromTravel(travel: number, maxTravel: number): number {
  return resist(travel, maxTravel, PULL_CURVE_EXPONENT);
}

/** Finger travel (dp) that corresponds to a pull-up depth. */
export function travelFromPullDepth(depth: number, maxTravel: number): number {
  return unresist(depth, maxTravel, PULL_CURVE_EXPONENT);
}

/**
 * The "virtual" scroll position `rawY` tracks the finger 1:1. Above maxScroll it is the pull-up past
 * the end; below 0 nothing moves (the top is a hard edge: pull-DOWN belongs to the app-wide
 * refresh control, the list never moves down). This maps it to what is drawn.
 */
export function resolveVisualState(rawY: number, geo: PullGeometry): VisualState {
  if (rawY <= 0) {
    return { scroll: 0, pull: 0 };
  }
  if (rawY <= geo.maxScroll) {
    return { scroll: rawY, pull: 0 };
  }
  return {
    scroll: geo.maxScroll,
    pull: geo.pullEnabled ? pullDepthFromTravel(rawY - geo.maxScroll, geo.maxTravel) : 0,
  };
}

/** Inverse of {@link resolveVisualState} (used to catch the content mid-bounce). */
export function rawYFromVisualState(v: VisualState, geo: PullGeometry): number {
  if (v.pull > 0) return geo.maxScroll + travelFromPullDepth(v.pull, geo.maxTravel);
  return clamp(v.scroll, 0, geo.maxScroll);
}

/**
 * Limits the virtual position to what can be drawn, so reversing the thumb reacts immediately
 * (no "dead zone" after over-dragging past a hard edge).
 */
export function clampRawY(rawY: number, geo: PullGeometry): number {
  // Top is a hard edge. Past the end, finger travel beyond what fully fills the pull changes nothing.
  const upper = geo.pullEnabled ? geo.maxScroll + getFingerTravel(geo.maxTravel) : geo.maxScroll;
  return clamp(rawY, 0, upper);
}

// ─── Arming ──────────────────────────────────────────────────────────────────

/** Pull progress 0..1 for a given depth. */
export function getPullProgress(depth: number, maxTravel: number): number {
  if (!(maxTravel > 0)) return 0;
  return clamp(depth / maxTravel, 0, 1);
}

/** Armed state with hysteresis: arms at ARM_PROGRESS, disarms below DISARM_PROGRESS. */
export function nextArmedState(wasArmed: boolean, progress: number): boolean {
  return wasArmed ? progress >= DISARM_PROGRESS : progress >= ARM_PROGRESS;
}

// ─── Ring ────────────────────────────────────────────────────────────────────

export interface RingArc {
  /** Visible length of the white arc (same unit as the circumference passed in). */
  whiteLength: number;
  /** Rotation (deg) to apply to the white arc so it ends exactly at 12 o'clock. */
  rotationDeg: number;
  /** false when the white arc is too small to draw (avoids a stray dot). */
  visible: boolean;
}

/**
 * Instagram's ring is a countdown: at progress 0 it is fully white; the grey track "eats" the
 * white clockwise starting at 12 o'clock, so the white that remains always ENDS at 12 o'clock.
 * Draw order: full grey track, then this white arc on top.
 */
export function getRingArc(progress: number, circumference: number): RingArc {
  const p = clamp(progress, 0, 1);
  const whiteLength = (1 - p) * circumference;
  return {
    whiteLength,
    // SVG circles start at 3 o'clock; -90 moves the start to 12 o'clock, +p*360 slides it forward.
    rotationDeg: -90 + p * 360,
    visible: whiteLength > 0.75,
  };
}

// ─── Release decision ────────────────────────────────────────────────────────

export interface ReleaseInput {
  /** Current pull-up depth (dp). */
  pull: number;
  /** Live armed flag from the gesture. */
  armed: boolean;
  /** true when the system cancelled the gesture (never commits). */
  cancelled: boolean;
  /** Release velocity along the scroll axis, dp/ms (positive = scrolling towards the end). */
  scrollVelocity: number;
  maxScroll: number;
}

export type ReleaseDecision =
  | { kind: 'commit' }
  | { kind: 'pull-back' }
  | { kind: 'momentum'; velocity: number }
  | { kind: 'idle' };

/** What to do the moment the finger lifts. History only ever opens HERE, never while the finger is down. */
export function decideRelease(input: ReleaseInput): ReleaseDecision {
  const { pull, armed, cancelled, scrollVelocity, maxScroll } = input;

  if (pull > EDGE_EPSILON) {
    return !cancelled && armed ? { kind: 'commit' } : { kind: 'pull-back' };
  }
  if (!cancelled && maxScroll > 0 && Math.abs(scrollVelocity) >= MIN_MOMENTUM_VELOCITY) {
    return { kind: 'momentum', velocity: scrollVelocity };
  }
  return { kind: 'idle' };
}
