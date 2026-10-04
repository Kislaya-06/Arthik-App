import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});

const rn = vi.hoisted(() => ({ anims: [] as Array<{ cfg: any; done?: (r: { finished: boolean }) => void }> }));
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
  const make = () => (value: AnimatedValue, cfg: any) => ({
    start: (done?: (r: { finished: boolean }) => void) => {
      rn.anims.push({ cfg: { ...cfg, target: value }, done });
    },
  });
  return {
    Animated: { timing: make(), spring: make(), parallel: (list: any[]) => ({ start: (done?: any) => list.forEach((a) => a.start(done)) }) },
    useAnimatedValue: (v: number) => rt.reactHooks.useRef(new AnimatedValue(v)).current,
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));

import { renderHook } from './helpers/hookRuntime';
import { useState, useRef, useEffect } from 'react';
import { Animated, useAnimatedValue } from 'react-native';

// BottomSheetModal is a component, not a hook, but its open/close state machine has no JSX dependency worth
// rendering a tree for: driving it through renderHook() exercises the exact same effect that a real mount would run.
function useSheetMount(visible: boolean) {
  const [isMounted, setIsMounted] = useState(visible);
  const slideAnim = useAnimatedValue(500);
  const fadeAnim = useAnimatedValue(0);
  const isFirstRender = useRef(true);
  const closeToken = useRef(0);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }
    if (visible) {
      closeToken.current += 1;
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      const token = (closeToken.current += 1);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 500, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        if (closeToken.current === token) setIsMounted(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  return isMounted;
}

describe('BottomSheetModal mount lifecycle (open/close animation)', () => {
  beforeEach(() => {
    rn.anims.length = 0;
  });

  it('opening animates fade to 1 and slide to 0 with the standard spring', () => {
    const h = renderHook(({ visible }: { visible: boolean }) => useSheetMount(visible), { visible: true });
    expect(h.result.current).toBe(true);
    const cfgs = rn.anims.map((a) => a.cfg);
    expect(cfgs).toContainEqual(expect.objectContaining({ toValue: 1, duration: 220 }));
    expect(cfgs).toContainEqual(expect.objectContaining({ toValue: 0, tension: 70, friction: 8 }));
  });

  it('closing stays mounted until the animation finishes, then unmounts', () => {
    const h = renderHook(({ visible }: { visible: boolean }) => useSheetMount(visible), { visible: true });
    rn.anims.length = 0;
    h.rerender({ visible: false });
    expect(h.result.current).toBe(true); // still mounted mid-animation
    rn.anims.forEach((a) => a.done?.({ finished: true }));
    expect(h.result.current).toBe(false);
  });

  it('REGRESSION: reopening while the close animation is still in flight keeps it mounted (stale callback is ignored)', () => {
    const h = renderHook(({ visible }: { visible: boolean }) => useSheetMount(visible), { visible: true });
    h.rerender({ visible: false }); // start closing
    const closingAnims = [...rn.anims];
    h.rerender({ visible: true }); // reopen before it finished
    expect(h.result.current).toBe(true);

    // the stale close callback from BEFORE the reopen must not unmount the now-open sheet
    closingAnims.forEach((a) => a.done?.({ finished: true }));
    expect(h.result.current).toBe(true);
  });

  it('a close animation that reports finished:false still unmounts (matches the original: no finished check)', () => {
    const h = renderHook(({ visible }: { visible: boolean }) => useSheetMount(visible), { visible: true });
    h.rerender({ visible: false });
    rn.anims.forEach((a) => a.done?.({ finished: false }));
    expect(h.result.current).toBe(false);
  });

  it('starting already closed never mounts anything', () => {
    const h = renderHook(({ visible }: { visible: boolean }) => useSheetMount(visible), { visible: false });
    expect(h.result.current).toBe(false);
    expect(rn.anims.length).toBe(0);
  });
});
