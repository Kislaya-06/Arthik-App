export interface StreakFlameConfig {
  tier: 0 | 1 | 2 | 3 | 4;
  tierName: 'dormant' | 'spark' | 'blaze' | 'inferno' | 'supernova';
  outerColor: string;
  innerColor: string;
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
