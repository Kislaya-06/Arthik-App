/**
 * ambientBackground.ts
 *
 * Design of the ambient background: across the TOP of a screen, a tinted glow that is strongest at the very top and eases
 * away to nothing, fine film grain, and now and then a soft gust of wind that drifts in from the left or right edge and
 * melts into the grain.
 *
 *  - Strongest at the top of the phone (but never so strong that the clock, notification icons or header text suffer),
 *    falling smoothly to exactly zero where the first card begins, with no edge anywhere (smootherstep curve).
 *  - The gust is NOT a line and NOT a separate light: it is a very faint, soft haze of the screen's own colour, made of
 *    wisps, that sits under the grain so it is seen only through the grain. It enters from the left or the right edge, drifts
 *    towards the middle while it spreads and slightly rolls, and has faded out completely before it gets there.
 *  - Nothing loops. Every gust is planned at random when it starts (side, height, size, speed, strength) and the gaps
 *    between gusts are random too, so there is no point where a cycle "restarts" and nothing can stutter.
 *
 * Colour follows the screen: green (Home / History / add-expense form, the Home hero card's mint), violet (Savings, the
 * Gullak card) and orange (Insights, the Insights hero card).
 *
 * Pure (no React / React Native): unit-tested. Randomness is injected, so the tests are deterministic.
 */

/** Master switch. false removes the effect everywhere without touching any screen. */
export const AMBIENT_ENABLED = true;

/** Global strength multiplier. 1 = designed strength, 0.6 = subtler, 1.4 = stronger. */
export const AMBIENT_INTENSITY = 1;

// ─── Where it is drawn ───────────────────────────────────────────────────────

/**
 * The effect ends exactly where the Insights hero card begins on every screen:
 * scroll padding 16 + header row (segmented control, 48) + gap 24 below it = 88dp under the status bar.
 */
export const AMBIENT_HEADER_BLOCK = 88;

export function getAmbientHeight(insetTop: number): number {
  return Math.round(Math.max(0, insetTop) + AMBIENT_HEADER_BLOCK);
}

/** Quintic "smootherstep": 0 -> 1 with zero slope at BOTH ends, so a fade has no visible start or end. */
export function smootherstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * The whole effect dissolves into the screen background from the very top (barely) to the bottom (fully): opacity of the
 * background-coloured overlay at each share of the height. Zero slope at both ends => strongest at the top, and no edge
 * where it ends.
 */
export const FADE_STOP_COUNT = 12;
export const FADE_STOPS: ReadonlyArray<{ offset: number; alpha: number }> = Array.from({ length: FADE_STOP_COUNT }, (_, i) => {
  const offset = i / (FADE_STOP_COUNT - 1);
  return { offset, alpha: smootherstep(offset) };
});

// ─── Colours ─────────────────────────────────────────────────────────────────

export type ToneKey = 'home' | 'savings' | 'insights';

export interface Tone {
  /** Very dark shade of the colour: the tinted base of the area. */
  deep: string;
  /** Medium shade: the glow at the top. */
  mid: string;
  /** The card's own colour (light theme tint). */
  light: string;
  /** Light shade: the colour of the wind. */
  core: string;
}

export const TONES: Record<ToneKey, Tone> = {
  // Home hero card mint (#C4EBD4 / #B8E0C8 / #A8DCBE)
  home: { deep: '#0E2A24', mid: '#2F6B57', light: '#B8E0C8', core: '#CEF0DE' },
  // Gullak card violet (#8B5CF6 -> #581C87)
  savings: { deep: '#1E1040', mid: '#5B2FB5', light: '#8B5CF6', core: '#C4B0FF' },
  // Insights hero card (#F07167 -> #FED0A8)
  insights: { deep: '#3A140F', mid: '#B5402F', light: '#F07167', core: '#FED0A8' },
};

/** Screen (route) name -> colour. Everything else (History, the add / edit form) uses the Home green. */
export function toneForRoute(routeName?: string): ToneKey {
  if (routeName === 'Savings') return 'savings';
  if (routeName === 'Insights') return 'insights';
  return 'home';
}

export type AmbientMode = 'light' | 'dark' | 'amoled';

