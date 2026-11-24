/** "What's new" tour: shown once, only to people who already used the app; every step names a real tab. */
import { describe, it, expect } from 'vitest';
import { shouldStartTour, TOUR_STEPS, tourSeenKey, TOUR_ID } from '../src/lib/whatsNewTour';

describe('whatsNewTour', () => {
  it('starts once, only for someone with entries', () => {
    expect(shouldStartTour({ alreadySeen: false, hasEntries: true })).toBe(true);
    expect(shouldStartTour({ alreadySeen: true, hasEntries: true })).toBe(false);
    expect(shouldStartTour({ alreadySeen: false, hasEntries: false })).toBe(false);
  });

  it('every step opens a main tab and has short copy', () => {
    for (const s of TOUR_STEPS) {
      expect(['Home', 'History', 'Savings', 'Insights']).toContain(s.tab);
      expect(s.title.length).toBeLessThanOrEqual(36);
      expect(s.body.length).toBeLessThanOrEqual(170);
    }
    expect(new Set(TOUR_STEPS.map((s) => s.target)).size).toBe(TOUR_STEPS.length);
  });

  it('the seen flag is per tour, so the next release shows its own tour', () => {
    expect(tourSeenKey()).toBe(`@arthik_tour_seen_${TOUR_ID}`);
    expect(tourSeenKey('next')).not.toBe(tourSeenKey());
  });
});
