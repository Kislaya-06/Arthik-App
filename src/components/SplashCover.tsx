import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSplashCoverStore } from '../store/splashCoverStore';
import { useTheme } from '../store/themeStore';

const FADE_MS = 240;

/**
 * Full-screen mint cover for the Splash → app handoff (see splashCoverStore).
 * Always mounted, so turning it on is a single UI-thread opacity write: no mount-then-animate flash.
 */
export const SplashCover: React.FC = () => {
  const { colors } = useTheme();
  const phase = useSplashCoverStore((s) => s.phase);
  const end = useSplashCoverStore((s) => s.end);
  const opacity = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(opacity);
    if (phase === 'on') {
      opacity.value = 1;
    } else if (phase === 'fading') {
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(end);
      });
    } else {
      opacity.value = 0;
    }
  }, [phase, opacity, end]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents={phase === 'on' ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.mintGreen }, style]}
    />
  );
};

const styles = StyleSheet.create({
  cover: {
    // Above the navigator, below the app-lock overlay (zIndex 99999) and the offline/sync banners.
    zIndex: 999,
  },
});
