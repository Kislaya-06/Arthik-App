import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, AppState } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as REasing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StatusBar } from 'expo-status-bar';
import Lock from 'lucide-react-native/icons/lock';
import FingerprintPattern from 'lucide-react-native/icons/fingerprint-pattern';
import { useTheme } from '../store/themeStore';
import { useAppLockStore } from '../store/appLockStore';
import { useAuthStore } from '../store/authStore';
import { navigationRef } from '../navigation/navigationRef';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Spacing, FontSize, FontFamily, Motion } from '../config/theme';

export const AppLockOverlay: React.FC = () => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const isAuthenticating = useAppLockStore((s) => s.isAuthenticating);
  const isAppLockEnabled = useAppLockStore((s) => s.isAppLockEnabled);
  const isLocked = useAppLockStore((s) => s.isLocked);
  const user = useAuthStore((s) => s.user);
  const authenticate = useAppLockStore((s) => s.authenticate);

  const [shouldRender, setShouldRender] = useState(isLocked);
  const opacityVal = useSharedValue(1);
  const scaleVal = useSharedValue(1);

  useEffect(() => {
    if (isLocked) {
      setShouldRender(true);
      opacityVal.value = 1;
      scaleVal.value = 1;
    } else if (shouldRender) {
      if (reduceMotion) {
        setShouldRender(false);
        return;
      }
      opacityVal.value = withTiming(0, {
        duration: Motion.duration.snappy,
        easing: REasing.bezier(0.23, 1, 0.32, 1),
      }, (finished) => {
        if (finished) {
          scheduleOnRN(setShouldRender, false);
        }
      });
      scaleVal.value = withTiming(1.03, {
        duration: Motion.duration.snappy,
        easing: REasing.bezier(0.23, 1, 0.32, 1),
      });
    }
  }, [isLocked, shouldRender, reduceMotion, opacityVal, scaleVal]);

  useEffect(() => {
    // Only auto-trigger biometric prompt on appearance if app is in active foreground state
    if (AppState.currentState === 'active' && isLocked) {
      const timer = setTimeout(() => {
        if (AppState.currentState === 'active' && useAppLockStore.getState().isLocked) {
          authenticate();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [authenticate, isLocked]);

  if (!user || !isAppLockEnabled || !shouldRender) {
    return null;
  }

  const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : 'Splash';
  if (currentRoute === 'Splash') {
    return null;
  }

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacityVal.value,
    transform: [{ scale: scaleVal.value }],
  }));

  return (
    <Animated.View
      pointerEvents={isLocked ? 'auto' : 'none'}
      style={[
        styles.container,
        { backgroundColor: colors.background },
        animatedContainerStyle,
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.content}>
        {/* Security Shield / Lock Icon */}
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : 'rgba(184, 224, 200, 0.28)',
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <Lock size={36} color={isDark ? colors.mintGreen : colors.mintGreenDark} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>Arthik is Locked</Text>

        {/* Subtitle */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Touch the fingerprint sensor or use your device screen lock to access your finances.
        </Text>

        {/* Circular Touch / Scan Sensor Action */}
        <View style={styles.actionContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlock Arthik"
            accessibilityHint="Double tap to scan fingerprint or enter device PIN"
            style={({ pressed }) => [
              styles.circleButton,
              {
                backgroundColor: colors.mintGreen,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
            onPress={() => authenticate(true)}
          >
            {isAuthenticating ? (
              <ActivityIndicator size="small" color="#1A2B4C" />
            ) : (
              <FingerprintPattern size={36} color="#1A2B4C" strokeWidth={2.2} />
            )}
          </Pressable>

          <Text style={[styles.touchHint, { color: colors.textSecondary }]}>
            {isAuthenticating ? 'Waiting for Sensor...' : 'Tap to unlock'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.surface,
  },
  title: {
    fontSize: FontSize.titleMedium,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.element,
  },
  subtitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.section,
  },
  actionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  touchHint: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.semibold,
    textAlign: 'center',
    marginTop: Spacing.group,
  },
});