import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { Spacing, FontFamily } from '../config/theme';
import { supabase } from '../config/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

interface LogoPieceConfig {
  source: any;
  containerOffset: { left: number; top: number };
  imageOffset: { left: number; top: number };
  rotate: string;
  unrotate: string;
  translateProp: 'translateX' | 'translateY';
  translateFrom: number;
  scalePrimaryProp: 'scaleX' | 'scaleY';
  scaleSecondaryProp: 'scaleX' | 'scaleY';
}

const LOGO_PIECES: LogoPieceConfig[] = [
  {
    // Line 1: Top-Left slant (-29.5°)
    source: require('../../assets/logo_piece_1.png'),
    containerOffset: { left: -5.94, top: -13.35 },
    imageOffset: { left: 5.94, top: 13.35 },
    rotate: '-29.5deg',
    unrotate: '29.5deg',
    translateProp: 'translateY',
    translateFrom: -18.1,
    scalePrimaryProp: 'scaleY',
    scaleSecondaryProp: 'scaleX',
  },
  {
    // Line 2: Right slant (+29.6°)
    source: require('../../assets/logo_piece_2.png'),
    containerOffset: { left: 18.87, top: 10.26 },
    imageOffset: { left: -18.87, top: -10.26 },
    rotate: '29.6deg',
    unrotate: '-29.6deg',
    translateProp: 'translateY',
    translateFrom: -21.1,
    scalePrimaryProp: 'scaleY',
    scaleSecondaryProp: 'scaleX',
  },
  {
    // Line 3: Bottom curved base (-12.6°)
    source: require('../../assets/logo_piece_3.png'),
    containerOffset: { left: -13.74, top: 18.76 },
    imageOffset: { left: 13.74, top: -18.76 },
    rotate: '-12.6deg',
    unrotate: '12.6deg',
    translateProp: 'translateX',
    translateFrom: -21.4,
    scalePrimaryProp: 'scaleX',
    scaleSecondaryProp: 'scaleY',
  },
];

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { setSession } = useAuthStore();
  const { colors, isDark } = useTheme();
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);

  // Icon initial entrance & punch
  const iconEntranceScale = useRef(new Animated.Value(0.6)).current;
  const iconEntranceOpacity = useRef(new Animated.Value(0)).current;
  const iconPunch = useRef(new Animated.Value(1)).current;

  // 3 line creation / draw progress values (0 -> 1)
  const lineProgress = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Icon starts dead-center (brandRowX: 80 -> 0), "Arthik" emerges from inside/behind icon (wordmarkSlideX: -160 -> 0)
  const brandRowX = useRef(new Animated.Value(80)).current;
  const wordmarkSlideX = useRef(new Animated.Value(-160)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;

  // Tagline & dots animations
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(12)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  // Expanding Mint Circle for exit transition (bloom from centered icon)
  const exitCircleScale = useRef(new Animated.Value(1)).current;
  const exitCircleOpacity = useRef(new Animated.Value(0)).current;
  const contentFadeOpacity = useRef(new Animated.Value(1)).current;

  // Wave animation values for the 3 dots
  const dotAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Helper to pulse a single dot (0 -> 1 -> 0)
    const createDotPulse = (anim: Animated.Value) =>
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 260,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 260,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

    // Sequential wave animation for the 3 dots: 1st -> 2nd -> 3rd -> repeat
    const dotWaveLoop = Animated.loop(
      Animated.sequence([
        Animated.stagger(180, dotAnims.map(createDotPulse)),
        Animated.delay(260),
      ])
    );

    // Trigger return to center, then butter-smooth circular mint bloom from the centered icon, then navigate
    const triggerExitAndNavigate = (targetScreen: keyof RootStackParamList) => {
      dotWaveLoop.stop();

      Animated.sequence([
        // 1. Tagline and dots fade out quickly, icon glides back to center, wordmark retracts
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(dotsOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(brandRowX, {
            toValue: 80,
            duration: 440,
            easing: Easing.bezier(0.25, 1, 0.5, 1),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkSlideX, {
            toValue: -160,
            duration: 440,
            easing: Easing.bezier(0.25, 1, 0.5, 1),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkOpacity, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),

        // 2. Native driver pause (80ms) to clearly perceive the centered icon
        Animated.delay(80),

        // 3. Butter-smooth circular mint bloom expanding outward from the centered icon (gentle ease-in-out)
        Animated.parallel([
          Animated.timing(exitCircleOpacity, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(exitCircleScale, {
            toValue: 24,
            duration: 750,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(contentFadeOpacity, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),

        // 4. Brief hold (120ms) on solid mint green before destination cross-fade
        Animated.delay(120),
      ]).start(() => {
        navigation.replace(targetScreen as any);
      });
    };

    // 1. Entrance & Reveal Sequence
    Animated.sequence([
      // A. Center icon pops in with a smooth spring
      Animated.parallel([
        Animated.timing(iconEntranceOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(iconEntranceScale, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // B. The 3 navy lines draw smoothly in place along their angles
      Animated.stagger(
        120,
        lineProgress.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 280,
            easing: Easing.bezier(0.25, 1, 0.5, 1),
            useNativeDriver: true,
          })
        )
      ),

      // C. Tactile spring punch — lines lock firmly into place!
      Animated.sequence([
        Animated.timing(iconPunch, {
          toValue: 1.08,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(iconPunch, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // Appreciation pause with icon in center (160ms)
      Animated.delay(160),

      // D. THE UPLATA MOVE: Icon moves from center to left, and "Arthik" emerges from behind the icon
      Animated.parallel([
        Animated.timing(brandRowX, {
          toValue: 0,
          duration: 520,
          easing: Easing.bezier(0.2, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkSlideX, {
          toValue: 0,
          duration: 520,
          easing: Easing.bezier(0.2, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // E. Tagline "Apna kharcha, apna hisaab" fades and floats in smoothly
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslateY, {
          toValue: 0,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // F. Loading dots fade in
      Animated.timing(dotsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dotWaveLoop.start();
    });

    const initAuthAndNavigate = async () => {
      const startTime = Date.now();
      let nextScreen: keyof RootStackParamList = 'Onboarding';
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await setSession(session);

        if (session) {
          await Promise.all([fetchCategories(), fetchExpenses()]);
          nextScreen = 'AppTabs';
        } else {
          const hasSeen = await AsyncStorage.getItem('@arthik_has_seen_onboarding');
          if (hasSeen === 'true') {
            nextScreen = 'Auth';
          }
        }
      } catch (e) {
        if (__DEV__) console.error('Session retrieval error:', e);
      } finally {
        // Ample viewing time (~4.8s total) so dots have ~2.5s to pulse before returning to center
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 4800 - elapsed);
        exitTimerRef.current = setTimeout(() => {
          triggerExitAndNavigate(nextScreen);
        }, delay);
      }
    };

    initAuthAndNavigate();

    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      dotWaveLoop.stop();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Main Content wrapper */}
      <View style={styles.contentContainer}>
        {/* Brand Row: [Icon Anchor (Icon + Blooming Circle)] + [Emerging Wordmark] */}
        <Animated.View
          style={[
            styles.brandRow,
            {
              transform: [{ translateX: brandRowX }],
            },
          ]}
        >
          {/* Icon Anchor: anchors the expanding circle directly to the icon */}
          <View style={styles.iconAnchor}>
            {/* Expanding Mint Circle for Exit Transition: locked to the icon itself */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.exitCircle,
                {
                  backgroundColor: colors.mintGreen,
                  opacity: exitCircleOpacity,
                  transform: [{ scale: exitCircleScale }],
                },
              ]}
            />

            {/* Icon Container Card: Starts in dead center, slides left, returns to center */}
            <Animated.View
              style={[
                styles.iconCard,
                {
                  backgroundColor: colors.mintGreen,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: colors.borderSubtle,
                  transform: [{ scale: Animated.multiply(iconEntranceScale, iconPunch) }],
                },
              ]}
            >
              {/* Inner lines container scaled from 112 -> 80 (fades out as circle expands) */}
              <Animated.View style={[styles.linesScaleWrapper, { opacity: contentFadeOpacity }]}>
                {LOGO_PIECES.map((piece, i) => {
                  const progress = lineProgress[i];
                  const transform: any[] = [
                    { rotate: piece.rotate },
                    {
                      [piece.translateProp]: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [piece.translateFrom, 0],
                      }),
                    },
                    {
                      [piece.scalePrimaryProp]: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.01, 1],
                      }),
                    },
                    {
                      [piece.scaleSecondaryProp]: progress.interpolate({
                        inputRange: [0, 0.35, 1],
                        outputRange: [0.35, 1, 1],
                      }),
                    },
                    { rotate: piece.unrotate },
                  ];

                  return (
                    <Animated.View
                      key={i}
                      style={[
                        styles.pieceContainer,
                        piece.containerOffset,
                        {
                          opacity: progress.interpolate({
                            inputRange: [0, 0.08, 1],
                            outputRange: [0, 1, 1],
                          }),
                          transform,
                        },
                      ]}
                    >
                      <Image
                        source={piece.source}
                        style={[styles.pieceImage, piece.imageOffset]}
                        resizeMode="contain"
                      />
                    </Animated.View>
                  );
                })}
              </Animated.View>
            </Animated.View>
          </View>

          {/* Wordmark Mask: "Arthik" emerges from directly behind the right edge of the icon */}
          <View style={styles.wordmarkClipBox}>
            <Animated.View
              style={[
                styles.wordmarkInner,
                {
                  opacity: wordmarkOpacity,
                  transform: [{ translateX: wordmarkSlideX }],
                },
              ]}
            >
              <Animated.Text
                style={[
                  styles.appName,
                  {
                    color: colors.textPrimary,
                  },
                ]}
                numberOfLines={1}
              >
                Arthik
              </Animated.Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Tagline "Apna kharcha, apna hisaab" */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              color: colors.textSecondary,
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
          Apna kharcha, apna hisaab
        </Animated.Text>

        {/* Animated Sequential Dots (plenty of time to pulse) */}
        <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity }]}>
          {dotAnims.map((anim, index) => {
            const scale = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.35],
            });

            return (
              <View key={index} style={styles.dotWrapper}>
                {/* Inactive base dot */}
                <View
                  style={[
                    styles.dotBase,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.22)'
                        : 'rgba(26, 43, 76, 0.18)',
                    },
                  ]}
                />
                {/* Active green animated dot */}
                <Animated.View
                  style={[
                    styles.dotActive,
                    {
                      backgroundColor: isDark ? colors.mintGreen : colors.mintGreenDark,
                      opacity: anim,
                      transform: [{ scale }],
                    },
                  ]}
                />
              </View>
            );
          })}
        </Animated.View>
      </View>
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
    overflow: 'hidden',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 84,
    zIndex: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 84,
  },
  iconAnchor: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 3,
  },
  exitCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    zIndex: 10,
  },
  iconCard: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  linesScaleWrapper: {
    width: 112,
    height: 112,
    transform: [{ scale: 80 / 112 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceContainer: {
    position: 'absolute',
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceImage: {
    position: 'absolute',
    width: 112,
    height: 112,
  },
  wordmarkClipBox: {
    width: 160,
    height: 80,
    overflow: 'hidden',
    justifyContent: 'center',
    zIndex: 2,
  },
  wordmarkInner: {
    width: 160,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 44,
    color: '#1A2B4C',
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  tagline: {
    position: 'absolute',
    top: 96,
    fontSize: 17,
    color: '#8A8FA3',
    fontFamily: FontFamily.medium,
  },
  dotsContainer: {
    position: 'absolute',
    top: 138,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  dotWrapper: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dotBase: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
