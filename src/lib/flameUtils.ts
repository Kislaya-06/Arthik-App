export interface StreakFlameConfig {
  tier: 0 | 1 | 2 | 3 | 4;
  tierName: 'dormant' | 'spark' | 'blaze' | 'inferno' | 'supernova';
  outerColor: string;
  innerColor: string;
  coreColor?: string;
  glowColor: string;
  glowSecondaryColor: string;
  glowOpacity: number;
  glowRadius: number;
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
 * - 0 days: Dormant ember / quiet flame awaiting ignition
 * - 1-3 days: Spark (warm flame dancing, 1 ember rising, subtle glow)
 * - 4-7 days: Blaze (energetic fire licking, 2 embers rising, fiery halo)
 * - 8-14 days: Inferno (blazing fire, white-hot core, 3 embers rising, radiant glow)
 * - 15+ days: Supernova (legendary firestorm, 4 continuous embers, hyper-radiant aura)
 */
export function getStreakFlameConfig(streak: number): StreakFlameConfig {
  if (streak <= 0) {
    return {
      tier: 0,
      tierName: 'dormant',
      outerColor: '#D97757',
      innerColor: '#EAA690',
      glowColor: '#FF7043',
      glowSecondaryColor: '#FFA726',
      glowOpacity: 0,
      glowRadius: 0,
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
      glowColor: '#FF5722',
      glowSecondaryColor: '#FFB300',
      glowOpacity: 0.32,
      glowRadius: 18,
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
      glowColor: '#FF3D00',
      glowSecondaryColor: '#FFC107',
      glowOpacity: 0.52,
      glowRadius: 24,
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
      glowColor: '#E62E00',
      glowSecondaryColor: '#FF9800',
      glowOpacity: 0.72,
      glowRadius: 30,
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
    glowColor: '#FF1744',
    glowSecondaryColor: '#FFD600',
    glowOpacity: 0.90,
    glowRadius: 36,
    emberCount: 4,
    flickerSpeed: 620,
    lickStretch: 1.26,
    swayDegrees: 5.5,
  };
}
