import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
  interpolate,
  Extrapolation,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontFamily, FontSize, ControlHeight, ThemeColors, Motion } from '../config/theme';
import { FIXED_SHAPE_MAX_FONT_SCALE } from '../lib/fontScale';
import {
  PILL_BOX_SHADOW,
  PILL_LANDING_MARGIN_MS,
  PILL_LANDING_MAX_MS,
  capWidthFor,
  inactiveLabelOpacity,
  pillPiecesFor,
  pillRadiusFor,
  springLandingMs,
} from '../lib/segmentedMotion';
import {
  claimTouch,
  clearPendingSelection,
  createFenceOwner,
  setPendingSelection,
} from '../lib/selectionCommitFence';

const PILL_PADDING = 4; // inset between outer pill edge and sliding highlight
const TOGGLE_HEIGHT = ControlHeight.standard;
/** Sliding highlight height (content is TOGGLE_HEIGHT tall, highlight inset PILL_PADDING top and bottom). */
const HIGHLIGHT_HEIGHT = TOGGLE_HEIGHT - PILL_PADDING * 2;
const HIGHLIGHT_RADIUS = pillRadiusFor(BorderRadius.pill, HIGHLIGHT_HEIGHT);
const HIGHLIGHT_CAP_WIDTH = capWidthFor(HIGHLIGHT_RADIUS);
/** Base width of the scaled flat middle piece (any positive number works; it is only scaled). */
const BODY_BASE_WIDTH = 100;

/**
 * When the highlight will have LANDED for a move from `from` to `to` (both x and width ride SLIDE_SPRING,
 * with overshoot clamping). The list re-render waits for this, so FlashList's mount never lands mid-glide.
 */
export function categoryPillLandingMs(
  from: { x: number; width: number } | null,
  to: { x: number; width: number }
): number {
  if (!from) return 0;
  const landed = Math.max(
    springLandingMs(SLIDE_SPRING, from.x, to.x, undefined, true),
    springLandingMs(SLIDE_SPRING, from.width, to.width, undefined, true)
  );
  if (landed === 0) return 0;
  return Math.min(PILL_LANDING_MAX_MS, landed + PILL_LANDING_MARGIN_MS);
}

/** Apple-calibrated critically damped spring — runs entirely on the native UI thread */
/** pendingKeyRef value meaning "the user picked All (id null)", distinct from "nothing pending". */
const PENDING_ALL = '\u0000all';

const SLIDE_SPRING = {
  stiffness: 447.4,
  damping: 49,
  mass: 1,
  overshootClamping: true,
} as const;

export interface FilterOption {
  id: string | null;
  name: string;
}

interface Props {
  options: FilterOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  commitOnSettle?: boolean;
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

  const reduceMotion = useReducedMotion();

  const handlePressIn = () => {
    if (reduceMotion) return;
    scale.value = withSpring(Motion.scale.chip, {
      stiffness: 520,
      damping: 32,
      mass: 1,
    });
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    scale.value = withSpring(1, Motion.springs.settle);
  };

  // How "selected" this chip looks (0..1) from the highlight's live position (UI thread).
  // Drives an OPACITY cross-fade of two label copies. Animating Text `color` instead (the old way)
  // changes the text itself, so Android re-measured every nearby chip's text on every frame.
  const activeLabelStyle = useAnimatedStyle(() => {
    if (!layout || layout.width <= 0) {
      return { opacity: isActive ? 1 : 0 };
    }
    const itemCenter = layout.x + layout.width / 2;
    const pillCenter = pillLeft.value + pillWidth.value / 2;
    const distance = Math.abs(pillCenter - itemCenter);
    const maxRange = Math.max(layout.width, 40) * 0.6;
    if (distance >= maxRange) {
      return { opacity: 0 };
    }
    return { opacity: interpolate(distance, [0, maxRange], [1, 0], Extrapolation.CLAMP) };
  });
  const inactiveLabelStyle = useAnimatedStyle(() => {
    if (!layout || layout.width <= 0) {
      return { opacity: isActive ? 0 : 1 };
    }
    const itemCenter = layout.x + layout.width / 2;
    const pillCenter = pillLeft.value + pillWidth.value / 2;
    const distance = Math.abs(pillCenter - itemCenter);
    const maxRange = Math.max(layout.width, 40) * 0.6;
    if (distance >= maxRange) {
      return { opacity: 1 };
    }
    return {
      opacity: inactiveLabelOpacity(interpolate(distance, [0, maxRange], [1, 0], Extrapolation.CLAMP)),
    };
  });

