import React, { useState, useRef } from 'react';
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
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { AlertCircle, ArrowLeft, Eye, EyeOff, X } from 'lucide-react-native';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

// --- AnimatedButton must be defined OUTSIDE the screen component to obey React's Rules of Hooks ---
type AnimatedButtonProps = {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
};

const AnimatedButton: React.FC<AnimatedButtonProps> = ({ onPress, style, children }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
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

// --- Main Screen ---
export const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorTranslateY = useRef(new Animated.Value(-12)).current;

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const toggleMode = () => {
    const nextMode = mode === 'signup' ? 'login' : 'signup';
    setErrorMessage(null);
    errorOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(translateYAnim, { toValue: -10, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setMode(nextMode);
      translateYAnim.setValue(10);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateYAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const showError = (msg: string) => {
    setSuccessMessage(null);
    setErrorMessage(msg);
    errorTranslateY.setValue(-12);
    Animated.parallel([
      Animated.timing(errorOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(errorTranslateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const showSuccess = (msg: string) => {
    setErrorMessage(null);
    setSuccessMessage(msg);
    errorTranslateY.setValue(-12);
    Animated.parallel([
      Animated.timing(errorOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(errorTranslateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const dismissError = () => {
    Animated.timing(errorOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setErrorMessage(null);
      setSuccessMessage(null);
    });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showError('Please enter your email address first, then tap Forgot Password.');
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'arthik://reset-password',
    });
    setForgotLoading(false);
    if (error) {
      showError(error.message);
    } else {
      showSuccess(`Password reset link sent to ${email}. Check your inbox!`);
    }
  };

  // Maps raw Supabase/API error messages to friendly, readable messages
  const getFriendlyError = (message: string, currentMode: 'login' | 'signup'): string => {
    const msg = message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
      return "No account found with this email, or the password is incorrect. Please check your details or sign up first.";
    }
    if (msg.includes('email not confirmed')) {
      return "Please verify your email address before logging in. Check your inbox for a confirmation link.";
    }
    if (msg.includes('user already registered') || msg.includes('already been registered')) {
      return "This email is already registered. Try logging in instead.";
    }
    if (msg.includes('password should be at least')) {
      return "Password must be at least 6 characters long.";
    }
    if (msg.includes('unable to validate email address') || msg.includes('invalid email')) {
      return "Please enter a valid email address.";
    }
    if (msg.includes('email rate limit') || msg.includes('too many requests')) {
      return "Too many attempts. Please wait a moment before trying again.";
    }
    if (msg.includes('missing email or phone')) {
      return "Please enter your email address.";
    }
    return message; // fallback to raw message
  };

  const handleAuth = async () => {
    // Client-side validation first
    if (!email.trim()) {
      showError("Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      showError("Please enter your password.");
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      showError("Please enter your full name.");
      return;
    }

    setAuthLoading(true);
    dismissError();

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        showError(getFriendlyError(error.message, 'signup'));
      } else {
        navigation.navigate('ProfileSetup');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showError(getFriendlyError(error.message, 'login'));
      } else {
        navigation.replace('AppTabs');
      }
    }
    setAuthLoading(false);
  };


  const handleGoogleAuth = async () => {
    try {
      const redirectTo = makeRedirectUri();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (result.type === 'success') {
          // Supabase returns the token as a URL hash fragment, we convert it to query for easy parsing
          const urlWithQuery = result.url.replace('#', '?');
          const parsed = Linking.parse(urlWithQuery);

          const accessToken = parsed.queryParams?.access_token as string;
          const refreshToken = parsed.queryParams?.refresh_token as string;

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) throw sessionError;

            // Check if profile exists and has a first name
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user?.id)
              .single();

            if (!profile || !profile.first_name) {
              navigation.navigate('ProfileSetup');
            } else {
              navigation.replace('AppTabs');
            }
          }
        }
      }
    } catch (e: any) {
        showError(e.message || 'Error with Google Authentication');
      }
    };

  const isSignUp = mode === 'signup';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={[styles.backBtn, { marginTop: insets.top + 16 }]} onPress={() => navigation.goBack()}>
            <ArrowLeft size={26} color="#1A2B4C" />
          </Pressable>

          {/* In-UI Message Banner (error or success) */}
          {(errorMessage || successMessage) && (
            <Animated.View
              style={[
                styles.errorBanner,
                successMessage && styles.successBanner,
                { opacity: errorOpacity, transform: [{ translateY: errorTranslateY }] },
              ]}
            >
              <AlertCircle size={18} color={successMessage ? '#4CAF50' : '#E87070'} style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={[styles.errorBannerText, successMessage && styles.successBannerText]} numberOfLines={4}>
                {successMessage || errorMessage}
              </Text>
              <Pressable onPress={dismissError} style={styles.errorBannerClose}>
                <X size={16} color={successMessage ? '#4CAF50' : '#E87070'} />
              </Pressable>
            </Animated.View>
          )}

          <Animated.View
            style={{ opacity: opacityAnim, transform: [{ translateY: translateYAnim }] }}
          >
            <Text style={styles.heading}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.subtext}>
              {isSignUp ? 'Start your expense journey' : 'Log in to continue tracking'}
            </Text>

            <View style={styles.formContainer}>
              {isSignUp && (
                <>
                  <Text style={styles.label}>FULL NAME</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedField === 'name' && styles.inputFocused,
                    ]}
                  >
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="Your name"
                        placeholderTextColor="#A8ADBD"
                        value={fullName}
                        onChangeText={setFullName}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                </>
              )}

              <Text style={styles.label}>EMAIL</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputFocused,
                ]}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#A8ADBD"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <Text style={styles.label}>PASSWORD</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputFocused,
                ]}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { paddingRight: 44 }]}
                    placeholder={isSignUp ? 'Create a password' : 'Enter password'}
                    placeholderTextColor="#A8ADBD"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#8A8FA3" />
                    ) : (
                      <Eye size={20} color="#8A8FA3" />
                    )}
                  </Pressable>
                </View>
              </View>

              {!isSignUp && (
                <Pressable onPress={forgotLoading ? undefined : handleForgotPassword}>
                  <Text style={styles.forgotPassword}>
                    {forgotLoading ? 'Sending...' : 'Forgot Password?'}
                  </Text>
                </Pressable>
              )}

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <AnimatedButton
                style={[styles.btn, styles.googleBtn]}
                onPress={handleGoogleAuth}
              >
                <Image
                  source={require('../../assets/google.png')}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </AnimatedButton>

              <AnimatedButton
                style={[styles.btn, styles.primaryBtn, authLoading && styles.primaryBtnLoading]}
                onPress={handleAuth}
              >
                <Text style={styles.primaryBtnText}>
                  {authLoading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Log In')}
                </Text>
              </AnimatedButton>
            </View>
          </Animated.View>

          <Pressable onPress={toggleMode} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : 'New here? '}
              <Text style={styles.toggleTextBold}>
                {isSignUp ? 'Log in' : 'Sign up'}
              </Text>
            </Text>
          </Pressable>
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
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 36,
    marginTop: 32,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  subtext: {
    fontSize: 16,
    marginTop: 8,
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
  },
  formContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    marginTop: 24,
    marginBottom: 8,
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontFamily: 'Quicksand_500Medium',
    flex: 1,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  forgotPassword: {
    textAlign: 'right',
    marginTop: 8,
    color: '#7FBF9E',
    fontSize: 14,
    fontFamily: 'Quicksand_700Bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E2E8',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#8A8FA3',
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
  },
  btn: {
    width: '100%',
    borderRadius: 9999,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E8E9ED',
  },
  googleBtnText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  primaryBtn: {
    backgroundColor: '#B8E0C8',
    marginTop: 16,
  },
  primaryBtnText: {
    fontSize: 18,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  toggleBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  toggleText: {
    color: '#8A8FA3',
    fontSize: 16,
    fontFamily: 'Quicksand_500Medium',
    textAlign: 'center',
  },
  toggleTextBold: {
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FACACAC',
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
    fontFamily: 'Quicksand_500Medium',
    lineHeight: 20,
  },
  errorBannerClose: {
    padding: 4,
    marginLeft: 4,
  },
  successBanner: {
    backgroundColor: '#F0FFF4',
    borderColor: '#C3E6CB',
  },
  successBannerText: {
    color: '#276749',
  },
  primaryBtnLoading: {
    opacity: 0.6,
  },
});
