import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { ThemeColors, Spacing } from '../config/theme';
import { PullToHistoryIndicator, PULL_FOOTER_HEIGHT } from './PullToHistoryIndicator';
import { useRefreshLock } from './RefreshScrollShell';
import {
  PullGeometry,
  RELEASE_SPRING,
  MOMENTUM_DECELERATION,
  EDGE_EPSILON,
  LIST_BOTTOM_GAP,
  LIST_TOP_PAD,
  FOOTER_PEEK,
  getMaxTravel,
  getPullProgress,
  nextArmedState,
  resolveVisualState,
  rawYFromVisualState,
  clampRawY,
  decideRelease,
} from '../lib/pullToHistoryPhysics';

/**
 * Recent-transactions list with an Instagram "Vanish Mode"-style pull-up that opens History.
 *
 * WHY NOT A ScrollView?
 * On Android the native ScrollView steals the touch from any JS PanResponder as soon as the finger
 * moves ~8dp, so a pull layered on top of it cannot be made reliable. This component owns the
 * whole vertical gesture instead (drag, momentum, pull-up) in one place.
 *
 * Pull-DOWN is deliberately NOT handled here: the list never moves down. A downward drag that starts
 * with the list at the top is left alone so the app-wide native refresh circle (AppRefreshControl,
 * hosted by RefreshScrollShell) takes it, exactly like History / Savings / Insights.
 *
 * Behaviour (measured from Instagram, see lib/pullToHistoryPhysics.ts):
 *  - The rows and the footer (ring + label) are ONE block. The footer is hidden behind the nav bar
 *    at rest and rises out of it as the block is dragged up.
 *  - The block follows the thumb 1:1 at first, then gets progressively stiffer (rubber band).
 *  - History opens ONLY when the finger is lifted while the ring is full. Lifting earlier springs back.
 */

export interface PullToHistoryListHandle {
  /** Snap everything back to the resting state (call when the screen regains focus). */
  reset: () => void;
}

export interface PullToHistoryListProps {
  /** The rows. Must render at its natural height (no flex: 1). */
  children: React.ReactNode;
  colors: ThemeColors;
  isDark: boolean;
  /** false when there is nothing to open (no transactions) — hides the footer and disables the pull. */
  pullEnabled: boolean;
  /** Called once, when the finger is lifted while the ring is full. */
  onCommit: () => void;
}

interface GestureState {
  active: boolean;
  /** Virtual scroll position at the moment the gesture was claimed. */
  y0: number;
  /** gestureState.dy at the moment the gesture was claimed (so the touch-slop does not make it jump). */
  dyAtGrant: number;
  armed: boolean;
  lastMoveAt: number;
}

/** Vertical movement (dp) before the list claims the touch. Below this a tap still reaches the row. */
const TOUCH_SLOP = 6;
/** After a commit, wait this long (History is on screen by then) before snapping Home back to rest. */
const COMMIT_RESET_DELAY_MS = 500;
/** A release this long after the last move is a "hold", not a fling. */
const FLING_MAX_IDLE_MS = 100;
/** Height of the dissolve under the section header (unchanged look). */
const TOP_FADE_HEIGHT = 24;

const vibrate = (ms: number) => {
  try {
    Vibration.vibrate(ms);
  } catch {
    // Vibration is best-effort
  }
};

