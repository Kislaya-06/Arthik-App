/**
 * "Your <year> in Arthik" (Yearly tab): a banner that opens a full-screen story of the year.
 * Tap the right side for the next slide, the left side to go back; swipe down or the X to close.
 * Slides come from buildYearStory (src/lib/insights/yearStory.ts).
 */
import React, { useCallback, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { parseISO } from 'date-fns/parseISO';
import { format } from 'date-fns/format';
import Sparkles from 'lucide-react-native/icons/sparkles';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import X from 'lucide-react-native/icons/x';
import { PressableOpacity } from '../../components/ui/PressableOpacity';
import { AppButton } from '../../components/ui/AppButton';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';
import { useTheme } from '../../store/themeStore';
import { BorderRadius, FontFamily, FontSize, LetterSpacing, ScreenHue, Spacing } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import type { YearStorySlide } from '../../lib/insights/yearStory';
import type { Category } from '../../store/categoryStore';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const SETTLE = { duration: 400, dampingRatio: 1 } as const; // no overshoot (§9.7)
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 800;

// `size`: the modal passes the full screen size; on Android "100%" stops above the navigation bar.
const Gradient = ({ id, size }: { id: string; size?: { width: number; height: number } }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
  <Svg width={size?.width ?? '100%'} height={size?.height ?? '100%'}>
    <Defs>
      <LinearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
        <Stop offset="0%" stopColor={ScreenHue.insights.from} />
        <Stop offset="100%" stopColor={ScreenHue.insights.to} />
      </LinearGradient>
    </Defs>
    <Rect width="100%" height="100%" fill={`url(#${id})`} />
  </Svg>
  </View>
);

// ─── Banner ─────────────────────────────────────────────────────────────────

export const YearStoryBanner: React.FC<{ year: number; onPress: () => void }> = ({ year, onPress }) => {
  const { colors } = useTheme();
  const ink = colors.forestGreen; // deep ink on the coral hue, like the active pills
  return (
    <PressableOpacity
      activeOpacity={PRESS_DIM_OPACITY}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your ${year} in Arthik. Open your year story.`}
      style={styles.banner}
    >
      <Gradient id="yearStoryBanner" />
      <Sparkles size={22} color={ink} />
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: ink }]} maxFontSizeMultiplier={1.3}>
          Your {year} in Arthik
        </Text>
        <Text style={[styles.bannerSub, { color: ink }]} maxFontSizeMultiplier={1.3}>
          See your year in a few taps
        </Text>
      </View>
      <ChevronRight size={20} color={ink} />
    </PressableOpacity>
  );
};

// ─── Slides ─────────────────────────────────────────────────────────────────

function slideText(s: YearStorySlide, year: number, categories: Category[]): { label: string; big: string; line: string } {
  switch (s.kind) {
    case 'totals':
      return {
        label: `In ${year} you spent`,
        big: formatCurrency(s.spent),
        line: `${s.entries} entries logged${s.inflow > 0 ? ` · ${formatCurrency(s.inflow)} came in` : ''}`,
      };
    case 'topCategory':
      return {
        label: 'Your top category',
        big: categories.find((c) => c.id === s.categoryId)?.name ?? 'Other',
        line: `${formatCurrency(s.amount)} · ${Math.round(s.share * 100)}% of your spending`,
      };
    case 'topPlace':
      return { label: 'Your top place', big: s.name, line: `${s.count} ${s.count === 1 ? 'time' : 'times'} · ${formatCurrency(s.total)}` };
    case 'noSpend':
      return {
        label: 'No-spend days',
        big: `${s.count} ${s.count === 1 ? 'day' : 'days'}`,
        line: s.longest > 1 ? `Your longest run was ${s.longest} days in a row` : 'Days you spent nothing at all',
      };
    case 'bestMonth':
      return {
        label: 'Your best month',
        big: format(parseISO(s.monthKey), 'MMMM'),
        line: s.moneyLeft >= 0 ? `${formatCurrency(s.moneyLeft)} left over` : `Only ${formatCurrency(-s.moneyLeft)} short`,
      };
    case 'gullak':
      return { label: 'Into your Gullak', big: formatCurrency(s.added), line: 'Saved through the year' };
    case 'closing':
      return { label: `That was your ${year}`, big: 'Well done', line: 'Keep logging and next year\'s story gets even better.' };
  }
}

// ─── Modal ──────────────────────────────────────────────────────────────────

interface ModalProps {
  visible: boolean;
  year: number;
  slides: YearStorySlide[];
  categories: Category[];
  onClose: () => void;
}

export const YearStoryModal: React.FC<ModalProps> = ({ visible, year, slides, categories, onClose }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const dragY = useSharedValue(0);
  const ink = colors.forestGreen;
  const last = slides.length - 1;

  const close = useCallback(() => {
    onClose();
    setIndex(0);
    dragY.set(0);
  }, [onClose, dragY]);

  const onTap = useCallback(
    (x: number) => {
      if (x < width * 0.3) setIndex((i) => Math.max(0, i - 1));
      else setIndex((i) => Math.min(last, i + 1));
    },
    [width, last]
  );

  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      dragY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) scheduleOnRN(close);
      else dragY.set(withSpring(0, { ...SETTLE, velocity: e.velocityY }));
    });
  const tap = Gesture.Tap().onEnd((e) => {
    scheduleOnRN(onTap, e.x);
  });
  const gesture = Gesture.Race(pan, tap);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.get() }],
    opacity: 1 - Math.min(0.4, dragY.get() / 600),
  }));

  const slide = slides[Math.min(index, last)];
  if (!slide) return null;
  const t = slideText(slide, year, categories);
  const entering = reduced ? FadeIn.duration(200) : FadeInDown.duration(280).easing(EASE_OUT);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={styles.fill}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.fill, dragStyle]}>
            <Gradient id="yearStoryBg" size={Dimensions.get('screen')} />

            <View style={[styles.progressRow, { paddingTop: insets.top + Spacing.group }]}>
              {slides.map((_, i) => (
                <View key={i} style={[styles.progressTrack, { backgroundColor: `${ink}2E` }]}>
                  {i <= index && <View style={[styles.progressFill, { backgroundColor: ink }]} />}
                </View>
              ))}
            </View>
            <View style={styles.topRow}>
              <Text style={[styles.yearTag, { color: ink }]}>{year} IN ARTHIK</Text>
              <PressableOpacity
                activeOpacity={PRESS_DIM_OPACITY}
                onPress={close}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close year story"
              >
                <X size={24} color={ink} />
              </PressableOpacity>
            </View>

            <Animated.View
              key={index}
              entering={entering}
              style={styles.slideBody}
              accessible
              accessibilityLabel={`Slide ${index + 1} of ${slides.length}. ${t.label}: ${t.big}. ${t.line}`}
              accessibilityHint={index < last ? 'Tap the right side for the next slide' : undefined}
            >
              <Text style={[styles.slideLabel, { color: ink }]} maxFontSizeMultiplier={1.3}>{t.label}</Text>
              <Text style={[styles.slideBig, { color: ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
                {t.big}
              </Text>
              <Text style={[styles.slideLine, { color: ink }]} maxFontSizeMultiplier={1.3}>{t.line}</Text>
            </Animated.View>

            <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.gutter }]}>
              {index === last ? (
                <AppButton label="Done" onPress={close} size="cta" variant="secondary" />
              ) : (
                <Text style={[styles.hint, { color: ink }]}>Tap to continue · Swipe down to close</Text>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    padding: Spacing.block,
    borderRadius: BorderRadius.card,
    overflow: 'hidden',
    marginTop: Spacing.surface,
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  bannerSub: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium, marginTop: Spacing.nano },
  progressRow: { flexDirection: 'row', gap: Spacing.micro, paddingHorizontal: Spacing.gutter },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    marginTop: Spacing.block,
  },
  yearTag: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: LetterSpacing.label },
  slideBody: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.gutter },
  slideLabel: { fontSize: FontSize.titleSmall, fontFamily: FontFamily.medium },
  slideBig: { fontSize: FontSize.display, lineHeight: 42, fontFamily: FontFamily.bold, marginTop: Spacing.element },
  slideLine: { fontSize: FontSize.body, fontFamily: FontFamily.medium, marginTop: Spacing.group, opacity: 0.85 },
  footer: { paddingHorizontal: Spacing.gutter },
  hint: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium, textAlign: 'center', opacity: 0.7 },
});
