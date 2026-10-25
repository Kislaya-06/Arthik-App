import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useFocusEntryCount, useScreenBlurListener, useScreenFocusListener } from './useFocusEntry';
import { useIsSplashCoverOpaque } from '../store/splashCoverStore';

/**
 * Wait after a blur before quietly emptying the ring. Longer than the tab cross-fade and the stack slide, so the
 * ring is never seen emptying while the screen is still visible on its way out.
 */
const BLUR_RESET_DELAY_MS = 450;
/** A focus event this soon after a sweep started for the same target is the same visit: do not restart it. */
const SAME_VISIT_WINDOW_MS = 120;
const SWEEP_EASING = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Progress value (0..1) for a ring chart that sweeps up from empty on every visit — WITHOUT a blink.
 *
 * Why the old ring blinked: when you came back to a frozen tab, its last frame (the FULL ring) was shown first,
 * and only then did the entry effect reset the ring to 0 and sweep again: full → empty → sweep = one blink.
 *
 * The fix is to never reset on the way IN. The ring is emptied on the way OUT instead: after the screen loses
 * focus and is no longer visible, the value is set to 0 on the UI thread (shared values keep working while the
 * tab is frozen). When you come back, the ring is already empty and simply sweeps up. If you come back before
 * the reset happened, the pending reset is cancelled and the ring glides from where it is. No jump either way.
 *
 * Two triggers start the sweep, so a return can never leave the ring empty:
 *  1. the focus-entry layout effect (runs before the first painted frame of a revealed tab);
 *  2. the navigation 'focus' event (backup; skipped when trigger 1 already started this visit's sweep).
 *
 * Also:
 *  - the sweep runs on the UI thread (Reanimated), so a busy JS thread can not make it stutter;
 *  - new data mid-sweep re-targets smoothly from the current value;
 *  - right after a cold start it waits until the splash cover starts to dissolve, so the sweep is seen;
 *  - with "reduce motion" on, the ring is simply set.
 */
export function useRingSweep(target: number, durationMs: number): SharedValue<number> {
  const progress = useSharedValue(0);
  const entry = useFocusEntryCount();
  const coverOpaque = useIsSplashCoverOpaque();
  const reduceMotion = useReducedMotion();
  const clamped = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 0;

  // Latest inputs for the event listeners (they are registered once).
  const latest = useRef({ clamped, coverOpaque, reduceMotion, durationMs });
  latest.current = { clamped, coverOpaque, reduceMotion, durationMs };

  // What the last started sweep was for, and when. React re-runs layout effects when a frozen tab is revealed even
  // if no dependency changed; restarting the same sweep there would reset its timing curve (a tiny hitch).
  const lastKey = useRef('');
  const lastStart = useRef({ at: 0, value: -1 });

  const startSweep = (value: number) => {
    cancelAnimation(progress);
    lastStart.current = { at: Date.now(), value };
    if (latest.current.reduceMotion) {
      progress.value = value;
      return;
    }
    progress.value = withTiming(value, { duration: latest.current.durationMs, easing: SWEEP_EASING });
  };

  // Trigger 1 — layout effect: starts in the same commit as the reveal of a frozen tab, before its first frame.
  useLayoutEffect(() => {
    // entry 0 = the mount commit before focus is counted; the real first entry (1) follows right after.
    if (entry === 0 || coverOpaque) return;
    const key = `${entry}|${clamped}|${reduceMotion ? 1 : 0}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    startSweep(clamped);
    // startSweep only reads refs and the stable shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, clamped, coverOpaque, reduceMotion, progress]);

  // Trigger 2 — focus event (backup). Also cancels a pending blur reset if we came back quickly.
  useScreenFocusListener(() => {
    const { clamped: value, coverOpaque: opaque } = latest.current;
    if (opaque) return;
    const recent = Date.now() - lastStart.current.at < SAME_VISIT_WINDOW_MS && lastStart.current.value === value;
    if (recent) return;
    startSweep(value);
  });

  useScreenBlurListener(() => {
    if (latest.current.reduceMotion) return;
    // Holds the current value during the delay (the screen is fading/sliding out), then empties instantly.
    progress.value = withDelay(BLUR_RESET_DELAY_MS, withTiming(0, { duration: 0 }));
  });

  useEffect(() => () => cancelAnimation(progress), [progress]);

  return progress;
}
