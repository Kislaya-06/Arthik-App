import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { FontFamily, FontSize, LineHeight, Spacing } from '../../config/theme';
import { GradientIconBadge } from '../GradientIconBadge';
import { AppButton } from './AppButton';

/** Space above a full-page empty state that sits at the top of a scrolling list (History, Ledger, Review). */
export const EMPTY_STATE_TOP_OFFSET = 64;

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export interface EmptyStateProps {
  /** Lucide icon component shown inside the gradient badge. */
  icon: IconComponent;
  title: string;
  /** One short line that says what will appear here or what to do. */
  subtitle?: string;
  /** Optional next step. `primary` only when it is THE action of the screen (e.g. "Add Transaction"). */
  action?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' };
  /**
   * `screen`: the whole page is empty (72dp badge, 20px title).
   * `section`: one card or list inside a page is empty (56dp badge, 18px title).
   */
  size?: 'screen' | 'section';
  style?: StyleProp<ViewStyle>;
}

const ANATOMY = {
  screen: { badge: 72, icon: 32, title: FontSize.titleMedium, titleLine: LineHeight.titleMedium },
  section: { badge: 56, icon: 26, title: FontSize.titleSmall, titleLine: LineHeight.titleSmall },
} as const;

/**
 * The one empty state of the app (design-system §11): gradient icon badge, bold title, one muted line,
 * optional button. No motion of its own: a screen that animates its empty state wraps this in its own
 * animated view, so existing entrance animations stay exactly as they were.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, subtitle, action, size = 'screen', style }) => {
  const { colors, isDark } = useTheme();
  const a = ANATOMY[size];

  return (
    <View style={[styles.wrap, style]}>
      <GradientIconBadge size={a.badge} color={colors.mint} isDark={isDark}>
        {({ iconColor }) => <Icon size={a.icon} color={iconColor} strokeWidth={2.2} />}
      </GradientIconBadge>
      <Text style={[styles.title, { fontSize: a.title, lineHeight: a.titleLine, color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      {action ? (
        <AppButton
          label={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'secondary'}
          size="compact"
          style={styles.action}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: Spacing.block,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: Spacing.element,
    maxWidth: 300,
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.block,
  },
});

export default EmptyState;
