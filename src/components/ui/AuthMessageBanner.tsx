import React from 'react';
import { Text, StyleSheet, Pressable, Animated } from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';
import { ThemeColors, FontFamily, FontSize, Spacing, BorderRadius } from '../../config/theme';

export interface AuthMessageBannerProps {
  message: string | null;
  type?: 'error' | 'success';
  onDismiss: () => void;
  opacity: Animated.Value | Animated.AnimatedInterpolation<number>;
  translateY: Animated.Value | Animated.AnimatedInterpolation<number>;
  isDark: boolean;
  colors: ThemeColors;
}

export const AuthMessageBanner: React.FC<AuthMessageBannerProps> = ({
  message,
  type = 'error',
  onDismiss,
  opacity,
  translateY,
  isDark,
}) => {
  if (!message) return null;

  const isSuccess = type === 'success';
  const iconColor = isSuccess
    ? (isDark ? '#81C784' : '#4CAF50')
    : (isDark ? '#FF8E8E' : '#E87070');

  return (
    <Animated.View
      style={[
        styles.banner,
        isDark && {
          backgroundColor: isSuccess ? 'rgba(76, 175, 80, 0.15)' : 'rgba(232, 112, 112, 0.15)',
          borderColor: isSuccess ? 'rgba(76, 175, 80, 0.3)' : 'rgba(232, 112, 112, 0.3)',
        },
        isSuccess && !isDark && styles.successBanner,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <AlertCircle
        size={18}
        color={iconColor}
        style={{ marginRight: Spacing.element, flexShrink: 0 }}
      />
      <Text
        style={[
          styles.bannerText,
          isDark && { color: iconColor },
          isSuccess && !isDark && styles.successBannerText,
        ]}
        numberOfLines={4}
      >
        {message}
      </Text>
      <Pressable onPress={onDismiss} style={styles.bannerClose} hitSlop={8}>
        <X size={16} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEEEC',
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    borderColor: 'rgba(232, 112, 112, 0.4)',
    paddingHorizontal: Spacing.block,
    paddingVertical: 12,
    marginBottom: Spacing.surface,
  },
  successBanner: {
    backgroundColor: '#E8F5EE',
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  bannerText: {
    flex: 1,
    fontSize: FontSize.bodySmall,
    color: '#D32F2F',
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
  successBannerText: {
    color: '#2E7D32',
  },
  bannerClose: {
    padding: Spacing.nano,
    marginLeft: Spacing.element,
  },
});
