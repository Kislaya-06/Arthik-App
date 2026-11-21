export interface StreakFlameConfig {
  tier: 0 | 1 | 2 | 3 | 4;
  tierName: 'dormant' | 'spark' | 'blaze' | 'inferno' | 'supernova';
  outerColor: string;
  innerColor: string;
  /** Orange middle layer between the red outer fire and the yellow heart. */
  midColor: string;
  coreColor?: string;
  emberCount: number;
  flickerSpeed: number; // ms for one loop
  lickStretch: number;  // peak scaleY
  swayDegrees: number;  // max tilt
}

export interface EmberConfig {
  driftX: number;
  heightRatio: number;
  durationRatio: number;
  delay: number;
}

export const EMBER_CONFIGS: EmberConfig[] = [
  // Ember 0: drifts left
  { driftX: -3.5, heightRatio: 0.70, durationRatio: 1.15, delay: 0 },
  // Ember 1: drifts right
  { driftX: 3.2, heightRatio: 0.85, durationRatio: 1.30, delay: 350 },
  // Ember 2: rises high center-left
  { driftX: -1.8, heightRatio: 1.00, durationRatio: 1.05, delay: 700 },
  // Ember 3: shoots fast center-right
  { driftX: 2.2, heightRatio: 0.80, durationRatio: 0.95, delay: 200 },
];

export const FLAME_PATHS = {
  // Leaping organic fire body (viewBox 0 0 24 24)
  outer:
    'M 12 2 C 12 2 14.5 5.5 15.5 8 C 17 11.5 18.5 13.8 18.5 16.5 C 18.5 20.1 15.6 23 12 23 C 8.4 23 5.5 20.1 5.5 16.5 C 5.5 13.5 7.2 10.5 9.5 7.8 C 9.8 9.5 10.8 11 12 11 C 13 11 13.5 9.5 13.5 8 C 13.5 5.8 12 4 12 2 Z',
  // Inner core fire tongue (hot plasma)
  inner:
    'M 12 11 C 12.8 12.5 14.2 14.2 14.2 16.5 C 14.2 18.5 13.2 20.5 12 20.5 C 10.8 20.5 9.8 18.5 9.8 16.5 C 9.8 14.5 11 13 12 11 Z',
  // White-hot center highlight (for active blaze)
  core:
    'M 12 15 C 12.5 15.8 13 16.8 13 18 C 13 19 12.5 19.5 12 19.5 C 11.5 19.5 11 19 11 18 C 11 16.8 11.5 15.8 12 15 Z',
  // Ember teardrop spark (viewBox 0 0 4 5)
  ember:
    'M 2 0.5 C 2.8 1.8 3.5 2.8 3.5 3.5 C 3.5 4.3 2.8 5 2 5 C 1.2 5 0.5 4.3 0.5 3.5 C 0.5 2.8 1.2 1.8 2 0.5 Z',
};

/**
 * Returns visual & animation tuning parameters based on streak count.
 * - 0 days: Dormant (muted, still flame)
 * - 1-3 days: Spark (warm flame, gentle flicker)
 * - 4-7 days: Blaze (brighter fire, livelier flicker)
 * - 8-14 days: Inferno (blazing fire, white-hot core)
 * - 15+ days: Supernova (hottest colours, liveliest flicker)
 */
