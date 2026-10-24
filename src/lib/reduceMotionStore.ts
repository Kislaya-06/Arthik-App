/**
 * App-wide "reduce motion" value shared by every component (OPT-43).
 *
 * One subscription to the OS setting for the whole app, instead of one per component.
 * Pure (no React, no React Native import): the OS is passed in, so it can be tested.
 * The value is LIVE: switching "Remove animations" while the app is open is picked up.
 */
export interface MotionSettingSource {
  isReduceMotionEnabled: () => Promise<boolean>;
  addEventListener: (
    name: 'reduceMotionChanged',
    handler: (enabled: boolean) => void
  ) => { remove: () => void } | void;
}

export interface ReduceMotionStore {
  /** Starts listening on first use. Returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /** Current value. `startupValue` is used until the OS has answered once. */
  getSnapshot: (startupValue: boolean) => boolean;
}

export function createReduceMotionStore(source: MotionSettingSource): ReduceMotionStore {
  let current: boolean | null = null; // null = OS has not answered yet
  let started = false;
  const listeners = new Set<() => void>();

  const set = (value: boolean) => {
    if (current === value) return;
    current = value;
    listeners.forEach((l) => l());
  };

  const start = () => {
    if (started) return;
    started = true;
    try {
      source
        .isReduceMotionEnabled()
        .then(set)
        .catch(() => {});
      // Lives as long as the app, like the single shared subscription it replaces.
      source.addEventListener('reduceMotionChanged', set);
    } catch {
      // Best effort: without the OS answer we keep the startup value.
    }
  };

  return {
    subscribe: (listener) => {
      start();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: (startupValue) => (current === null ? startupValue : current),
  };
}