export const PullToHistoryList = forwardRef<PullToHistoryListHandle, PullToHistoryListProps>(
  function PullToHistoryList(
    { children, colors, isDark, pullEnabled, onCommit },
    ref
  ) {
    // ── Animated values (all JS-driven; the physics lives on the JS thread) ──────────────────────
    const scrollY = useRef(new Animated.Value(0)).current; // in-bounds scroll offset (decay can overshoot; clamped for drawing)
    const pullDepth = useRef(new Animated.Value(0)).current; // pull-up past the end (dp)

    // Plain-number mirrors of the values above (Animated.Value has no public getter).
    const scrollVal = useRef(0);
    const pullVal = useRef(0);

    const [viewportH, setViewportH] = useState(0);
    const [rowsH, setRowsH] = useState(0);

    // ── Geometry ────────────────────────────────────────────────────────────────────────────────
    const maxScroll = Math.max(0, LIST_TOP_PAD + rowsH + LIST_BOTTOM_GAP - viewportH);
    const maxTravel = getMaxTravel(viewportH);

    const geoRef = useRef<PullGeometry>({ maxScroll, maxTravel, pullEnabled });
    geoRef.current = { maxScroll, maxTravel, pullEnabled };

    // Always read the freshest props from the (created-once) PanResponder.
    const latest = useRef({ onCommit });
    latest.current = { onCommit };

    const gestureRef = useRef<GestureState>({ active: false, y0: 0, dyAtGrant: 0, armed: false, lastMoveAt: 0 });
    const gesture = gestureRef;

    // The app-wide refresh circle must be OFF whenever this list owns the touch or is scrolled away from
    // the top (otherwise a downward scroll mid-list would be mistaken for a pull-to-refresh).
    const setRefreshLocked = useRefreshLock();
    const refreshLockedRef = useRef(false);
    const syncRefreshLock = useCallback(() => {
      const locked = gestureRef.current.active || scrollVal.current > EDGE_EPSILON || pullVal.current > EDGE_EPSILON;
      if (locked !== refreshLockedRef.current) {
        refreshLockedRef.current = locked;
        setRefreshLocked(locked);
      }
    }, [setRefreshLocked]);

    const momentumRef = useRef(false);
    const committedRef = useRef(false);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      const a = scrollY.addListener(({ value }) => {
        scrollVal.current = value;
        syncRefreshLock();
      });
      const b = pullDepth.addListener(({ value }) => {
        pullVal.current = value;
        syncRefreshLock();
      });
      return () => {
        scrollY.removeListener(a);
        pullDepth.removeListener(b);
      };
    }, [scrollY, pullDepth, syncRefreshLock]);

    // The scroll offset can never be drawn outside [0, maxScroll], even if a fling overshoots for a frame.
    const clampedScroll = useMemo(
      () =>
        scrollY.interpolate({
          inputRange: [0, Math.max(maxScroll, 1)],
          outputRange: [0, maxScroll],
          extrapolate: 'clamp',
        }),
      [scrollY, maxScroll]
    );

    // translateY = -(scroll + pull). Rows AND footer share this one transform; nothing ever moves down.
    const translateY = useMemo(
      () => Animated.multiply(Animated.add(clampedScroll, pullDepth), -1),
      [clampedScroll, pullDepth]
    );

    // If rows/viewport change while resting (new transaction, rotation), keep the offset legal.
    useEffect(() => {
      if (!gesture.current.active && scrollVal.current > maxScroll) {
        scrollY.setValue(maxScroll);
      }
    }, [maxScroll, scrollY]);

    // ── Small animation helpers ─────────────────────────────────────────────────────────────────
    const stopAll = useCallback(() => {
      scrollY.stopAnimation();
      pullDepth.stopAnimation();
      momentumRef.current = false;
    }, [scrollY, pullDepth]);

    const springTo = useCallback((value: Animated.Value, toValue: number) => {
      Animated.spring(value, {
        toValue,
        stiffness: RELEASE_SPRING.stiffness,
        damping: RELEASE_SPRING.damping,
        mass: RELEASE_SPRING.mass,
        restDisplacementThreshold: 0.05,
        restSpeedThreshold: 0.05,
        useNativeDriver: false,
      }).start();
    }, []);

    const startMomentum = useCallback(
      (velocity: number) => {
        const max = geoRef.current.maxScroll;
        if (max <= 0) return;
        momentumRef.current = true;
        const id = scrollY.addListener(({ value }) => {
          if (value >= max || value <= 0) {
            scrollY.removeListener(id);
            scrollY.stopAnimation();
            scrollY.setValue(value >= max ? max : 0);
          }
        });
        Animated.decay(scrollY, {
          velocity,
          deceleration: MOMENTUM_DECELERATION,
          useNativeDriver: false,
        }).start(() => {
          scrollY.removeListener(id);
          momentumRef.current = false;
        });
      },
      [scrollY]
    );

    const reset = useCallback(() => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      stopAll();
      scrollY.setValue(0);
      pullDepth.setValue(0);
      gesture.current = { active: false, y0: 0, dyAtGrant: 0, armed: false, lastMoveAt: 0 };
      committedRef.current = false;
      syncRefreshLock();
    }, [stopAll, scrollY, pullDepth, syncRefreshLock]);

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    useEffect(
      () => () => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        scrollY.stopAnimation();
        pullDepth.stopAnimation();
      },
      [scrollY, pullDepth]
    );

    // ── Gesture ─────────────────────────────────────────────────────────────────────────────────
    const finishGesture = useCallback(
      (g: PanResponderGestureState | null, cancelled: boolean) => {
        const state = gesture.current;
        state.active = false;
        syncRefreshLock(); // finger is up: the refresh circle may be re-enabled if the list is at the top
        if (committedRef.current) return;

        const geo = geoRef.current;
        const props = latest.current;
        const isFresh = g !== null && Date.now() - state.lastMoveAt <= FLING_MAX_IDLE_MS;

        const decision = decideRelease({
          pull: pullVal.current,
          armed: state.armed,
          cancelled,
          scrollVelocity: isFresh && g ? -g.vy : 0,
          maxScroll: geo.maxScroll,
        });

        switch (decision.kind) {
          case 'commit':
            // The finger is up and the ring was full: NOW open History.
            committedRef.current = true;
            props.onCommit();
            resetTimerRef.current = setTimeout(reset, COMMIT_RESET_DELAY_MS);
            break;
          case 'pull-back':
            springTo(pullDepth, 0);
            break;
          case 'momentum':
            startMomentum(decision.velocity);
            break;
          default:
            break;
        }
      },
      [pullDepth, springTo, startMomentum, reset, syncRefreshLock]
    );

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          // Touching a moving / bouncing list catches it (like a native scroll view); a normal touch goes to the row.
          onStartShouldSetPanResponderCapture: () =>
            !committedRef.current && (momentumRef.current || pullVal.current > EDGE_EPSILON),
          onMoveShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponderCapture: (_e, g) => {
            if (committedRef.current) return false;
            if (!(Math.abs(g.dy) > TOUCH_SLOP && Math.abs(g.dy) > Math.abs(g.dx))) return false;
            // Finger moving DOWN while the list is already at the top: not ours. Leave it alone so the
            // app-wide native refresh circle takes the gesture (the list itself never moves down).
            const atTop = scrollVal.current <= EDGE_EPSILON && pullVal.current <= EDGE_EPSILON;
            if (g.dy > 0 && atTop) return false;
            return true;
          },
          onPanResponderTerminationRequest: () => false,
          onShouldBlockNativeResponder: () => true,

          onPanResponderGrant: (_e, g) => {
            stopAll();
            const geo = geoRef.current;
            const visual = {
              scroll: Math.min(geo.maxScroll, Math.max(0, scrollVal.current)),
              pull: pullVal.current,
            };
            gesture.current = {
              active: true,
              y0: rawYFromVisualState(visual, geo),
              dyAtGrant: g.dy,
              armed: nextArmedState(false, getPullProgress(visual.pull, geo.maxTravel)),
              lastMoveAt: Date.now(),
            };
            syncRefreshLock(); // we own this touch now: switch the refresh circle off until the finger lifts
          },

          onPanResponderMove: (_e, g) => {
            const state = gesture.current;
            if (!state.active || committedRef.current) return;
            const geo = geoRef.current;

            // Finger up (dy < 0) => the virtual scroll position increases.
            let rawY = state.y0 - (g.dy - state.dyAtGrant);
            const clamped = clampRawY(rawY, geo);
            if (clamped !== rawY) {
              state.y0 += clamped - rawY; // no dead zone when the thumb reverses
              rawY = clamped;
            }

            const v = resolveVisualState(rawY, geo);
            scrollY.setValue(v.scroll);
            pullDepth.setValue(v.pull);
            state.lastMoveAt = Date.now();

            const armedNow = nextArmedState(state.armed, getPullProgress(v.pull, geo.maxTravel));
            if (armedNow !== state.armed) {
              state.armed = armedNow;
              if (armedNow) vibrate(15);
            }
          },

          onPanResponderRelease: (_e, g) => finishGesture(g, false),
          onPanResponderTerminate: (_e, g) => finishGesture(g, true),
        }),
      // Created once: every dependency is a stable ref / Animated.Value / memoised callback.
      [finishGesture, stopAll, syncRefreshLock, scrollY, pullDepth]
    );

    // ── Layout ──────────────────────────────────────────────────────────────────────────────────
    const onRootLayout = useCallback((e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      setViewportH((prev) => (prev === h ? prev : h));
    }, []);

    const onRowsLayout = useCallback((e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      setRowsH((prev) => (prev === h ? prev : h));
    }, []);

    return (
      <View style={styles.root} onLayout={onRootLayout} {...panResponder.panHandlers}>
        {/* Rows + footer: one rigid block that moves together */}
        <Animated.View
          style={[
            styles.content,
            {
              // Short lists: still push the footer just below the visible area so it is hidden at rest.
              minHeight: viewportH + FOOTER_PEEK + PULL_FOOTER_HEIGHT,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.rows} onLayout={onRowsLayout}>
            {children}
          </View>

          {pullEnabled && (
            <>
              <View style={styles.footerSpacer} />
              <PullToHistoryIndicator
                pullDepthAnim={pullDepth}
                maxTravel={maxTravel}
                colors={colors}
                isDark={isDark}
              />
            </>
          )}
        </Animated.View>

        {/* Dissolve under the "Recent Transactions" header — rows fade out as they scroll up (unchanged look) */}
        <View style={styles.topFade} pointerEvents="none">
          <Svg height={TOP_FADE_HEIGHT} width="100%">
            <Defs>
              <SvgLinearGradient id="portalFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.background} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height={TOP_FADE_HEIGHT} fill="url(#portalFade)" />
          </Svg>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.gutter,
  },
  rows: {
    marginTop: LIST_TOP_PAD,
  },
  // Always keeps the footer's ring FOOTER_PEEK below the bottom edge when the list rests at its end.
  footerSpacer: {
    flexGrow: 1,
    minHeight: LIST_BOTTOM_GAP + FOOTER_PEEK,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_FADE_HEIGHT,
    zIndex: 5,
  },
});

export default PullToHistoryList;
