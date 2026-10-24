import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { createReduceMotionStore } from '../lib/reduceMotionStore';

/**
 * THE app-wide "reduce motion" hook (OPT-43).
 *
 * - Live: follows the OS setting while the app is open (one shared subscription for all components).
 * - No wrong first frame: until the OS answers, it uses the value the system had when the app started
 *   (the same signal Reanimated reads).
 */
const store = createReduceMotionStore(AccessibilityInfo);

export function useReduceMotion(): boolean {
  const startupValue = useReducedMotion();
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot(startupValue));
}
