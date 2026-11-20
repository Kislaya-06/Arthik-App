import { Animated, Easing } from 'react-native';
import { Motion } from '../config/theme';

/**
 * sheetTransition.ts
 *
 * The enter / exit motion that CadenceSwitchModal, PeriodRenewalModal and VaultSpendingGuardModal each wrote
 * out by hand (identical code, only the off-screen distance and the entrance fade differed). Moved here
 * unchanged so the three sheets keep exactly the same feel:
 *  - open: backdrop fades in over `enterFadeMs` while the sheet springs up (Motion.springs.sheet);
 *  - close: backdrop fades out over 160 ms and the sheet slides down over 180 ms (iOS drawer curve), then the
 *    sheet unmounts;
 *  - reduce motion: values jump, no animation.
 * The caller keeps its own effect, dependencies and first-render guard, and calls setIsMounted(true) (plus any
 * form reset) before this when opening, exactly as before.
 */
export const SHEET_EXIT_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export interface SheetTransitionParams {
  visible: boolean;
  reduceMotion: boolean;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  /** How far below its resting place the sheet starts and ends (px). */
  offscreen: number;
  /** Backdrop fade-in duration when opening (ms). */
  enterFadeMs: number;
  setIsMounted: (mounted: boolean) => void;
}

export function runSheetTransition({
  visible,
  reduceMotion,
  fadeAnim,
  slideAnim,
  offscreen,
  enterFadeMs,
  setIsMounted,
}: SheetTransitionParams): void {
  if (visible) {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: enterFadeMs,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          stiffness: Motion.springs.sheet.stiffness,
          damping: Motion.springs.sheet.damping,
          mass: Motion.springs.sheet.mass,
          useNativeDriver: true,
        }),
      ]).start();
    }
  } else {
    if (reduceMotion) {
      fadeAnim.setValue(0);
      slideAnim.setValue(offscreen);
      setIsMounted(false);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          easing: SHEET_EXIT_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: offscreen,
          duration: 180,
          easing: SHEET_EXIT_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsMounted(false);
      });
    }
  }
}
