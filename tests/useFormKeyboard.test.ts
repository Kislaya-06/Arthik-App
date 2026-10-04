import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});

type Anim = { kind: 'timing' | 'spring'; cfg: any; done?: (r: { finished: boolean }) => void; started: boolean };
const rn = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  removed: [] as string[],
  dismiss: vi.fn(),
  anims: [] as Anim[],
}));

vi.mock('react-native', async () => {
  const rt = await import('./helpers/hookRuntime');
  class AnimatedValue {
    value: number;
    constructor(v: number) {
      this.value = v;
    }
    setValue(v: number) {
      this.value = v;
    }
  }
  const make = (kind: 'timing' | 'spring') => (value: AnimatedValue, cfg: any) => ({
    start: (done?: (r: { finished: boolean }) => void) => {
      rn.anims.push({ kind, cfg: { ...cfg, target: value }, done, started: true });
    },
  });
  return {
    Keyboard: {
      addListener: (event: string, cb: () => void) => {
        rn.listeners.set(event, cb);
        return { remove: () => void rn.removed.push(event) };
      },
      dismiss: rn.dismiss,
    },
    Animated: { timing: make('timing'), spring: make('spring') },
    Easing: { out: (f: unknown) => f, cubic: 'cubic' },
    useAnimatedValue: (v: number) => rt.reactHooks.useRef(new AnimatedValue(v)).current,
  };
});

import { renderHook } from './helpers/hookRuntime';
import { useFormKeyboard } from '../src/hooks/useFormKeyboard';

const lastAnim = () => rn.anims[rn.anims.length - 1];
const finish = (a: Anim, finished = true) => a.done?.({ finished });
const newHook = () => {
  const h = renderHook(() => useFormKeyboard());
  const scrollTo = vi.fn();
  (h.result.current.scrollRef as any).current = { scrollTo };
  return { h, scrollTo };
};

