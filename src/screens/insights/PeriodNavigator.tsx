import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, useAnimatedValue,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Spacing, FontSize, FontFamily } from '../../config/theme';

export interface PeriodNavigatorProps {
  dateLabel: string;
  subLabel: string;
  offset: number;
  minOffset: number;
  dotCount: number;
  activeDotIndex: number;
  hasPrevData: boolean;  // false → grey left arrow (no expenses in prev period)
  onPrev: () => void;
  onNext: () => void;
}

export const PeriodNavigator: React.FC<PeriodNavigatorProps> = ({
  dateLabel, subLabel, offset, minOffset, dotCount, activeDotIndex, hasPrevData, onPrev, onNext,
}) => {
  const isAtCurrent = offset === 0;
  // Block going back if at oldest period with data
  const isAtOldest = offset <= minOffset || hasPrevData === false;

  // Each dot slot is (inactive dot width 6 + gap 8) = 14px
  const DOT_SLOT = 14;

  // Elastic pill animation: independent left position and width values
  const slideLeft = useAnimatedValue(activeDotIndex * DOT_SLOT);
  const slideWidth = useAnimatedValue(16);
  const prevIndex = useRef(activeDotIndex);

  useEffect(() => {
    const from = prevIndex.current;
    const to = activeDotIndex;
    if (from === to) return;
    prevIndex.current = to;

    slideLeft.stopAnimation();
    slideWidth.stopAnimation();

    const distance = Math.abs(to - from);
    const maxStretch = 16 + distance * DOT_SLOT;
    const targetLeft = to * DOT_SLOT;

    const springCfg = { tension: 100, friction: 16, useNativeDriver: false };
    const timeCfg = { duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: false };

    Animated.sequence([
      to > from
        ? Animated.timing(slideWidth, { toValue: maxStretch, ...timeCfg })
        : Animated.parallel([
            Animated.timing(slideLeft, { toValue: targetLeft, ...timeCfg }),
            Animated.timing(slideWidth, { toValue: maxStretch, ...timeCfg }),
          ]),
      to > from
        ? Animated.parallel([
            Animated.spring(slideLeft, { toValue: targetLeft, ...springCfg }),
            Animated.spring(slideWidth, { toValue: 16, ...springCfg }),
          ])
        : Animated.spring(slideWidth, { toValue: 16, ...springCfg }),
    ]).start();
  }, [activeDotIndex]);

  return (
    <View style={navStyles.container}>
      {/* Arrow row */}
      <View style={navStyles.row}>
        <Pressable
          onPress={onPrev}
          disabled={isAtOldest}
          hitSlop={12}
          style={[navStyles.arrowBtn, isAtOldest && navStyles.arrowDisabled]}
        >
          <ChevronLeft size={16} color={isAtOldest ? 'rgba(60,35,35,0.25)' : '#2D1E1E'} />
        </Pressable>

        <View style={navStyles.labelBlock}>
          <Text
            style={[navStyles.dateLabel, { fontFamily: FontFamily.bold }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {dateLabel}
          </Text>
          {!!subLabel && (
            <Text
              style={[navStyles.subLabel, { fontFamily: FontFamily.medium }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {subLabel}
            </Text>
          )}
        </View>

        <Pressable
          onPress={onNext}
          disabled={isAtCurrent}
          hitSlop={12}
          style={[navStyles.arrowBtn, isAtCurrent && navStyles.arrowDisabled]}
        >
          <ChevronRight size={16} color={isAtCurrent ? 'rgba(60,35,35,0.25)' : '#2D1E1E'} />
        </Pressable>
      </View>

      {/* Pagination dots with stretchy elastic sliding pill */}
      {dotCount > 1 && (
        <View style={navStyles.dotsRow}>
          {/* Static ghost dots with left-to-right emergence progression */}
          {Array.from({ length: dotCount }).map((_, i) => {
            // Older history on the left is softly faded, smoothly emerging towards the current period on the right
            const progress = dotCount > 1 ? i / (dotCount - 1) : 1;
            const dotOpacity = 0.2 + progress * 0.45;
            const dotScale = 0.82 + progress * 0.18;

            return (
              <View
                key={i}
                style={[
                  navStyles.dot,
                  { width: i === activeDotIndex ? 16 : 6 },
                  {
                    backgroundColor: `rgba(60,35,35,${dotOpacity.toFixed(2)})`,
                    transform: [{ scale: dotScale }],
                  },
                ]}
              />
            );
          })}
          {/* Animated pill that stretches and snaps over the dots */}
          <Animated.View
            style={[
              navStyles.dot,
              navStyles.activePill,
              {
                left: slideLeft,
                width: slideWidth,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

export const navStyles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: Spacing.group },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60,35,35,0.06)',
  },
  arrowDisabled: { opacity: 0.35 },
  labelBlock: { alignItems: 'center', minWidth: 160, maxWidth: 220, flexShrink: 1 },
  dateLabel: { fontSize: FontSize.cta, color: '#2D1E1E' },
  subLabel: { fontSize: FontSize.bodySmall, color: 'rgba(60,35,35,0.6)', marginTop: Spacing.nano },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginTop: Spacing.element,
    position: 'relative',
  },
  dot: { height: 6, borderRadius: 3 },
  // Absolutely-positioned elastic pill drawn on top of the ghost dots
  activePill: {
    position: 'absolute',
    top: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2D1E1E',
  },
});
