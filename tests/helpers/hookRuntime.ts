/**
 * hookRuntime.ts: a tiny React hook runtime for unit tests.
 *
 * Why it exists: the project's tests run in plain node with no extra dependency, but several hooks (useScrollDirection,
 * useFocusEntry, useFormKeyboard, useSavingsDashboard, useExpenseForm) can only run inside a renderer. Instead of adding
 * react-test-renderer, this file implements just enough of React's hooks (state, refs, memo, callbacks, effects,
 * useSyncExternalStore for zustand) to run one hook function and read what it returns.
 *
 * It also models the one React behaviour this app relies on: when a `freezeOnBlur` tab is hidden, React cleans up its
 * LAYOUT effects, and when the tab is revealed again it re-runs them (passive effects are NOT re-run). See freeze()/reveal().
 *
 * Usage (in a test file):
 *
 *   vi.mock('react', async () => {
 *     const actual = await vi.importActual<any>('react');
 *     const rt = await import('./helpers/hookRuntime');
 *     return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
 *   });
 *   import { renderHook, act } from './helpers/hookRuntime';
 */

type Cleanup = void | (() => void);

interface EffectCell {
  kind: 'layout' | 'passive';
  deps?: readonly unknown[];
  create: () => Cleanup;
  cleanup?: Cleanup;
  pending: boolean;
}

interface Instance {
  hooks: any[];
  cursor: number;
  rendering: boolean;
  dirty: boolean;
  unmounted: boolean;
  frozen: boolean;
  renders: number;
  render: () => void;
}

let current: Instance | null = null;

const depsChanged = (a?: readonly unknown[], b?: readonly unknown[]): boolean => {
  if (!a || !b) return true;
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return true;
  return false;
};

const need = (): Instance => {
  if (!current) throw new Error('A hook was called outside renderHook()');
  return current;
};

function schedule(inst: Instance) {
  if (inst.unmounted || inst.frozen) return;
  if (inst.rendering) {
    inst.dirty = true;
    return;
  }
  let guard = 0;
  do {
    inst.dirty = false;
    inst.render();
    if (++guard > 50) throw new Error('hookRuntime: too many re-renders (infinite loop?)');
  } while (inst.dirty);
}

function useStateImpl<S>(initial: S | (() => S)): [S, (v: S | ((p: S) => S)) => void] {
  const inst = need();
  const idx = inst.cursor++;
  if (!inst.hooks[idx]) {
    const cell: { value: S; set: (v: S | ((p: S) => S)) => void } = {
      value: typeof initial === 'function' ? (initial as () => S)() : initial,
      set: (v) => {
        const next = typeof v === 'function' ? (v as (p: S) => S)(cell.value) : v;
        if (Object.is(next, cell.value)) return;
        cell.value = next;
        schedule(inst);
      },
    };
    inst.hooks[idx] = cell;
  }
  const cell = inst.hooks[idx];
  return [cell.value, cell.set];
}

function useRefImpl<T>(initial: T): { current: T } {
  const inst = need();
  const idx = inst.cursor++;
  if (!inst.hooks[idx]) inst.hooks[idx] = { current: initial };
  return inst.hooks[idx];
}

function useMemoImpl<T>(factory: () => T, deps?: readonly unknown[]): T {
  const inst = need();
  const idx = inst.cursor++;
  const cell = inst.hooks[idx];
  if (!cell || depsChanged(cell.deps, deps)) {
    inst.hooks[idx] = { deps, value: factory() };
  }
  return inst.hooks[idx].value;
}

function useCallbackImpl<T extends (...a: any[]) => any>(fn: T, deps?: readonly unknown[]): T {
  return useMemoImpl(() => fn, deps);
}

function makeEffect(kind: 'layout' | 'passive') {
  return (create: () => Cleanup, deps?: readonly unknown[]) => {
    const inst = need();
    const idx = inst.cursor++;
    const cell: EffectCell | undefined = inst.hooks[idx];
    if (!cell) {
      inst.hooks[idx] = { kind, deps, create, pending: true } as EffectCell;
    } else if (depsChanged(cell.deps, deps)) {
      cell.deps = deps;
      cell.create = create;
      cell.pending = true;
    } else {
      cell.create = create; // keep the newest closure for a later freeze/reveal
    }
  };
}