export function getStreakFlameConfig(streak: number): StreakFlameConfig {
  if (streak <= 0) {
    return {
      tier: 0,
      tierName: 'dormant',
      outerColor: '#D97757',
      innerColor: '#EAA690',
      midColor: '#E39072',
      emberCount: 0,
      flickerSpeed: 1800,
      lickStretch: 1.05,
      swayDegrees: 1.2,
    };
  }

  if (streak <= 3) {
    return {
      tier: 1,
      tierName: 'spark',
      outerColor: '#FF5722',
      innerColor: '#FFC107',
      midColor: '#FF9800',
      coreColor: '#FFF9C4',
      emberCount: 1,
      flickerSpeed: 1100,
      lickStretch: 1.14,
      swayDegrees: 2.5,
    };
  }

  if (streak <= 7) {
    return {
      tier: 2,
      tierName: 'blaze',
      outerColor: '#FF3D00',
      innerColor: '#FFD54F',
      midColor: '#FF9100',
      coreColor: '#FFFFFF',
      emberCount: 2,
      flickerSpeed: 920,
      lickStretch: 1.18,
      swayDegrees: 3.5,
    };
  }

  if (streak <= 14) {
    return {
      tier: 3,
      tierName: 'inferno',
      outerColor: '#E62E00',
      innerColor: '#FFE082',
      midColor: '#FF8F00',
      coreColor: '#FFFFFF',
      emberCount: 3,
      flickerSpeed: 760,
      lickStretch: 1.22,
      swayDegrees: 4.5,
    };
  }

  return {
    tier: 4,
    tierName: 'supernova',
    outerColor: '#D50000',
    innerColor: '#FFEA00',
    midColor: '#FF9100',
    coreColor: '#FFFFFF',
    emberCount: 4,
    flickerSpeed: 620,
    lickStretch: 1.26,
    swayDegrees: 5.5,
  };
}

/** Smallest flame (day 1) as a share of the full flame; the full size is reached at FLAME_FULL_GROWTH_DAYS. */
export const FLAME_MIN_GROWTH = 0.72;
export const FLAME_FULL_GROWTH_DAYS = 30;

/**
 * How big the flame is drawn (0..1 of its box) for a streak. It grows a little with EVERY extra day,
 * fast at first and slower later (log curve), and stops growing at FLAME_FULL_GROWTH_DAYS.
 * A streak of 0 shows the smallest flame.
 */
export function flameGrowthFor(streak: number): number {
  const days = Number.isFinite(streak) && streak > 0 ? Math.min(streak, FLAME_FULL_GROWTH_DAYS) : 0;
  const t = Math.log(1 + days) / Math.log(1 + FLAME_FULL_GROWTH_DAYS);
  return FLAME_MIN_GROWTH + (1 - FLAME_MIN_GROWTH) * t;
}

/** One full flicker loop. Three tier "flicker" beats fit in it, so a hotter tier loops faster. */
export function flameLoopMs(config: StreakFlameConfig): number {
  return config.flickerSpeed * 3;
}

export interface FlameFrame {
  /** Flame height (scaled from the base of the flame). */
  scaleY: number;
  /** Flame width; narrows a little as the flame stretches up. */
  scaleX: number;
  /** Lean of the flame, in degrees. */
  rotateDeg: number;
  /** Size of the hot inner tongue. */
  innerScale: number;
  /** Brightness of the hot inner tongue. */
  innerOpacity: number;
}

/**
 * Flame shape at `phase` (0..1) of one loop. Sums of sines with WHOLE-number frequencies, so the end of
 * the loop meets its start exactly (no jump when the loop repeats), and the flame never repeats a plain
 * "breathing" rhythm. Runs on the UI thread.
 */
export function flameFrameAt(phase: number, lickStretch: number, swayDegrees: number): FlameFrame {
  'worklet';
  const t = phase * 2 * Math.PI;
  // Height: a slow lick plus quicker small flickers (normalised to -1..1).
  const lick = 0.55 * Math.sin(2 * t) + 0.3 * Math.sin(5 * t + 1.1) + 0.15 * Math.sin(9 * t + 2.3);
  const amp = (lickStretch - 1) * 0.6;
  const scaleY = 1 + amp * lick;
  const scaleX = 1 - amp * 0.35 * lick;
  const rotateDeg = swayDegrees * (0.7 * Math.sin(t + 0.4) + 0.3 * Math.sin(4 * t + 1.7));
  const core = 0.6 * Math.sin(3 * t + 0.8) + 0.4 * Math.sin(7 * t);
  return {
    scaleY,
    scaleX,
    rotateDeg,
    innerScale: 1 + 0.08 * core,
    innerOpacity: 0.88 + 0.12 * core,
  };
}

// ── Living fire shapes (animated emoji style) ────────────────────────────────────────────────
// The flame is redrawn every frame from the loop phase: its tongues lick up and down, the tip
// whips side to side, and small flame bits break off the top and fade. Every wave uses a
// WHOLE-number frequency of the loop, so phase 0 and phase 1 draw the same shape (seamless loop).
// All shapes use the 24x24 flame box; the base of the fire sits at (12, 23).

