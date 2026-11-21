import { describe, it, expect } from 'vitest';
import { heroRingProgress } from '../src/lib/heroRing';

// UX-004: the Home spent ring shows the REAL share of the period's money that was spent.
describe('UX-004: heroRingProgress', () => {
  it('shows the real percent when spending is over the money of the period (₹460 of ₹250 = 184%)', () => {
    const r = heroRingProgress(460, 250);
    expect(r.percentLabel).toBe('184%');
    expect(r.isOver).toBe(true);
  });

  it('is exactly one lap and not over when the whole money of the period was spent', () => {
    expect(heroRingProgress(250, 250)).toEqual({ ratio: 1, percentLabel: '100%', isOver: false });
  });

  it('draws at most two laps and caps the text at "999%+" so it fits the ring (₹5,000 of ₹10)', () => {
    const r = heroRingProgress(5000, 10);
    expect(r.ratio).toBe(2);
    expect(r.percentLabel).toBe('999%+');
    expect(r.isOver).toBe(true);
  });

  it('draws one full red lap at "100%" when the period had no money at all (no real percent exists)', () => {
    const r = heroRingProgress(300, 0);
    expect(r.ratio).toBe(1);
    expect(r.percentLabel).toBe('100%');
    expect(r.isOver).toBe(true);
  });

  it('is an empty ring at "0%" when nothing came in and nothing was spent', () => {
    expect(heroRingProgress(0, 0)).toEqual({ ratio: 0, percentLabel: '0%', isOver: false });
  });
});
