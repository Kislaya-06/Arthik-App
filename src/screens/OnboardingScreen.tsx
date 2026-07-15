import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Theme } from '../config/theme';
import { IndianRupee, Sparkles, Check } from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');

// --- SLIDE 1 ILLUSTRATION ---
const Slide1Illustration = () => (
  <View style={styles.illContainer}>
    {/* Concentric Circles */}
    <View style={styles.circleOuter} />
    <View style={styles.circleMiddle} />
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
    <View style={[styles.rupeeBadge, { bottom: 45, left: -10 }]}>
      <Text style={styles.rupeeBadgeText}>₹</Text>
    </View>
    <View style={[styles.rupeeBadge, { bottom: 20, right: -10 }]}>
      <Text style={styles.rupeeBadgeText}>₹</Text>
    </View>
  </View>
);

// --- SLIDE 2 ILLUSTRATION ---
const Slide2Illustration = () => {
  const size = 180;
  const strokeWidth = 26;
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
    <View style={styles.illContainer}>
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
      {/* Inner white circle with Rupee icon */}
      <View style={styles.donutCenter}>
        <IndianRupee size={24} color="#1A2B4C" />
      </View>
    </View>
  );
};

// --- SLIDE 3 ILLUSTRATION ---
const Slide3Illustration = () => (
  <View style={styles.illContainer}>
    {/* Concentric Circles */}
    <View style={styles.circleOuterSlide3} />
    <View style={styles.circleInnerSlide3}>
      <Check size={48} color="#1A2B4C" strokeWidth={3} />
    </View>

    {/* Bubble shapes */}
    <View style={[styles.bubbleCard, { top: 30, left: -10 }]}>
      <View style={[styles.bubbleLine, { width: 24, backgroundColor: '#EF4444' }]} />
      <View style={styles.bubbleLine} />
    </View>

    <View style={[styles.bubbleCard, { top: 25, right: -10, width: 40 }]}>
      <View style={[styles.bubbleLine, { width: 20, backgroundColor: '#10B981' }]} />
      <View style={styles.bubbleLine} />
    </View>

    <View style={[styles.bubbleCard, { bottom: 35, left: -5 }]}>
      <View style={[styles.bubbleLine, { width: 16, backgroundColor: '#FCD34D' }]} />
      <View style={styles.bubbleLine} />
    </View>

    {/* Sparkle & Dot */}
    <View style={[styles.absolutePos, { top: 15, right: 30 }]}>
      <Sparkles size={14} color="#F4B8AE" />
    </View>
    <View style={[styles.dotAccent, { bottom: 25, right: 20, backgroundColor: '#F4B8AE' }]} />
  </View>
);

// --- MODULE-LEVEL SLIDES DATA ---
// Defined outside the component since this is static data that never changes.
// Note: Slide 2 legend uses inline styles to avoid a forward-reference to `styles`.
const SLIDES = [
  {
    title: 'Track Every Rupee',
    subtitle: 'Log your daily expenses in seconds',
    illustration: <Slide1Illustration />,
    showSkip: true,
    buttonLabel: 'Next',
  },
  {
    title: 'See Where It Goes',
    subtitle: 'Understand your spending with clear insights',
    illustration: (
      <View style={{ alignItems: 'center' }}>
        <Slide2Illustration />
        {/* Legend Grid */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: width - 64, marginTop: 20 }}>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: '#B8E0C8' }} />
              <Text style={{ fontSize: 14, color: '#1A2B4C', fontFamily: 'Quicksand_600SemiBold', flex: 1 }}>Food</Text>
              <Text style={{ fontSize: 14, color: '#8A8FA3', fontFamily: 'Quicksand_500Medium' }}>38%</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: '#F5D98B' }} />
              <Text style={{ fontSize: 14, color: '#1A2B4C', fontFamily: 'Quicksand_600SemiBold', flex: 1 }}>Shopping</Text>
              <Text style={{ fontSize: 14, color: '#8A8FA3', fontFamily: 'Quicksand_500Medium' }}>20%</Text>
            </View>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: '#F4B8AE' }} />
              <Text style={{ fontSize: 14, color: '#1A2B4C', fontFamily: 'Quicksand_600SemiBold', flex: 1 }}>Travel</Text>
              <Text style={{ fontSize: 14, color: '#8A8FA3', fontFamily: 'Quicksand_500Medium' }}>27%</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: '#C9B8E8' }} />
              <Text style={{ fontSize: 14, color: '#1A2B4C', fontFamily: 'Quicksand_600SemiBold', flex: 1 }}>Other</Text>
              <Text style={{ fontSize: 14, color: '#8A8FA3', fontFamily: 'Quicksand_500Medium' }}>15%</Text>
            </View>
          </View>
        </View>
      </View>
    ),
    showSkip: true,
    buttonLabel: 'Next',
  },
  {
    title: 'Simple. Fast. Yours.',
    subtitle: 'Start your journey to smarter spending',
    illustration: <Slide3Illustration />,
    showSkip: false,
    buttonLabel: 'Get Started',
  },
];


export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handlePressNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      navigation.navigate('Auth');
    }
  };

  const handlePressSkip = () => {
    navigation.navigate('Auth');
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      {currentSlide.showSkip && (
        <TouchableOpacity style={styles.skipButton} onPress={handlePressSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Main content Area (FlatList Swipe) */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={[styles.content, { width }]}>
            <View style={styles.illustrationWrapper}>
              {item.illustration}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Pagination indicators */}
      <View style={styles.paginationRow}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>

      {/* CTA Action Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={handlePressNext}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{currentSlide.buttonLabel}</Text>
      </TouchableOpacity>
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
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#8A8FA3',
    fontFamily: Theme.fonts.semibold,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 100, // leave space for absolute elements below
  },
  illustrationWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  title: {
    fontSize: 30,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 18,
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 12,
    lineHeight: 26,
  },
  paginationRow: {
    position: 'absolute',
    bottom: 128,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    marginHorizontal: 4,
  },
  activeDot: {
    width: 32,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B8E0C8',
  },
  inactiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D8DCE3',
    backgroundColor: 'transparent',
  },
  button: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    borderRadius: 9999,
    backgroundColor: '#B8E0C8',
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonText: {
    fontSize: 18,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
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
    fontSize: 12,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
  },
  // Slide 2 Specifics
  donutCenter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2B4C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: width - 64,
    marginTop: 20,
  },
  legendCol: {
    flex: 1,
    paddingHorizontal: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#1A2B4C',
    fontFamily: 'Quicksand_600SemiBold',
    flex: 1,
  },
  legendPercent: {
    fontSize: 14,
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
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


