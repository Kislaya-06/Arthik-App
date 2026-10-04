import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, StyleSheet, View, useWindowDimensions, useAnimatedValue } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/themeStore';
import { useAmbientStore } from '../store/ambientStore';
import { useSafeIsFocused } from '../hooks/useFocusEntry';
import {
  AMBIENT_ENABLED,
  AmbientMode,
  FADE_STOPS,
  GLOW_PROFILE,
  GLOW_RX,
  GLOW_RY,
  GRAIN_TILE_DP,
  GUST_ENVELOPE_STOPS,
  GUST_SLOTS,
  GUST_START,
  GustPlan,
  Palette,
  ToneKey,
  WASH_BOTTOM_SHARE,
  firstGustDelayMs,
  getAmbientHeight,
  getGrainGrid,
  getPalette,
  gustCentre,
  nextGustDelayMs,
  planGust,
  toneForRoute,
} from '../lib/ambientBackground';
import { GRAIN_TILE_URI } from '../lib/ambientGrain';
import { WIND_SPRITE_URI } from '../lib/ambientWind';

/**
 * Light across the TOP of a screen (see lib/ambientBackground.ts for the design): a tinted glow strongest at the very top,
 * fine film grain, and soft gusts of wind that drift in from the left or right edge and melt into the grain.
 *
 * Put it as the FIRST child of a screen's root view. It paints under everything else, ignores touches and is hidden from
 * screen readers. Its colour follows the screen automatically (green / violet / orange), it eases away to nothing where the
 * first card begins (no edge), and the user can switch it off in Profile.
 *
 * Why it can not stutter: a gust is a single native-driver animation over its whole life, and the next gust is planned at
 * random when the previous one has ended and is already invisible. There is no loop, so no loop point.
 */

