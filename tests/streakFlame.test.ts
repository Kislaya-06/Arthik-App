import { describe, it, expect } from 'vitest';
import { getStreakFlameConfig, FLAME_PATHS } from '../src/lib/flameUtils';

describe('StreakFlame Component & Tier Configuration Engine', () => {
  describe('Streak Tiers & Progression Matrix', () => {
    it('returns dormant tier 0 for 0 days streak (no embers, no glow)', () => {
      const config = getStreakFlameConfig(0);
      expect(config.tier).toBe(0);
      expect(config.tierName).toBe('dormant');
      expect(config.emberCount).toBe(0);
      expect(config.glowOpacity).toBe(0);
      expect(config.outerColor).toBe('#D97757');
      expect(config.flickerSpeed).toBe(1800);
      expect(config.lickStretch).toBe(1.05);
    });

    it('returns dormant tier 0 for negative streak as safety fallback', () => {
      const config = getStreakFlameConfig(-5);
      expect(config.tier).toBe(0);
      expect(config.tierName).toBe('dormant');
      expect(config.emberCount).toBe(0);
    });

    it('returns spark tier 1 for 1 to 3 days streak (1 rising ember, warm glow)', () => {
      [1, 2, 3].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(1);
        expect(config.tierName).toBe('spark');
        expect(config.emberCount).toBe(1);
        expect(config.glowOpacity).toBe(0.32);
        expect(config.outerColor).toBe('#FF5722');
        expect(config.innerColor).toBe('#FFC107');
        expect(config.flickerSpeed).toBe(1100);
      });
    });

    it('returns blaze tier 2 for 4 to 7 days streak (2 rising embers, bright fiery halo)', () => {
      [4, 5, 6, 7].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(2);
        expect(config.tierName).toBe('blaze');
        expect(config.emberCount).toBe(2);
        expect(config.glowOpacity).toBe(0.52);
        expect(config.outerColor).toBe('#FF3D00');
        expect(config.innerColor).toBe('#FFD54F');
        expect(config.coreColor).toBe('#FFFFFF');
        expect(config.flickerSpeed).toBe(920);
      });
    });

    it('returns inferno tier 3 for 8 to 14 days streak (3 rising embers, radiant crimson glow)', () => {
      [8, 10, 14].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(3);
        expect(config.tierName).toBe('inferno');
        expect(config.emberCount).toBe(3);
        expect(config.glowOpacity).toBe(0.72);
        expect(config.outerColor).toBe('#E62E00');
        expect(config.innerColor).toBe('#FFE082');
        expect(config.flickerSpeed).toBe(760);
      });
    });

    it('returns supernova tier 4 for 15+ days streak (4 continuous embers, hyper-radiant firestorm)', () => {
      [15, 30, 100].forEach((day) => {
        const config = getStreakFlameConfig(day);
        expect(config.tier).toBe(4);
        expect(config.tierName).toBe('supernova');
        expect(config.emberCount).toBe(4);
        expect(config.glowOpacity).toBe(0.90);
        expect(config.outerColor).toBe('#D50000');
        expect(config.innerColor).toBe('#FFEA00');
        expect(config.flickerSpeed).toBe(620);
      });
    });

    it('maintains strict monotonic intensity progression across all tiers', () => {
      const sampleDays = [0, 2, 5, 10, 20];
      const configs = sampleDays.map(getStreakFlameConfig);

      for (let i = 1; i < configs.length; i++) {
        const prev = configs[i - 1];
        const curr = configs[i];

        // Embers increase with streak
        expect(curr.emberCount).toBeGreaterThanOrEqual(prev.emberCount);
        // Glow opacity increases with streak
        expect(curr.glowOpacity).toBeGreaterThanOrEqual(prev.glowOpacity);
        // Flame lick stretch increases with streak
        expect(curr.lickStretch).toBeGreaterThan(prev.lickStretch);
        // Wind sway degrees increase with streak
        expect(curr.swayDegrees).toBeGreaterThan(prev.swayDegrees);
        // Flicker cycle speed becomes faster (lower ms duration)
        expect(curr.flickerSpeed).toBeLessThan(prev.flickerSpeed);
      }
    });
  });

  describe('Flame Vector Geometry', () => {
    it('provides valid, closed SVG paths for outer flame, inner core, and embers', () => {
      expect(FLAME_PATHS.outer.startsWith('M 12 2')).toBe(true);
      expect(FLAME_PATHS.outer.endsWith('Z')).toBe(true);

      expect(FLAME_PATHS.inner.startsWith('M 12 11')).toBe(true);
      expect(FLAME_PATHS.inner.endsWith('Z')).toBe(true);

      expect(FLAME_PATHS.core.startsWith('M 12 15')).toBe(true);
      expect(FLAME_PATHS.core.endsWith('Z')).toBe(true);

      expect(FLAME_PATHS.ember.startsWith('M 2 0.5')).toBe(true);
      expect(FLAME_PATHS.ember.endsWith('Z')).toBe(true);
    });
  });
});
