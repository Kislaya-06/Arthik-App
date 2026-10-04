import React, { useEffect } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle, StyleSheet, useAnimatedValue } from 'react-native';
import Svg, { Path, SvgProps } from 'react-native-svg';

export interface PiggyBankCoinIconProps extends SvgProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const COIN_PATH =
  'M 7.5 1.0 A 5.0 5.0 0 1 0 7.501 1.0 Z M 5.5 3.4 H 9.2 V 4.1 H 6.3 V 4.7 H 8.5 V 5.35 H 6.3 V 5.6 C 7.3 5.6 8.0 5.9 8.3 6.4 C 8.5 6.7 8.5 7.1 8.2 7.5 L 9.2 8.8 H 8.1 L 6.3 6.7 V 8.8 H 5.5 Z';

export const PIGGY_BODY_PATH =
  'M 13.4 8.2 C 13.8 6.5 14.8 4.2 15.6 3.6 C 16.2 3.2 16.7 4.2 16.5 6.2 C 17.5 7.2 18.5 8.6 18.5 10.2 L 21.0 10.2 C 21.6 10.2 22.0 10.6 22.0 11.2 L 22.0 13.0 C 22.0 13.6 21.6 14.0 21.0 14.0 L 18.8 14.0 C 18.3 15.8 17.2 17.2 15.8 17.8 L 15.8 20.8 C 15.8 21.3 15.3 21.8 14.8 21.8 L 13.2 21.8 C 12.7 21.8 12.2 21.3 12.2 20.8 L 12.2 18.6 C 11.6 18.4 11.0 18.4 10.4 18.6 L 10.4 20.8 C 10.4 21.3 9.9 21.8 9.4 21.8 L 7.8 21.8 C 7.3 21.8 6.8 21.3 6.8 20.8 L 6.8 17.8 C 5.2 16.6 4.0 14.8 3.8 12.6 C 3.6 11.2 4.0 9.8 4.8 8.6 C 4.4 9.5 4.2 10.5 4.2 11.4 C 4.2 13.4 5.6 14.8 7.5 14.8 C 9.4 14.8 11.2 13.6 11.8 11.6 C 12.2 10.4 12.4 9.2 13.4 8.2 Z M 16.8 9.8 A 0.85 0.85 0 1 0 16.801 9.8 Z';

/**
 * Custom vector icon representing a Piggy Bank with a Coin dropping into it.
 */
export const PiggyBankCoinIcon: React.FC<PiggyBankCoinIconProps> = ({
  size = 24,
  color = 'currentColor',
  style,
  ...props
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} {...props}>
    <Path fill={color} fillRule="evenodd" clipRule="evenodd" d={COIN_PATH} />
    <Path fill={color} fillRule="evenodd" clipRule="evenodd" d={PIGGY_BODY_PATH} />
  </Svg>
);

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
    Animated.spring(val, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }),
  ]);

// Reusable animated SVG layer to eliminate markup duplication
const AnimatedSvgLayer = ({
  size,
  path,
  fill,
  style,
}: {
  size: number;
  path: string;
  fill: string;
  style: StyleProp<ViewStyle>;
}) => (
  <Animated.View style={[StyleSheet.absoluteFill, styles.center, style]} pointerEvents="none">
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill={fill} fillRule="evenodd" clipRule="evenodd" d={path} />
    </Svg>
  </Animated.View>
);

/**
 * Animated version of the Piggy Bank with a joyful Coin Drop & Squash-and-Stretch bounce.
 * Driven entirely via React Native Animated with useNativeDriver: true for 60fps smoothness.
 */
export const AnimatedPiggyBank: React.FC<AnimatedPiggyBankProps> = ({
  size = 48,
  color = '#2E7D52',
  coinColor = '#F59E0B',
  triggerKey,
  style,
  onAnimationEnd,
}) => {
  const coinY = useAnimatedValue(-size * 0.35);
  const coinOpacity = useAnimatedValue(1);
  const coinScale = useAnimatedValue(0.9);
  const piggyScaleX = useAnimatedValue(1);
  const piggyScaleY = useAnimatedValue(1);

  useEffect(() => {
    coinY.setValue(-size * 0.35);
    coinOpacity.setValue(1);
    coinScale.setValue(0.9);
    piggyScaleX.setValue(1);
    piggyScaleY.setValue(1);

    const dropAnim = Animated.sequence([
      Animated.parallel([
        Animated.timing(coinY, { toValue: size * 0.22, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(coinScale, { toValue: 0.75, duration: 260, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(coinOpacity, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]),
      ]),
      Animated.parallel([
        createSquash(piggyScaleX, 1.22),
        createSquash(piggyScaleY, 0.84),
      ]),
    ]);

    dropAnim.start(() => onAnimationEnd?.());
    return () => dropAnim.stop();
  }, [triggerKey, size, onAnimationEnd, coinY, coinOpacity, coinScale, piggyScaleX, piggyScaleY]);

  return (
    <View style={[{ width: size, height: size, position: 'relative' }, styles.center, style]}>
      <AnimatedSvgLayer
        size={size}
        path={COIN_PATH}
        fill={coinColor}
        style={{ transform: [{ translateY: coinY }, { scale: coinScale }], opacity: coinOpacity }}
      />
      <AnimatedSvgLayer
        size={size}
        path={PIGGY_BODY_PATH}
        fill={color}
        style={{ transform: [{ scaleX: piggyScaleX }, { scaleY: piggyScaleY }] }}
      />
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
