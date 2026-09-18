import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { useTheme } from '../store/themeStore';
import { IndianRupee, Sparkles, Check } from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

// --- SLIDE 1 ILLUSTRATION ---
const Slide1Illustration = ({ isDark, colors }: { isDark: boolean; colors: any }) => (
  <View style={styles.illContainer}>
    {/* Concentric Circles */}
    <View style={[styles.circleOuter, { opacity: isDark ? 0.12 : 0.2 }]} />
    <View style={[styles.circleMiddle, { opacity: isDark ? 0.25 : 0.4 }]} />
    <View style={styles.circleInner}>
      <IndianRupee size={32} color="#1A2B4C" />
    </View>

    {/* Sparkles */}
    <View style={[styles.absolutePos, { top: 10, left: 10 }]}>
      <Sparkles size={16} color="#B8E0C8" />
    </View>
    <View style={[styles.absolutePos, { top: 20, right: 20 }]}>
      <Sparkles size={14} color="#F4B8AE" />
    </View>

    {/* Dots */}
    <View style={[styles.dotAccent, { bottom: 30, right: 30, backgroundColor: '#F4B8AE' }]} />
    <View style={[styles.dotAccent, { bottom: 40, left: 20, backgroundColor: '#B8E0C8' }]} />

    {/* Rupee Badges */}
    <View style={[styles.rupeeBadge, { bottom: 45, left: -10, backgroundColor: colors.card }]}>
      <Text style={[styles.rupeeBadgeText, { color: colors.textPrimary }]}>₹</Text>
    </View>
    <View style={[styles.rupeeBadge, { bottom: 20, right: -10, backgroundColor: colors.card }]}>
      <Text style={[styles.rupeeBadgeText, { color: colors.textPrimary }]}>₹</Text>
    </View>
  </View>
);

// --- SLIDE 2 ILLUSTRATION ---
const Slide2Illustration = ({ colors }: { colors: any }) => {
  const size = 150;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Segments: Food (38%), Travel (27%), Shopping (20%), Other (15%)
  const segments = [
    { percentage: 0.38, color: '#B8E0C8' },
    { percentage: 0.27, color: '#F4B8AE' },
    { percentage: 0.20, color: '#F5D98B' },
    { percentage: 0.15, color: '#C9B8E8' },
  ];

  let accumulatedPercent = 0;

  return (
    <View style={styles.donutWrapper}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {segments.map((segment, index) => {
            const strokeDashoffset = circumference - circumference * segment.percentage;
            const rotationAngle = accumulatedPercent * 360;
            accumulatedPercent += segment.percentage;

            return (
              <Circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                fill="transparent"
                rotation={rotationAngle}
                origin={`${size / 2}, ${size / 2}`}
              />
            );
          })}
        </G>
      </Svg>
      {/* Inner circle with Rupee icon */}
      <View style={[styles.donutCenter, { backgroundColor: colors.card }]}>
        <IndianRupee size={22} color={colors.textPrimary} />
      </View>
    </View>
  );
};

// --- SLIDE 2 LEGEND ---
const Slide2Legend = ({ colors }: { colors: any }) => (
  <View style={styles.legendContainer}>
    <View style={styles.legendCol}>
      <View style={styles.legendRow}>
        <View style={styles.legendLeft}>
          <View style={[styles.legendDot, { backgroundColor: '#B8E0C8' }]} />
          <Text style={[styles.legendText, { color: colors.textPrimary }]} numberOfLines={1}>Food</Text>
        </View>
        <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>38%</Text>
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendLeft}>
          <View style={[styles.legendDot, { backgroundColor: '#F5D98B' }]} />
          <Text style={[styles.legendText, { color: colors.textPrimary }]} numberOfLines={1}>Shopping</Text>
        </View>
        <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>20%</Text>
      </View>
    </View>
    <View style={styles.legendCol}>
      <View style={styles.legendRow}>
        <View style={styles.legendLeft}>
          <View style={[styles.legendDot, { backgroundColor: '#F4B8AE' }]} />
          <Text style={[styles.legendText, { color: colors.textPrimary }]} numberOfLines={1}>Travel</Text>
        </View>
        <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>27%</Text>
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendLeft}>
          <View style={[styles.legendDot, { backgroundColor: '#C9B8E8' }]} />
          <Text style={[styles.legendText, { color: colors.textPrimary }]} numberOfLines={1}>Other</Text>
        </View>
        <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>15%</Text>
      </View>
    </View>
  </View>
);

// --- SLIDE 3 ILLUSTRATION ---
const Slide3Illustration = ({ isDark, colors }: { isDark: boolean; colors: any }) => (
  <View style={styles.illContainer}>
    {/* Concentric Circles */}
    <View style={[styles.circleOuterSlide3, { opacity: isDark ? 0.15 : 0.25 }]} />
    <View style={styles.circleInnerSlide3}>
      <Check size={48} color="#1A2B4C" strokeWidth={3} />
    </View>

    {/* Bubble shapes */}
    <View style={[styles.bubbleCard, { top: 30, left: -10, backgroundColor: colors.card }]}>
      <View style={[styles.bubbleLine, { width: 24, backgroundColor: '#EF4444' }]} />
      <View style={[styles.bubbleLine, { backgroundColor: colors.borderSubtle }]} />
    </View>

    <View style={[styles.bubbleCard, { top: 25, right: -10, width: 40, backgroundColor: colors.card }]}>
      <View style={[styles.bubbleLine, { width: 20, backgroundColor: '#10B981' }]} />
      <View style={[styles.bubbleLine, { backgroundColor: colors.borderSubtle }]} />
    </View>

    <View style={[styles.bubbleCard, { bottom: 35, left: -5, backgroundColor: colors.card }]}>
      <View style={[styles.bubbleLine, { width: 16, backgroundColor: '#FCD34D' }]} />
      <View style={[styles.bubbleLine, { backgroundColor: colors.borderSubtle }]} />
    </View>

    {/* Sparkle & Dot */}
    <View style={[styles.absolutePos, { top: 15, right: 30 }]}>
      <Sparkles size={14} color="#F4B8AE" />
    </View>
    <View style={[styles.dotAccent, { bottom: 25, right: 20, backgroundColor: '#F4B8AE' }]} />
  </View>
);

