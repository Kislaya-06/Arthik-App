import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { GradientIconBadge } from './GradientIconBadge';

export interface BehavioralInsightRowProps {
  icon: React.FC<{ size: number; color: string; strokeWidth?: number }>;
  badgeColor: string;
  title: string;
  headline: string;
  detail: string;
  pillText?: string | null;
  pillColor?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const BehavioralInsightRow: React.FC<BehavioralInsightRowProps> = ({
  icon: Icon,
  badgeColor,
  title,
  headline,
  detail,
  pillText,
  pillColor,
  onPress,
  accessibilityLabel,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: isDark ? 1 : 0,
          opacity: pressed && onPress ? 0.8 : 1,
        },
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={accessibilityLabel || `${title}: ${headline}. ${detail}`}
    >
      {/* Icon Badge */}
      <GradientIconBadge size={44} color={badgeColor} isDark={isDark}>
        {({ iconColor }) => <Icon size={20} color={iconColor} strokeWidth={2.2} />}
      </GradientIconBadge>

      {/* Center text content */}
      <View style={styles.textWrapper}>
        <Text
          style={[styles.title, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[styles.headline, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
          numberOfLines={1}
        >
          {headline}
        </Text>
        <Text
          style={[styles.detail, { color: colors.textMuted, fontFamily: FontFamily.medium }]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>

      {/* Right pill badge */}
      {!!pillText && (
        <View
          style={[
            styles.pill,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.cardSubtle,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              {
                color: pillColor || colors.textSecondary,
                fontFamily: FontFamily.bold,
              },
            ]}
            numberOfLines={1}
          >
            {pillText}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: BorderRadius.card, // 20
    marginBottom: Spacing.group, // 12
    gap: Spacing.group, // 12
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  textWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  headline: {
    fontSize: FontSize.bodySmall, // 14
    lineHeight: 19,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 11,
  },
});