/** The flame box is drawn with extra room above it so tongues and flame bits can rise past the top. */
export const FLAME_HEADROOM = 6;
/** viewBox of the flame drawing (24 wide, FLAME_HEADROOM of extra room above the 24x24 box). */
export const FLAME_VIEWBOX = `0 -${FLAME_HEADROOM} 24 ${24 + FLAME_HEADROOM}`;

const FIRE_BASE_X = 12;
const FIRE_BASE_Y = 23;

/** How strongly the fire moves (0..1), from the tier's lick stretch: hotter tier, livelier fire. */
export function flameEnergy(lickStretch: number): number {
  'worklet';
  const e = (lickStretch - 1) / 0.26;
  return e < 0 ? 0 : e > 1 ? 1 : e;
}

function n(v: number): string {
  'worklet';
  return (Math.round(v * 100) / 100).toString();
}

/**
 * Outline of the whole fire (main tip, a right tongue, a left tongue and a round base).
 * `scale` shrinks it towards the base (used for the orange middle layer) and `shift` gives a
 * layer its own rhythm so the layers never move as one block.
 */
export function flameOutlineAt(phase: number, energy: number, scale = 1, shift = 0): string {
  'worklet';
  const t = phase * 2 * Math.PI + shift;
  const e = energy;
  const s = Math.sin;
  // Main tip: whips side to side and licks up and down.
  const tx = 11.6 + e * (1.3 * s(t + 0.4) + 0.5 * s(3 * t + 1.9));
  const ty = 1.0 + e * (1.0 * s(2 * t + 0.6) + 0.5 * s(5 * t + 2.1));
  // Side tongues lick on their own beats.
  const rx = 18.8 + e * 0.6 * s(2 * t + 1.3);
  const ry = 6.4 + e * (1.4 * s(3 * t + 0.5) + 0.4 * s(7 * t + 1.0));
  const lx = 5.6 + e * 0.6 * s(2 * t + 2.9);
  const ly = 8.6 + e * (1.4 * s(4 * t + 2.2) + 0.4 * s(6 * t + 0.3));
  // Dips between the tongues.
  const n1x = 15.4 + e * 0.4 * s(3 * t + 2.5);
  const n1y = 8.0 + e * 0.6 * s(2 * t + 0.2);
  const n2x = 8.6 + e * 0.4 * s(3 * t + 0.9);
  const n2y = 10.2 + e * 0.6 * s(2 * t + 3.0);
  // The round base breathes very slightly.
  const half = 7.4 * (1 + e * 0.025 * s(2 * t + 1.0));
  const rbx = FIRE_BASE_X + half;
  const lbx = FIRE_BASE_X - half;

  const X = (x: number) => n(FIRE_BASE_X + (x - FIRE_BASE_X) * scale);
  const Y = (y: number) => n(FIRE_BASE_Y + (y - FIRE_BASE_Y) * scale);
  const P = (x: number, y: number) => `${X(x)} ${Y(y)}`;

  return (
    `M ${P(tx, ty)} ` +
    `C ${P(tx + 1.0, ty + 3.0)} ${P(n1x - 0.8, n1y - 1.2)} ${P(n1x, n1y)} ` +
    `C ${P(n1x + 1.2, n1y + 0.2)} ${P(rx - 0.6, ry + 1.4)} ${P(rx, ry)} ` +
    `C ${P(rx + 1.0, ry + 3.0)} ${P(rbx + 0.6, 12.4)} ${P(rbx, 15.8)} ` +
    `C ${P(rbx, 20.0)} ${P(15.9, FIRE_BASE_Y)} ${P(FIRE_BASE_X, FIRE_BASE_Y)} ` +
    `C ${P(8.1, FIRE_BASE_Y)} ${P(lbx, 20.0)} ${P(lbx, 15.8)} ` +
    `C ${P(lbx - 0.6, 12.6)} ${P(lx - 0.8, ly + 2.6)} ${P(lx, ly)} ` +
    `C ${P(lx + 0.6, ly + 1.0)} ${P(n2x - 1.0, n2y + 0.2)} ${P(n2x, n2y)} ` +
    `C ${P(n2x + 0.4, n2y - 2.6)} ${P(tx - 1.6, ty + 3.6)} ${P(tx, ty)} Z`
  );
}

