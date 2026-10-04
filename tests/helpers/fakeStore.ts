/**
 * fakeStore.ts: a minimal stand-in for a zustand store, for hook tests.
 *
 * Real zustand hooks call React's own hooks through the real `react` package, which the hook runtime in hookRuntime.ts
 * can not intercept. A fake store is a plain function (`useStore(selector)` just reads the current state), so hooks that
 * select from a store run fine in tests. It supports the parts of the zustand API the app uses: getState, setState
 * (object or function), and subscribe.
 */
export interface FakeStore<T> {
  (): T;
  <U>(selector: (s: T) => U): U;
  getState: () => T;
  setState: (partial: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (listener: (s: T, prev: T) => void) => () => void;
}

export function createFakeStore<T extends object>(initial: T): FakeStore<T> {
  let state = initial;
  const listeners = new Set<(s: T, prev: T) => void>();

  const useStore = ((selector?: (s: T) => unknown) => (selector ? selector(state) : state)) as FakeStore<T>;
  useStore.getState = () => state;
  useStore.setState = (partial) => {
    const prev = state;
    const patch = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state, prev));
  };
  useStore.subscribe = (listener) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return useStore;
}
