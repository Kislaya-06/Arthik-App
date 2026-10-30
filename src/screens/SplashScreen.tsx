import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, ImageSourcePropType, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { User, AuthError } from '@supabase/supabase-js';
import { RootStackParamList } from '../types';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useExpenseStore, isNetworkFailure } from '../store/expenseStore';
import { canShowHomeFromCache, startHomeFromCache } from '../lib/warmStart';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useNetworkStore } from '../store/networkStore';
import { useTheme } from '../store/themeStore';
import { useAppLockStore } from '../store/appLockStore';
import { useSplashCoverStore } from '../store/splashCoverStore';
import { Spacing, FontFamily, FontSize } from '../config/theme';
import { supabase } from '../config/supabase';
import { perfMark } from '../lib/perfMarks';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;
type Target = keyof RootStackParamList;

/*
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *  How this splash works (and why it can not glitch any more)
 *
 *  The old splash chained ~20 JS-driven animations (sequence/parallel/stagger) for the entrance and another chain
 *  for the exit. The exit could start while the entrance was still running, so both fought over the same values:
 *  the icon slid left in the middle of the green bloom, the tagline faded back in on top of the green, and the
 *  timing depended on how busy the JS thread was with startup hydration.
 *
 *  Now there are just two CLOCKS (shared values, in ms) that run on the UI thread:
 *    t   entrance clock  0 → ENTRANCE_MS
 *    ex  exit clock      0 → EXIT_MS
 *  Every visual is a pure function of those clocks (see the timelines below). Nothing is chained, so nothing can
 *  fight, and a busy JS thread can not stretch or skip a step.
 *
 *  The exit starts only when BOTH are true: the entrance has finished AND the next screen is known.
 *  The bloom lives in its own full-screen layer centred on the screen, painted above everything, so it always
 *  grows from the centred icon and always covers the wordmark, tagline and dots.
 *  The splash ends on solid mint, a mint cover (App.tsx) takes over, the route is swapped underneath it, and the
 *  cover dissolves once the next screen has laid out (see splashCoverStore).
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

const ENTRANCE_MS = 540;
const EXIT_MS = 360;
const ICON_SIZE = 80;
/** Lockup geometry: icon (80) + wordmark box (160) = 240 wide, so the icon sits 80 left of centre when open. */
const ROW_CENTER_SHIFT = 80;
const WORDMARK_WIDTH = 160;

// Entrance timeline (ms on clock `t`)
const ICON_POP: [number, number] = [0, 160];
const LINE_STARTS = [75, 115, 155];
const LINE_MS = 120;
const PUNCH: [number, number] = [270, 350];
const LOCKUP: [number, number] = [300, 490];
const WORDMARK_FADE: [number, number] = [300, 460];
const TAGLINE: [number, number] = [370, 540];
const DOTS_IN: [number, number] = [430, 540];

// Exit timeline (ms on clock `ex`)
const EX_TEXT_FADE: [number, number] = [0, 80];
const EX_WORDMARK_FADE: [number, number] = [0, 90];
const EX_LOCKUP_BACK: [number, number] = [0, 160];
const EX_LINES_FADE: [number, number] = [110, 160];
/** Bloom appears (fully hidden inside the mint icon card, so the switch is invisible) and grows. */
const EX_BLOOM: [number, number] = [160, 360];

// Loading dots: 3 pulses of 400ms, staggered by 130ms, then a 180ms rest (same rhythm as before).
const DOT_CYCLE_MS = 840;
const DOT_STAGGER_MS = 130;
const DOT_PULSE_MS = 400;

