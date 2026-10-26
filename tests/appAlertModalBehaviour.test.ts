/**
 * appAlertModalBehaviour.test.ts
 *
 * The themed dialog that replaced the white Android popup (e.g. History "Delete Expense?").
 * Locks the fixes from the Oct 2026 review:
 *   - a double tap on "Delete" runs the delete ONCE
 *   - an interrupted exit animation still runs the chosen action (old code dropped it on finished=false)
 *   - the entrance animation plays once per alert (old code restarted it one render later)
 *   - a second alert waits for the first instead of replacing it (and dropping its callbacks)
 *   - the scrim covers the system navigation bar (edge-to-edge dialog window)
 *   - every button is >= 4.5:1 contrast in Light, Dark and AMOLED
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});

const anim = vi.hoisted(() => ({
  // Each withTiming with a callback is parked here; tests decide when / how it ends.
  pending: [] as Array<(finished: boolean) => void>,
  timings: 0,
  springs: 0,
}));

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  Text: (props: any) => ({ type: 'Text', props }),
  Modal: (props: any) => ({ type: 'Modal', props }),
  Pressable: (props: any) => ({ type: 'Pressable', props }),
  ScrollView: (props: any) => ({ type: 'ScrollView', props }),
  StyleSheet: { create: (s: any) => s, absoluteFill: { position: 'absolute' } },
  Platform: { OS: 'android', select: (o: any) => o.android },
  Keyboard: { dismiss: () => {} },
  Dimensions: { get: () => ({ width: 400, height: 800 }) },
  Alert: { alert: () => {} },
  AccessibilityInfo: { addEventListener: () => ({ remove: () => {} }), isReduceMotionEnabled: async () => false },
}));

vi.mock('react-native-reanimated', async () => {
  const { reactHooks } = await import('./helpers/hookRuntime');
  return {
  default: { View: (props: any) => ({ type: 'Animated.View', props }) },
  useSharedValue: (v: any) => reactHooks.useRef({ value: v }).current,
  runOnJS: (fn: any) => fn,
  useAnimatedStyle: (fn: any) => fn(),
  useReducedMotion: () => false,
  withSpring: (v: any) => {
    anim.springs++;
    return v;
  },
  withTiming: (v: any, _cfg: any, cb?: (finished: boolean) => void) => {
    anim.timings++;
    if (cb) anim.pending.push(cb);
    return v;
  },
  };
});

vi.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: any, ...args: any[]) => fn(...args) }));

// zustand's own hook uses the real React; bridge the REAL alert store to the test hook runtime.
vi.mock('../src/store/alertStore', async () => {
  const real = await vi.importActual<any>('../src/store/alertStore');
  const { reactHooks } = await import('./helpers/hookRuntime');
  const store = real.useAlertStore;
  const hook: any = () => reactHooks.useSyncExternalStore(store.subscribe, store.getState);
  Object.assign(hook, store);
  return { ...real, useAlertStore: hook };
});

vi.mock('../src/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

vi.mock('../src/store/themeStore', async () => {
  const { DarkColors } = await import('../src/config/theme');
  return { useTheme: () => ({ colors: DarkColors, themeMode: 'dark' }) };
});

import { renderHook, act } from './helpers/hookRuntime';
import { AppAlertModal } from '../src/components/ui/AppAlertModal';
import { useAlertStore, showAlert } from '../src/store/alertStore';
import { alertButtonPalette, contrastRatio } from '../src/lib/alertButtonPalette';
import { LightColors, DarkColors, AmoledColors } from '../src/config/theme';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const reset = () => {
  useAlertStore.setState({ isOpen: false, id: 0, title: '', message: undefined, buttons: [], options: undefined, queue: [] });
  anim.pending.length = 0;
  anim.timings = 0;
  anim.springs = 0;
};

/** Find every node of `type` in a plain element tree. */
const findAll = (node: any, pred: (n: any) => boolean, out: any[] = []): any[] => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => findAll(n, pred, out));
    return out;
  }
  if (pred(node)) out.push(node);
  const kids = node.props?.children;
  if (kids !== undefined) findAll(kids, pred, out);
  return out;
};

/** The alert's action buttons, rendered (AlertButtonComponent is a plain function component). */
const actionButtons = (tree: any) =>
  findAll(tree, (n) => typeof n.type === 'function' && n.props?.button).map((el) => ({
    text: el.props.button.text,
    press: () => el.props.onPress(),
  }));

