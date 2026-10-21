import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSplashCoverStore } from '../src/store/splashCoverStore';

describe('splashCoverStore (splash → app handoff cover)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => setTimeout(() => cb(0), 16));
    useSplashCoverStore.getState().end();
  });
  afterEach(() => {
    useSplashCoverStore.getState().end();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts off', () => {
    expect(useSplashCoverStore.getState().phase).toBe('off');
  });

  it('show() turns the cover fully on at once', () => {
    useSplashCoverStore.getState().show();
    expect(useSplashCoverStore.getState().phase).toBe('on');
  });

  it('revealSoon() starts fading after two frames plus the settle time', () => {
    const s = useSplashCoverStore.getState();
    s.show();
    s.revealSoon();
    vi.advanceTimersByTime(100);
    expect(useSplashCoverStore.getState().phase).toBe('on');
    vi.advanceTimersByTime(200);
    expect(useSplashCoverStore.getState().phase).toBe('fading');
  });

  it('never stays on: the safety net fades it even without revealSoon()', () => {
    useSplashCoverStore.getState().show();
    vi.advanceTimersByTime(1500);
    expect(useSplashCoverStore.getState().phase).toBe('fading');
  });

  it('revealSoon() does nothing when the cover is not on', () => {
    useSplashCoverStore.getState().revealSoon();
    vi.advanceTimersByTime(2000);
    expect(useSplashCoverStore.getState().phase).toBe('off');
  });

  it('end() turns it off and cancels pending timers', () => {
    const s = useSplashCoverStore.getState();
    s.show();
    s.revealSoon();
    s.end();
    vi.advanceTimersByTime(2000);
    expect(useSplashCoverStore.getState().phase).toBe('off');
  });
});