const Slide2Combined = ({ colors }: { colors: any }) => (
  <View style={styles.slide2Wrapper}>
    <Slide2Illustration colors={colors} />
    <Slide2Legend colors={colors} />
  </View>
);

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { colors, isDark } = useTheme();

  const flatListRef = useRef<FlatList>(null);
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const slides = [
    {
      title: 'Track Every Rupee',
      subtitle: 'Log your daily expenses in seconds',
      illustration: <Slide1Illustration isDark={isDark} colors={colors} />,
      showSkip: true,
      buttonLabel: 'Next',
    },
    {
      title: 'See Where It Goes',
      subtitle: 'Understand your spending with clear insights',
      illustration: <Slide2Combined colors={colors} />,
      showSkip: true,
      buttonLabel: 'Next',
    },
    {
      title: 'Simple. Fast. Yours.',
      subtitle: 'Start your journey to smarter spending',
      illustration: <Slide3Illustration isDark={isDark} colors={colors} />,
      showSkip: false,
      buttonLabel: 'Get Started',
    },
  ];

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@arthik_has_seen_onboarding', 'true');
    } catch {}
    navigation.replace('Auth');
  };

  const handlePressNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      finishOnboarding();
    }
  };

  const handlePressSkip = () => {
    finishOnboarding();
  };

  const currentSlide = slides[currentIndex];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Skip Button */}
      {currentSlide.showSkip && (
        <TouchableOpacity style={[styles.skipButton, { top: insets.top + Spacing.block }]} onPress={handlePressSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Main content Area (FlatList Swipe) */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={[styles.content, { width, paddingBottom: Math.max(insets.bottom, Spacing.block) + 140 }]}>
            <View style={styles.illustrationWrapper}>
              {item.illustration}
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Bottom Controls (Footer) */}
      <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.block }]}>
        {/* Pagination indicators */}
        <View style={styles.paginationRow}>
          {slides.map((_, index) => {
            const isActive = index === currentIndex;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.activeDot, { backgroundColor: colors.mint }]
                    : [
                        styles.inactiveDot,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.35)'
                            : 'rgba(26, 43, 76, 0.22)',
                        },
                      ],
                ]}
              />
            );
          })}
        </View>

        {/* CTA Action Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.mint }]}
          onPress={handlePressNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: colors.forestGreen }]}>{currentSlide.buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    position: 'relative',
  },
  skipButton: {
    position: 'absolute',
    right: Spacing.gutter,
    zIndex: 10,
  },
  skipText: {
    fontSize: FontSize.body,
    color: '#8A8FA3',
    fontFamily: FontFamily.semibold,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  illustrationWrapper: {
    width: '100%',
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: FontSize.screenTitle,
    color: '#1A2B4C',
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 18,
    color: '#8A8FA3',
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    paddingHorizontal: Spacing.section,
    marginTop: Spacing.group,
    lineHeight: 26,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.gutter,
    alignItems: 'center',
    zIndex: 10,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.section,
  },
  dot: {
    marginHorizontal: 5,
  },
  activeDot: {
    width: 28,
    height: 8,
    borderRadius: 4,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  button: {
    width: '100%',
    borderRadius: BorderRadius.pill,
    backgroundColor: '#B8E0C8',
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonText: {
    fontSize: FontSize.cta,
    color: '#1A2B4C',
    fontFamily: FontFamily.bold,
  },
  // Custom Illustrations
  illContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circleOuter: {
    position: 'absolute',
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: '#B8E0C8',
    opacity: 0.2,
  },
  circleMiddle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#B8E0C8',
    opacity: 0.4,
  },
  circleInner: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#B8E0C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  absolutePos: {
    position: 'absolute',
  },
  dotAccent: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rupeeBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rupeeBadgeText: {
    fontSize: FontSize.caption,
    color: '#1A2B4C',
    fontFamily: FontFamily.bold,
  },
  // Slide 2 Specifics
  slide2Wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  donutWrapper: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 290,
    marginTop: Spacing.block,
    paddingHorizontal: Spacing.element,
  },
  legendCol: {
    flex: 1,
    paddingHorizontal: Spacing.element,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.micro,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: Spacing.element,
  },
  legendText: {
    fontSize: FontSize.bodySmall,
    color: '#1A2B4C',
    fontFamily: FontFamily.semibold,
  },
  legendPercent: {
    fontSize: FontSize.bodySmall,
    color: '#8A8FA3',
    fontFamily: FontFamily.medium,
  },
  // Slide 3 Specifics
  circleOuterSlide3: {
    position: 'absolute',
    width: 208,
    height: 208,
    borderRadius: 104,
    backgroundColor: '#B8E0C8',
    opacity: 0.25,
  },
  circleInnerSlide3: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: '#B8E0C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleCard: {
    position: 'absolute',
    width: 48,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleLine: {
    height: 2,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
    marginVertical: 1,
  },
});


