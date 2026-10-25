import React, { useEffect, useId } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle, StyleSheet, useAnimatedValue } from 'react-native';
import Svg, { Path, Circle, Defs, Mask, Rect, G, SvgProps } from 'react-native-svg';
import { Motion } from '../config/theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

export interface PiggyBankCoinIconProps extends SvgProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Mathematical 1:1 Vector Replica of the Indian Rupee Gullak (Piggy Bank)
 * matches the exact silhouette sprite geometry:
 * - Upward-curling tail on the left
 * - Chubby round pig body with two pointed ears, rounded snout, and sturdy splayed legs
 * - Gentle circular gap separating the coin from the pig's back
 * - Crisp, authentic Indian Rupee symbol (₹) upright inside the coin disc
 * - Smiling eye (◡) cutout
 */

export const PIGGY_TAIL_PATH =
  'M 3.8 16.5 C 2.2 16.5 1.5 15.2 1.5 13.0 C 1.5 11.5 2.2 10.8 2.6 10.8 C 2.9 10.8 3.1 11.1 3.0 11.5 C 2.6 12.0 2.4 12.5 2.4 13.0 C 2.4 14.5 3.0 15.5 3.8 15.5 C 4.3 15.5 4.5 16.0 4.3 16.3 C 4.1 16.5 3.9 16.5 3.8 16.5 Z';

export const PIGGY_BODY_PATH =
  'M 5.8 8.2 C 6.8 8.8 7.9 9.1 9.1 9.1 C 10.3 9.1 11.4 8.8 12.4 8.2 L 13.0 7.4 L 13.6 7.3 L 14.1 8.1 L 14.6 8.2 L 15.8 7.2 C 16.0 7.0 16.3 7.2 16.3 7.5 L 16.4 8.6 C 17.1 9.6 17.8 10.6 18.2 11.8 L 20.8 11.8 C 21.4 11.8 21.7 12.2 21.7 12.8 L 21.7 14.4 C 21.7 15.0 21.4 15.4 20.8 15.4 L 18.4 15.4 C 18.0 16.6 17.4 17.6 16.8 18.5 L 17.4 21.5 C 17.6 21.9 17.3 22.3 16.9 22.3 L 15.1 22.3 C 14.7 22.3 14.4 22.0 14.3 21.6 L 13.8 19.6 C 12.6 19.8 11.2 19.8 9.8 19.6 L 9.2 21.6 C 9.1 22.0 8.8 22.3 8.4 22.3 L 6.6 22.3 C 6.2 22.3 5.9 21.9 6.1 21.5 L 6.7 18.8 C 5.0 17.6 4.0 15.8 4.0 13.8 C 4.0 11.4 4.8 9.4 5.8 8.2 Z';

export const COIN_PATH = 'M 9.1 1.4 A 3.3 3.3 0 1 0 9.101 1.4 Z';

export const PiggyBankCoinIcon: React.FC<PiggyBankCoinIconProps> = ({
  size = 24,
  color = 'currentColor',
  style,
  ...props
}) => {
  const rawId = useId();
  const maskId = `piggy_mask_${rawId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      {...props}
    >
      <Defs>
        <Mask id={maskId}>
          {/* Base white canvas keeps all masked shapes opaque */}
          <Rect width={24} height={24} fill="#FFFFFF" />

          {/* 1. Smiling eye cutout (◡) */}
          <Path
            d="M 15.4 12.2 A 0.85 0.85 0 0 0 17.1 12.2"
            fill="none"
            stroke="#000000"
            strokeWidth={1.05}
            strokeLinecap="round"
          />

          {/* 2. Authentic Indian Rupee Symbol (₹) cutout inside coin — upright, clean */}
          <G
            transform="translate(9.1, 4.7) scale(0.36) translate(-12, -12)"
            fill="none"
            stroke="#000000"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Upper horizontal bar */}
            <Path d="M 7.8 7.0 H 16.2" strokeWidth={2.0} />
            {/* Middle horizontal bar */}
            <Path d="M 7.8 10.2 H 15.0" strokeWidth={2.0} />
            {/* Vertical stem + curved bowl/loop */}
            <Path d="M 10.4 7.0 V 14.0 C 13.6 14.0 15.4 12.6 15.4 10.2 C 15.4 7.8 13.6 7.0 10.4 7.0" strokeWidth={1.9} />
            {/* Diagonal kick leg */}
            <Path d="M 10.4 14.0 L 16.0 18.2" strokeWidth={2.1} />
          </G>
        </Mask>
      </Defs>

      {/* Piggy Bank Silhouette Group (Tail + Body + Coin Disc) */}
      <G fill={color} mask={`url(#${maskId})`}>
        {/* Tail */}
        <Path d={PIGGY_TAIL_PATH} />
        {/* Chubby Pig Body */}
        <Path d={PIGGY_BODY_PATH} />
        {/* Coin Disc */}
        <Circle cx={9.1} cy={4.7} r={3.55} />
      </G>
    </Svg>
  );
};

