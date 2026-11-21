import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, LayoutChangeEvent } from 'react-native';
import { useTheme } from '../../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, ControlHeight } from '../../config/theme';
import { PressableOpacity } from './PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';

/** Icon slot of a form row: a plain 20px line icon, no tile (a tile per row made the card read like a settings page). */
export const FORM_ROW_ICON = 24;
/** Hairline dividers start under the row title (iOS inset grouped list), not at the card edge. */
const DIVIDER_INSET = Spacing.block + FORM_ROW_ICON + Spacing.group;

export interface FormGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * One inset grouped card of form rows (Add Transaction). Rows are separated by hairline dividers that start under the
 * title; there is no divider under the last row. `false` / `null` children are skipped, so a hidden row leaves no gap.
 */
export const FormGroup: React.FC<FormGroupProps> = ({ children, style, onLayout }) => {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children);
  return (
    <View
      onLayout={onLayout}
      style={[styles.group, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, style]}
    >
      {rows.map((row, i) => (
        <React.Fragment key={(row as any).key ?? i}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
};

export interface FormRowProps {
  /** Lucide icon component (drawn 20px in the 24dp slot). */
  icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Icon colour; defaults to textSecondary (pass an accent when the row is ON). */
  iconColor?: string;
  title?: string;
  subtitle?: string;
  /** Right side of the header line: a value, a switch, a counter. */
  right?: React.ReactNode;
  /** Replaces the title / subtitle block (the note row puts its text field here). */
  middle?: React.ReactNode;
  /** Content under the header line, full row width (segmented choices, the split editor). */
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  accessibilityRole?: 'button' | 'switch';
  accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean; disabled?: boolean };
}

/** A row inside a FormGroup (56dp minimum): line icon, title (+ subtitle), right accessory, optional content below. */
export const FormRow: React.FC<FormRowProps> = ({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  right,
  middle,
  children,
  onPress,
  disabled,
  onLayout,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}) => {
  const { colors } = useTheme();

  const header = (
    <View style={styles.header}>
      <View style={styles.iconSlot}>
        <Icon size={20} color={iconColor ?? colors.textSecondary} />
      </View>
      {middle ?? (
        <View style={styles.titleBlock}>
          {title ? (
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
      )}
      {right}
    </View>
  );

  return (
    <View onLayout={onLayout}>
      {onPress ? (
        <PressableOpacity
          activeOpacity={PRESS_DIM_OPACITY}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole={accessibilityRole ?? 'button'}
          accessibilityLabel={accessibilityLabel ?? title}
          accessibilityState={accessibilityState}
        >
          {header}
        </PressableOpacity>
      ) : (
        header
      )}
      {children ? <View style={styles.below}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  group: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: Spacing.gutter,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: DIVIDER_INSET,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ControlHeight.row,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.group,
    gap: Spacing.group,
  },
  iconSlot: {
    width: FORM_ROW_ICON,
    height: FORM_ROW_ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontFamily: FontFamily.semibold,
  },
  subtitle: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.nano,
  },
  below: {
    paddingHorizontal: Spacing.block,
    paddingBottom: Spacing.block,
    gap: Spacing.group,
  },
});
