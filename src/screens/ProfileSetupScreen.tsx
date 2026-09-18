import React, { useRef, useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { ArrowLeft, ArrowRight, Camera, User } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCategoryStore } from '../store/categoryStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

// AnimatedButton defined outside to obey React's Rules of Hooks
type AnimatedButtonProps = {
  onPress: () => void;
  style?: any;
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

export const ProfileSetupScreen: React.FC<Props> = ({ navigation }) => {
  const { updateProfile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleAvatarPress = () => {
    // TODO: Supabase Integration - Integrate expo-image-picker here to allow avatar upload to Supabase Storage
    if (__DEV__) console.log('Avatar picker pressed');
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!firstName.trim()) {
      setFirstNameError(true);
      return;
    }
    setFirstNameError(false);
    setLoading(true);

    try {
      // TODO: Supabase Integration - updateProfile saves first_name/last_name to Supabase profiles table when real credentials are set
      await updateProfile(firstName.trim(), lastName.trim());

      await Promise.all([fetchCategories(), fetchExpenses()]);

      navigation.reset({
        index: 0,
        routes: [{ name: 'AppTabs' }],
      });
    } catch (e) {
      if (__DEV__) console.error('Profile update error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.gutter }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back arrow */}
          <Pressable style={[styles.backBtn, { marginTop: Spacing.block }]} onPress={() => navigation.goBack()}>
            <ArrowLeft size={26} color={colors.textPrimary} />
          </Pressable>

          {/* Progress Row */}
          <View style={styles.progressRow}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>PROFILE SETUP</Text>
            <Text style={[styles.progressStep, { color: colors.mintDark }]}>Step 1 of 1</Text>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBarBg, { backgroundColor: colors.borderSubtle }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.mint }]} />
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={handleAvatarPress} style={styles.avatarWrapper}>
              <View style={[
                styles.avatarOuter, 
                { 
                  backgroundColor: colors.cardSubtle,
                  borderColor: isDark ? colors.card : '#FFFFFF'
                }
              ]}>
                <User size={48} color={colors.textTertiary} />
              </View>
              <View style={[
                styles.cameraBadge, 
                { 
                  backgroundColor: colors.mint,
                  borderColor: isDark ? colors.card : '#FFFFFF'
                }
              ]}>
                <Camera size={16} color={colors.forestGreen} />
              </View>
            </Pressable>
          </View>

          {/* Heading */}
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Tell us about you</Text>
          <Text style={[styles.subtext, { color: colors.textSecondary }]}>This helps personalise your experience</Text>

          {/* First Name */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>FIRST NAME</Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: colors.inputBg,
                borderWidth: isDark ? 1 : 2,
                borderColor: isDark ? colors.borderSubtle : 'transparent',
              },
              focusedField === 'firstName' && { borderColor: colors.mint },
              firstNameError && [styles.inputError, { borderColor: colors.coral, backgroundColor: isDark ? 'rgba(244, 184, 174, 0.15)' : '#FFF8F7' }],
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="First Name"
              placeholderTextColor={colors.textTertiary}
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                if (t.trim()) setFirstNameError(false);
              }}
              onFocus={() => setFocusedField('firstName')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
          {firstNameError && (
            <Text style={[styles.errorText, { color: colors.coral }]}>First name is required</Text>
          )}

          {/* Last Name */}
          <View style={styles.lastNameLabelRow}>
            <Text style={[styles.rowLabelText, { color: colors.textSecondary }]}>LAST NAME</Text>
            <View style={[styles.optionalBadge, { backgroundColor: isDark ? 'rgba(184, 224, 200, 0.15)' : '#E8F5EC' }]}>
              <Text style={[styles.optionalBadgeText, { color: colors.mintDark }]}>Optional</Text>
            </View>
          </View>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: colors.inputBg,
                borderWidth: isDark ? 1 : 2,
                borderColor: isDark ? colors.borderSubtle : 'transparent',
              },
              focusedField === 'lastName' && { borderColor: colors.mint },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Last Name (optional)"
              placeholderTextColor={colors.textTertiary}
              value={lastName}
              onChangeText={setLastName}
              onFocus={() => setFocusedField('lastName')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {/* CTA Button */}
          <View style={styles.ctaContainer}>
            <AnimatedButton
              disabled={loading}
              style={[
                styles.ctaBtn,
                { backgroundColor: colors.mint, opacity: loading ? 0.7 : 1 }
              ]}
              onPress={handleSubmit}
            >
              <Text style={[styles.ctaBtnText, { color: colors.forestGreen }]}>
                {loading ? 'Saving...' : "Let's Go"}
              </Text>
              {!loading && <ArrowRight size={20} color={colors.forestGreen} style={{ marginLeft: Spacing.element }} />}
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
    paddingHorizontal: Spacing.gutter,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },

  // Progress
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.section,
  },
  progressLabel: {
    fontSize: FontSize.caption,
    color: '#8A8FA3',
    letterSpacing: 0.8,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
  },
  progressStep: {
    fontSize: FontSize.caption,
    color: '#7FBF9E',
    fontFamily: FontFamily.bold,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E2E8',
    marginTop: Spacing.group,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#B8E0C8',
    width: '100%',
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginTop: Spacing.gutter,
  },
  avatarWrapper: {
    position: 'relative',
    width: 112,
    height: 112,
  },
  avatarOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#E5E7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#B8E0C8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Heading
  heading: {
    fontSize: 28,
    color: '#1A2B4C',
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginTop: Spacing.gutter,
  },
  subtext: {
    fontSize: FontSize.body,
    color: '#8A8FA3',
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    marginTop: Spacing.element,
  },

  // Inputs
  label: {
    fontSize: FontSize.caption,
    marginTop: Spacing.gutter,
    marginBottom: Spacing.element,
    color: '#8A8FA3',
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastNameLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  rowLabelText: {
    fontSize: FontSize.caption,
    color: '#8A8FA3',
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionalBadge: {
    backgroundColor: '#E8F5EC',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.group,
    paddingVertical: Spacing.micro,
  },
  optionalBadgeText: {
    fontSize: FontSize.caption,
    color: '#7FBF9E',
    fontFamily: FontFamily.bold,
  },
  inputWrapper: {
    backgroundColor: '#F1F2F5',
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.surface,
    height: ControlHeight.row,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: '#B8E0C8',
  },
  inputError: {
    borderColor: '#F4B8AE',
    backgroundColor: '#FFF8F7',
  },
  input: {
    fontSize: FontSize.body,
    color: '#1A2B4C',
    fontFamily: FontFamily.medium,
  },
  errorText: {
    fontSize: FontSize.caption,
    color: '#E87070',
    fontFamily: FontFamily.medium,
    marginTop: 6,
    marginLeft: Spacing.micro,
  },

  // CTA
  ctaContainer: {
    marginTop: 'auto',
    paddingTop: Spacing.section,
  },
  ctaBtn: {
    borderRadius: BorderRadius.pill,
    backgroundColor: '#B8E0C8',
    paddingVertical: Spacing.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ctaBtnText: {
    fontSize: 18,
    color: '#1A2B4C',
    fontFamily: FontFamily.bold,
  },
});
