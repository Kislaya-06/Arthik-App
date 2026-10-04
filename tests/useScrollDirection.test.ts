import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});
// useFocusEffect runs its callback when the screen gains focus: model that with a passive effect
vi.mock('@react-navigation/native', async () => {
  const rt = await import('./helpers/hookRuntime');
  return { useFocusEffect: (cb: () => void) => rt.reactHooks.useEffect(() => cb(), [cb]) };
});

// A fake store: zustand's own hooks use the real React, which the hook runtime can not intercept (see helpers/fakeStore.ts)
vi.mock('../src/store/navBarStore', async () => {
  const { createFakeStore } = await import('./helpers/fakeStore');
  const useNavBarStore: any = createFakeStore({
    isVisible: true,
    showNavBar: () => useNavBarStore.setState({ isVisible: true }),
    hideNavBar: () => useNavBarStore.setState({ isVisible: false }),
  });
  return { useNavBarStore };
});

import { renderHook } from './helpers/hookRuntime';
import { useScrollDirection } from '../src/hooks/useScrollDirection';
import { useNavBarStore } from '../src/store/navBarStore';

const scroll = (y: number) => ({ nativeEvent: { contentOffset: { y } } }) as any;
const visible = () => useNavBarStore.getState().isVisible;

describe('useScrollDirection (hide the bottom bar when scrolling down, show it when scrolling up)', () => {
  beforeEach(() => {
    useNavBarStore.setState({ isVisible: true });
  });

  it('scrolling DOWN by more than 15px hides the bar', () => {
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(16));
    expect(visible()).toBe(false);
  });

  it('tiny movements (15px or less) are ignored, so the bar does not flicker', () => {
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(10));
    h.result.current(scroll(15));
    expect(visible()).toBe(true);
  });

  it('small moves add up: the distance is measured from the last point that counted', () => {
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(10)); // ignored, last counted point is still 0
    h.result.current(scroll(20)); // 20 from the last counted point: hides
    expect(visible()).toBe(false);
  });

  it('scrolling UP by more than 15px shows it again', () => {
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(200));
    expect(visible()).toBe(false);
    h.result.current(scroll(180));
    expect(visible()).toBe(true);
  });

  it('a small step back up while hidden does not show it (needs more than 15px)', () => {
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(100));
    expect(visible()).toBe(false);
    h.result.current(scroll(90)); // only 10px up
    expect(visible()).toBe(false);
    h.result.current(scroll(80)); // 20px up from the last counted point
    expect(visible()).toBe(true);
  });

  it('at the very top (offset 0 or less, including iOS-style bounce) the bar is always shown', () => {
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(300));
    expect(visible()).toBe(false);
    h.result.current(scroll(0));
    expect(visible()).toBe(true);

    h.result.current(scroll(300));
    expect(visible()).toBe(false);
    h.result.current(scroll(-20));
    expect(visible()).toBe(true);
  });

  it('after reaching the top the next scroll is measured from the top again', () => {
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(500));
    h.result.current(scroll(0));
    h.result.current(scroll(10)); // only 10 from the top
    expect(visible()).toBe(true);
    h.result.current(scroll(20));
    expect(visible()).toBe(false);
  });

  it('does not write to the store when nothing changes (no needless re-render of the bar)', () => {
    const writes: boolean[] = [];
    const unsub = useNavBarStore.subscribe((s, p) => {
      if (s.isVisible !== p.isVisible) writes.push(s.isVisible);
    });
    const h = renderHook(() => useScrollDirection());
    h.result.current(scroll(100)); // hide
    h.result.current(scroll(140)); // still going down
    h.result.current(scroll(200)); // still going down
    h.result.current(scroll(120)); // up: show
    unsub();
    expect(writes).toEqual([false, true]);
  });

  it('when the screen gains focus the bar is brought back if it was left hidden', () => {
    useNavBarStore.setState({ isVisible: false });
    renderHook(() => useScrollDirection());
    expect(visible()).toBe(true);
  });

  it('returns the same handler on every render (safe to pass to onScroll)', () => {
    const h = renderHook(() => useScrollDirection());
    const first = h.result.current;
    h.rerender();
    expect(h.result.current).toBe(first);
  });
});
