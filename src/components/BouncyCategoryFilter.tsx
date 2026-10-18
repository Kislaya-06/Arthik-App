import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
  interpolateColor,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontFamily, FontSize, ControlHeight, ThemeColors } from '../config/theme';

const PILL_PADDING = 4; // inset between outer pill edge and sliding highlight
const TOGGLE_HEIGHT = ControlHeight.standard;

export interface FilterOption {
  id: string | null;
  name: string;
}

interface Props {
  options: FilterOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}

interface FilterItemProps {
  opt: FilterOption;
  isActive: boolean;
  colors: ThemeColors;
  layout?: { x: number; width: number };
  pillLeft: SharedValue<number>;
  pillWidth: SharedValue<number>;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const FilterItem = React.memo<FilterItemProps>(({
  opt,
  isActive,
  colors,
  layout,
  pillLeft,
  pillWidth,
  onLayout,
  onPress,
  isFirst,
  isLast,
}) => {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.94, { damping: 12, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 240 });
  };

  // Reanimated UI-thread color interpolation as pill highlight passes underneath
  const animatedTextStyle = useAnimatedStyle(() => {
    if (!layout || layout.width <= 0) {
      return {
        color: isActive ? colors.forestGreen : colors.textSecondary,
      };
    }
    const itemCenter = layout.x + layout.width / 2;
    const pillCenter = pillLeft.value + pillWidth.value / 2;
    const distance = Math.abs(pillCenter - itemCenter);
    const maxRange = Math.max(layout.width, 40) * 0.6;
    const progress = interpolate(distance, [0, maxRange], [1, 0], Extrapolation.CLAMP);
    return {
      color: interpolateColor(progress, [0, 1], [colors.textSecondary, colors.forestGreen]),
    };
  });

