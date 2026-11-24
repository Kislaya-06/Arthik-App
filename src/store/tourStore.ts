/**
 * The "What's new" tour: which step is showing, and the places on screen it can spotlight.
 * Screens register a target with <TourTarget id=…> (src/components/tour/TourTarget.tsx).
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOUR_STEPS, tourSeenKey, shouldStartTour } from '../lib/whatsNewTour';

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Brings the target on screen (scrolls if needed) and returns where it is, in screen coordinates. */
export type TourMeasure = () => Promise<TourRect | null>;

interface TourState {
  step: number | null;
  targets: Record<string, TourMeasure>;
  register: (id: string, measure: TourMeasure) => () => void;
  start: () => void;
  next: () => void;
  finish: () => void;
}

const markSeen = () => AsyncStorage.setItem(tourSeenKey(), '1').catch(() => {});

export const useTourStore = create<TourState>((set, get) => ({
  step: null,
  targets: {},
  register: (id, measure) => {
    set((s) => ({ targets: { ...s.targets, [id]: measure } }));
    return () =>
      set((s) => {
        if (s.targets[id] !== measure) return s;
        const { [id]: _gone, ...rest } = s.targets;
        return { targets: rest };
      });
  },
  start: () => set({ step: 0 }),
  next: () => {
    const { step } = get();
    if (step === null) return;
    if (step + 1 >= TOUR_STEPS.length) get().finish();
    else set({ step: step + 1 });
  },
  finish: () => {
    set({ step: null });
    markSeen();
  },
}));

/** Called when Home comes into view: starts the tour once after an update, for someone who already used the app. */
export async function maybeStartWhatsNewTour(hasEntries: boolean): Promise<void> {
  if (useTourStore.getState().step !== null) return;
  let alreadySeen = true;
  try {
    alreadySeen = (await AsyncStorage.getItem(tourSeenKey())) === '1';
  } catch {
    return; // storage unreadable: never risk showing it every launch
  }
  if (!alreadySeen && !hasEntries) {
    markSeen(); // a brand new user: nothing to compare with
    return;
  }
  if (shouldStartTour({ alreadySeen, hasEntries })) useTourStore.getState().start();
}
