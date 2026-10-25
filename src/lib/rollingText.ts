/**
 * rollingText.ts
 *
 * Pure planning logic for the "rolling digits" animation (odometer / slot-reel style):
 * every digit of a changed number spins through the digit wheel (0-9) and settles on its new value.
 *
 * Measured from the reference recording (see RollingText.tsx):
 *  - All digit wheels start TOGETHER and spin about one full revolution, then ease out.
 *  - Digits that did not change (the "1" in 1,250 -> 1,050) still spin.
 *  - Direction follows the value: a number that goes DOWN rolls downward (new digits enter from the
 *    top), a number that goes UP rolls upward (new digits enter from the bottom).
 *  - Only digits move. Symbols, commas and words stay still.
 *
 * No React / React Native imports: deterministic and unit-testable.
 */

// ─── FEEL constants (safe to tune) ───────────────────────────────────────────

/**
 * Total time of one roll. 240ms: fast, responsive Apple-grade micro-animation.
 * Settles crisp and immediate without delay. Paired with ROLL_EASING below.
 */
export const ROLL_DURATION_MS = 240;
/**
 * Ease-out with a long, soft landing (like a reel coming to rest), as cubic-bezier control points.
 * Fast start so the change registers instantly, then a gentle settle on the final digit.
 */
export const ROLL_EASING: readonly [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Extra full revolutions every digit makes on top of the distance to its new value. 1 = matches the recording. */
export const ROLL_EXTRA_CYCLES = 1;
/**
 * Delay between neighbouring digits (ms, left to right). A crisp 10ms ripple makes the number feel
 * like it is being "typed in" by a mechanism, instead of one block jumping.
 */
export const ROLL_STAGGER_MS = 10;
/** true = digits that did not change also spin. false = only changed digits spin (Apple Wallet style). */
export const SPIN_UNCHANGED_DIGITS = false;

/** 11-glyph wheel strip (0-9 + wrap-around 0) */
export const GLYPHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;

/**
 * Deterministic glyph sequence for a single digit roll.
 * When dir === 1 (up), digits ascend from roll.from to roll.to.
 * When dir === -1 (down), digits descend from roll.from to roll.to.
 * Eliminates modulo discontinuities and font baseline clipping on native Android.
 */
export function getWheelGlyphs(roll: DigitRoll): number[] {
  const count = roll.travel + 1;
  const glyphs: number[] = new Array(count);
  if (roll.dir === 1) {
    for (let i = 0; i < count; i++) {
      glyphs[i] = (roll.from + i) % 10;
    }
  } else {
    for (let i = 0; i < count; i++) {
      glyphs[i] = (roll.to + i) % 10;
    }
  }
  return glyphs;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type RollDirection = 1 | -1;

export interface DigitRoll {
  /** Digit shown when the roll starts (0-9). A digit that did not exist before starts at 0. */
  from: number;
  /** Digit the wheel settles on (0-9). */
  to: number;
  /** +1 = wheel moves up (values increase), -1 = wheel moves down (values decrease). */
  dir: RollDirection;
  /** Distance in digit steps (always > 0). */
  travel: number;
  /** true when the digit did not exist in the old text (e.g. 999 -> 1,000). */
  isNew: boolean;
}

export interface RollPlan {
  /** Map: character index in the NEW text -> its roll. Only digits that roll are present. */
  rolls: Record<number, DigitRoll>;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/** A number as people write it: digits, optionally grouped with commas, optionally a decimal part. */
const NUMBER_GROUP = /\d[\d,]*(?:\.\d+)?/g;

interface ParsedText {
  /** Text between numbers (length = groups.length + 1). */
  statics: string[];
  /** The number groups, e.g. "1,250". */
  groups: Array<{ raw: string; start: number }>;
}

export function parseText(text: string): ParsedText {
  const statics: string[] = [];
  const groups: ParsedText['groups'] = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER_GROUP)) {
    const start = m.index ?? 0;
    statics.push(text.slice(last, start));
    groups.push({ raw: m[0], start });
    last = start + m[0].length;
  }
  statics.push(text.slice(last));
  return { statics, groups };
}

const groupValue = (raw: string): number => parseFloat(raw.replace(/,/g, '')) || 0;
const groupDigits = (raw: string): number[] => raw.replace(/[^\d]/g, '').split('').map(Number);

const mod10 = (n: number): number => ((n % 10) + 10) % 10;

/** Steps a wheel has to move from `from` to `to` going in `dir` (0..9). */
export function stepsBetween(from: number, to: number, dir: RollDirection): number {
  return dir === 1 ? mod10(to - from) : mod10(from - to);
}

// ─── Planning ────────────────────────────────────────────────────────────────

/**
 * Decides which digits roll when the text goes from `prev` to `next`.
 * Returns null when nothing should animate: same text, or the words/symbols around the numbers differ
 * (a different sentence is simply swapped).
 */
export function planRoll(prev: string, next: string, forceSpin: boolean = false): RollPlan | null {
  if (prev === next && !forceSpin) return null;

  const a = parseText(prev);
  const b = parseText(next);
  if (a.groups.length === 0 || a.groups.length !== b.groups.length) return null;
  for (let i = 0; i < a.statics.length; i++) {
    if (a.statics[i] !== b.statics[i]) return null;
  }

  const rolls: Record<number, DigitRoll> = {};

  for (let g = 0; g < b.groups.length; g++) {
    const before = a.groups[g].raw;
    const after = b.groups[g].raw;
    if (before === after && !forceSpin) continue; // this number did not change -> it stays still

    const delta = groupValue(after) - groupValue(before);
    const dir: RollDirection = delta !== 0 ? (delta > 0 ? 1 : -1) : 1;

    const prevDigits = groupDigits(before);
    const nextDigits = groupDigits(after);

    // Walk the NEW group's characters, right-aligning its digits against the old group's digits.
    let digitIdx = 0;
    const raw = b.groups[g].raw;
    for (let c = 0; c < raw.length; c++) {
      if (!/\d/.test(raw[c])) continue;
      const to = nextDigits[digitIdx];
      const fromFromRight = prevDigits.length - (nextDigits.length - digitIdx);
      const hasOld = fromFromRight >= 0 && fromFromRight < prevDigits.length;
      const from = hasOld ? prevDigits[fromFromRight] : 0;

      const base = stepsBetween(from, to, dir);
      const isUnchangedDigit = prevDigits.length === nextDigits.length && hasOld && base === 0;
      const travel = base + (isUnchangedDigit && !SPIN_UNCHANGED_DIGITS && !forceSpin ? 0 : 10 * ROLL_EXTRA_CYCLES);
      if (travel > 0) {
        rolls[b.groups[g].start + c] = { from, to, dir, travel, isNew: !hasOld };
      }
      digitIdx++;
    }
  }

  return Object.keys(rolls).length > 0 ? { rolls } : null;
}

/** Wheel position (in digit steps) at the end of a roll, given the start position. Start is offset so it stays positive. */
export const WHEEL_BASE = 30;
export function wheelStart(roll: DigitRoll): number {
  return WHEEL_BASE + roll.from;
}
export function wheelEnd(roll: DigitRoll): number {
  return wheelStart(roll) + roll.dir * roll.travel;
}

/** Which digit a wheel at `position` is showing (nearest). */
export function digitAt(position: number): number {
  return mod10(Math.round(position));
}

// ─── Style splitting ─────────────────────────────────────────────────────────

export const CONTAINER_LAYOUT_KEYS = new Set([
  'margin',
  'marginVertical',
  'marginHorizontal',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'padding',
  'paddingVertical',
  'paddingHorizontal',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'alignSelf',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'zIndex',
  'elevation',
]);

/**
 * Splits a flattened style object into:
 *  - containerStyle: outer layout & margin properties applied to the outer View wrapper.
 *  - textStyle: pure typographic properties applied to the glyphs / digit cells.
 *
 * CRITICAL FIX: Any margin on the text (e.g. `marginTop: 1` on hero card's primaryAmount) must NEVER
 * sit on the individual digit cells or the wheel strip. In the wheel, 11 digits are stacked vertically;
 * if each digit gets `marginTop: 1`, the spacing between digits becomes `lineHeight + 1` instead of `lineHeight`.
 * Over 9 steps, the digit settles 9px too low, and then abruptly jumps 9px back on swap to the static digit (jitter).
 * By extracting margins to the container, outer spacing is preserved while wheel pitch is strictly `lineHeight`.
 */
export function splitRollingStyles(flat: Record<string, any> = {}): {
  containerStyle: Record<string, any>;
  textStyle: Record<string, any>;
} {
  const containerStyle: Record<string, any> = {};
  const textStyle: Record<string, any> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;
    if (CONTAINER_LAYOUT_KEYS.has(key)) {
      containerStyle[key] = value;
    } else {
      textStyle[key] = value;
    }
  }

  // Explicitly ensure zero margin/padding on inner glyphs/cells
  textStyle.margin = 0;
  textStyle.marginTop = 0;
  textStyle.marginBottom = 0;
  textStyle.marginLeft = 0;
  textStyle.marginRight = 0;
  textStyle.marginHorizontal = 0;
  textStyle.marginVertical = 0;
  textStyle.padding = 0;
  textStyle.paddingTop = 0;
  textStyle.paddingBottom = 0;
  textStyle.paddingLeft = 0;
  textStyle.paddingRight = 0;
  textStyle.paddingHorizontal = 0;
  textStyle.paddingVertical = 0;

  return { containerStyle, textStyle };
}
