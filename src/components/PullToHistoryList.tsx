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
  LayoutChangeEvent,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withDecay,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
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
 * On Android the native ScrollView steals the touch from any JS gesture responder as soon as the finger
 * moves ~8dp, so a pull layered on top of it cannot be made reliable. This component owns the
 * whole vertical gesture instead (drag, momentum, pull-up) in one place on the UI thread via RNGH + Reanimated.
 *
 * Pull-DOWN is deliberately NOT handled here: the list never moves down. A downward drag that starts
 * with the list at the top is left alone (via gesture fail) so the app-wide native refresh circle (AppRefreshControl,
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

/** Vertical movement (dp) before the list claims the touch. Below this a tap still reaches the row. */
const TOUCH_SLOP = 6;
/** After a commit, wait this long (History is on screen by then) before snapping Home back to rest. */
const COMMIT_RESET_DELAY_MS = 500;
/** A release this long after the last move is a "hold", not a fling. */
const FLING_MAX_IDLE_MS = 100;
/** Height of the dissolve under the section header (unchanged look). */
const TOP_FADE_HEIGHT = 24;
/** Height of the soft dissolve at the bottom edge above the floating nav bar. */
const BOTTOM_FADE_HEIGHT = 44;

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
    // ── Reanimated Shared Values (all UI-thread driven) ─────────────────────────────────────────
    const scrollY = useSharedValue(0); // in-bounds scroll offset (0..maxScroll)
    const pullDepth = useSharedValue(0); // pull-up past the end (dp, 0..maxTravel)

    const [viewportH, setViewportH] = useState(0);
    const [rowsH, setRowsH] = useState(0);

    // ── Geometry ────────────────────────────────────────────────────────────────────────────────
    const maxScroll = Math.max(0, LIST_TOP_PAD + rowsH + LIST_BOTTOM_GAP - viewportH);
    const maxTravel = getMaxTravel(viewportH);

    const maxScrollVal = useSharedValue(maxScroll);
    const maxTravelVal = useSharedValue(maxTravel);
    const pullEnabledVal = useSharedValue(pullEnabled);

    const isGestureActive = useSharedValue(false);
    const isArmed = useSharedValue(false);
    const isCommitted = useSharedValue(false);
    const isMomentumRunning = useSharedValue(false);

    const startTouchX = useSharedValue(0);
    const startTouchY = useSharedValue(0);
    const gestureY0 = useSharedValue(0);
    const startTranslationY = useSharedValue(0);
    const lastMoveAt = useSharedValue(0);

    // Always keep latest onCommit callback in a ref so worklet schedules fresh handler
    const latestOnCommit = useRef(onCommit);
    latestOnCommit.current = onCommit;

    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync layout geometry to UI-thread shared values
    useEffect(() => {
      maxScrollVal.value = maxScroll;
      maxTravelVal.value = maxTravel;
      pullEnabledVal.value = pullEnabled;
      if (!isGestureActive.value && scrollY.value > maxScroll) {
        scrollY.value = maxScroll;
      }
    }, [maxScroll, maxTravel, pullEnabled, maxScrollVal, maxTravelVal, pullEnabledVal, isGestureActive, scrollY]);

    // The app-wide refresh circle must be OFF whenever this list owns the touch or is scrolled away from
    // the top (otherwise a downward scroll mid-list would be mistaken for a pull-to-refresh).
    const setRefreshLocked = useRefreshLock();

    useAnimatedReaction(
      () => isGestureActive.value || scrollY.value > EDGE_EPSILON || pullDepth.value > EDGE_EPSILON,
      (locked, prevLocked) => {
        'worklet';
        if (locked !== prevLocked) {
          scheduleOnRN(setRefreshLocked, locked);
        }
      }
    );

    const reset = useCallback(() => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      cancelAnimation(scrollY);
      cancelAnimation(pullDepth);
      scrollY.value = 0;
      pullDepth.value = 0;
      isGestureActive.value = false;
      isArmed.value = false;
      isCommitted.value = false;
      isMomentumRunning.value = false;
      setRefreshLocked(false);
    }, [scrollY, pullDepth, isGestureActive, isArmed, isCommitted, isMomentumRunning, setRefreshLocked]);

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    useEffect(() => {
      return () => {
        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
        }
        cancelAnimation(scrollY);
        cancelAnimation(pullDepth);
        setRefreshLocked(false);
      };
    }, [scrollY, pullDepth, setRefreshLocked]);

    const handleCommit = useCallback(() => {
      latestOnCommit.current();
      resetTimerRef.current = setTimeout(reset, COMMIT_RESET_DELAY_MS);
    }, [reset]);

    // ── Gesture definition (RNGH Pan with manual activation) ────────────────────────────────────
    const panGesture = useMemo(
      () =>
        Gesture.Pan()
          .manualActivation(true)
          .onTouchesDown((e, stateManager) => {
            'worklet';
            if (isCommitted.value) return;
            if (e.allTouches.length === 0) return;

            startTouchX.value = e.allTouches[0].x;
            startTouchY.value = e.allTouches[0].y;

            // Touching a moving / bouncing list catches it (like a native scroll view); normal touch goes to row
            if (isMomentumRunning.value || pullDepth.value > EDGE_EPSILON) {
              cancelAnimation(scrollY);
              cancelAnimation(pullDepth);
              isMomentumRunning.value = false;

              const geo: PullGeometry = {
                maxScroll: maxScrollVal.value,
                maxTravel: maxTravelVal.value,
                pullEnabled: pullEnabledVal.value,
              };
              const visual = {
                scroll: Math.min(geo.maxScroll, Math.max(0, scrollY.value)),
                pull: pullDepth.value,
              };
              gestureY0.value = rawYFromVisualState(visual, geo);
              startTranslationY.value = 0;
              isArmed.value = nextArmedState(false, getPullProgress(visual.pull, geo.maxTravel));
              lastMoveAt.value = Date.now();
              isGestureActive.value = true;
              stateManager.activate();
            }
          })
          .onTouchesMove((e, stateManager) => {
            'worklet';
            if (isCommitted.value || isGestureActive.value) return;
            if (e.allTouches.length === 0) return;

            const dx = e.allTouches[0].x - startTouchX.value;
            const dy = e.allTouches[0].y - startTouchY.value;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDy > TOUCH_SLOP && absDy > absDx) {
              // Finger moving DOWN while the list is already at the top: not ours. Leave it alone so the
              // app-wide native refresh circle takes the gesture (the list itself never moves down).
              const atTop = scrollY.value <= EDGE_EPSILON && pullDepth.value <= EDGE_EPSILON;
              if (dy > 0 && atTop) {
                stateManager.fail();
              } else {
                stateManager.activate();
              }
            } else if (absDx > TOUCH_SLOP && absDx > absDy) {
              stateManager.fail();
            }
          })
          .onStart((e) => {
            'worklet';
            cancelAnimation(scrollY);
            cancelAnimation(pullDepth);
            isMomentumRunning.value = false;
            isGestureActive.value = true;

            const geo: PullGeometry = {
              maxScroll: maxScrollVal.value,
              maxTravel: maxTravelVal.value,
              pullEnabled: pullEnabledVal.value,
            };
            const visual = {
              scroll: Math.min(geo.maxScroll, Math.max(0, scrollY.value)),
              pull: pullDepth.value,
            };
            gestureY0.value = rawYFromVisualState(visual, geo);
            startTranslationY.value = e.translationY;
            isArmed.value = nextArmedState(false, getPullProgress(visual.pull, geo.maxTravel));
            lastMoveAt.value = Date.now();
          })
          .onUpdate((e) => {
            'worklet';
            if (!isGestureActive.value || isCommitted.value) return;

            const geo: PullGeometry = {
              maxScroll: maxScrollVal.value,
              maxTravel: maxTravelVal.value,
              pullEnabled: pullEnabledVal.value,
            };

            const deltaY = e.translationY - startTranslationY.value;
            // Finger up (deltaY < 0) => the virtual scroll position increases.
            let rawY = gestureY0.value - deltaY;
            const clamped = clampRawY(rawY, geo);
            if (clamped !== rawY) {
              gestureY0.value += clamped - rawY; // no dead zone when the thumb reverses
              rawY = clamped;
            }

            const v = resolveVisualState(rawY, geo);
            scrollY.value = v.scroll;
            pullDepth.value = v.pull;
            lastMoveAt.value = Date.now();

            const armedNow = nextArmedState(isArmed.value, getPullProgress(v.pull, geo.maxTravel));
            if (armedNow !== isArmed.value) {
              isArmed.value = armedNow;
              if (armedNow) {
                scheduleOnRN(vibrate, 15);
              }
            }
          })
          .onEnd((e) => {
            'worklet';
            isGestureActive.value = false;
            if (isCommitted.value) return;

            const geo: PullGeometry = {
              maxScroll: maxScrollVal.value,
              maxTravel: maxTravelVal.value,
              pullEnabled: pullEnabledVal.value,
            };

            const isFresh = Date.now() - lastMoveAt.value <= FLING_MAX_IDLE_MS;
            // e.velocityY is in px/s; physics uses dp/ms.
            // e.velocityY < 0 when finger flings up (scrolling towards end), so scrollVelocity = -e.velocityY / 1000.
            const scrollVelocity = isFresh ? -e.velocityY / 1000 : 0;

            const decision = decideRelease({
              pull: pullDepth.value,
              armed: isArmed.value,
              cancelled: false,
              scrollVelocity,
              maxScroll: geo.maxScroll,
            });

            switch (decision.kind) {
              case 'commit':
                isCommitted.value = true;
                scheduleOnRN(handleCommit);
                break;
              case 'pull-back':
                pullDepth.value = withSpring(0, {
                  stiffness: RELEASE_SPRING.stiffness,
                  damping: RELEASE_SPRING.damping,
                  mass: RELEASE_SPRING.mass,
                });
                break;
              case 'momentum': {
                const vel = -e.velocityY; // points/second for withDecay
                isMomentumRunning.value = true;
                scrollY.value = withDecay(
                  {
                    velocity: vel,
                    deceleration: MOMENTUM_DECELERATION,
                    clamp: [0, geo.maxScroll],
                  },
                  (finished) => {
                    'worklet';
                    if (finished) {
                      isMomentumRunning.value = false;
                    }
                  }
                );
                break;
              }
              default:
                break;
            }
          })
          .onFinalize((_e, success) => {
            'worklet';
            isGestureActive.value = false;
            if (!success && !isCommitted.value && pullDepth.value > 0) {
              pullDepth.value = withSpring(0, {
                stiffness: RELEASE_SPRING.stiffness,
                damping: RELEASE_SPRING.damping,
                mass: RELEASE_SPRING.mass,
              });
            }
          }),
      [
        handleCommit,
        isArmed,
        isCommitted,
        isGestureActive,
        isMomentumRunning,
        gestureY0,
        lastMoveAt,
        maxScrollVal,
        maxTravelVal,
        pullDepth,
        pullEnabledVal,
        scrollY,
        startTouchX,
        startTouchY,
        startTranslationY,
      ]
    );

    // ── Animated styles ─────────────────────────────────────────────────────────────────────────
    const contentAnimatedStyle = useAnimatedStyle(() => {
      const clampedScroll = Math.max(0, Math.min(maxScrollVal.value, scrollY.value));
      return {
        transform: [{ translateY: -clampedScroll - pullDepth.value }],
      };
    });

    const bottomFadeAnimatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(pullDepth.value, [0, 16], [1, 0], Extrapolation.CLAMP),
    }));

    // ── Layout measurement ──────────────────────────────────────────────────────────────────────
    const onRootLayout = useCallback((e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      setViewportH((prev) => (prev === h ? prev : h));
    }, []);

    const onRowsLayout = useCallback((e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      setRowsH((prev) => (prev === h ? prev : h));
    }, []);

    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.root} onLayout={onRootLayout}>
          {/* Rows + footer: one rigid block that moves together */}
          <Animated.View
            style={[
              styles.content,
              {
                // Short lists: still push the footer just below the visible area so it is hidden at rest.
                minHeight: viewportH + FOOTER_PEEK + PULL_FOOTER_HEIGHT,
              },
              contentAnimatedStyle,
            ]}
          >
            <View style={styles.rows} onLayout={onRowsLayout}>
              {children}
            </View>

            {pullEnabled && (
              <>
                <View style={styles.footerSpacer} />
                <PullToHistoryIndicator
                  pullDepth={pullDepth}
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

          {/* Dissolve at the bottom edge above the nav bar — rows fade out smoothly as they approach the bottom boundary */}
          <Animated.View
            style={[styles.bottomFade, bottomFadeAnimatedStyle]}
            pointerEvents="none"
          >
            <Svg height={BOTTOM_FADE_HEIGHT} width="100%">
              <Defs>
                <SvgLinearGradient id="portalBottomFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
                  <Stop offset="0.4" stopColor={colors.background} stopOpacity="0.35" />
                  <Stop offset="0.8" stopColor={colors.background} stopOpacity="0.85" />
                  <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height={BOTTOM_FADE_HEIGHT} fill="url(#portalBottomFade)" />
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>
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
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_FADE_HEIGHT,
    zIndex: 5,
  },
});

export default PullToHistoryList;
