import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../store/themeStore';
import { ControlHeight, BorderRadius, FontSize, FontFamily, LineHeight } from '../../config/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'cta' | 'standard' | 'compact';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Standardized AppButton primitive for Arthik.
 * Enforces unified heights (60px CTA, 48px standard, 36px compact),
 * stadium pill radii, and responsive spring touch physics (tension 70, friction 8).
 */
export const AppButton: React.FC<AppButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'standard',
  icon,
  iconRight,
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const height = size === 'cta'
    ? ControlHeight.cta
    : size === 'compact'
      ? ControlHeight.compact
      : ControlHeight.standard;

  const fontSize = size === 'cta'
    ? FontSize.titleSmall
    : size === 'compact'
      ? FontSize.bodySmall
      : FontSize.body;

  const lineHeight = size === 'cta'
    ? LineHeight.titleSmall
    : size === 'compact'
      ? LineHeight.bodySmall
      : LineHeight.body;

  // Variant-specific surface & border styling
  let backgroundColor: string = colors.mintGreen;
  let textColor: string = '#1A2B4C';
  let borderWidth: number = 0;
  let borderColor: string = 'transparent';

  switch (variant) {
    case 'primary':
      backgroundColor = colors.mintGreen;
      textColor = '#1A2B4C';
      break;
    case 'secondary':
      backgroundColor = colors.cardSubtle;
      textColor = colors.textPrimary;
      borderWidth = 1;
      borderColor = colors.borderSubtle;
      break;
    case 'outline':
      backgroundColor = 'transparent';
      textColor = colors.textPrimary;
      borderWidth = 1;
      borderColor = colors.border;
      break;
    case 'danger':
      backgroundColor = colors.danger;
      textColor = '#FFFFFF';
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      textColor = colors.textSecondary;
      break;
  }

  const effectiveOpacity = disabled ? 0.5 : 1;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled: disabled || loading }}
        testID={testID}
        style={[
          styles.buttonBase,
          {
            height,
            backgroundColor,
            borderColor,
            borderWidth,
            borderRadius: BorderRadius.pill,
            opacity: effectiveOpacity,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            {icon ? <Animated.View style={styles.iconLeft}>{icon}</Animated.View> : null}
            <Text
              style={[
                styles.labelBase,
                {
                  color: textColor,
                  fontSize,
                  lineHeight,
                },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {iconRight ? <Animated.View style={styles.iconRight}>{iconRight}</Animated.View> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minWidth: 64,
  },
  labelBase: {
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
