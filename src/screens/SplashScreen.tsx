import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Theme } from '../config/theme';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useExpenseStore } from '../store/expenseStore';
import { supabase } from '../config/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { setSession } = useAuthStore();
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);

  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(10)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.parallel([
      // Logo (opacity 0 -> 1, scale 0.8 -> 1) over 500ms
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      // Wordmark "Arthik" (starts 150ms after logo, opacity 0 -> 1, translateY 10 -> 0)
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkTranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Tagline (starts 300ms after logo, opacity 0 -> 1)
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Pagination dots (starts 450ms after logo, opacity 0 -> 1)
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(dotsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    let authSubscription: any = null;

    const initAuthAndNavigate = async () => {
      let nextScreen: keyof RootStackParamList = 'Onboarding';

      try {
        const { data: { session } } = await supabase.auth.getSession();
        await setSession(session);

        if (session) {
          await Promise.all([fetchCategories(), fetchExpenses()]);
          nextScreen = 'AppTabs';
        }
      } catch (e) {
        console.error('Session retrieval error:', e);
      }

      // Transition to next screen after 1.8 seconds
      setTimeout(() => {
        navigation.replace(nextScreen as any);
      }, 1800);
    };

    initAuthAndNavigate();
  }, []);

  return (
    <View style={styles.container}>
      {/* Decorative blurred background circles */}
      <View style={styles.bgCircleTop} />
      <View style={styles.bgCircleBottom} />

      {/* Main Logo Container */}
      <Animated.View
        style={[
          styles.logoImageContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image 
          source={require('../../assets/logo.png')} 
          style={{ width: 112, height: 112 }} 
          resizeMode="cover" 
        />
      </Animated.View>

      {/* Wordmark "Arthik" */}
      <Animated.Text
        style={[
          styles.appName,
          {
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkTranslateY }],
          },
        ]}
      >
        Arthik
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Apna kharcha, apna hisaab
      </Animated.Text>

      {/* Pagination Style Dots */}
      <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity }]}>
        <View style={[styles.dot, { backgroundColor: '#B8E0C8' }]} />
        <View style={[styles.dot, { backgroundColor: '#B8E0C8' }]} />
        <View style={[styles.dot, { backgroundColor: '#D8DCE3' }]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bgCircleTop: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#B8E0C8',
    opacity: 0.1,
    top: -50,
    left: -50,
  },
  bgCircleBottom: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#F4B8AE',
    opacity: 0.1,
    bottom: -50,
    right: -50,
  },
  logoImageContainer: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  appName: {
    fontSize: 54,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
    marginTop: 24,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 18,
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
    marginTop: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});