/** The yellow heart of the fire: a teardrop whose tip dances on its own rhythm. */
export function flameHeartAt(phase: number, energy: number): string {
  'worklet';
  const t = phase * 2 * Math.PI;
  const e = energy;
  const s = Math.sin;
  const ix = FIRE_BASE_X + e * (0.7 * s(2 * t + 0.8) + 0.3 * s(5 * t));
  const iy = 11.6 + e * (1.2 * s(3 * t + 1.4) + 0.4 * s(7 * t + 0.2));
  const w = 3.6 * (1 + e * 0.06 * s(4 * t + 2.0));
  const bottom = 21.6;
  const r = FIRE_BASE_X + w;
  const l = FIRE_BASE_X - w;
  return (
    `M ${n(ix)} ${n(iy)} ` +
    `C ${n(ix + 0.6)} ${n(iy + 2.6)} ${n(r)} ${n(14.8)} ${n(r)} ${n(17.6)} ` +
    `C ${n(r)} ${n(20.2)} ${n(13.8)} ${n(bottom)} ${n(FIRE_BASE_X)} ${n(bottom)} ` +
    `C ${n(10.2)} ${n(bottom)} ${n(l)} ${n(20.2)} ${n(l)} ${n(17.6)} ` +
    `C ${n(l)} ${n(14.8)} ${n(ix - 0.6)} ${n(iy + 2.6)} ${n(ix)} ${n(iy)} Z`
  );
}

/** Share of its own cycle a flame bit is visible (it is hidden for the rest, so the loop is seamless). */
export const FLAME_BIT_VISIBLE_SHARE = 0.6;

/**
 * Small flame bits that break off the top of the fire, rise, shrink and vanish (one closed shape each).
 * `count` bits (0..2) run at evenly spread times; drift and height come from EMBER_CONFIGS.
 * Returns a zero-size path ("M 12 23 Z") when no bit is visible, so the drawing never jumps.
 */
export function flameBitsAt(phase: number, count: number): string {
  'worklet';
  const bits = count < 0 ? 0 : count > 2 ? 2 : Math.floor(count);
  let d = '';
  for (let i = 0; i < bits; i++) {
    const cfg = EMBER_CONFIGS[i];
    const cycle = phase * 2 + i / bits;
    const life = cycle - Math.floor(cycle);
    if (life >= FLAME_BIT_VISIBLE_SHARE) continue;
    const u = life / FLAME_BIT_VISIBLE_SHARE;
    const grow = Math.sin(Math.PI * u);
    const size = 1.15 * grow * (1 - 0.35 * u);
    if (size < 0.05) continue;
    const cx = FIRE_BASE_X + (cfg.driftX > 0 ? 0.8 : -0.8) + cfg.driftX * 0.45 * u;
    const cy = 4.5 - 8.5 * cfg.heightRatio * u;
    const r = size;
    d +=
      `M ${n(cx)} ${n(cy - 1.6 * r)} ` +
      `C ${n(cx + 0.4 * r)} ${n(cy - 0.8 * r)} ${n(cx + r)} ${n(cy - 0.2 * r)} ${n(cx + r)} ${n(cy + 0.3 * r)} ` +
      `C ${n(cx + r)} ${n(cy + 0.9 * r)} ${n(cx + 0.5 * r)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} ` +
      `C ${n(cx - 0.5 * r)} ${n(cy + r)} ${n(cx - r)} ${n(cy + 0.9 * r)} ${n(cx - r)} ${n(cy + 0.3 * r)} ` +
      `C ${n(cx - r)} ${n(cy - 0.2 * r)} ${n(cx - 0.4 * r)} ${n(cy - 0.8 * r)} ${n(cx)} ${n(cy - 1.6 * r)} Z `;
  }
  return d === '' ? `M ${FIRE_BASE_X} ${FIRE_BASE_Y} Z` : d.trim();
}
