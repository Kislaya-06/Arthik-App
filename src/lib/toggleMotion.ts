/**
 * toggleMotion.ts
 *
 * Pure geometry + motion rules for the "squish" on/off switch (<AnimatedToggle/>).
 *
 * The idea, in one picture:
 *   A rigid ball that slides looks like a plastic part. A real "liquid" switch does three things:
 *     1. PRESS   - the thumb stretches sideways under your finger, like it is being squeezed.
 *     2. TRAVEL  - while it slides, the thumb is longest in the middle of the trip. Its front edge
 *                  runs ahead and its back edge lags, then it contracts as it lands.
 *     3. LAND    - it settles at the far end with a tiny squash, then rests at its normal size.
 *   The thumb's edge that is NOT travelling stays glued to the track end while you press, so the
 *   stretch always grows toward the middle (never out of the track).
 *
 * How the stretch is computed (so there is only ONE spring for position):
 *   progress (0 = off, 1 = on) is a single spring.  The travel stretch is sin(pi * progress), which is
 *   exactly 0 at both ends and biggest in the middle. So it needs no extra animation and can never get
 *   stuck. The press stretch is a second small spring (0 = rest, 1 = pressed).
 *
 * No React / React Native imports: deterministic and unit-testable.
 */

export interface ToggleGeometry {
  /** Gap between the track's inner edge and the thumb. */
  padding: number;
  /** Resting (round) thumb diameter. */
  thumbSize: number;
  /** Width the thumb can use inside the track (inner width minus both paddings). */
  travelSpace: number;
  /** Extra thumb width while pressed, in px. */
  stretch: number;
}

/** Travel stretch as a share of the thumb diameter (0.25 => a 22px ball stretches dynamically by 5.5px mid-flight). */
export const DEFAULT_STRETCH_RATIO = 0.25;
/** Extra stretch in the middle of the trip, as a share of the stretch allowance. */
export const TRAVEL_STRETCH_FACTOR = 1.0;
/** Share of stretch applied on stationary finger press (subtle tactile give, not a jarring pre-stretch). */
export const PRESS_STRETCH_FACTOR = 0.25;
/** The thumb is never allowed narrower than this share of its diameter (the landing squash floor). */
export const MIN_THUMB_RATIO = 0.92;

/** Slide: fast & snappy critically damped + clamped, so the thumb glides across quickly and never pokes past the track end. */
export const SLIDE_SPRING = { stiffness: 720, damping: 44, mass: 1, overshootClamping: true } as const;
/** Press stretch in: fast. */
export const PRESS_IN_SPRING = { stiffness: 700, damping: 34, mass: 1 } as const;
/** Press stretch out: a hair underdamped so the thumb lands with a tiny squash (under 1px). */
export const PRESS_OUT_SPRING = { stiffness: 420, damping: 25, mass: 1 } as const;
/** Track "lift" while pressed. */
export const TRACK_SPRING = { stiffness: 520, damping: 30, mass: 1 } as const;

/** Defaults: fast 200ms colour cross-fade matching snappy spring, subtle 1.025 press scale. */
export const DEFAULT_COLOR_DURATION_MS = 200;
export const DEFAULT_PRESS_SCALE = 1.025;

/**
 * Same numbers the old toggle used (1px border, 2.5px padding when height <= 28 else 3px), so every
 * existing size (50x26, 52x26, 58x30) keeps its exact resting look.
 */
export function toggleGeometry(width: number, height: number, stretchOverride?: number): ToggleGeometry {
  const borderWidth = 1;
  const innerHeight = height - borderWidth * 2;
  const innerWidth = width - borderWidth * 2;
  const padding = height <= 28 ? 2.5 : 3;
  const thumbSize = innerHeight - padding * 2;
  const travelSpace = innerWidth - padding * 2;
  const stretch =
    stretchOverride !== undefined
      ? Math.max(0, stretchOverride)
      : Math.round(thumbSize * DEFAULT_STRETCH_RATIO * 2) / 2;
  return { padding, thumbSize, travelSpace, stretch };
}

export interface ThumbLayout {
  left: number;
  width: number;
  scaleY: number;
}

/**
 * Where the thumb is, from the two animated numbers.
 *   progress: 0 (off, left) .. 1 (on, right)
 *   press:    0 (rest) .. 1 (pressed)
 * Includes React Bits squish physics: as width expands mid-flight, scaleY narrows to preserve area.
 */
export function thumbLayout(progress: number, press: number, g: ToggleGeometry): ThumbLayout {
  'worklet';
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const raw =
    g.thumbSize +
    press * g.stretch * PRESS_STRETCH_FACTOR +
    Math.sin(Math.PI * p) * g.stretch * TRAVEL_STRETCH_FACTOR;
  const minWidth = g.thumbSize * MIN_THUMB_RATIO;
  const width = raw < minWidth ? minWidth : raw > g.travelSpace ? g.travelSpace : raw;
  // Anchoring: at p=0 the left edge sits on the left padding, at p=1 the RIGHT edge sits on the right
  // padding, whatever the width is. In between the front edge runs ahead of the back edge.
  const left = g.padding + p * (g.travelSpace - width);
  const scaleY = width > 0 ? g.thumbSize / width : 1;
  return { left, width, scaleY };
}
