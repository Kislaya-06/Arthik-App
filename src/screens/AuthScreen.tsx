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
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { supabase, isMockMode } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { mockLogin } = useAuthStore();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const toggleMode = () => {
    const nextMode = mode === 'signup' ? 'login' : 'signup';

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

  const handleAuth = async () => {
    if (isMockMode) {
      // TODO: Supabase Integration - Remove mock login bypass when Supabase authentication is ready
      mockLogin(email || 'user@example.com', fullName || 'Developer');
      if (mode === 'signup') {
        navigation.navigate('ProfileSetup');
      } else {
        navigation.replace('AppTabs');
      }
      return;
    }

    if (mode === 'signup') {
      // TODO: Supabase Integration - signUp flow active when real credentials are set
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        alert(error.message);
      } else {
        navigation.navigate('ProfileSetup');
      }
    } else {
      // TODO: Supabase Integration - signInWithPassword flow active when real credentials are set
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert(error.message);
      } else {
        navigation.replace('AppTabs');
      }
    }
  };

  const handleGoogleAuth = async () => {
    // TODO: Supabase Integration - Implement full Google OAuth flow via Supabase when ready
    console.log('Google Auth pressed');
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
        >
          <Pressable style={[styles.backBtn, { marginTop: insets.top + 16 }]} onPress={() => navigation.goBack()}>
            <ArrowLeft size={26} color="#1A2B4C" />
          </Pressable>

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
                <Pressable onPress={() => console.log('Forgot Password pressed')}>
                  <Text style={styles.forgotPassword}>Forgot Password?</Text>
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
                style={[styles.btn, styles.primaryBtn]}
                onPress={handleAuth}
              >
                <Text style={styles.primaryBtnText}>
                  {isSignUp ? 'Sign Up' : 'Log In'}
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
});
