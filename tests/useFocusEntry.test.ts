import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});

const nav = vi.hoisted(() => ({ focused: true, throws: false }));
vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => {
    if (nav.throws) throw new Error("Couldn't find a navigation object");
    return nav.focused;
  },
}));

import { renderHook } from './helpers/hookRuntime';
import { useFocusEntryCount, useSafeIsFocused } from '../src/hooks/useFocusEntry';

describe('useSafeIsFocused', () => {
  beforeEach(() => {
    nav.focused = true;
    nav.throws = false;
  });

  it('returns the real focus state inside a navigator', () => {
    nav.focused = false;
    expect(renderHook(() => useSafeIsFocused()).result.current).toBe(false);
    nav.focused = true;
    expect(renderHook(() => useSafeIsFocused()).result.current).toBe(true);
  });

  it('returns true (never crashes) when there is no navigator, e.g. in a unit test or storybook', () => {
    nav.throws = true;
    expect(renderHook(() => useSafeIsFocused()).result.current).toBe(true);
  });
});

describe('useFocusEntryCount (how many times has this screen been ENTERED?)', () => {
  beforeEach(() => {
    nav.focused = true;
    nav.throws = false;
  });

  it('counts the first visit', () => {
    const h = renderHook(() => useFocusEntryCount());
    expect(h.result.current).toBe(1);
  });

  it('a screen that is mounted but not focused has not been entered yet', () => {
    nav.focused = false;
    const h = renderHook(() => useFocusEntryCount());
    expect(h.result.current).toBe(0);
    nav.focused = true;
    h.rerender();
    expect(h.result.current).toBe(1);
  });

  it('counts every return: focused -> blurred -> focused', () => {
    const h = renderHook(() => useFocusEntryCount());
    expect(h.result.current).toBe(1);

    nav.focused = false;
    h.rerender();
    expect(h.result.current).toBe(1); // leaving is not an entry

    nav.focused = true;
    h.rerender();
    expect(h.result.current).toBe(2);

    nav.focused = false;
    h.rerender();
    nav.focused = true;
    h.rerender();
    expect(h.result.current).toBe(3);
  });

  it('an ordinary re-render while staying focused is NOT an entry', () => {
    const h = renderHook(() => useFocusEntryCount());
    h.rerender();
    h.rerender();
    h.rerender();
    expect(h.result.current).toBe(1);
  });

  it('REGRESSION: a frozen tab revealed again counts as a new entry, even if the "blurred" render never happened', () => {
    // freezeOnBlur can hide the tab before React ever commits a render with isFocused = false.
    // React then re-runs LAYOUT effects (not passive ones) when the tab is revealed.
    const h = renderHook(() => useFocusEntryCount());
    expect(h.result.current).toBe(1);

    h.freeze();
    h.reveal();
    expect(h.result.current).toBe(2);

    h.freeze();
    h.reveal();
    expect(h.result.current).toBe(3);
  });

  it('a frozen tab whose blur render DID happen also counts exactly once on return', () => {
    const h = renderHook(() => useFocusEntryCount());
    nav.focused = false;
    h.rerender();
    h.freeze();
    nav.focused = true;
    h.reveal();
    expect(h.result.current).toBe(2);
  });

  it('works outside a navigator too (counts the first entry, never crashes)', () => {
    nav.throws = true;
    const h = renderHook(() => useFocusEntryCount());
    expect(h.result.current).toBe(1);
  });
});
