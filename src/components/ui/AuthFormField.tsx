import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardTypeOptions,
  ReturnKeyTypeOptions,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { ThemeColors, FontFamily, FontSize, Spacing, BorderRadius, ControlHeight } from '../../config/theme';

export interface AuthFormFieldProps {
  label: string;
  rightLabel?: React.ReactNode;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  isPassword?: boolean;
  showPassword?: boolean;
  onToggleShowPassword?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  colors: ThemeColors;
  isDark: boolean;
  editable?: boolean;
  errorText?: string | null;
  isError?: boolean;
}

export const AuthFormField: React.FC<AuthFormFieldProps> = ({
  label,
  rightLabel,
  value,
  onChangeText,
  placeholder,
  isFocused = false,
  onFocus,
  onBlur,
  isPassword = false,
  showPassword = false,
  onToggleShowPassword,
  autoCapitalize = 'none',
  keyboardType = 'default',
  returnKeyType = 'done',
  onSubmitEditing,
  colors,
  isDark,
  editable = true,
  errorText,
  isError,
}) => {
  const hasError = Boolean(isError || errorText);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
          {label}
        </Text>
        {rightLabel}
      </View>
      <View
        style={[
          styles.inputWrapper,
          isFocused && { borderColor: colors.mint },
          hasError && {
            borderColor: colors.coral,
            backgroundColor: isDark ? 'rgba(244, 184, 174, 0.15)' : '#FFF8F7',
          },
        ]}
      >
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: hasError
                ? (isDark ? 'rgba(244, 184, 174, 0.15)' : '#FFF8F7')
                : colors.inputBg,
              borderWidth: isDark ? 1 : 0,
              borderColor: hasError ? colors.coral : colors.borderSubtle,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                fontFamily: FontFamily.medium,
                paddingRight: isPassword ? 44 : Spacing.block,
              },
            ]}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            secureTextEntry={isPassword && !showPassword}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            editable={editable}
          />
          {isPassword && onToggleShowPassword ? (
            <Pressable
              style={styles.eyeIcon}
              onPress={onToggleShowPassword}
              hitSlop={8}
              accessible
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.textSecondary} />
              ) : (
                <Eye size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
      {errorText ? (
        <Text style={[styles.errorText, { color: colors.coral, fontFamily: FontFamily.medium }]}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.block,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.element,
  },
  label: {
    fontSize: FontSize.caption,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    borderRadius: BorderRadius.input,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputContainer: {
    height: ControlHeight.row,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.block,
    justifyContent: 'center',
    position: 'relative',
  },
  input: {
    fontSize: FontSize.body,
    height: '100%',
  },
  eyeIcon: {
    position: 'absolute',
    right: Spacing.block,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FontSize.caption,
    marginTop: 4,
  },
});