describe('AppAlertModal behaviour', () => {
  beforeEach(reset);

  it('a double tap on Delete runs the delete exactly once', async () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => AppAlertModal({}));
    await act(() => showAlert('Delete Expense?', 'Delete this ₹200 transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]));
    const del = actionButtons(result.current).find((b) => b.text === 'Delete')!;
    await act(() => {
      del.press();
      del.press();
    });
    await act(() => anim.pending.forEach((cb) => cb(true)));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(useAlertStore.getState().isOpen).toBe(false);
  });

  it('runs the action even if the exit animation is interrupted (finished = false)', async () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => AppAlertModal({}));
    await act(() => showAlert('Delete Expense?', 'x', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]));
    const del = actionButtons(result.current).find((b) => b.text === 'Delete')!;
    await act(() => del.press());
    await act(() => anim.pending.forEach((cb) => cb(false)));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('Cancel / backdrop runs the cancel callback once (a swiped row can close again)', async () => {
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() => AppAlertModal({}));
    await act(() => showAlert('Delete Expense?', 'x', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]));
    const modal: any = result.current; // the component's root element is the <Modal>
    await act(() => {
      modal.props.onRequestClose(); // Android back
      modal.props.onRequestClose();
    });
    await act(() => anim.pending.forEach((cb) => cb(true)));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('plays the entrance once per alert (no restart on the follow-up render)', async () => {
    renderHook(() => AppAlertModal({}));
    await act(() => showAlert('Notice', 'Hello'));
    // One entrance = 1 spring (scale) + 2 timings (card + backdrop). A restart would double these.
    expect(anim.springs).toBe(1);
    expect(anim.timings).toBe(2);
  });

  it('the scrim covers the navigation bar too (edge-to-edge dialog window)', async () => {
    const { result } = renderHook(() => AppAlertModal({}));
    await act(() => showAlert('Notice'));
    const modal: any = result.current; // the component's root element is the <Modal>
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(modal.props.transparent).toBe(true);
  });

  it('a second alert waits for the first and is shown after it closes', async () => {
    const firstCancel = vi.fn();
    const { result } = renderHook(() => AppAlertModal({}));
    await act(() => showAlert('Delete Expense?', 'x', [{ text: 'Cancel', style: 'cancel', onPress: firstCancel }, { text: 'Delete', style: 'destructive' }]));
    await act(() => showAlert('Sync failed', 'Try again later'));
    expect(useAlertStore.getState().title).toBe('Delete Expense?');
    const cancel = actionButtons(result.current).find((b) => b.text === 'Cancel')!;
    await act(() => cancel.press());
    await act(() => anim.pending.splice(0).forEach((cb) => cb(true)));
    expect(firstCancel).toHaveBeenCalledTimes(1);
    const st = useAlertStore.getState();
    expect(st.isOpen).toBe(true);
    expect(st.title).toBe('Sync failed');
  });

  it('button labels are capped at the shared large-font limit so they never clip', async () => {
    const src = read('src/components/ui/AppAlertModal.tsx');
    expect(src).toMatch(/maxFontSizeMultiplier=\{FIXED_SHAPE_MAX_FONT_SCALE\}/);
    expect(src).not.toMatch(/Dimensions\.get/);
    expect(src).not.toMatch(/runOnJS/);
  });
});

describe('alertStore queue', () => {
  beforeEach(reset);

  it('the same alert asked twice (double tap on a delete swipe) is shown once', () => {
    showAlert('Delete Expense?', 'Delete this ₹200 transaction?');
    showAlert('Delete Expense?', 'Delete this ₹200 transaction?');
    expect(useAlertStore.getState().queue).toHaveLength(0);
  });

  it('ids increase per shown alert and the queue drains in order', () => {
    showAlert('A');
    const idA = useAlertStore.getState().id;
    showAlert('B');
    showAlert('C');
    useAlertStore.getState().hideAlert();
    expect(useAlertStore.getState().title).toBe('B');
    expect(useAlertStore.getState().id).toBe(idA + 1);
    useAlertStore.getState().hideAlert();
    expect(useAlertStore.getState().title).toBe('C');
    useAlertStore.getState().hideAlert();
    expect(useAlertStore.getState().isOpen).toBe(false);
  });
});

describe('alert button contrast (WCAG AA 4.5:1) in every theme', () => {
  const themes = [
    ['Light', LightColors, false],
    ['Dark', DarkColors, false],
    ['AMOLED', AmoledColors, true],
  ] as const;
  for (const [name, colors, amoled] of themes) {
    for (const variant of ['default', 'cancel', 'destructive'] as const) {
      it(`${name} ${variant}`, () => {
        const p = alertButtonPalette(variant, colors, amoled);
        expect(contrastRatio(p.text, p.background)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('the old destructive colours really failed (why this changed)', () => {
    expect(contrastRatio('#FFFFFF', LightColors.danger)).toBeLessThan(4.5);
    expect(contrastRatio('#FFFFFF', DarkColors.danger)).toBeLessThan(3);
  });
});
