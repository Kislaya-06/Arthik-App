/**
 * "What's new" spotlight tour shown once after an update: each step opens the screen where a new feature lives,
 * highlights it and explains it in a small card. Pure data + the start rule; the overlay is
 * src/components/tour/WhatsNewTour.tsx and screens mark their feature with <TourTarget id=…>.
 *
 * Next release: change TOUR_ID and the steps (a new id shows the tour again once).
 */
import type { TabParamList } from '../types';

export const TOUR_ID = '2026-11-25-quick-add';
export const tourSeenKey = (id = TOUR_ID) => `@arthik_tour_seen_${id}`;

export interface TourStep {
  /** The TourTarget id to spotlight. If it is not on screen, the card shows in the middle without a spotlight. */
  target: string;
  tab: keyof TabParamList;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: 'home.recent',
    tab: 'Home',
    title: 'Spot each place at a glance',
    body: 'Every entry now shows the first letter of its note. Spending is in plain colour and only money coming in is green.',
  },
  {
    target: 'nav.plus',
    tab: 'Home',
    title: 'Add it again in one tap',
    body: 'Press and hold + to see your recent spends. Pick one and it fills in for today. A normal tap on + now picks the category you usually use at this time.',
  },
  {
    target: 'insights.heading',
    tab: 'Insights',
    title: "See where you're heading",
    body: 'Your month-end estimate, how many days your money lasts and when Gullak hits its next goal. Plus your habits and money shared with friends.',
  },
];

/**
 * Show the tour once, only to people who used the app before this update (a brand new user has nothing to
 * compare with and gets onboarding instead).
 */
export function shouldStartTour(s: { alreadySeen: boolean; hasEntries: boolean }): boolean {
  return !s.alreadySeen && s.hasEntries;
}
