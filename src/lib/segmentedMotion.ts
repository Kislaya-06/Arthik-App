/**
 * segmentedMotion.ts
 *
 * Pure motion rules for the sliding pill in <SegmentedControl/> (Home All/Daily/Weekly/Monthly,
 * Insights Weekly/Monthly/Yearly, Savings history filters, Cash/UPI, ...).
 *
 * Why the pill is two edges and not one box:
 *   A box that just slides looks like a sticker being dragged. iOS pills feel "liquid" because the
 *   edge in the direction of travel leaves first and the back edge catches up a moment later. So the
 *   pill stretches while it moves and snaps back to its normal width when it lands.
 *   We get that for free by giving the two edges two springs: a quick one for the leading edge and a
 *   slightly softer one for the trailing edge. No timing curves, no scale (scale would squash the
 *   round corners).
 *
 * Why the screen waits for PILL_SETTLE_MS:
 *   Changing a big screen (new totals, rolling digits, card resize) costs frames. If that work lands
 *   while the pill is still gliding, the pill stutters. So heavy screens ask the control to report the
 *   change only after the pill has landed (commitOnSettle). Rapid taps restart the wait, so only the
 *   final choice is reported.
 *
 * No React / React Native imports: deterministic and unit-testable.
 */

export interface PillSpring {
  stiffness: number;
  damping: number;
  mass: number;
}

/** Leading edge: quick, a hair under critical damping (≈0.3% overshoot, i.e. under 1px). */
export const LEADING_EDGE_SPRING: PillSpring = { stiffness: 700, damping: 46, mass: 1 };
/** Trailing edge for a ONE-slot move: softer, so it lags behind and the pill stretches in flight. */
export const TRAILING_EDGE_SPRING: PillSpring = { stiffness: 420, damping: 40, mass: 1 };
/** Each extra slot of distance makes the trailing edge this much stiffer (see trailingSpringFor). */
export const TRAILING_STIFFNESS_PER_EXTRA_SLOT = 80;
/** Damping as a share of critical damping for the trailing edge (no wobble). */
export const TRAILING_DAMPING_RATIO = 0.97;

/**
 * Trailing-edge spring for a move of `slots` option-widths.
 *
 * With one fixed spring the lag between the two edges grows with distance: a 3-slot jump (All -> Monthly)
 * stretched the pill to 1.56x its width, a blob. Stiffening the trailing edge a little for longer moves
 * keeps the stretch at about 19% / 28% / 29% for 1 / 2 / 3 slots AND makes every jump land in about the
 * same ~285ms, which is how iOS controls feel (duration does not grow with distance).
 */
export function trailingSpringFor(slots: number): PillSpring {
  'worklet';
  const extra = slots > 1 ? slots - 1 : 0;
  const stiffness = TRAILING_EDGE_SPRING.stiffness + TRAILING_STIFFNESS_PER_EXTRA_SLOT * extra;
  return {
    stiffness,
    damping: 2 * Math.sqrt(stiffness) * TRAILING_DAMPING_RATIO,
    mass: 1,
  };
}

/**
 * Time after the LAST tap by which both edges are within ~1.5px of the target on ANY jump length
 * (they all settle in about 285ms, see trailingSpringFor). Landing haptic fires at this moment.
 */
export const PILL_SETTLE_MS = 320;

/**
 * Time after the LAST tap by which the pill is 95%+ arrived (leading edge landed, trailing edge
 * within ~6px). Heavy screens (Insights, Home) commit here to smoothly overlap rolling numbers
 * and card transitions with the pill's soft deceleration.
 */
export const PILL_COMMIT_MS = 200;

/** Soft "landing" tick when the pill arrives (the selection tick still fires on tap). */
export const LANDING_HAPTIC_ENABLED = true;

/**
 * Width of one option slot. `containerWidth` is the onLayout width of the control, which INCLUDES its
 * border, so the usable width is smaller by two borders. Ignoring the border (the old formula) made the
 * pill wider than the real slots, so it drifted up to ~1.5px off the labels by the last option and left a
 * 2px gap on the right against 4px on the left.
 */
export function optionWidthFor(
  containerWidth: number,
  optionCount: number,
  trackInset: number,
  borderWidth = 1
): number {
  if (!(containerWidth > 0) || optionCount <= 0) return 0;
  const w = (containerWidth - borderWidth * 2 - trackInset * 2) / optionCount;
  return w > 0 ? w : 0;
}

/**
 * Opacity of the INACTIVE-colour label copy. It stays fully visible until the pill is mostly under the
 * label, then fades out completely. If it stayed at 1 under the active copy, the grey anti-aliased edges
 * of the glyphs would show as a faint fringe around the active-colour text.
 */
export function inactiveLabelOpacity(activeProgress: number): number {
  'worklet';
  if (activeProgress <= 0.6) return 1;
  if (activeProgress >= 1) return 0;
  return 1 - (activeProgress - 0.6) / 0.4;
}

export interface PillEdges {
  left: number;
  right: number;
}

/** Target edges (track coordinates) for option `index` when every option is `optionWidth` wide. */
export function pillEdgesFor(index: number, optionWidth: number): PillEdges {
  return { left: index * optionWidth, right: (index + 1) * optionWidth };
}

/**
 * Which spring each edge uses for a move. Moving right => right edge leads. Moving left => left edge
 * leads. Decided from where the pill is NOW (so a re-tap mid-flight picks the right edge).
 */
export function edgeSpringsFor(
  currentLeft: number,
  targetLeft: number,
  optionWidth: number
): { left: PillSpring; right: PillSpring } {
  'worklet';
  const movingRight = targetLeft >= currentLeft;
  const distance = movingRight ? targetLeft - currentLeft : currentLeft - targetLeft;
  const slots = optionWidth > 0 ? distance / optionWidth : 1;
  const trailing = trailingSpringFor(slots);
  return movingRight
    ? { left: trailing, right: LEADING_EDGE_SPRING }
    : { left: LEADING_EDGE_SPRING, right: trailing };
}

/**
 * How "selected" option `index` looks (0..1) given the pill's live edges. 1 when the pill's centre is
 * on the option, falling to 0 one option away. Drives the label colour cross-fade so the text changes
 * colour exactly as the pill passes under it, not when React re-renders.
 */
export function labelActiveProgress(
  pillLeft: number,
  pillRight: number,
  index: number,
  optionWidth: number
): number {
  'worklet';
  if (!(optionWidth > 0)) return 0;
  const pillCentre = (pillLeft + pillRight) / 2;
  const optionCentre = index * optionWidth + optionWidth / 2;
  const t = 1 - Math.abs(pillCentre - optionCentre) / optionWidth;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Plain-JS spring step simulation (same physics as Reanimated's physics-based withSpring), used by
 * tests to prove PILL_SETTLE_MS and the stretch amount stay true if someone tunes the springs.
 */
export function simulateSpring(spring: PillSpring, from: number, to: number, ms: number): number {
  const dt = 1 / 1000;
  let x = from;
  let v = 0;
  for (let t = 0; t < ms; t++) {
    const a = (-spring.stiffness * (x - to) - spring.damping * v) / spring.mass;
    v += a * dt;
    x += v * dt;
  }
  return x;
}
