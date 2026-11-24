/**
 * The "What's new" spotlight tour (big-app style): each Next opens the screen where the next new feature lives,
 * dims everything else so only the feature stays lit, and explains it in a card. Skip ends it at any step; Android Back skips.
 * Steps: src/lib/whatsNewTour.ts. Targets: <TourTarget id=…>. Shown once (tourStore.maybeStartWhatsNewTour).
 */
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTourStore, TourRect } from '../../store/tourStore';
import { useNavBarStore } from '../../store/navBarStore';
import { navigationRef } from '../../navigation/navigationRef';
import { TOUR_STEPS } from '../../lib/whatsNewTour';
import { useTheme } from '../../store/themeStore';
import { useScrimColor } from '../../hooks/useScrimColor';
import { AppButton } from '../ui/AppButton';
import { PressableOpacity } from '../ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';
import { BorderRadius, FontFamily, FontSize, LetterSpacing, LineHeight, Spacing } from '../../config/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const PAD = 8; // space between the feature and the edge of the spotlight
const CARD_ROOM = 230; // enough height for the card under the spotlight
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function holePath(W: number, H: number, r: TourRect, radius: number): string {
  const x = r.x - PAD, y = r.y - PAD, w = r.width + PAD * 2, h = r.height + PAD * 2;
  const k = Math.min(radius, w / 2, h / 2);
  return (
    `M0 0H${W}V${H}H0Z ` +
    `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}` +
    `H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`
  );
}

export const WhatsNewTour: React.FC = () => {
  const step = useTourStore((s) => s.step);
  const next = useTourStore((s) => s.next);
  const finish = useTourStore((s) => s.finish);
  const { colors, isDark } = useTheme();
  const scrim = useScrimColor();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<{ step: number; rect: TourRect | null } | null>(null);

  // Open the step's screen, then find and measure its feature.
  useEffect(() => {
    if (step === null) {
      setShown(null);
      return;
    }
    let live = true;
    setShown(null);
    (async () => {
      const s = TOUR_STEPS[step];
      useNavBarStore.getState().showNavBar();
      if (navigationRef.isReady()) navigationRef.navigate('AppTabs', { screen: s.tab });
      await wait(450);
      let measure = useTourStore.getState().targets[s.target];
      for (let i = 0; !measure && i < 10 && live; i++) {
        await wait(150);
        measure = useTourStore.getState().targets[s.target];
      }
      const rect = measure ? await measure() : null;
      if (live) setShown({ step, rect });
    })();
    return () => {
      live = false;
    };
  }, [step]);

  if (step === null) return null;
  const { width: W, height: H } = Dimensions.get('screen');
  const s = TOUR_STEPS[step];
  const rect = shown?.rect ?? null;
  const last = step === TOUR_STEPS.length - 1;
  const radius = rect ? Math.min(BorderRadius.card, (rect.height + PAD * 2) / 2) : 0;

  // The card goes under the feature when it fits, otherwise above it; with no spotlight it sits in the middle.
  let cardPos: object = { top: H / 2 - CARD_ROOM / 2 };
  if (rect) {
    const below = rect.y + rect.height + PAD + Spacing.group;
    cardPos = below + CARD_ROOM < H - insets.bottom ? { top: below } : { bottom: H - (rect.y - PAD - Spacing.group) };
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Path d={rect ? holePath(W, H, rect, radius) : `M0 0H${W}V${H}H0Z`} fill={scrim} fillRule="evenodd" />
        </Svg>

        {shown && (
          <Animated.View
            key={step}
            entering={reduced ? FadeIn.duration(180) : FadeInDown.duration(260).easing(EASE_OUT)}
            style={[
              styles.card,
              cardPos,
              { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 },
            ]}
            accessibilityViewIsModal
          >
            <Text style={[styles.label, { color: colors.mintText }]}>
              NEW · {step + 1} OF {TOUR_STEPS.length}
            </Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]} maxFontSizeMultiplier={1.3}>
              {s.title}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {s.body}
            </Text>
            <View style={styles.actions}>
              {!last ? (
                <PressableOpacity
                  activeOpacity={PRESS_DIM_OPACITY}
                  onPress={finish}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Skip the tour"
                >
                  <Text style={[styles.skip, { color: colors.textSecondary }]}>Skip</Text>
                </PressableOpacity>
              ) : (
                <View />
              )}
              <View style={styles.nextBtn}>
                <AppButton label={last ? 'Got it' : 'Next'} size="standard" onPress={next} />
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: Spacing.gutter,
    right: Spacing.gutter,
    padding: Spacing.block,
    borderRadius: BorderRadius.card,
  },
  label: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: LetterSpacing.label },
  title: { fontSize: FontSize.titleSmall, fontFamily: FontFamily.bold, marginTop: Spacing.micro },
  body: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall, fontFamily: FontFamily.medium, marginTop: Spacing.micro },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.group },
  skip: { fontSize: FontSize.body, fontFamily: FontFamily.semibold },
  nextBtn: { minWidth: 120 },
});
