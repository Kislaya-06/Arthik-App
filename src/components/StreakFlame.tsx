import React, { useRef, useEffect, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import {
  getStreakFlameConfig,
  FLAME_PATHS,
  EMBER_CONFIGS,
  StreakFlameConfig,
} from '../lib/flameUtils';

export { getStreakFlameConfig, FLAME_PATHS, EMBER_CONFIGS, StreakFlameConfig };

export interface StreakFlameProps {
  streak: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  colorOverride?: string;
}

export const StreakFlame: React.FC<StreakFlameProps> = ({
  streak,
  size = 18,
  style,
  colorOverride,
}) => {
  const config = useMemo(() => getStreakFlameConfig(streak), [streak]);
  const glowSize = Math.max(size * 2, config.glowRadius * 2);

  // ── Animated values ──────────────────────────────────────────
  const flameLick = useRef(new Animated.Value(0)).current;
  const coreFlutter = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  // 4 rising ember particle drivers
  const emberAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // 1. Outer Flame Lick Animation: Anchored stretch & sway
    flameLick.setValue(0);
    const outerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameLick, {
          toValue: 1,
          duration: config.flickerSpeed,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flameLick, {
          toValue: 0,
          duration: config.flickerSpeed,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    outerLoop.start();

    // 2. Inner Core Flutter: Faster micro-oscillations for plasma depth
    coreFlutter.setValue(0);
    const innerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(coreFlutter, {
          toValue: 1,
          duration: Math.max(380, Math.round(config.flickerSpeed * 0.65)),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(coreFlutter, {
          toValue: 0,
          duration: Math.max(380, Math.round(config.flickerSpeed * 0.65)),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    innerLoop.start();

    // 3. Radial Fiery Glow Pulse (when streak > 0)
    let glowLoop: Animated.CompositeAnimation | null = null;
    if (config.glowOpacity > 0) {
      glowPulse.setValue(0);
      glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1,
            duration: Math.round(config.flickerSpeed * 1.1),
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowPulse, {
            toValue: 0,
            duration: Math.round(config.flickerSpeed * 1.1),
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      glowLoop.start();
    } else {
      glowPulse.setValue(0);
    }

    // 4. Rising Embers / Sparks Loops (Flames emitting upwards)
    const emberLoops: Animated.CompositeAnimation[] = [];
    EMBER_CONFIGS.forEach((cfg, idx) => {
      if (idx < config.emberCount) {
        emberAnims[idx].setValue(0);
        const duration = Math.round(1100 * cfg.durationRatio);
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(cfg.delay),
            Animated.timing(emberAnims[idx], {
              toValue: 1,
              duration,
              easing: Easing.bezier(0.2, 0.0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(emberAnims[idx], {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
        loop.start();
        emberLoops.push(loop);
      } else {
        emberAnims[idx].setValue(0);
      }
    });

    return () => {
      outerLoop.stop();
      innerLoop.stop();
      glowLoop?.stop();
      emberLoops.forEach((l) => l.stop());
    };
  }, [config, flameLick, coreFlutter, glowPulse, emberAnims]);

  // ── Outer Flame Interpolations ──────────────────────────────
  // The bottom of the flame stays grounded while the tip licks upward
  const scaleY = flameLick.interpolate({
    inputRange: [0, 0.4, 0.7, 1],
    outputRange: [1.0, config.lickStretch, 0.96, 1.0],
  });

  const scaleX = flameLick.interpolate({
    inputRange: [0, 0.4, 0.7, 1],
    outputRange: [1.0, 0.92, 1.04, 1.0],
  });

  // Upward translation compensation keeps the bottom edge anchored
  const translateY = flameLick.interpolate({
    inputRange: [0, 0.4, 0.7, 1],
    outputRange: [0, -(config.lickStretch - 1) * (size * 0.45), 0.02 * size, 0],
  });

  const rotate = flameLick.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [
      '0deg',
      `${config.swayDegrees}deg`,
      `-${config.swayDegrees * 0.8}deg`,
      '0deg',
    ],
  });

  // ── Inner Core Interpolations ───────────────────────────────
  const coreScaleY = coreFlutter.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.15],
  });

  const coreScaleX = coreFlutter.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 0.94],
  });

  const coreOpacity = coreFlutter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.0],
  });

  // ── Glow Interpolations ─────────────────────────────────────
  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.15],
  });

  const glowCurrentOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [config.glowOpacity * 0.5, config.glowOpacity],
  });

  const outerColor = colorOverride || config.outerColor;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        styles.overflowVisible,
        style,
      ]}
      pointerEvents="box-none"
    >
      {/* ── Layer 1: Fiery Radial Glow Aura (Behind Flame) ── */}
      {config.glowOpacity > 0 && (
        <Animated.View
          style={[
            styles.glowWrapper,
            {
              width: glowSize,
              height: glowSize,
              left: (size - glowSize) / 2,
              top: (size - glowSize) / 2,
              opacity: glowCurrentOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
          pointerEvents="none"
        >
          <Svg width={glowSize} height={glowSize} viewBox={`0 0 ${glowSize} ${glowSize}`}>
            <Defs>
              <RadialGradient
                id={`streak-glow-${config.tier}`}
                cx="50%"
                cy="50%"
                rx="50%"
                ry="50%"
              >
                <Stop offset="0%" stopColor={config.glowColor} stopOpacity={0.85} />
                <Stop offset="45%" stopColor={config.glowSecondaryColor} stopOpacity={0.4} />
                <Stop offset="100%" stopColor={config.glowColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle
              cx={glowSize / 2}
              cy={glowSize / 2}
              r={glowSize / 2}
              fill={`url(#streak-glow-${config.tier})`}
            />
          </Svg>
        </Animated.View>
      )}

      {/* ── Layer 2: Main Leaping Flame Body ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          {
            transform: [
              { translateY },
              { scaleY },
              { scaleX },
              { rotate },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {/* Outer Flame Silhouette */}
          <Path
            d={FLAME_PATHS.outer}
            fill={outerColor}
            fillRule="evenodd"
            clipRule="evenodd"
          />

          {/* Inner Flame Core (Hottest Part) */}
          <Path
            d={FLAME_PATHS.inner}
            fill={config.innerColor}
            fillRule="evenodd"
            clipRule="evenodd"
            opacity={config.tier === 0 ? 0.6 : 0.95}
          />

          {/* Center White-Hot Spark Droplet (for tier 2+) */}
          {config.coreColor && config.tier >= 2 && (
            <Path
              d={FLAME_PATHS.core}
              fill={config.coreColor}
              fillRule="evenodd"
              clipRule="evenodd"
              opacity={0.9}
            />
          )}
        </Svg>
      </Animated.View>

      {/* ── Layer 3: Independent Inner Core Flutter ── */}
      {config.tier > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            {
              opacity: coreOpacity,
              transform: [
                { translateY: Animated.multiply(translateY, 0.7) },
                { scaleY: coreScaleY },
                { scaleX: coreScaleX },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
              d={FLAME_PATHS.inner}
              fill={config.innerColor}
              fillRule="evenodd"
              clipRule="evenodd"
              opacity={0.8}
            />
          </Svg>
        </Animated.View>
      )}

      {/* ── Layer 4: Rising Embers / Sparks Emitter ("Flames निकलती हुई") ── */}
      {config.emberCount > 0 &&
        EMBER_CONFIGS.slice(0, config.emberCount).map((cfg, idx) => {
          const anim = emberAnims[idx];
          const riseDistance = size * cfg.heightRatio;

          const emberTranslateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [size * 0.1, -riseDistance],
          });

          const emberTranslateX = anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, cfg.driftX * 0.6, cfg.driftX],
          });

          const emberScale = anim.interpolate({
            inputRange: [0, 0.25, 0.7, 1],
            outputRange: [0.35, 1.15, 0.85, 0.15],
          });

          const emberOpacity = anim.interpolate({
            inputRange: [0, 0.15, 0.75, 1],
            outputRange: [0, 0.95, 0.7, 0],
          });

          const emberSize = Math.max(3, Math.round(size * 0.22));

          return (
            <Animated.View
              key={`ember-${idx}`}
              style={[
                styles.emberParticle,
                {
                  width: emberSize,
                  height: Math.round(emberSize * 1.25),
                  left: (size - emberSize) / 2,
                  top: size * 0.2,
                  opacity: emberOpacity,
                  transform: [
                    { translateY: emberTranslateY },
                    { translateX: emberTranslateX },
                    { scale: emberScale },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <Svg
                width={emberSize}
                height={Math.round(emberSize * 1.25)}
                viewBox="0 0 4 5"
                fill="none"
              >
                <Path
                  d={FLAME_PATHS.ember}
                  fill={idx % 2 === 0 ? config.innerColor : config.outerColor}
                />
              </Svg>
            </Animated.View>
          );
        })}
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowVisible: {
    overflow: 'visible',
  },
  glowWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  emberParticle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});

export default StreakFlame;
