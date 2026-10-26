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
 * Why the screen waits until the pill has LANDED (not "almost landed"):
 *   Reanimated 4 on Fabric pauses its own UI-thread commits while a React commit is being mounted
 *   (ReanimatedCommitHook -> pauseReanimatedCommits, unpaused in ReanimatedMountHook). So ANY React
 *   render that lands while the pill is moving freezes the pill for one or more frames, then it jumps.
 *   That is the jitter. The old 200ms "commit early for overlap" left 6-12px of travel (80px on History)
 *   for that freeze to show. Heavy screens now hear about the change only when both edges are within
 *   PILL_LANDED_EPSILON_PX of the target (pillLandingMs). Rapid taps restart the wait.
 *
 * Why the pill is drawn as pieces (see pillPiecesFor):
 *   Animating `width` is a LAYOUT prop: every frame dirties Yoga and must go through a shadow-tree
 *   commit. Transform / opacity / backgroundColor are the only props Reanimated can apply straight to
 *   the native view. So the stretching pill is two round caps + a flat middle that is SCALED (a flat
 *   rectangle can be scaled without squashing any corner). Same shape, same motion, zero layout work.
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
 * Fallback commit delay, used only when the glide distance is not known yet (control not measured).
 * Normal taps use pillLandingMs(), which is exact for the real slot width.
 */
export const PILL_COMMIT_MS = PILL_SETTLE_MS;

/**
 * "Landed" means both edges are this close to the target. Below ~1px a held frame is invisible, so a
 * React commit after this point can never show as a jump.
 */
export const PILL_LANDED_EPSILON_PX = 1;

/** Extra wait added to every computed landing time (one 60Hz frame + scheduling slack). */
export const PILL_LANDING_MARGIN_MS = 24;

/** Hard ceiling so a broken layout can never make a screen wait forever. */
export const PILL_LANDING_MAX_MS = 900;

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

/**
 * Milliseconds until a spring released at rest at `from` stays within `epsilon` of `to` for good.
 * Same physics as simulateSpring. `clampOvershoot` mirrors Reanimated's overshootClamping.
 * Cost: at most PILL_LANDING_MAX_MS tiny steps, run once per tap on the JS thread.
 */
export function springLandingMs(
  spring: PillSpring,
  from: number,
  to: number,
  epsilon: number = PILL_LANDED_EPSILON_PX,
  clampOvershoot = false
): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  if (Math.abs(to - from) <= epsilon) return 0;
  const dt = 1 / 1000;
  const goingUp = to > from;
  let x = from;
  let v = 0;
  let lastOutside = 0;
  for (let t = 1; t <= PILL_LANDING_MAX_MS; t++) {
    const a = (-spring.stiffness * (x - to) - spring.damping * v) / spring.mass;
    v += a * dt;
    x += v * dt;
    if (clampOvershoot && (goingUp ? x > to : x < to)) {
      x = to;
      v = 0;
    }
    if (Math.abs(x - to) > epsilon) lastOutside = t;
  }
  // After `lastOutside` steps it was still outside; one step later it is inside for good.
  return lastOutside === 0 ? 0 : Math.min(PILL_LANDING_MAX_MS, lastOutside + 1);
}

/**
 * When the segmented pill will have LANDED for a move from (fromLeft, fromRight) to option `toIndex`.
 * Uses exactly the springs animateTo() will use. Returns PILL_COMMIT_MS when geometry is unknown.
 */
export function pillLandingMs(
  fromLeft: number,
  fromRight: number,
  toIndex: number,
  optionWidth: number
): number {
  if (!(optionWidth > 0)) return PILL_COMMIT_MS;
  const target = pillEdgesFor(toIndex, optionWidth);
  const springs = edgeSpringsFor(fromLeft, target.left, optionWidth);
  const left = springLandingMs(springs.left, fromLeft, target.left);
  const right = springLandingMs(springs.right, fromRight, target.right);
  const landed = Math.max(left, right);
  if (landed === 0) return 0;
  return Math.min(PILL_LANDING_MAX_MS, landed + PILL_LANDING_MARGIN_MS);
}

/** Narrowest the pill is ever drawn (old behaviour: never thinner than a dot). */
export const PILL_MIN_WIDTH = 8;