describe('useFormKeyboard (the custom keypad and the system keyboard on the add / edit form)', () => {
  beforeEach(() => {
    rn.listeners.clear();
    rn.removed.length = 0;
    rn.anims.length = 0;
    rn.dismiss.mockClear();
    (globalThis as any).requestAnimationFrame = (cb: () => void) => cb();
  });

  it('starts with the keypad open and the keyboard closed', () => {
    const { h } = newHook();
    expect(h.result.current.isKeypadVisible).toBe(true);
    expect(h.result.current.isKeyboardOpen).toBe(false);
    expect((h.result.current.keypadAnim as any).value).toBe(1);
  });

  describe('hideKeypad / showKeypad', () => {
    it('hideKeypad slides the keypad down over 200 ms and only then marks it hidden', () => {
      const { h } = newHook();
      h.result.current.hideKeypad();
      expect(lastAnim().cfg).toMatchObject({ toValue: 0, duration: 200, useNativeDriver: false });
      expect(h.result.current.isKeypadVisible).toBe(true); // still visible while it animates
      finish(lastAnim());
      expect(h.result.current.isKeypadVisible).toBe(false);
    });

    it('an interrupted hide (not finished) leaves the keypad visible', () => {
      const { h } = newHook();
      h.result.current.hideKeypad();
      finish(lastAnim(), false);
      expect(h.result.current.isKeypadVisible).toBe(true);
    });

    it('hiding an already hidden keypad does nothing', () => {
      const { h } = newHook();
      h.result.current.hideKeypad();
      const n = rn.anims.length;
      h.result.current.hideKeypad();
      expect(rn.anims.length).toBe(n);
    });

    it('showKeypad brings it back (visible straight away, animated to 1 over 220 ms)', () => {
      const { h } = newHook();
      h.result.current.hideKeypad();
      finish(lastAnim());
      h.result.current.showKeypad();
      expect(h.result.current.isKeypadVisible).toBe(true);
      expect(lastAnim().cfg).toMatchObject({ toValue: 1, duration: 220, useNativeDriver: false });
    });

    it('showKeypad is blocked while the note field has focus', () => {
      const { h } = newHook();
      h.result.current.handleNoteFocus();
      finish(lastAnim());
      const n = rn.anims.length;
      h.result.current.showKeypad();
      expect(rn.anims.length).toBe(n);
      expect(h.result.current.isKeypadVisible).toBe(false);
    });
  });

  describe('system keyboard events', () => {
    it('listens for the keyboard when mounted and stops when unmounted', () => {
      const { h } = newHook();
      expect([...rn.listeners.keys()].sort()).toEqual(['keyboardDidHide', 'keyboardDidShow']);
      h.unmount();
      expect(rn.removed.sort()).toEqual(['keyboardDidHide', 'keyboardDidShow']);
    });

    it('keyboard opening marks it open and tucks the keypad away', () => {
      const { h } = newHook();
      rn.listeners.get('keyboardDidShow')!();
      expect(h.result.current.isKeyboardOpen).toBe(true);
      expect(lastAnim().cfg).toMatchObject({ toValue: 0 });
    });

    it('keyboard closing marks it closed and does NOT bring the keypad back by itself', () => {
      const { h } = newHook();
      rn.listeners.get('keyboardDidShow')!();
      finish(lastAnim());
      const n = rn.anims.length;
      rn.listeners.get('keyboardDidHide')!();
      expect(h.result.current.isKeyboardOpen).toBe(false);
      expect(h.result.current.isKeypadVisible).toBe(false);
      expect(rn.anims.length).toBe(n);
    });
  });

  describe('note field', () => {
    it('focusing it opens the keyboard state and hides the keypad', () => {
      const { h } = newHook();
      h.result.current.handleNoteFocus();
      expect(h.result.current.isKeyboardOpen).toBe(true);
      expect(lastAnim().cfg).toMatchObject({ toValue: 0 });
    });

    it('scrolls the note into view, 12px above its top, once its position is known', () => {
      const { h, scrollTo } = newHook();
      h.result.current.handleNoteLayout({ nativeEvent: { layout: { y: 400 } } } as any);
      h.result.current.handleNoteFocus();
      expect(scrollTo).toHaveBeenCalledWith({ y: 388, animated: true });
    });

    it('does not scroll when the note position is not known yet', () => {
      const { h, scrollTo } = newHook();
      h.result.current.handleNoteFocus();
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('blurring the note lets the keypad be shown again', () => {
      const { h } = newHook();
      h.result.current.handleNoteFocus();
      finish(lastAnim());
      h.result.current.handleNoteBlur();
      h.result.current.showKeypad();
      expect(h.result.current.isKeypadVisible).toBe(true);
    });
  });

  describe('tapping the amount', () => {
    it('closes the system keyboard, brings the keypad back and scrolls to the top', () => {
      const { h, scrollTo } = newHook();
      h.result.current.handleNoteFocus();
      finish(lastAnim());
      h.result.current.handleAmountPress();
      expect(rn.dismiss).toHaveBeenCalledTimes(1);
      expect(h.result.current.isKeypadVisible).toBe(true);
      expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    });
  });

  describe('dragging the keypad down', () => {
    it('follows the finger: 258px of drag is a fully closed keypad', () => {
      const { h } = newHook();
      const anim = h.result.current.keypadAnim as any;
      h.result.current.handleKeypadDrag(0);
      expect(anim.value).toBe(1);
      h.result.current.handleKeypadDrag(129);
      expect(anim.value).toBeCloseTo(0.5, 6);
      h.result.current.handleKeypadDrag(258);
      expect(anim.value).toBe(0);
    });

    it('never goes outside 0..1 (over-drag and upward drag are clamped)', () => {
      const { h } = newHook();
      const anim = h.result.current.keypadAnim as any;
      h.result.current.handleKeypadDrag(900);
      expect(anim.value).toBe(0);
      h.result.current.handleKeypadDrag(-80);
      expect(anim.value).toBe(1);
    });

    it('a drag of more than 30px, released, keeps closing (180 ms) and then marks the keypad hidden', () => {
      const { h } = newHook();
      h.result.current.handleKeypadDragEnd(31, 0);
      expect(lastAnim().kind).toBe('timing');
      expect(lastAnim().cfg).toMatchObject({ toValue: 0, duration: 180 });
      finish(lastAnim());
      expect(h.result.current.isKeypadVisible).toBe(false);
    });

    it('a quick flick (fast enough, even a short drag) also closes it', () => {
      const { h } = newHook();
      h.result.current.handleKeypadDragEnd(10, 0.36);
      expect(lastAnim().cfg).toMatchObject({ toValue: 0, duration: 180 });
    });

    it('a short, slow drag springs back open using the standard spring (tension 70, friction 8)', () => {
      const { h } = newHook();
      h.result.current.handleKeypadDragEnd(10, 0.1);
      expect(lastAnim().kind).toBe('spring');
      expect(lastAnim().cfg).toMatchObject({ toValue: 1, tension: 70, friction: 8, useNativeDriver: false });
      expect(h.result.current.isKeypadVisible).toBe(true);
    });

    it('dragging a keypad that is already hidden does nothing', () => {
      const { h } = newHook();
      h.result.current.hideKeypad();
      finish(lastAnim());
      const n = rn.anims.length;
      const anim = h.result.current.keypadAnim as any;
      const before = anim.value;
      h.result.current.handleKeypadDrag(100);
      h.result.current.handleKeypadDragEnd(100, 1);
      expect(anim.value).toBe(before);
      expect(rn.anims.length).toBe(n);
    });
  });

  it('keeps the same handler functions between renders (safe to use in effects and props)', () => {
    const { h } = newHook();
    const a = h.result.current;
    h.rerender();
    const b = h.result.current;
    expect(b.showKeypad).toBe(a.showKeypad);
    expect(b.hideKeypad).toBe(a.hideKeypad);
    expect(b.handleAmountPress).toBe(a.handleAmountPress);
    expect(b.handleNoteFocus).toBe(a.handleNoteFocus);
    expect(b.handleKeypadDrag).toBe(a.handleKeypadDrag);
    expect(b.scrollRef).toBe(a.scrollRef);
  });
});