  return (
    <Pressable
      onLayout={onLayout}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={styles.item}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      hitSlop={{
        top: 8,
        bottom: 8,
        left: isFirst ? 16 : 2,
        right: isLast ? 16 : 2,
      }}
    >
      <Animated.View style={animStyle}>
        <View style={styles.labelWrapper}>
          {/* Invisible bold placeholder reserves stable width to eliminate onLayout font-shift churn */}
          <Text
            numberOfLines={1}
            style={[styles.label, styles.hiddenPlaceholder, { fontFamily: FontFamily.bold }]}
            aria-hidden
          >
            {opt.name}
          </Text>
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.label,
              styles.visibleLabel,
              animatedTextStyle,
              {
                fontFamily: isActive ? FontFamily.bold : FontFamily.medium,
              },
            ]}
          >
            {opt.name}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export const BouncyCategoryFilter = React.memo<Props>(({ options, value, onChange }) => {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Content-space x + width for each option, keyed by id ?? 'all'
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

  // UI-thread Reanimated shared values for sliding highlight
  const pillLeft = useSharedValue(PILL_PADDING);
  const pillWidth = useSharedValue(0);
  const stretchAnim = useSharedValue(1);
  const squishAnim = useSharedValue(1);
  const leadAnim = useSharedValue(0);

  // Track whether we've done the first no-animation snap
  const initialized = useRef(false);
  const prevKey = useRef<string | null>(null);
  const lastActiveLayout = useRef<{ x: number; width: number } | null>(null);

  const activeKey = value ?? 'all';

  // Smoothly center the active item in the ScrollView (Apple UX standard for horizontal chips)
  const centerCategory = useCallback((targetKey: string) => {
    const targetLayout = layouts[targetKey];
    if (!targetLayout || containerWidth <= 0) return;
    const centerOffset = Math.max(
      0,
      targetLayout.x - containerWidth / 2 + targetLayout.width / 2
    );
    scrollRef.current?.scrollTo({ x: centerOffset, animated: true });
  }, [containerWidth, layouts]);

  const animateTo = useCallback((targetKey: string, _oldKey?: string | null) => {
    const targetLayout = layouts[targetKey];
    if (!targetLayout) return;

    prevKey.current = targetKey;
    lastActiveLayout.current = { x: targetLayout.x, width: targetLayout.width };

    // 1. Primary slide: Apple-calibrated critically damped spring on native UI thread
    // Exact physical equivalent of React Native Origami tension: 100, friction: 16
    // stiffness = 447.4, damping = 49 (mass: 1)
    cancelAnimation(pillLeft);
    cancelAnimation(pillWidth);
    cancelAnimation(stretchAnim);
    cancelAnimation(squishAnim);
    cancelAnimation(leadAnim);

    pillLeft.value = withSpring(targetLayout.x, {
      stiffness: 447.4,
      damping: 49,
      mass: 1,
      overshootClamping: true,
    });
    pillWidth.value = withSpring(targetLayout.width, {
      stiffness: 447.4,
      damping: 49,
      mass: 1,
      overshootClamping: true,
    });
    stretchAnim.value = 1;
    squishAnim.value = 1;
    leadAnim.value = 0;

    centerCategory(targetKey);
  }, [centerCategory, layouts, leadAnim, pillLeft, pillWidth, squishAnim, stretchAnim]);

  // Immediate touch-driven animation start on UI thread:
  const handleSelect = useCallback((id: string | null) => {
    Haptics.selectionAsync().catch(() => {});
    const targetKey = id ?? 'all';
    if (targetKey !== prevKey.current && layouts[targetKey]) {
      animateTo(targetKey, prevKey.current);
    }
    // Decouple UI-thread spring motion from heavy SectionList dataset transition
    if (typeof React.startTransition === 'function') {
      React.startTransition(() => {
        onChange(id);
      });
    } else {
      onChange(id);
    }
  }, [animateTo, layouts, onChange]);

  useEffect(() => {
    const activeLayout = layouts[activeKey];
    if (!activeLayout) return;

    if (!initialized.current) {
      // First layout measurement — snap immediately on UI thread, no animation
      initialized.current = true;
      prevKey.current = activeKey;
      lastActiveLayout.current = { x: activeLayout.x, width: activeLayout.width };
      pillLeft.value = activeLayout.x;
      pillWidth.value = activeLayout.width;
      stretchAnim.value = 1;
      squishAnim.value = 1;
      leadAnim.value = 0;
      centerCategory(activeKey);
      return;
    }

    if (prevKey.current !== activeKey) {
      // External value change not triggered by direct handleSelect tap
      animateTo(activeKey, prevKey.current);
    } else if (
      lastActiveLayout.current &&
      (lastActiveLayout.current.x !== activeLayout.x ||
        lastActiveLayout.current.width !== activeLayout.width)
    ) {
      // Genuine layout coordinate change (e.g. initial options load or window resize)
      lastActiveLayout.current = { x: activeLayout.x, width: activeLayout.width };
      pillLeft.value = activeLayout.x;
      pillWidth.value = activeLayout.width;
      centerCategory(activeKey);
    }
  }, [activeKey, animateTo, centerCategory, layouts, leadAnim, pillLeft, pillWidth, squishAnim, stretchAnim]);

  const animatedHighlightStyle = useAnimatedStyle(() => ({
    left: pillLeft.value,
    width: pillWidth.value,
    transform: [
      { translateX: leadAnim.value },
      { scaleX: stretchAnim.value },
      { scaleY: squishAnim.value },
    ],
  }));

  return (
    // ── Outer pill: FIXED visual shape, both ends rounded, clips its children ──
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={[
        styles.pill,
        {
          backgroundColor: colors.cardSubtle,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      {/* ── ScrollView lives INSIDE the pill ── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        {/* Sliding highlight — absolute in scroll-content space, so it travels with items */}
        <Animated.View
          style={[
            styles.slidingHighlight,
            { backgroundColor: colors.mintGreen },
            animatedHighlightStyle,
          ]}
        />

        {/* Items */}
        {options.map((opt, idx) => {
          const key = opt.id ?? 'all';
          const isActive = value === opt.id;

          return (
            <FilterItem
              key={key}
              opt={opt}
              isActive={isActive}
              colors={colors}
              layout={layouts[key]}
              pillLeft={pillLeft}
              pillWidth={pillWidth}
              isFirst={idx === 0}
              isLast={idx === options.length - 1}
              onPress={() => handleSelect(opt.id)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setLayouts((prev) => {
                  if (prev[key]?.x === x && prev[key]?.width === width) return prev;
                  return { ...prev, [key]: { x, width } };
                });
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    height: TOGGLE_HEIGHT,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    overflow: 'hidden', // clips scroll content at rounded corners → both ends stay rounded
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOGGLE_HEIGHT,
    paddingHorizontal: PILL_PADDING,
  },
  slidingHighlight: {
    position: 'absolute',
    top: PILL_PADDING,
    bottom: PILL_PADDING,
    borderRadius: BorderRadius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  item: {
    height: TOGGLE_HEIGHT,
    paddingHorizontal: Spacing.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  labelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenPlaceholder: {
    opacity: 0,
  },
  visibleLabel: {
    position: 'absolute',
    textAlign: 'center',
  },
  label: {
    fontSize: FontSize.bodySmall,
    includeFontPadding: false,
  },
});

export default BouncyCategoryFilter;