/**
 * Each cap is a rounded box 2*radius + 2*CAP_FLAT_PX wide. The extra flat part means the body's
 * cut edge always sits under a FLAT part of a cap, so no anti-aliasing seam can ever show.
 */
export const CAP_FLAT_PX = 1;

export interface PillPieces {
  /** Pill is not placed yet (both edges still 0). Hide it so it never flashes as a dot. */
  visible: boolean;
  leftCapX: number;
  rightCapX: number;
  bodyX: number;
  bodyScaleX: number;
  shadowX: number;
  shadowScaleX: number;
}

/** Width of one cap piece for a pill of corner radius `radius`. */
export function capWidthFor(radius: number): number {
  'worklet';
  return 2 * radius + 2 * CAP_FLAT_PX;
}

/**
 * Corner radius the pill really gets. React Native clamps a radius to half the height, so we do the
 * same; caps built from an unclamped radius would be wider than the real corners.
 */
export function pillRadiusFor(requestedRadius: number, pillHeight: number): number {
  const half = pillHeight > 0 ? pillHeight / 2 : 0;
  const r = requestedRadius > 0 ? requestedRadius : 0;
  return Math.max(0, Math.min(r, half));
}

/**
 * Transform-only geometry for a pill spanning [left, right] (track coordinates).
 *   - left cap: a rounded box of capWidthFor(radius) at `left`
 *   - right cap: the same box ending at `right`
 *   - body: a flat box of `bodyBase` width, translated + scaled to fill between the caps' centres
 *   - shadow: one rounded box of `shadowBase` width, translated + scaled to the whole pill (blurred,
 *     so the tiny corner stretch can't be seen; it never draws a fill)
 * transform order is [translateX, scaleX]; React Native scales around the view's centre.
 */
export function pillPiecesFor(
  left: number,
  right: number,
  radius: number,
  bodyBase: number,
  shadowBase: number
): PillPieces {
  'worklet';
  const raw = right - left;
  const width = raw > PILL_MIN_WIDTH ? raw : PILL_MIN_WIDTH;
  const end = left + width;
  const capW = 2 * radius + 2 * CAP_FLAT_PX;
  const rightCapX = end - capW > left ? end - capW : left;
  const a = left + radius + CAP_FLAT_PX;
  const b = end - radius - CAP_FLAT_PX;
  const span = b > a ? b - a : 0;
  const safeBody = bodyBase > 0 ? bodyBase : 1;
  const safeShadow = shadowBase > 0 ? shadowBase : 1;
  const bodyScale = span / safeBody;
  // When the pill is narrower than two caps the caps alone draw it; park the (invisible) body at the
  // pill's centre so it can never sit outside the pill.
  const bodyCentre = span > 0 ? (a + b) / 2 : (left + end) / 2;
  return {
    visible: raw > 1,
    leftCapX: left,
    rightCapX,
    bodyX: bodyCentre - safeBody / 2,
    bodyScaleX: bodyScale > 0.0001 ? bodyScale : 0.0001,
    shadowX: (left + end) / 2 - safeShadow / 2,
    shadowScaleX: width / safeShadow,
  };
}

/**
 * Pill colours must be opaque for the piece-based pill (the pieces overlap inside the pill, and a
 * see-through colour would show the overlap darker). Anything we cannot prove opaque returns false and
 * the control falls back to one scaled box (still transform-only).
 */
export function isOpaqueColor(color: string | undefined | null): boolean {
  if (!color || typeof color !== 'string') return false;
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return false;
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3 || hex.length === 6) return /^[0-9a-f]+$/.test(hex);
    if (hex.length === 4) return /^[0-9a-f]{3}f$/.test(hex);
    if (hex.length === 8) return /^[0-9a-f]{6}ff$/.test(hex);
    return false;
  }
  const fn = c.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length <= 3) return true;
    const alpha = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return Number.isFinite(alpha) && alpha >= 1;
  }
  // Named colours (e.g. 'white') are opaque.
  return /^[a-z]+$/.test(c);
}

/** Shadow under the moving pill. Same look as Android elevation 2, drawn behind (never above) the fill. */
export const PILL_BOX_SHADOW = '0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12)';
