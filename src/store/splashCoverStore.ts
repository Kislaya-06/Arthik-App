import { create } from 'zustand';

/**
 * Splash → app handoff cover.
 *
 * The Splash screen ends on a solid mint screen (its bloom). At that exact moment `show()` turns on a full-screen
 * mint cover that lives in App.tsx (above the navigator). The route is swapped UNDER the cover, the new screen
 * mounts and lays out unseen, and only then `revealSoon()` dissolves the cover. The user never sees a
 * half-mounted Home screen, a card at the wrong size, or a ring that restarts.
 *
 *   'off'     cover invisible, touches pass through
 *   'on'      cover fully opaque (set in one UI-thread write, no fade-in)
 *   'fading'  cover dissolving to transparent; ends itself with `end()`
 */
export type SplashCoverPhase = 'off' | 'on' | 'fading';

/** Quiet time after the route swap so the destination can mount, lay out and paint its first frames. */
const SETTLE_MS = 120;
/** Hard safety net: the cover can never stay up longer than this, whatever happens to the destination. */
const MAX_WAIT_MS = 1400;

interface SplashCoverState {
  phase: SplashCoverPhase;
  show: () => void;
  revealSoon: () => void;
  end: () => void;
}

let settleTimer: ReturnType<typeof setTimeout> | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

const clearTimers = () => {
  if (settleTimer) clearTimeout(settleTimer);
  if (safetyTimer) clearTimeout(safetyTimer);
  settleTimer = null;
  safetyTimer = null;
};

export const useSplashCoverStore = create<SplashCoverState>((set, get) => ({
  phase: 'off',

  show: () => {
    clearTimers();
    set({ phase: 'on' });
    // Never let the cover trap the user, even if nobody calls revealSoon().
    safetyTimer = setTimeout(() => {
      if (get().phase === 'on') set({ phase: 'fading' });
    }, MAX_WAIT_MS);
  },

  revealSoon: () => {
    if (get().phase !== 'on') return;
    if (settleTimer) clearTimeout(settleTimer);
    // Two frames: the swap is committed and the destination has had its first layout pass.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        settleTimer = setTimeout(() => {
          settleTimer = null;
          if (get().phase === 'on') set({ phase: 'fading' });
        }, SETTLE_MS);
      });
    });
  },

  end: () => {
    clearTimers();
    set({ phase: 'off' });
  },
}));

/** True while the cover fully hides the app (entrance animations should wait for the reveal). */
export const useIsSplashCoverOpaque = (): boolean => useSplashCoverStore((s) => s.phase === 'on');
