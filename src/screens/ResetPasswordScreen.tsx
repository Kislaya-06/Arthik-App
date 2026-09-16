import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { ArrowLeft, KeyRound, Eye, EyeOff, AlertCircle, X, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

type AnimatedButtonProps = {
  onPress: () => void;
  style: any;
  disabled?: boolean;
  children: React.ReactNode;
};

const AnimatedButton: React.FC<AnimatedButtonProps> = ({ onPress, style, disabled, children }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() =>
        Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()
      }
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'password' | 'confirm' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorTranslateY = useRef(new Animated.Value(-10)).current;

  const showError = (msg: string) => {
    setErrorMessage(msg);
    errorTranslateY.setValue(-10);
    Animated.parallel([
      Animated.timing(errorOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(errorTranslateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (route.params?.initialError) {
      showError(route.params.initialError);
    }
  }, [route.params?.initialError]);

  const dismissError = () => {
    setErrorMessage(null);
    errorOpacity.setValue(0);
  };

  const handleUpdatePassword = async () => {
    if (loading) return;
    if (!password.trim()) {
      showError('Please enter a new password.');
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match. Please verify and try again.');
      return;
    }

    dismissError();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        let friendlyMsg = error.message;
        const lower = error.message.toLowerCase();
        if (lower.includes('should be different') || lower.includes('same password')) {
          friendlyMsg = 'New password cannot be the same as your old password.';
        } else if (lower.includes('session') || lower.includes('expired') || lower.includes('jwt')) {
          friendlyMsg = 'Password reset session has expired. Please request a new link from the login screen.';
        }
        showError(friendlyMsg);
        setLoading(false);
        return;
      }

      // Update session in store if available
      if (data?.user) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          await setSession(sessionData.session);
        }
      }

      setLoading(false);

      Alert.alert(
        'Password Reset Successful 🎉',
        'Your password has been updated successfully. You can now continue tracking your expenses.',
        [
          {
            text: 'Continue to App',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'AppTabs' }],
              });
            },
          },
        ],
        { cancelable: false }
      );
    } catch (e: any) {
      setLoading(false);
      showError(e?.message || 'Something went wrong while resetting password. Please try again.');
    }
  };

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header & Back Button */}
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Auth' }],
                  });
                }
              }}
              hitSlop={10}
            >
              <ArrowLeft size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
              Reset Password
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Key Icon Illustration */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.mint + '33', borderColor: colors.mint + '66' }]}>
              <KeyRound size={36} color={colors.textPrimary} />
            </View>
          </View>

          {/* Heading and description */}
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
            Set New Password
          </Text>
          <Text style={[styles.subtext, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
            Choose a strong password with at least 6 characters to secure your account.
          </Text>

          {/* In-UI Error Banner */}
          {errorMessage && (
            <Animated.View
              style={[
                styles.errorBanner,
                isDark && { backgroundColor: 'rgba(232, 112, 112, 0.15)', borderColor: 'rgba(232, 112, 112, 0.3)' },
                { opacity: errorOpacity, transform: [{ translateY: errorTranslateY }] },
              ]}
            >
              <AlertCircle size={18} color={colors.danger} style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={[styles.errorBannerText, { color: colors.danger, fontFamily: 'Quicksand_500Medium' }]}>
                {errorMessage}
              </Text>
              <Pressable onPress={dismissError} style={styles.errorBannerClose}>
                <X size={16} color={colors.danger} />
              </Pressable>
            </Animated.View>
          )}

          {/* Form */}
          <View style={styles.formContainer}>
            {/* New Password */}
            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>NEW PASSWORD</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'password' && { borderColor: colors.mint },
              ]}
            >
              <View style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.inputBg,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: colors.borderSubtle,
                }
              ]}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, fontFamily: 'Quicksand_500Medium', paddingRight: 44 }]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) dismissError();
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Confirm New Password */}
            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>CONFIRM NEW PASSWORD</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'confirm' && { borderColor: colors.mint },
              ]}
            >
              <View style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.inputBg,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: colors.borderSubtle,
                }
              ]}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, fontFamily: 'Quicksand_500Medium', paddingRight: 44 }]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.textTertiary}
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (errorMessage) dismissError();
                  }}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={8}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Password Match Indicator */}
            {password.length > 0 && confirmPassword.length > 0 && (
              <View style={styles.matchIndicatorRow}>
                {password === confirmPassword ? (
                  <>
                    <Check size={14} color={isDark ? colors.mintGreen : colors.mintDark} />
                    <Text style={[styles.matchTextSuccess, { color: isDark ? colors.mintGreen : colors.mintDark, fontFamily: 'Quicksand_500Medium' }]}>
                      Passwords match
                    </Text>
                  </>
                ) : (
                  <>
                    <X size={14} color={colors.danger} />
                    <Text style={[styles.matchTextError, { color: colors.danger, fontFamily: 'Quicksand_500Medium' }]}>
                      Passwords do not match yet
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Submit Button */}
            <AnimatedButton
              style={[
                styles.submitBtn,
                passwordsMatch
                  ? [styles.submitBtnActive, { backgroundColor: colors.mint }]
                  : [styles.submitBtnDisabled, { backgroundColor: colors.cardSubtle }],
                loading && styles.submitBtnLoading,
              ]}
              onPress={handleUpdatePassword}
              disabled={!passwordsMatch || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={passwordsMatch ? colors.forestGreen : colors.textPrimary} />
              ) : (
                <Text
                  style={[
                    styles.submitBtnText,
                    { fontFamily: 'Quicksand_700Bold' },
                    passwordsMatch ? { color: colors.forestGreen } : { color: colors.textTertiary },
                  ]}
                >
                  Update Password
                </Text>
              )}
            </AnimatedButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#1A2B4C',
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#B8E0C833',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B8E0C866',
  },
  heading: {
    fontSize: 28,
    color: '#1A2B4C',
    textAlign: 'center',
    marginTop: 16,
  },
  subtext: {
    fontSize: 15,
    color: '#8A8FA3',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  formContainer: {
    marginTop: 24,
  },
  label: {
    fontSize: 12,
    color: '#8A8FA3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  inputWrapper: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 18,
  },
  inputFocused: {
    borderColor: '#B8E0C8',
  },
  inputContainer: {
    backgroundColor: '#F1F2F5',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 56,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    fontSize: 16,
    color: '#1A2B4C',
    flex: 1,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  matchIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginLeft: 4,
  },
  matchTextSuccess: {
    fontSize: 13,
    color: '#4CAF50',
  },
  matchTextError: {
    fontSize: 13,
    color: '#E87070',
  },
  submitBtn: {
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  submitBtnActive: {
    backgroundColor: '#B8E0C8',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#E5E7ED',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnLoading: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: 18,
    color: '#1A2B4C',
  },
  submitBtnTextDisabled: {
    color: '#A8ADBD',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FACACA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
    gap: 4,
  },
  errorBannerText: {
    flex: 1,
    color: '#C0392B',
    fontSize: 14,
    lineHeight: 20,
  },
  errorBannerClose: {
    padding: 4,
    marginLeft: 4,
  },
});
