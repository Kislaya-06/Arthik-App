/**
 * "What's new" spotlight tour shown once after an update: each step opens the screen where a new feature lives,
 * highlights it and explains it in a small card. Pure data + the start rule; the overlay is
 * src/components/tour/WhatsNewTour.tsx and screens mark their feature with <TourTarget id=…>.
 *
 * Next release: change TOUR_ID and the steps (a new id shows the tour again once).
 */
import type { TabParamList } from '../types';

export const TOUR_ID = '2026-11-28-simple-money';
export const tourSeenKey = (id = TOUR_ID) => `@arthik_tour_seen_${id}`;

export interface TourStep {
  /** The TourTarget id to spotlight. If it is not on screen, the card shows in the middle without a spotlight. */
  target: string;
  tab: keyof TabParamList;
  title: string;
  body: string;
}

// Both steps live on Home, the one tab Pure Mode and Budget Mode share.
export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: 'home.hero',
    tab: 'Home',
    title: 'Gullak is simpler now',
    body: 'Leftover budget goes to Gullak when a budget ends. When you switch, you can save it or carry it forward. Pure Mode Day, Week and Month show only that time.',
  },
  {
    target: 'nav.plus',
    tab: 'Home',
    title: 'Money checks that make sense',
    body: 'If an add, edit or delete needs more money, Arthik asks you to add income first. Away 7+ days with nothing added? You choose what counts.',
  },
];

/**
 * Show the tour once, only to people who used the app before this update (a brand new user has nothing to
 * compare with and gets onboarding instead).
 */
export function shouldStartTour(s: { alreadySeen: boolean; hasEntries: boolean }): boolean {
  return !s.alreadySeen && s.hasEntries;
}