function useRouteNameSafe(): string | undefined {
  try {
    const nav = require('@react-navigation/native');
    return nav.useRoute().name;
  } catch {
    return undefined;
  }
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => on && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      on = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

interface GustState {
  plan: GustPlan;
  /** Pause before this gust starts (only the first gust of a slot waits; later ones are already past their pause). */
  delayMs: number;
}

/** One independent gust timeline. */
const Gust: React.FC<{ slot: number; palette: Palette; screenWidth: number; height: number; running: boolean }> = ({
  slot,
  palette,
  screenWidth,
  height,
  running,
}) => {
  const [state, setState] = useState<GustState>(() => ({
    plan: planGust(Math.random, screenWidth),
    delayMs: firstGustDelayMs(slot, Math.random),
  }));
  const life = useAnimatedValue(0); // 0..1 over the gust's whole life (linear): opacity, spread, tilt, lift
  const pos = useAnimatedValue(0); // 0..1 eased: how far it has drifted in

  // Layout effect on purpose: it is cleaned up when a tab is frozen (freezeOnBlur) and re-run when it is revealed,
  // so a hidden screen never keeps animating in the background.
  useLayoutEffect(() => {
    if (!running) return;
    const { plan, delayMs } = state;
    let anim: Animated.CompositeAnimation | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const start = setTimeout(() => {
      life.setValue(0); // invisible at 0, so nothing can pop
      pos.setValue(0);
      anim = Animated.parallel([
        Animated.timing(life, { toValue: 1, duration: plan.durationMs, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(pos, { toValue: 1, duration: plan.durationMs, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);
      anim.start(({ finished }) => {
        if (!finished) return;
        // the gust is fully invisible now: plan the next one at random
        timer = setTimeout(
          () => setState({ plan: planGust(Math.random, screenWidth), delayMs: 0 }),
          nextGustDelayMs(Math.random)
        );
      });
    }, delayMs);

    return () => {
      clearTimeout(start);
      if (timer) clearTimeout(timer);
      anim?.stop();
    };
  }, [running, state, life, pos, screenWidth]);

  const { plan } = state;
  const mirror = plan.side === 'right' ? -1 : 1;
  const startX = GUST_START * screenWidth;
  const endX = gustCentre(plan, 1) * screenWidth;

  const translateX = pos.interpolate({
    inputRange: [0, 1],
    outputRange: plan.side === 'left' ? [startX, endX] : [screenWidth - startX, screenWidth - endX],
  });
  const translateY = life.interpolate({ inputRange: [0, 1], outputRange: [0, plan.lift] });
  const rotate = life.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${plan.tiltDeg}deg`] });
  const scaleX = life.interpolate({ inputRange: [0, 1], outputRange: [mirror, mirror * plan.spread] });
  const opacity = life.interpolate({
    inputRange: GUST_ENVELOPE_STOPS.map((s) => s.life),
    outputRange: GUST_ENVELOPE_STOPS.map((s) => s.opacity * plan.strength * palette.gustPeak),
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -plan.widthDp / 2, // centred on x = 0 at rest, then moved by translateX
        top: plan.y * height - plan.heightDp / 2,
        width: plan.widthDp,
        height: plan.heightDp,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate }, { scaleX }],
      }}
    >
      <Image
        source={{ uri: WIND_SPRITE_URI }}
        resizeMode="stretch"
        fadeDuration={0}
        style={{ width: plan.widthDp, height: plan.heightDp, tintColor: palette.gust }}
      />
    </Animated.View>
  );
};

export interface AmbientBackgroundProps {
  /** Override the colour. By default it follows the screen's route (Savings violet, Insights orange, everything else green). */
  tone?: ToneKey;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({ tone }) => {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const routeName = useRouteNameSafe();
  const userEnabled = useAmbientStore((s) => s.enabled);
  const hydrated = useAmbientStore((s) => s.hydrated);

  const height = getAmbientHeight(insets.top);
  const resolvedTone: ToneKey = tone ?? toneForRoute(routeName);
  const mode: AmbientMode = !isDark ? 'light' : colors.background === '#000000' ? 'amoled' : 'dark';
  const palette = useMemo(() => getPalette(resolvedTone, mode), [resolvedTone, mode]);
  const grid = useMemo(() => getGrainGrid(width, height), [width, height]);

  const focused = useSafeIsFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  const visible = AMBIENT_ENABLED && userEnabled && hydrated;
  const running = visible && focused && appActive && !reduceMotion;

  if (!visible) return null;

  return (
    <View
      style={[styles.layer, { height }]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {/* Tinted base + a glow centred on the top edge: the strongest light is at the very top */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ambient-wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.wash} stopOpacity={palette.washAlpha} />
            <Stop offset="1" stopColor={palette.wash} stopOpacity={palette.washAlpha * WASH_BOTTOM_SHARE} />
          </LinearGradient>
          <RadialGradient id="ambient-glow" cx="50%" cy="50%" r="50%">
            {GLOW_PROFILE.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={palette.glow} stopOpacity={palette.glowAlpha * s.share} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#ambient-wash)" />
        <Ellipse cx={width / 2} cy={0} rx={width * GLOW_RX} ry={height * GLOW_RY} fill="url(#ambient-glow)" />
      </Svg>

      {/* Gusts of wind from the left and right edges (under the grain, so they are seen only through it) */}
      {Array.from({ length: GUST_SLOTS }).map((_, slot) => (
        <Gust key={slot} slot={slot} palette={palette} screenWidth={width} height={height} running={running} />
      ))}

      {/* Film grain */}
      <View style={styles.grain} pointerEvents="none">
        {Array.from({ length: grid.rows }).map((_, r) =>
          Array.from({ length: grid.cols }).map((__, c) => (
            <Image
              key={`${r}-${c}`}
              source={{ uri: GRAIN_TILE_URI }}
              resizeMode="stretch"
              fadeDuration={0}
              style={{
                position: 'absolute',
                left: c * GRAIN_TILE_DP,
                top: r * GRAIN_TILE_DP,
                width: GRAIN_TILE_DP,
                height: GRAIN_TILE_DP,
                opacity: palette.grainOpacity,
              }}
            />
          ))
        )}
      </View>

      {/* Ease away to nothing: smootherstep, zero slope at both ends, so there is no edge anywhere */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ambient-fade" x1="0" y1="0" x2="0" y2="1">
            {FADE_STOPS.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={colors.background} stopOpacity={s.alpha} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#ambient-fade)" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  grain: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
});

export default AmbientBackground;
