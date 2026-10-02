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

  // ── Milestone / streak change subtle settle spring ──────────
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevStreakRef = useRef(streak);

  useEffect(() => {
    // Only animate when streak actually changes and reaches a milestone/increment
    if (prevStreakRef.current !== streak && streak > 0) {
      scaleAnim.setValue(0.92);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
    prevStreakRef.current = streak;
  }, [streak, scaleAnim]);

  const outerColor = colorOverride || config.outerColor;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transform: [{ scale: scaleAnim }],
        },
        styles.overflowVisible,
        style,
      ]}
      pointerEvents="box-none"
    >
      {/* ── Layer 1: Fiery Radial Glow Aura (Calm, static glow behind flame) ── */}
      {config.glowOpacity > 0 && (
        <View
          style={[
            styles.glowWrapper,
            {
              width: glowSize,
              height: glowSize,
              left: (size - glowSize) / 2,
              top: (size - glowSize) / 2,
              opacity: config.glowOpacity * 0.45,
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
        </View>
      )}

      {/* ── Layer 2: Main Flame Body (Crisp, calm vector paths) ── */}
      <View
        style={[StyleSheet.absoluteFill, styles.center]}
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

          {/* Inner Flame Core */}
          <Path
            d={FLAME_PATHS.inner}
            fill={config.innerColor}
            fillRule="evenodd"
            clipRule="evenodd"
            opacity={config.tier === 0 ? 0.6 : 0.95}
          />

          {/* Center White-Hot Core Spark (tier 2+) */}
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
      </View>
    </Animated.View>
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
});

export default StreakFlame;