  return (
    <Pressable
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={opt.name}
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
            maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}
            style={[styles.label, styles.hiddenPlaceholder, { fontFamily: FontFamily.bold }]}
            aria-hidden
          >
            {opt.name}
          </Text>
          {/* Same text twice, both bold (identical size): inactive colour + active colour, cross-faded. */}
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}
            style={[
              styles.label,
              styles.visibleLabel,
              { color: colors.textSecondary, fontFamily: FontFamily.bold },
              inactiveLabelStyle,
            ]}
          >
            {opt.name}
          </Animated.Text>
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.label,
              styles.visibleLabel,
              { color: colors.forestGreen, fontFamily: FontFamily.bold },
              activeLabelStyle,
            ]}
          >
            {opt.name}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export const BouncyCategoryFilter = React.memo<Props>(({
  options,
  value,
  onChange,
  commitOnSettle = false,
}) => {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  // Content-space x + width for each option, keyed by id ?? 'all'
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

  // UI-thread Reanimated shared values — TRANSFORM-ONLY (no layout properties animated)
  const pillX = useSharedValue(PILL_PADDING);   // drives translateX (not `left`) → zero native relayout
  const pillWidth = useSharedValue(0);

  // Ref mirrors for stable callback access (avoids re-creating animateTo on every layout change)
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const containerWidthRef = useRef(0);
  const scrollXRef = useRef(0);

  // Commit on settle timer and pending key (prevents heavy parent re-renders from stuttering the spring)
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKeyRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Touch fence owner (lib/selectionCommitFence) + when the current glide lands (absolute ms).
  const fenceOwnerRef = useRef<number>(0);
  if (fenceOwnerRef.current === 0) fenceOwnerRef.current = createFenceOwner();
  const landingAtRef = useRef(0);

  // Track whether we've done the first no-animation snap
  const initialized = useRef(false);
  const prevKey = useRef<string | null>(null);
  const lastActiveLayout = useRef<{ x: number; width: number } | null>(null);

  const activeKey = value ?? 'all';

  // Smoothly center the active item in the ScrollView if outside comfortable visible bounds (Apple UX standard)
  const centerCategory = useCallback((targetKey: string, force = false) => {
    const targetLayout = layoutsRef.current[targetKey];
    const cw = containerWidthRef.current;
    if (!targetLayout || cw <= 0) return;

    const visibleLeft = scrollXRef.current;
    const visibleRight = scrollXRef.current + cw;
    const margin = 24;

    const isComfortablyVisible =
      targetLayout.x >= visibleLeft + margin &&
      targetLayout.x + targetLayout.width <= visibleRight - margin;

    // Do NOT scroll the container under the user's finger if the chip is already comfortably in view!
    if (!force && isComfortablyVisible) {
      return;
    }

    const centerOffset = Math.max(0, targetLayout.x - cw / 2 + targetLayout.width / 2);
    scrollRef.current?.scrollTo({ x: centerOffset, animated: !reduceMotion });
  }, [reduceMotion]); // stable: reads from refs

  const animateTo = useCallback((targetKey: string) => {
    const targetLayout = layoutsRef.current[targetKey];
    if (!targetLayout) return;

    prevKey.current = targetKey;
    lastActiveLayout.current = { x: targetLayout.x, width: targetLayout.width };

    cancelAnimation(pillX);
    cancelAnimation(pillWidth);

    if (reduceMotion) {
      pillX.value = targetLayout.x;
      pillWidth.value = targetLayout.width;
    } else {
      pillX.value = withSpring(targetLayout.x, SLIDE_SPRING);
      pillWidth.value = withSpring(targetLayout.width, SLIDE_SPRING);
    }

    centerCategory(targetKey);
  }, [centerCategory, pillX, pillWidth, reduceMotion]); // stable: shared values never change identity

  // Hand the pending tap to the parent. viaTransition = normal timer path; false = touch fence / unmount.
  const deliverPending = useCallback((viaTransition: boolean) => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    clearPendingSelection(fenceOwnerRef.current);
    if (pendingKeyRef.current === null) return;
    const finalId = pendingKeyRef.current === PENDING_ALL ? null : pendingKeyRef.current;
    pendingKeyRef.current = null;
    if (viaTransition && typeof React.startTransition === 'function') {
      React.startTransition(() => {
        onChangeRef.current(finalId);
      });
    } else {
      onChangeRef.current(finalId);
    }
  }, []);

  // Immediate touch-driven animation start on UI thread:
  const handleSelect = useCallback((id: string | null) => {
    Haptics.selectionAsync().catch(() => {});
    const targetKey = id ?? 'all';
    const now = Date.now();
    if (targetKey !== prevKey.current && layoutsRef.current[targetKey]) {
      const from = lastActiveLayout.current;
      const glideMs = reduceMotion ? 0 : categoryPillLandingMs(from, layoutsRef.current[targetKey]);
      landingAtRef.current = now + glideMs;
      animateTo(targetKey);
    }

    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    if (!commitOnSettle) {
      // Decouple UI-thread spring motion from heavy SectionList dataset transition
      if (typeof React.startTransition === 'function') {
        React.startTransition(() => {
          onChange(id);
        });
      } else {
        onChange(id);
      }
      return;
    }

    // commitOnSettle: the list re-render (a React commit, which pauses Reanimated's UI commits until it is
    // mounted) waits until the highlight has LANDED. A re-tap mid-glide restarts the wait.
    pendingKeyRef.current = id ?? PENDING_ALL;
    setPendingSelection(fenceOwnerRef.current, () => deliverPending(false));
    const remaining = Math.max(0, landingAtRef.current - now);
    commitTimerRef.current = setTimeout(() => deliverPending(true), remaining);
  }, [animateTo, commitOnSettle, onChange, reduceMotion, deliverPending]);

  useEffect(() => () => {
    // Never lose a tap: if the screen goes away mid-glide, hand the value over now.
    if (pendingKeyRef.current !== null) {
      deliverPending(false);
    } else {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      clearPendingSelection(fenceOwnerRef.current);
    }
  }, [deliverPending]);

  // Taps on this filter are claimed so the app-root touch fence does not flush it on a re-tap.
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    claimTouch(fenceOwnerRef.current, e?.nativeEvent);
  }, []);

  useEffect(() => {
    const activeLayout = layouts[activeKey];
    if (!activeLayout) return;

    if (!initialized.current) {
      // First layout measurement — snap immediately on UI thread, no animation
      initialized.current = true;
      prevKey.current = activeKey;
      lastActiveLayout.current = { x: activeLayout.x, width: activeLayout.width };
      pillX.value = activeLayout.x;
      pillWidth.value = activeLayout.width;
      centerCategory(activeKey, true);
      return;
    }

    // While a tap is waiting to be committed, parent's value is intentionally stale: keep pill where user tapped
    if (pendingKeyRef.current !== null) return;

    if (prevKey.current !== activeKey) {
      // External value change not triggered by direct handleSelect tap
      animateTo(activeKey);
    } else if (
      lastActiveLayout.current &&
      (lastActiveLayout.current.x !== activeLayout.x ||
        lastActiveLayout.current.width !== activeLayout.width)
    ) {
      // Genuine layout coordinate change (e.g. initial options load or window resize)
      lastActiveLayout.current = { x: activeLayout.x, width: activeLayout.width };
      pillX.value = activeLayout.x;
      pillWidth.value = activeLayout.width;
      centerCategory(activeKey);
    }
  }, [activeKey, layouts, animateTo, centerCategory, pillX, pillWidth]);

  // Shadow box base width: the narrowest chip, so at rest the blurred shadow is (almost) unscaled.
  const shadowBase = useMemo(() => {
    const widths = Object.values(layouts).map((l) => l.width).filter((w) => w > 0);
    return widths.length > 0 ? Math.max(HIGHLIGHT_CAP_WIDTH, Math.min(...widths)) : HIGHLIGHT_CAP_WIDTH;
  }, [layouts]);

  // TRANSFORM / OPACITY ONLY (no `width`, no `left`): nothing here needs Yoga layout or a shadow-tree
  // commit, so the highlight glides even while the list below is busy. Same springs, same path as before.
  const highlightGroupStyle = useAnimatedStyle(() => ({
    opacity: pillWidth.value > 1 ? 1 : 0,
  }));
  const shadowStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillX.value, pillX.value + pillWidth.value, HIGHLIGHT_RADIUS, BODY_BASE_WIDTH, shadowBase);
    return { transform: [{ translateX: p.shadowX }, { scaleX: p.shadowScaleX }] };
  });
  const leftCapStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillX.value, pillX.value + pillWidth.value, HIGHLIGHT_RADIUS, BODY_BASE_WIDTH, shadowBase);
    return { transform: [{ translateX: p.leftCapX }] };
  });
  const bodyStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillX.value, pillX.value + pillWidth.value, HIGHLIGHT_RADIUS, BODY_BASE_WIDTH, shadowBase);
    return { transform: [{ translateX: p.bodyX }, { scaleX: p.bodyScaleX }] };
  });
  const rightCapStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillX.value, pillX.value + pillWidth.value, HIGHLIGHT_RADIUS, BODY_BASE_WIDTH, shadowBase);
    return { transform: [{ translateX: p.rightCapX }] };
  });

  return (
    // ── Outer pill: FIXED visual shape, both ends rounded, clips its children ──
    <View
      onLayout={(e) => {
        containerWidthRef.current = e.nativeEvent.layout.width;
      }}
      onTouchStart={handleTouchStart}
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
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x;
        }}
      >
        {/* Sliding highlight — absolute in scroll-content space, so it travels with items.
            Shadow box first (under), then flat middle, then the two round caps. */}
        <Animated.View pointerEvents="none" style={[styles.highlightLayer, highlightGroupStyle]}>
          <Animated.View
            style={[
              styles.highlightPiece,
              { width: shadowBase, borderRadius: HIGHLIGHT_RADIUS, boxShadow: PILL_BOX_SHADOW },
              shadowStyle,
            ]}
          />
          <Animated.View
            style={[styles.highlightPiece, { width: BODY_BASE_WIDTH, backgroundColor: colors.mintGreen }, bodyStyle]}
          />
          <Animated.View
            style={[
              styles.highlightPiece,
              { width: HIGHLIGHT_CAP_WIDTH, borderRadius: HIGHLIGHT_RADIUS, backgroundColor: colors.mintGreen },
              leftCapStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.highlightPiece,
              { width: HIGHLIGHT_CAP_WIDTH, borderRadius: HIGHLIGHT_RADIUS, backgroundColor: colors.mintGreen },
              rightCapStyle,
            ]}
          />
        </Animated.View>

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
              pillLeft={pillX}
              pillWidth={pillWidth}
              isFirst={idx === 0}
              isLast={idx === options.length - 1}
              onPress={() => handleSelect(opt.id)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                layoutsRef.current[key] = { x, width };
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
  highlightLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  highlightPiece: {
    position: 'absolute',
    top: PILL_PADDING,
    height: HIGHLIGHT_HEIGHT,
    left: 0, // static anchor — position driven entirely by translateX
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
