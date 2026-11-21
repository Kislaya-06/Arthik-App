import { useEffect, useLayoutEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useIsSplashCoverOpaque } from '../store/splashCoverStore';

const SWEEP_EASING = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Progress value (0..max) for a ring chart. The ring sweeps up from empty the first time it is shown, and glides
 * from where it is to the new value whenever the value changes (a pill switch, a new expense). Coming back to the
 * screen does NOT replay the sweep: a value that has not changed stays still, like a real instrument.
 *
 * Also:
 *  - the sweep runs on the UI thread (Reanimated), so a busy JS thread can not make it stutter;
 *  - new data mid-sweep re-targets smoothly from the current value;
 *  - right after a cold start it waits until the splash cover starts to dissolve, so the first sweep is seen;
 *  - with "reduce motion" on, the ring is simply set;
 *  - a frozen tab that is revealed re-runs the layout effect with the same value: the timing then goes from the
 *    value to itself, which shows nothing (no blink, no replay).
 *
 * `max` is the largest value drawn (1 = one lap; the Home ring uses 2 for its second lap, UX-004).
 */
export function useRingSweep(target: number, durationMs: number, max = 1): SharedValue<number> {
  const progress = useSharedValue(0);
  const coverOpaque = useIsSplashCoverOpaque();
  const reduceMotion = useReducedMotion();
  const clamped = Number.isFinite(target) ? Math.max(0, Math.min(max, target)) : 0;

  useLayoutEffect(() => {
    if (coverOpaque) return;
    cancelAnimation(progress);
    if (reduceMotion) {
      progress.value = clamped;
      return;
    }
    progress.value = withTiming(clamped, { duration: durationMs, easing: SWEEP_EASING });
  }, [clamped, coverOpaque, reduceMotion, durationMs, progress]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  return progress;
}
