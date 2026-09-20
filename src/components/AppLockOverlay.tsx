import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../store/themeStore';
import { useAppLockStore } from '../store/appLockStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

export const AppLockOverlay: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { isAuthenticating, authenticate } = useAppLockStore();

  useEffect(() => {
    // Only auto-trigger biometric prompt on appearance if app is in active foreground state
    if (AppState.currentState === 'active') {
      const timer = setTimeout(() => {
        if (AppState.currentState === 'active' && useAppLockStore.getState().isLocked) {
          authenticate();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [authenticate]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

        {/* Unlock Action Button */}
        <Pressable
          style={({ pressed }) => [
            styles.unlockButton,
            {
              backgroundColor: colors.mintGreen,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          onPress={() => authenticate(true)}
        >
          <View style={styles.buttonRow}>
            {isAuthenticating ? (
              <ActivityIndicator size="small" color="#1A2B4C" />
            ) : (
              <ShieldCheck size={20} color="#1A2B4C" />
            )}
            <Text style={styles.buttonText}>
              {isAuthenticating ? 'Waiting for Sensor...' : 'Unlock Arthik'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
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
    fontSize: FontSize.sectionTitle,
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
  unlockButton: {
    width: '100%',
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.element,
  },
  buttonText: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
    color: '#1A2B4C',
  },
});