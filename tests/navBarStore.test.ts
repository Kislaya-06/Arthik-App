import { describe, it, expect, beforeEach } from 'vitest';
import { useNavBarStore } from '../src/store/navBarStore';

describe('navBarStore (bottom navigation bar visibility)', () => {
  beforeEach(() => {
    useNavBarStore.setState({ isVisible: true });
  });

  it('starts visible', () => {
    expect(useNavBarStore.getState().isVisible).toBe(true);
  });

  it('hideNavBar hides it and showNavBar brings it back', () => {
    useNavBarStore.getState().hideNavBar();
    expect(useNavBarStore.getState().isVisible).toBe(false);
    useNavBarStore.getState().showNavBar();
    expect(useNavBarStore.getState().isVisible).toBe(true);
  });

  it('is idempotent: hiding twice or showing twice changes nothing', () => {
    useNavBarStore.getState().hideNavBar();
    useNavBarStore.getState().hideNavBar();
    expect(useNavBarStore.getState().isVisible).toBe(false);
    useNavBarStore.getState().showNavBar();
    useNavBarStore.getState().showNavBar();
    expect(useNavBarStore.getState().isVisible).toBe(true);
  });

  it('notifies subscribers only when the value really changes', () => {
    const seen: boolean[] = [];
    const unsub = useNavBarStore.subscribe((s, prev) => {
      if (s.isVisible !== prev.isVisible) seen.push(s.isVisible);
    });
    useNavBarStore.getState().hideNavBar();
    useNavBarStore.getState().hideNavBar();
    useNavBarStore.getState().showNavBar();
    unsub();
    expect(seen).toEqual([false, true]);
  });

  it('exposes the same action functions on every read (stable references for useCallback deps)', () => {
    const a = useNavBarStore.getState();
    useNavBarStore.getState().hideNavBar();
    const b = useNavBarStore.getState();
    expect(a.showNavBar).toBe(b.showNavBar);
    expect(a.hideNavBar).toBe(b.hideNavBar);
  });
});