export interface AnimatedPiggyBankProps {
  size?: number;
  color?: string;
  coinColor?: string;
  triggerKey?: number | string | boolean;
  style?: StyleProp<ViewStyle>;
  onAnimationEnd?: () => void;
}

// Helper to create the squash-and-stretch spring timing
const createSquash = (val: Animated.Value, squash: number) =>
  Animated.sequence([
    Animated.timing(val, { toValue: squash, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    Animated.spring(val, {
      toValue: 1,
      stiffness: Motion.springs.settle.stiffness,
      damping: Motion.springs.settle.damping,
      mass: Motion.springs.settle.mass,
      useNativeDriver: true,
    }),
  ]);

/**
 * Animated version of the Indian Rupee Gullak with coin drop & joyful bounce.
 * Driven via React Native Animated with useNativeDriver: true for 60fps performance.
 */
export const AnimatedPiggyBank: React.FC<AnimatedPiggyBankProps> = ({
  size = 48,
  color = '#2E7D52',
  coinColor = '#F59E0B',
  triggerKey,
  style,
  onAnimationEnd,
}) => {
  const rawCoinId = useId();
  const rawPiggyId = useId();
  const coinMaskId = `anim_coin_${rawCoinId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const piggyMaskId = `anim_pig_${rawPiggyId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const coinY = useAnimatedValue(-size * 0.4);
  const coinOpacity = useAnimatedValue(1);
  const coinScale = useAnimatedValue(0.9);
  const piggyScaleX = useAnimatedValue(1);
  const piggyScaleY = useAnimatedValue(1);

  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      onAnimationEnd?.();
      return;
    }

    coinY.setValue(-size * 0.4);
    coinOpacity.setValue(1);
    coinScale.setValue(0.9);
    piggyScaleX.setValue(1);
    piggyScaleY.setValue(1);

    const dropAnim = Animated.sequence([
      Animated.parallel([
        Animated.timing(coinY, {
          toValue: size * 0.08,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(coinScale, {
          toValue: 0.8,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(coinOpacity, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        createSquash(piggyScaleX, 1.08),
        createSquash(piggyScaleY, 0.94),
      ]),
    ]);

    dropAnim.start(() => onAnimationEnd?.());
    return () => dropAnim.stop();
  }, [triggerKey, size, onAnimationEnd, coinY, coinOpacity, coinScale, piggyScaleX, piggyScaleY, reduceMotion]);

  return (
    <View style={[{ width: size, height: size, position: 'relative' }, styles.center, style]}>
      {/* 1. Dropping Indian Rupee Coin */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          {
            transform: [{ translateY: coinY }, { scale: coinScale }],
            opacity: coinOpacity,
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Defs>
            <Mask id={coinMaskId}>
              <Rect width={24} height={24} fill="#FFFFFF" />
              <G
                transform="translate(12, 6) scale(0.40) translate(-12, -12)"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M 7.8 7.0 H 16.2" stroke="#000000" strokeWidth={2.0} />
                <Path d="M 7.8 10.2 H 15.0" stroke="#000000" strokeWidth={2.0} />
                <Path d="M 10.4 7.0 V 14.0 C 13.6 14.0 15.4 12.6 15.4 10.2 C 15.4 7.8 13.6 7.0 10.4 7.0" stroke="#000000" strokeWidth={1.9} />
                <Path d="M 10.4 14.0 L 16.0 18.2" stroke="#000000" strokeWidth={2.1} />
              </G>
            </Mask>
          </Defs>
          <Circle cx={12} cy={6} r={3.8} fill={coinColor} mask={`url(#${coinMaskId})`} />
        </Svg>
      </Animated.View>

      {/* 2. Piggy Bank Body with Squash and Stretch */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          {
            transform: [{ scaleX: piggyScaleX }, { scaleY: piggyScaleY }],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Defs>
            <Mask id={piggyMaskId}>
              <Rect width={24} height={24} fill="#FFFFFF" />
              <Path
                d="M 15.4 12.2 A 0.85 0.85 0 0 0 17.1 12.2"
                fill="none"
                stroke="#000000"
                strokeWidth={1.05}
                strokeLinecap="round"
              />
            </Mask>
          </Defs>
          <G fill={color} mask={`url(#${piggyMaskId})`}>
            <Path d={PIGGY_TAIL_PATH} />
            <Path d={PIGGY_BODY_PATH} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PiggyBankCoinIcon;