// ── Tiny worklet easing helpers ──
const seg = (v: number, [a, b]: [number, number]) => {
  'worklet';
  if (v <= a) return 0;
  if (v >= b) return 1;
  return (v - a) / (b - a);
};
const outCubic = (x: number) => {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
};
const outQuart = (x: number) => {
  'worklet';
  return 1 - Math.pow(1 - x, 4);
};
const inOutCubic = (x: number) => {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const outBack = (x: number) => {
  'worklet';
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

interface LogoPieceConfig {
  source: ImageSourcePropType;
  containerOffset: { left: number; top: number };
  imageOffset: { left: number; top: number };
  rotate: string;
  unrotate: string;
  translateProp: 'translateX' | 'translateY';
  translateFrom: number;
  scalePrimaryProp: 'scaleX' | 'scaleY';
  scaleSecondaryProp: 'scaleX' | 'scaleY';
}

const LOGO_PIECES: LogoPieceConfig[] = [
  {
    // Line 1: Top-Left slant (-29.5°)
    source: require('../../assets/logo_piece_1.png'),
    containerOffset: { left: -5.94, top: -13.35 },
    imageOffset: { left: 5.94, top: 13.35 },
    rotate: '-29.5deg',
    unrotate: '29.5deg',
    translateProp: 'translateY',
    translateFrom: -18.1,
    scalePrimaryProp: 'scaleY',
    scaleSecondaryProp: 'scaleX',
  },
  {
    // Line 2: Right slant (+29.6°)
    source: require('../../assets/logo_piece_2.png'),
    containerOffset: { left: 18.87, top: 10.26 },
    imageOffset: { left: -18.87, top: -10.26 },
    rotate: '29.6deg',
    unrotate: '-29.6deg',
    translateProp: 'translateY',
    translateFrom: -21.1,
    scalePrimaryProp: 'scaleY',
    scaleSecondaryProp: 'scaleX',
  },
  {
    // Line 3: Bottom curved base (-12.6°)
    source: require('../../assets/logo_piece_3.png'),
    containerOffset: { left: -13.74, top: 18.76 },
    imageOffset: { left: 13.74, top: -18.76 },
    rotate: '-12.6deg',
    unrotate: '12.6deg',
    translateProp: 'translateX',
    translateFrom: -21.4,
    scalePrimaryProp: 'scaleX',
    scaleSecondaryProp: 'scaleY',
  },
];

/** One navy line of the logo: draws itself in along its own angle, fades out when the bloom starts. */
const LogoPiece: React.FC<{ piece: LogoPieceConfig; index: number; t: SharedValue<number>; ex: SharedValue<number> }> = ({
  piece,
  index,
  t,
  ex,
}) => {
  const style = useAnimatedStyle(() => {
    const start = LINE_STARTS[index];
    const p = outQuart(seg(t.value, [start, start + LINE_MS]));
    const appear = Math.min(1, p / 0.08);
    const secondary = p < 0.35 ? 0.35 + (p / 0.35) * 0.65 : 1;
    const transform = [
      { rotate: piece.rotate },
      { [piece.translateProp]: piece.translateFrom * (1 - p) },
      { [piece.scalePrimaryProp]: 0.01 + 0.99 * p },
      { [piece.scaleSecondaryProp]: secondary },
      { rotate: piece.unrotate },
    ];
    return {
      opacity: appear * (1 - seg(ex.value, EX_LINES_FADE)),
      transform: transform as any,
    };
  });

  return (
    <Animated.View style={[styles.pieceContainer, piece.containerOffset, style]}>
      <Image source={piece.source} style={[styles.pieceImage, piece.imageOffset]} resizeMode="contain" />
    </Animated.View>
  );
};

/** One loading dot: a soft pulse that travels 1 → 2 → 3 on a single repeating clock. */
const Dot: React.FC<{ index: number; dots: SharedValue<number>; color: string; baseColor: string }> = ({
  index,
  dots,
  color,
  baseColor,
}) => {
  const style = useAnimatedStyle(() => {
    const ms = dots.value * DOT_CYCLE_MS - index * DOT_STAGGER_MS;
    let v = 0;
    if (ms > 0 && ms < DOT_PULSE_MS) {
      // 0 → 1 → 0, eased (half a sine wave)
      v = Math.sin((ms / DOT_PULSE_MS) * Math.PI);
    }
    return { opacity: v, transform: [{ scale: 1 + 0.35 * v }] };
  });

  return (
    <View style={styles.dotWrapper}>
      <View style={[styles.dotBase, { backgroundColor: baseColor }]} />
      <Animated.View style={[styles.dotActive, { backgroundColor: color }, style]} />
    </View>
  );
};

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const setSession = useAuthStore((s) => s.setSession);
  const { colors, isDark } = useTheme();
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();

  // The two clocks + the dot loop clock
  const t = useSharedValue(0);
  const ex = useSharedValue(0);
  const dots = useSharedValue(0);

  // Scale that makes an 80pt circle cover the whole screen from its centre (with a little margin).
  const bloomTarget = (Math.hypot(width, height) / ICON_SIZE) * 1.08;
  const bloomScale = useSharedValue(bloomTarget);
  useEffect(() => {
    bloomScale.value = bloomTarget;
  }, [bloomTarget, bloomScale]);

  const entranceDone = useRef(false);
  const nextScreen = useRef<Target | null>(null);
  const exitStarted = useRef(false);
  const unmounted = useRef(false);

  // ── Navigation after the bloom: cover on → swap route under it → cover dissolves when the next screen is ready ──
  const finishExit = useCallback(
    (target: Target) => {
      if (unmounted.current) return;
      if (target === 'AppTabs' && useAppLockStore.getState().isAppLockEnabled) {
        useAppLockStore.getState().lock();
      }
      const cover = useSplashCoverStore.getState();
      cover.show();
      requestAnimationFrame(() => {
        if (unmounted.current) {
          useSplashCoverStore.getState().revealSoon();
          return;
        }
        perfMark('splash_exit');
        navigation.replace(target as any);
        useSplashCoverStore.getState().revealSoon();
      });
    },
    [navigation]
  );

  const tryExit = useCallback(() => {
    if (exitStarted.current || unmounted.current) return;
    if (!entranceDone.current || !nextScreen.current) return;
    exitStarted.current = true;
    const target = nextScreen.current;

    if (reduceMotion) {
      cancelAnimation(dots);
      ex.value = EXIT_MS;
      finishExit(target);
      return;
    }

    ex.value = withTiming(EXIT_MS, { duration: EXIT_MS, easing: Easing.linear }, (finished) => {
      if (finished) {
        cancelAnimation(dots);
        scheduleOnRN(finishExit, target);
      }
    });
  }, [reduceMotion, finishExit, ex, dots]);

  const onEntranceDone = useCallback(() => {
    entranceDone.current = true;
    tryExit();
  }, [tryExit]);

  // ── Entrance (one clock) + dot loop ──
  useEffect(() => {
    if (reduceMotion) {
      t.value = ENTRANCE_MS;
      onEntranceDone();
      return;
    }
    t.value = withTiming(ENTRANCE_MS, { duration: ENTRANCE_MS, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onEntranceDone);
    });
    dots.value = withRepeat(withTiming(1, { duration: DOT_CYCLE_MS, easing: Easing.linear }), -1, false);
    // Started once on mount by design: the clocks own the whole timeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Startup work: connectivity → session → offline restore → hydration (logic unchanged) ──
  useEffect(() => {
    const initAuthAndNavigate = async () => {
      let target: Target = 'Onboarding';
      try {
        // 1+2. Run connectivity check and session read in parallel (capped at 1.5s and 2s)
        const connectivity = Promise.race([
          useNetworkStore.getState().checkConnectivity(),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]).catch(() => {});
        const sessionRace = Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null }; error: AuthError | Error | null }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: new Error('Session timeout') }), 2000)
          ),
        ]).catch((e) => ({ data: { session: null }, error: e as Error, thrown: true as const }));

        await connectivity; // connectivity result applied first, exactly as before
        let activeUser: User | null = null;
        const res = await sessionRace; // then the session result
        if ('thrown' in res) {
          useNetworkStore.getState().setOffline(true);
        } else if (res.data?.session) {
          await setSession(res.data.session);
          activeUser = res.data.session.user;
        } else if (res.error && isNetworkFailure(res.error)) {
          useNetworkStore.getState().setOffline(true);
        }
        perfMark('session_ready');

        // 3. Offline recovery: restore the authenticated user & profile from local cache
        if (!activeUser) {
          const restoredUser = await useAuthStore.getState().restoreOfflineSession();
          if (restoredUser) activeUser = restoredUser;
        }

        // 4. Startup hydration for an authenticated user (aggregate 5s cap; cache-first loads fill the stores)
        if (activeUser) {
          const user = activeUser;
          const hydrationChain = async () => {
            await useExpenseStore.getState().loadPendingExpenses();
            await fetchCategories();
            await Promise.all([
              fetchExpenses(),
              useDailyBudgetStore.getState().hydrateFromSupabase(user.id),
              useAppLockStore.getState().init(user.id),
            ]);
          };
          // OPT-07 / ROL-005: opened again on the same day with caches in place -> show Home from cache and refresh
          // behind it (money writes are held until the server copy is in). Every other start waits as before.
          if (await canShowHomeFromCache(user.id)) {
            await startHomeFromCache(user.id);
            perfMark('warm_start_ready');
          } else {
            try {
              await Promise.race([hydrationChain(), new Promise<void>((resolve) => setTimeout(resolve, 5000))]);
            } catch (hydrationErr) {
              if (__DEV__) console.error('Startup hydration error:', hydrationErr);
            }
            perfMark('hydration_done');
          }
          target = 'AppTabs';
        } else {
          const hasSeen = await AsyncStorage.getItem('@arthik_has_seen_onboarding');
          if (hasSeen === 'true') target = 'Auth';
        }
      } catch (e) {
        if (__DEV__) console.error('Session retrieval error:', e);
      } finally {
        if (!unmounted.current) {
          nextScreen.current = target;
          tryExit();
        }
      }
    };

    initAuthAndNavigate();
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      unmounted.current = true;
      cancelAnimation(t);
      cancelAnimation(ex);
      cancelAnimation(dots);
    };
  }, [t, ex, dots]);

  // ── Animated styles: pure functions of the clocks ──
  const lockupOpen = (tv: number, exv: number) => {
    'worklet';
    const opened = outCubic(seg(tv, LOCKUP));
    const closing = outCubic(seg(exv, EX_LOCKUP_BACK));
    return opened * (1 - closing);
  };

  const brandRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ROW_CENTER_SHIFT * (1 - lockupOpen(t.value, ex.value)) }],
  }));

  const iconStyle = useAnimatedStyle(() => {
    const pop = 0.6 + 0.4 * outBack(seg(t.value, ICON_POP));
    const punch = 1 + 0.06 * Math.sin(seg(t.value, PUNCH) * Math.PI);
    return { transform: [{ scale: pop * punch }] };
  });

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: outCubic(seg(t.value, WORDMARK_FADE)) * (1 - seg(ex.value, EX_WORDMARK_FADE)),
    transform: [{ translateX: -WORDMARK_WIDTH * (1 - lockupOpen(t.value, ex.value)) }],
  }));

  const taglineStyle = useAnimatedStyle(() => {
    const p = outCubic(seg(t.value, TAGLINE));
    return {
      opacity: p * (1 - seg(ex.value, EX_TEXT_FADE)),
      transform: [{ translateY: 12 * (1 - p) }],
    };
  });

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: seg(t.value, DOTS_IN) * (1 - seg(ex.value, EX_TEXT_FADE)),
  }));

  const bloomStyle = useAnimatedStyle(() => {
    const started = ex.value >= EX_BLOOM[0];
    const g = inOutCubic(seg(ex.value, EX_BLOOM));
    return {
      opacity: started ? 1 : 0,
      transform: [{ scale: 1 + (bloomScale.value - 1) * g }],
    };
  });

  const dotColor = isDark ? colors.mintGreen : colors.mintGreenDark;
  const dotBaseColor = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(26, 43, 76, 0.18)';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.contentContainer}>
        {/* Lockup: [icon card] + ["Arthik" wordmark emerging from behind it] */}
        <Animated.View style={[styles.brandRow, brandRowStyle]}>
          <View style={styles.iconAnchor}>
            <Animated.View
              style={[
                styles.iconCard,
                {
                  backgroundColor: colors.mintGreen,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: colors.borderSubtle,
                  shadowColor: isDark ? '#000000' : '#1A2B4C',
                },
                iconStyle,
              ]}
            >
              <View style={styles.linesScaleWrapper}>
                {LOGO_PIECES.map((piece, i) => (
                  <LogoPiece key={i} piece={piece} index={i} t={t} ex={ex} />
                ))}
              </View>
            </Animated.View>
          </View>

          <View style={styles.wordmarkClipBox}>
            <Animated.View style={[styles.wordmarkInner, wordmarkStyle]}>
              <Animated.Text style={[styles.appName, { color: colors.textPrimary }]} numberOfLines={1}>
                Arthik
              </Animated.Text>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.Text style={[styles.tagline, { color: colors.textSecondary }, taglineStyle]}>
          Apna kharcha, apna hisaab
        </Animated.Text>

        <Animated.View style={[styles.dotsContainer, dotsStyle]}>
          {[0, 1, 2].map((i) => (
            <Dot key={i} index={i} dots={dots} color={dotColor} baseColor={dotBaseColor} />
          ))}
        </Animated.View>
      </View>

      {/* Bloom: its own full-screen layer, centred on the screen (= the centred icon), painted above everything. */}
      <View style={styles.bloomLayer} pointerEvents="none">
        <Animated.View style={[styles.bloomCircle, { backgroundColor: colors.mintGreen }, bloomStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 84,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 84,
  },
  iconAnchor: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  iconCard: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  linesScaleWrapper: {
    width: 112,
    height: 112,
    transform: [{ scale: ICON_SIZE / 112 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceContainer: {
    position: 'absolute',
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceImage: {
    position: 'absolute',
    width: 112,
    height: 112,
  },
  wordmarkClipBox: {
    width: WORDMARK_WIDTH,
    height: ICON_SIZE,
    overflow: 'hidden',
    justifyContent: 'center',
    zIndex: 2,
  },
  wordmarkInner: {
    width: WORDMARK_WIDTH,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 44,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  tagline: {
    position: 'absolute',
    top: 96,
    fontSize: FontSize.body,
    fontFamily: FontFamily.medium,
  },
  dotsContainer: {
    position: 'absolute',
    top: 138,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  dotWrapper: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotBase: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bloomLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    // Above the icon card (elevation 5) on Android, whose z-order follows elevation.
    elevation: 6,
    zIndex: 10,
  },
  bloomCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
  },
});
