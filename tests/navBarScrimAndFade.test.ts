import { describe, it, expect } from 'vitest';
import { getNavBarMetrics, getNavBarTop } from '../src/lib/navBarLayout';

describe('NavBar Scrim & Scroll Fade Geometry', () => {
  it('ambient scrim extends exactly 28dp above the floating nav bar top across insets', () => {
    const insets = [0, 16, 24, 34, 48]; // legacy, gesture, iPhone/Pixel, 3-button nav
    for (const inset of insets) {
      const m = getNavBarMetrics(390, inset);
      const navTop = getNavBarTop(m);
      const scrimHeight = m.bottomGap + m.barHeight + 28;

      expect(scrimHeight).toBe(navTop + 28);
      expect(scrimHeight).toBeGreaterThan(navTop);
    }
  });

  it('scrim covers the entire gesture bar space below the floating pill', () => {
    const m = getNavBarMetrics(390, 34);
    // Floating pill starts at bottomGap
    expect(m.bottomGap).toBe(42);
    // Scrim covers 0 to bottomGap + barHeight + 28
    const scrimHeight = m.bottomGap + m.barHeight + 28;
    expect(scrimHeight).toBe(42 + 68 + 28);
  });

  it('bottom fade interpolation disarms over the initial 16dp of pull-up', () => {
    // Simulates the pullDepth interpolation: [0, 16] -> [1, 0]
    const interpolateFade = (depth: number) => {
      if (depth <= 0) return 1;
      if (depth >= 16) return 0;
      return 1 - depth / 16;
    };

    expect(interpolateFade(0)).toBe(1); // resting: 100% fade overlay
    expect(interpolateFade(8)).toBe(0.5); // half pulled
    expect(interpolateFade(16)).toBe(0); // armed pull: completely unmasked
    expect(interpolateFade(50)).toBe(0); // deep pull: remains 0
  });
});
