import React from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  TextInputProps,
} from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '../../store/themeStore';
import { ControlHeight, BorderRadius, FontSize, FontFamily, LineHeight, Spacing } from '../../config/theme';

export type InputVariant = 'standard' | 'search' | 'selector';

export interface AppInputProps extends Omit<TextInputProps, 'style'> {
  variant?: InputVariant;
  label?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  error?: string;
  onClear?: () => void;
  onPress?: () => void; // for 'selector' variant
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Standardized AppInput primitive for Arthik.
 * Enforces unified heights (56px standard/selector, 48px search),
 * 16px corner radius (stadium for search), and accessible contrast.
 */
export const AppInput: React.FC<AppInputProps> = ({
  variant = 'standard',
  label,
  icon,
  iconRight,
  error,
  onClear,
  onPress,
  value,
  placeholder,
  style,
  inputStyle,
  containerStyle,
  ...restProps
}) => {
  const { colors } = useTheme();

  const isSearch = variant === 'search';
  const isSelector = variant === 'selector';

  const height = isSearch ? ControlHeight.standard : ControlHeight.row;
  const borderRadius = isSearch ? BorderRadius.pill : BorderRadius.input;

  const content = (
    <View
      style={[
        styles.inputRow,
        {
          height,
          borderRadius,
          backgroundColor: isSelector ? colors.card : colors.inputBg,
          borderColor: error ? colors.danger : colors.borderSubtle,
          borderWidth: isSelector ? 1 : 0,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.iconPrefix}>{icon}</View> : null}

      {isSelector ? (
        <Text
          numberOfLines={1}
          style={[
            styles.selectorText,
            {
              color: value ? colors.textPrimary : colors.textTertiary,
              fontSize: FontSize.body,
              lineHeight: LineHeight.body,
            },
            inputStyle,
          ]}
        >
          {value || placeholder}
        </Text>
      ) : (
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.textInput,
            {
              color: colors.textPrimary,
              fontSize: FontSize.body,
              lineHeight: LineHeight.body,
            },
            inputStyle,
          ]}
          {...restProps}
        />
      )}

      {isSearch && value && onClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Clear text"
          style={styles.clearButton}
        >
          <X size={16} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      {isSelector ? (
        <View style={styles.iconSuffix}>
          {iconRight || <ChevronRight size={20} color={colors.textSecondary} />}
        </View>
      ) : iconRight ? (
        <View style={styles.iconSuffix}>{iconRight}</View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}

      {isSelector ? (
        <Pressable
          onPress={onPress}
          accessible
          accessibilityRole="button"
          accessibilityLabel={label || placeholder || 'Select option'}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    marginBottom: Spacing.element,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.block,
    width: '100%',
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    paddingVertical: 0,
    height: '100%',
  },
  selectorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
  },
  iconPrefix: {
    marginRight: Spacing.element,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconSuffix: {
    marginLeft: Spacing.element,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    padding: Spacing.micro,
    marginLeft: Spacing.micro,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    marginTop: Spacing.micro,
  },
});