function useSyncExternalStoreImpl<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T): T {
  const inst = need();
  const idx = inst.cursor++;
  if (!inst.hooks[idx]) inst.hooks[idx] = { getSnapshot, last: undefined as T };
  const cell = inst.hooks[idx];
  cell.getSnapshot = getSnapshot;
  const snap = getSnapshot();
  cell.last = snap;
  const effIdx = inst.cursor++;
  const eff: EffectCell | undefined = inst.hooks[effIdx];
  const create = () =>
    subscribe(() => {
      const next = cell.getSnapshot();
      if (!Object.is(next, cell.last)) schedule(inst);
    });
  if (!eff) inst.hooks[effIdx] = { kind: 'passive', deps: [subscribe], create, pending: true } as EffectCell;
  else if (depsChanged(eff.deps, [subscribe])) {
    eff.deps = [subscribe];
    eff.create = create;
    eff.pending = true;
  }
  return snap;
}

/** The hooks to hand to `vi.mock('react', ...)`. */
export const reactHooks = {
  useState: useStateImpl,
  useRef: useRefImpl,
  useMemo: useMemoImpl,
  useCallback: useCallbackImpl,
  useEffect: makeEffect('passive'),
  useLayoutEffect: makeEffect('layout'),
  useSyncExternalStore: useSyncExternalStoreImpl,
  useDebugValue: () => {},
};

function runEffects(inst: Instance) {
  const cells: EffectCell[] = inst.hooks.filter((h) => h && typeof h.create === 'function' && 'kind' in h);
  const todo = cells.filter((c) => c.pending);
  for (const c of todo) {
    if (typeof c.cleanup === 'function') c.cleanup();
    c.cleanup = undefined;
  }
  for (const kind of ['layout', 'passive'] as const) {
    for (const c of todo) {
      if (c.kind !== kind) continue;
      c.pending = false;
      c.cleanup = c.create();
    }
  }
}

export interface RenderedHook<T, P> {
  /** Latest value returned by the hook. */
  readonly result: { current: T };
  /** How many times the hook function has run. */
  readonly renders: () => number;
  /** Re-run the hook (optionally with new props). */
  rerender: (props?: P) => void;
  /** Run cleanups and stop reacting to state changes. */
  unmount: () => void;
  /** Simulate React hiding a frozen tab: LAYOUT effect cleanups run. */
  freeze: () => void;
  /** Simulate React revealing it again: LAYOUT effects run again (passive ones do not). */
  reveal: () => void;
}

export function renderHook<T, P = undefined>(fn: (props: P) => T, initialProps?: P): RenderedHook<T, P> {
  let props = initialProps as P;
  const result = { current: undefined as unknown as T };
  const inst: Instance = {
    hooks: [],
    cursor: 0,
    rendering: false,
    dirty: false,
    unmounted: false,
    frozen: false,
    renders: 0,
    render: () => {
      const prev = current;
      current = inst;
      inst.cursor = 0;
      inst.rendering = true;
      try {
        result.current = fn(props);
        current = prev;
        inst.renders++;
        // Effects run while `rendering` is still true, so any state they set is batched into ONE follow-up render
        // (the do/while loops in schedule() and renderHook() pick it up), like React does.
        runEffects(inst);
      } finally {
        inst.rendering = false;
        current = prev;
      }
    },
  };
  inst.render();
  while (inst.dirty) {
    inst.dirty = false;
    inst.render();
  }
  return {
    result,
    renders: () => inst.renders,
    rerender: (next) => {
      if (next !== undefined) props = next;
      schedule(inst);
    },
    unmount: () => {
      inst.unmounted = true;
      for (const h of inst.hooks) {
        if (h && typeof h.create === 'function' && typeof h.cleanup === 'function') h.cleanup();
      }
    },
    freeze: () => {
      inst.frozen = true;
      for (const h of inst.hooks) {
        if (h && h.kind === 'layout' && typeof h.cleanup === 'function') {
          h.cleanup();
          h.cleanup = undefined;
        }
      }
    },
    reveal: () => {
      inst.frozen = false;
      for (const h of inst.hooks) {
        if (h && h.kind === 'layout') h.cleanup = h.create();
      }
      schedule(inst);
    },
  };
}

/** Same name as React's `act`: runs the callback, then lets any pending async work settle. */
export async function act(fn: () => void | Promise<void>): Promise<void> {
  await fn();
  await Promise.resolve();
}