export interface Palette {
  wash: string;
  washAlpha: number;
  /** The extra glow at the very top. */
  glow: string;
  glowAlpha: number;
  /** Colour of the wind. */
  gust: string;
  /** Opacity of a gust at its strongest (before the per-gust random strength). Deliberately tiny. */
  gustPeak: number;
  /** Opacity of the grain layer. */
  grainOpacity: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function getPalette(tone: ToneKey, mode: AmbientMode, intensity: number = AMBIENT_INTENSITY): Palette {
  const t = TONES[tone];
  const k = Math.max(0, intensity);
  if (mode === 'light') {
    return {
      wash: t.light,
      washAlpha: clamp01(0.3 * k),
      glow: t.light,
      glowAlpha: clamp01(0.28 * k),
      gust: t.mid,
      gustPeak: clamp01(0.14 * k),
      grainOpacity: clamp01(0.16 * k),
    };
  }
  const q = mode === 'amoled' ? 0.85 : 1; // AMOLED keeps more of its black
  return {
    wash: t.deep,
    washAlpha: clamp01(0.75 * q * k),
    glow: t.mid,
    glowAlpha: clamp01(0.3 * q * k),
    gust: t.core,
    gustPeak: clamp01(0.2 * q * k),
    grainOpacity: clamp01(0.26 * q * k),
  };
}

/** The tinted base eases off downwards to this share of its strength (the overlay then takes it to zero). */
export const WASH_BOTTOM_SHARE = 0.65;

/** The top glow is an ellipse centred on the top edge: its half-width (share of screen width) and half-height (share of the area). */
export const GLOW_RX = 0.75;
export const GLOW_RY = 0.9;
/** Brightness of the glow from its centre (0) to its rim (1), as a share of its strength. */
export const GLOW_PROFILE: ReadonlyArray<{ offset: number; share: number }> = [
  { offset: 0, share: 1 },
  { offset: 0.25, share: 0.63 },
  { offset: 0.5, share: 0.33 },
  { offset: 0.75, share: 0.1 },
  { offset: 1, share: 0 },
];

// ─── Grain ───────────────────────────────────────────────────────────────────

/** Size (dp) each 128px grain tile is drawn at (about 0.7dp per speck: a bit bigger than before). */
export const GRAIN_TILE_DP = 90;

export function getGrainGrid(width: number, height: number): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.ceil(width / GRAIN_TILE_DP)),
    rows: Math.max(1, Math.ceil(height / GRAIN_TILE_DP)),
  };
}

// ─── The wind ────────────────────────────────────────────────────────────────

/** How many gusts can be in the air at once (each one is a separate, independent timeline). */
export const GUST_SLOTS = 3;

export interface GustPlan {
  side: 'left' | 'right';
  /** Height of the gust's centre (share of the area; 0 = top edge). Biased towards the top. */
  y: number;
  /** Size of the sprite (dp). */
  widthDp: number;
  heightDp: number;
  /** How long the whole gust lasts. */
  durationMs: number;
  /** Strength relative to the palette's gustPeak (0..1). */
  strength: number;
  /** How far the centre travels from just outside the edge (share of the screen width). Always short of the middle. */
  travel: number;
  /** The gust stretches sideways by this factor while it moves (it spreads). */
  spread: number;
  /** Slow vertical drift (dp) and tilt (deg) over the gust: the gentle rolling. */
  lift: number;
  tiltDeg: number;
}

/** Where the centre starts (share of the screen width, outside the edge). */
export const GUST_START = -0.08;
/** The centre never gets past this (share of the screen width): the gust has melted away before the middle. */
export const GUST_MAX_TRAVEL = 0.46;

const between = (rand: () => number, lo: number, hi: number) => lo + (hi - lo) * rand();

/** Plans one gust, entirely at random (pass Math.random in the app, a seeded generator in tests). */
export function planGust(rand: () => number, screenWidth: number): GustPlan {
  const side: GustPlan['side'] = rand() < 0.5 ? 'left' : 'right';
  return {
    side,
    y: 0.04 + 0.5 * Math.pow(rand(), 1.5),
    widthDp: Math.round(screenWidth * between(rand, 0.85, 1.25)),
    heightDp: Math.round(between(rand, 90, 140)),
    durationMs: Math.round(between(rand, 7000, 12000)),
    strength: between(rand, 0.75, 1),
    travel: between(rand, 0.34, GUST_MAX_TRAVEL),
    spread: between(rand, 1.15, 1.5),
    lift: between(rand, -10, 10),
    tiltDeg: between(rand, -5, 5),
  };
}

/** Random pause before a slot starts its next gust. */
export function nextGustDelayMs(rand: () => number): number {
  return Math.round(between(rand, 1200, 5200));
}

/** Pause before a slot's FIRST gust: the first one arrives within a second, the others follow at staggered times. */
export function firstGustDelayMs(slot: number, rand: () => number): number {
  const windows: Array<[number, number]> = [
    [300, 900],
    [1800, 3600],
    [4200, 7000],
  ];
  const [lo, hi] = windows[Math.min(slot, windows.length - 1)];
  return Math.round(between(rand, lo, hi));
}

/** Opacity (0..1, share of the gust's strength) over a gust's life (0..1): smooth in, softer out, zero slope at both ends. */
export function gustEnvelope(life: number): number {
  const p = Math.min(1, Math.max(0, life));
  const s = Math.sin(Math.PI * Math.pow(p, 0.75));
  return s * s;
}

/** Stops for an interpolation of the envelope on the native thread. */
export const GUST_ENVELOPE_STOPS: ReadonlyArray<{ life: number; opacity: number }> = [
  0, 0.06, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
].map((life) => ({ life, opacity: gustEnvelope(life) }));

/** Centre of the gust (share of the screen width, measured from its own edge) after `ease` (0..1) of its travel. */
export function gustCentre(plan: GustPlan, ease: number): number {
  return GUST_START + (plan.travel - GUST_START) * ease;
}
