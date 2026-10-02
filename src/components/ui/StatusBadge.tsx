import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { BorderRadius, FontSize, FontFamily, LineHeight, Spacing } from '../../config/theme';

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'gullak';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Standardized StatusBadge primitive for Arthik.
 * Enforces stadium pill geometry, 12px Quicksand_700Bold typography,
 * and semantic status tints across Light, Dark, and AMOLED themes.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}) => {
  const { colors, isDark } = useTheme();

  let backgroundColor = colors.cardSubtle;
  let textColor = colors.textSecondary;
  let borderColor = 'transparent';

  switch (variant) {
    case 'success':
      backgroundColor = colors.mintGreenSoft;
      textColor = isDark ? colors.mint : colors.forestGreen;
      break;
    case 'warning':
      backgroundColor = colors.peachSoft;
      textColor = isDark ? colors.coral : colors.peachCoral;
      break;
    case 'danger':
      backgroundColor = isDark ? 'rgba(248, 113, 113, 0.2)' : 'rgba(239, 68, 68, 0.12)';
      textColor = colors.danger;
      break;
    case 'gullak':
      backgroundColor = isDark ? 'rgba(173, 235, 179, 0.25)' : '#ADEBB3';
      textColor = isDark ? colors.mint : '#1A2B4C';
      borderColor = isDark ? 'rgba(173, 235, 179, 0.35)' : 'rgba(0, 0, 0, 0.08)';
      break;
    case 'neutral':
    default:
      backgroundColor = colors.cardSubtle;
      textColor = colors.textSecondary;
      break;
  }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel || `${label} status`}
      testID={testID}
      style={[
        styles.badgeBase,
        {
          backgroundColor,
          borderColor,
          borderWidth: borderColor !== 'transparent' ? 1 : 0,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text
        numberOfLines={1}
        style={[
          styles.labelText,
          {
            color: textColor,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.pill,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: Spacing.micro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    textAlign: 'center',
  },
});
