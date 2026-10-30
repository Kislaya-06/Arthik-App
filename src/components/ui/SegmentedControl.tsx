import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../store/themeStore';
import {
  LANDING_HAPTIC_ENABLED,
  PILL_BOX_SHADOW,
  PILL_COMMIT_MS,
  capWidthFor,
  edgeSpringsFor,
  inactiveLabelOpacity,
  isOpaqueColor,
  labelActiveProgress,
  optionWidthFor,
  pillEdgesFor,
  pillLandingMs,
  pillPiecesFor,
  pillRadiusFor,
} from '../../lib/segmentedMotion';
import {
  claimTouch,
  clearPendingSelection,
  createFenceOwner,
  setPendingSelection,
} from '../../lib/selectionCommitFence';
import { BorderRadius, FontSize, FontFamily, LineHeight, Spacing, ControlHeight, Motion } from '../../config/theme';
import { FIXED_SHAPE_MAX_FONT_SCALE } from '../../lib/fontScale';

export interface SegmentedOption {
  key: string;
  label: string;
  badge?: string | number;
  icon?: React.ComponentType<{ size: number; color: string }> | ((props: { size: number; color: string }) => React.ReactNode);
  activePillColor?: string;
}

export interface SegmentedControlProps {
  options: (string | SegmentedOption)[];
  selectedKey: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
  borderRadius?: number;
  activePillColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  fontSize?: number;
  iconSize?: number;
  testID?: string;
  /**
   * true = call onChange only after the pill has LANDED (exact time from pillLandingMs, ~300ms).
   * Use on screens whose re-render is heavy (Home, Expense | Income, Insights, Savings history) so it
   * never freezes the glide. Safe for forms: any other touch delivers the pending value first
   * (lib/selectionCommitFence). Default false = onChange right away.
   */
  commitOnSettle?: boolean;
}

interface OptionItemProps {
  option: SegmentedOption;
  isSelected: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  fontSize?: number;
  iconSize?: number;
  index?: number;
  totalOptions?: number;
  /** Live pill edges (UI thread). Optional so the item still renders on its own (tests, first frame). */
  pillLeft?: SharedValue<number>;
  pillRight?: SharedValue<number>;
  optionWidth?: number;
}

// Soft "arrived" tick. iOS only: Android has no soft tick and would buzz twice ~320ms apart.
const LANDING_TICK = LANDING_HAPTIC_ENABLED && Platform.OS === 'ios';

const OptionItem: React.FC<OptionItemProps> = React.memo(({
  option,
  isSelected,
  onPress,
  activeColor,
  inactiveColor,
  fontSize,
  iconSize = 16,
  index = 0,
  totalOptions = 1,
  pillLeft,
  pillRight,
  optionWidth = 0,
}) => {
  const { colors } = useTheme();
  const pressScale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // Active-colour copy of the label fades in as the pill slides under it (UI thread, no re-render),
  // so text colour and pill always move together.
  const activeLayerStyle = useAnimatedStyle(() => {
    if (!pillLeft || !pillRight || !(optionWidth > 0)) {
      return { opacity: isSelected ? 1 : 0 };
    }
    return { opacity: labelActiveProgress(pillLeft.value, pillRight.value, index, optionWidth) };
  });
  const inactiveLayerStyle = useAnimatedStyle(() => {
    if (!pillLeft || !pillRight || !(optionWidth > 0)) {
      return { opacity: isSelected ? 0 : 1 };
    }
    return {
      opacity: inactiveLabelOpacity(labelActiveProgress(pillLeft.value, pillRight.value, index, optionWidth)),
    };
  });

  const reduceMotion = useReducedMotion();

  const handlePressIn = () => {
    if (reduceMotion) return;
    pressScale.value = withSpring(Motion.scale.chip, { stiffness: 520, damping: 32, mass: 1 });
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    pressScale.value = withSpring(1, Motion.springs.settle);
  };

  const IconComponent = option.icon;

  // Returns [icon, text] (not a fragment) so both label layers share the exact same tree shape.
  const renderLabel = (color: string) => [
    IconComponent ? <IconComponent key="icon" size={iconSize} color={color} /> : null,
    <Text
        key="text"
        numberOfLines={1}
        maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}
        style={[
          styles.optionLabel,
          {
            color,
            fontFamily: FontFamily.bold,
            marginLeft: IconComponent ? 6 : 0,
            ...(fontSize ? { fontSize, lineHeight: fontSize + 4 } : {}),
          },
        ]}
      >
        {option.label}
      </Text>,
  ];

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      accessible
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={option.label}
      style={styles.optionButton}
      hitSlop={{
        top: 10,
        bottom: 10,
        left: index === 0 ? 16 : 0,
        right: index === totalOptions - 1 ? 16 : 0,
      }}
    >
      <Animated.View style={[styles.optionContent, animStyle]}>
        {option.badge ? (
          <View style={styles.badgeWrapper} pointerEvents="none">
            <View style={[styles.badgePill, { backgroundColor: colors.mintGreenDark }]}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}>{option.badge}</Text>
            </View>
          </View>
        ) : null}
        <Animated.View style={[styles.labelRow, inactiveLayerStyle]}>{renderLabel(inactiveColor)}</Animated.View>
        <Animated.View style={[styles.labelRow, styles.activeLabelLayer, activeLayerStyle]} pointerEvents="none">
          {renderLabel(activeColor)}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

/**
 * Standardized SegmentedControl primitive for Arthik (see lib/segmentedMotion.ts for the why).
 * - Liquid pill: leading and trailing edges ride separate springs on the UI thread, so the pill
 *   stretches in the direction of travel and settles back to its exact width. Corners never squash.
 * - Label colours cross-fade with the pill's live position, not on React re-render.
 * - Haptics: a selection tick on tap and a soft tick when the pill lands.
 * - Transform-only pill: two round caps + a scaled flat middle (+ one blurred shadow). No `width`
 *   animation, so no per-frame layout and nothing a React commit can block (see segmentedMotion.ts).
 * - commitOnSettle: heavy screens get onChange only after the pill has landed, so their re-render can
 *   never stutter the glide. Rapid taps report only the last one. Touch fence keeps forms correct.
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = React.memo(({
  options,
  selectedKey,
  onChange,
  style,
  height = ControlHeight.standard,
  borderRadius = BorderRadius.pill,
  activePillColor,
  activeTextColor,
  inactiveTextColor,
  backgroundColor,
  borderColor,
  fontSize,
  iconSize,
  testID,
  commitOnSettle = false,
}) => {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();

  const normalizedOptions: SegmentedOption[] = options.map((opt) =>
    typeof opt === 'string' ? { key: opt, label: opt } : opt
  );

  const selectedIndex = Math.max(
    0,
    normalizedOptions.findIndex((opt) => opt.key === selectedKey)
  );

  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const pillLeft = useSharedValue(0);
  const pillRight = useSharedValue(0);
  // Where the pill is heading (JS copy of the last target). A tap measures its landing time from here.
  const targetEdgesRef = useRef<{ left: number; right: number } | null>(null);
  // Absolute time (ms) at which the current glide has landed. A tap commits no earlier than this.
  const landingAtRef = useRef(0);
  const fenceOwnerRef = useRef<number>(0);
  if (fenceOwnerRef.current === 0) fenceOwnerRef.current = createFenceOwner();
  const isFirstLayout = useRef(true);
  const prevIndexRef = useRef(selectedIndex);
  const prevOptionWidthRef = useRef(0);
  const prevOptionsCountRef = useRef(normalizedOptions.length);
  // Key the user tapped that the parent has not been told about yet (commitOnSettle only).
  const pendingKeyRef = useRef<string | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const trackInset = Spacing.micro;
  const optionWidth = optionWidthFor(containerWidth, normalizedOptions.length, trackInset);

  const snapTo = useCallback((targetIndex: number, optWidth: number) => {
    cancelAnimation(pillLeft);
    cancelAnimation(pillRight);
    const edges = pillEdgesFor(targetIndex, optWidth);
    targetEdgesRef.current = edges;
    landingAtRef.current = 0;
    pillLeft.value = edges.left;
    pillRight.value = edges.right;
  }, [pillLeft, pillRight]);

  const animateTo = useCallback((targetIndex: number, optWidth: number) => {
    if (optWidth <= 0) return;
    prevIndexRef.current = targetIndex;
    const target = pillEdgesFor(targetIndex, optWidth);
    targetEdgesRef.current = target;
    if (reduceMotion) {
      // OS "reduce motion": no glide, no stretch.
      snapTo(targetIndex, optWidth);
      return;
    }
    // withSpring keeps in-flight velocity, so a re-tap mid-glide redirects smoothly.
    const springs = edgeSpringsFor(pillLeft.value, target.left, optWidth);
    pillLeft.value = withSpring(target.left, springs.left);
    pillRight.value = withSpring(target.right, springs.right);
  }, [pillLeft, pillRight, reduceMotion, snapTo]);

  // Deliver the pending tap to the parent. `viaTransition` = normal timer path (interruptible render);
  // false = touch fence / unmount (must be applied before the next press handler runs).
  const deliverPending = useCallback((viaTransition: boolean) => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    clearPendingSelection(fenceOwnerRef.current);
    const finalKey = pendingKeyRef.current;
    pendingKeyRef.current = null;
    if (finalKey === null) return;
    if (viaTransition) {
      React.startTransition(() => {
        onChangeRef.current(finalKey);
      });
    } else {
      onChangeRef.current(finalKey);
    }
  }, []);

  // Touch-driven selection: pill starts on the UI thread on frame 0.
  const handleSelect = useCallback((key: string, idx: number) => {
    const indexChanged = idx !== prevIndexRef.current;
    // Like UISegmentedControl: tick only when the selection actually changes (not on a re-tap).
    if (indexChanged) Haptics.selectionAsync().catch(() => {});
    const now = Date.now();
    if (indexChanged) {
      let glideMs = reduceMotion ? 0 : PILL_COMMIT_MS;
      if (optionWidth > 0) {
        const from = targetEdgesRef.current ?? pillEdgesFor(prevIndexRef.current, optionWidth);
        if (!reduceMotion) glideMs = pillLandingMs(from.left, from.right, idx, optionWidth);
        animateTo(idx, optionWidth);
      } else {
        prevIndexRef.current = idx;
      }
      landingAtRef.current = now + glideMs;
    }
    // A re-tap on the slot the pill is already heading to still waits for the rest of the glide.
    const remaining = Math.max(0, landingAtRef.current - now);

    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    if (indexChanged && LANDING_TICK) {
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      }, remaining);
    }

    if (!commitOnSettle) {
      React.startTransition(() => {
        onChangeRef.current(key);
      });
      return;
    }

    // commitOnSettle: tell the parent only once the pill has landed, so its re-render (a React commit,
    // which pauses Reanimated's UI commits until it is mounted) can never freeze the glide.
    pendingKeyRef.current = key;
    setPendingSelection(fenceOwnerRef.current, () => deliverPending(false));
    commitTimerRef.current = setTimeout(() => deliverPending(true), remaining);
  }, [animateTo, optionWidth, commitOnSettle, reduceMotion, deliverPending]);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    // Never lose a tap: if the screen goes away mid-glide, hand the value over now.
    if (pendingKeyRef.current !== null) {
      deliverPending(false);
    } else {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      clearPendingSelection(fenceOwnerRef.current);
    }
  }, [deliverPending]);

  // Pill-owned touches are claimed so the app-root touch fence does not flush this pill on a re-tap.
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    claimTouch(fenceOwnerRef.current, e?.nativeEvent);
  }, []);

  useEffect(() => {
    if (optionWidth > 0) {
      if (isFirstLayout.current) {
        snapTo(selectedIndex, optionWidth);
        isFirstLayout.current = false;
        prevIndexRef.current = selectedIndex;
        prevOptionWidthRef.current = optionWidth;
        prevOptionsCountRef.current = normalizedOptions.length;
        return;
      }

      // While a tap is waiting to be reported, the parent's value is intentionally stale: keep the pill
      // where the user put it.
      if (pendingKeyRef.current !== null) return;

      const optionsCountChanged = prevOptionsCountRef.current !== normalizedOptions.length;
      const optionWidthChanged = Math.abs(prevOptionWidthRef.current - optionWidth) > 0.5;
      const indexChanged = prevIndexRef.current !== selectedIndex;

      if (optionsCountChanged || optionWidthChanged) {
        // Geometry changed: snap to the new slot, no glide.
        snapTo(selectedIndex, optionWidth);
        prevIndexRef.current = selectedIndex;
        prevOptionWidthRef.current = optionWidth;
        prevOptionsCountRef.current = normalizedOptions.length;
      } else if (indexChanged) {
        // Parent changed the value itself (e.g. cadence alignment): glide there.
        animateTo(selectedIndex, optionWidth);
      }
    }
  }, [selectedIndex, optionWidth, normalizedOptions.length, animateTo, snapTo]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    const measuredHeight = e.nativeEvent.layout.height;
    if (measuredHeight > 0 && Math.abs(measuredHeight - containerHeight) > 0.5) {
      setContainerHeight(measuredHeight);
    }
    // Guard against sub-pixel float noise and spurious reflow cancellations
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      // Place the pill BEFORE the first render that shows it, so there is no frame with the pill in the
      // wrong place (including the very first layout).
      const newOptWidth = optionWidthFor(width, normalizedOptions.length, trackInset);
      if (newOptWidth > 0) {
        snapTo(prevIndexRef.current, newOptWidth);
        prevOptionWidthRef.current = newOptWidth;
      }
      setContainerWidth(width);
    }
  };

  const resolvedBg = backgroundColor ?? colors.cardSubtle;
  const resolvedBorder = borderColor ?? colors.borderSubtle;
  const resolvedPillBg = activePillColor ?? colors.mintGreen;
  const resolvedActiveText = activeTextColor ?? colors.forestGreen;
  const resolvedInactiveText = inactiveTextColor ?? colors.textSecondary;

  const { hasOptionColors, colorInputRange, colorOutputRange } = useMemo(() => {
    const hasAny = normalizedOptions.some((opt) => !!opt.activePillColor);
    if (!hasAny || normalizedOptions.length === 0) {
      return { hasOptionColors: false, colorInputRange: [0, 1], colorOutputRange: [resolvedPillBg, resolvedPillBg] };
    }
    const input: number[] = [];
    const output: string[] = [];
    normalizedOptions.forEach((opt, idx) => {
      input.push(idx);
      output.push(opt.activePillColor ?? resolvedPillBg);
    });
    if (input.length === 1) {
      input.push(1);
      output.push(output[0]);
    }
    return { hasOptionColors: true, colorInputRange: input, colorOutputRange: output };
  }, [normalizedOptions, resolvedPillBg]);

  // ── Pill geometry (static per layout) ──
  // The pill sits inside the 1px border with `trackInset` on every side.
  const BORDER = 1;
  const resolvedHeight = containerHeight > 0 ? containerHeight : height;
  const pillHeight = Math.max(0, resolvedHeight - 2 * BORDER - 2 * trackInset);
  const pillRadius = pillRadiusFor(Math.max(4, borderRadius - 2), pillHeight);
  const capWidth = capWidthFor(pillRadius);
  const pieceBase = optionWidth > 0 ? optionWidth : 1;
  // Pieces overlap inside the pill, so they need opaque colours. Otherwise: one scaled box.
  const usePieces = useMemo(
    () => isOpaqueColor(resolvedPillBg) && normalizedOptions.every((o) => !o.activePillColor || isOpaqueColor(o.activePillColor)),
    [resolvedPillBg, normalizedOptions]
  );

  // Pill colour at the pill's live centre (UI thread). Same formula as before (centre-anchored).
  const pillColorAt = (left: number, right: number): string => {
    'worklet';
    if (!hasOptionColors || !(optionWidth > 0)) return resolvedPillBg;
    const pillCenter = (left + right) / 2;
    const centerSlot = (pillCenter - optionWidth / 2) / optionWidth;
    return interpolateColor(centerSlot, colorInputRange, colorOutputRange) as string;
  };

  // TRANSFORM / OPACITY / COLOUR ONLY. No `width`: nothing here needs Yoga layout or a shadow-tree commit.
  const pillGroupStyle = useAnimatedStyle(() => ({
    // Hidden until placed (both edges still at their initial 0), so it can never flash as a dot.
    opacity: pillRight.value - pillLeft.value > 1 ? 1 : 0,
  }));
  const shadowStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillLeft.value, pillRight.value, pillRadius, pieceBase, pieceBase);
    return { transform: [{ translateX: p.shadowX }, { scaleX: p.shadowScaleX }] };
  });
  const singleStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillLeft.value, pillRight.value, pillRadius, pieceBase, pieceBase);
    return {
      backgroundColor: pillColorAt(pillLeft.value, pillRight.value),
      transform: [{ translateX: p.shadowX }, { scaleX: p.shadowScaleX }],
    };
  });
  const leftCapStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillLeft.value, pillRight.value, pillRadius, pieceBase, pieceBase);
    return {
      backgroundColor: pillColorAt(pillLeft.value, pillRight.value),
      transform: [{ translateX: p.leftCapX }],
    };
  });
  const bodyStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillLeft.value, pillRight.value, pillRadius, pieceBase, pieceBase);
    return {
      backgroundColor: pillColorAt(pillLeft.value, pillRight.value),
      transform: [{ translateX: p.bodyX }, { scaleX: p.bodyScaleX }],
    };
  });
  const rightCapStyle = useAnimatedStyle(() => {
    const p = pillPiecesFor(pillLeft.value, pillRight.value, pillRadius, pieceBase, pieceBase);
    return {
      backgroundColor: pillColorAt(pillLeft.value, pillRight.value),
      transform: [{ translateX: p.rightCapX }],
    };
  });

  const pieceFrame = { top: trackInset, left: trackInset, height: pillHeight };

  return (
    <View
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      accessible
      accessibilityRole="tablist"
      testID={testID}
      style={[
        styles.container,
        {
          height,
          backgroundColor: resolvedBg,
          borderRadius,
          borderColor: resolvedBorder,
        },
        style,
      ]}
    >
      {/* Clipped Slider Track: Strictly clips pill inside container radius */}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.trackWrapper,
          { borderRadius: Math.max(0, borderRadius - 1) },
        ]}
        pointerEvents="none"
      >
        {optionWidth > 0 && pillHeight > 0 && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, pillGroupStyle]}>
            {/* Shadow only (no fill): one blurred box, drawn first so it always sits UNDER the pill. */}
            <Animated.View
              style={[
                styles.piece,
                pieceFrame,
                { width: pieceBase, borderRadius: pillRadius, boxShadow: PILL_BOX_SHADOW },
                shadowStyle,
              ]}
            />
            {usePieces ? (
              <>
                <Animated.View style={[styles.piece, pieceFrame, { width: pieceBase }, bodyStyle]} />
                <Animated.View
                  style={[styles.piece, pieceFrame, { width: capWidth, borderRadius: pillRadius }, leftCapStyle]}
                />
                <Animated.View
                  style={[styles.piece, pieceFrame, { width: capWidth, borderRadius: pillRadius }, rightCapStyle]}
                />
              </>
            ) : (
              <Animated.View
                style={[styles.piece, pieceFrame, { width: pieceBase, borderRadius: pillRadius }, singleStyle]}
              />
            )}
          </Animated.View>
        )}
      </View>

      {/* Options Row: interactive tabs and floating badges */}
      <View style={styles.optionsRow}>
        {normalizedOptions.map((option, idx) => (
          <OptionItem
            key={option.key}
            option={option}
            isSelected={option.key === selectedKey}
            onPress={() => handleSelect(option.key, idx)}
            activeColor={resolvedActiveText}
            inactiveColor={resolvedInactiveText}
            fontSize={fontSize}
            iconSize={iconSize}
            index={idx}
            totalOptions={normalizedOptions.length}
            pillLeft={pillLeft}
            pillRight={pillRight}
            optionWidth={optionWidth}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: ControlHeight.standard,
    padding: Spacing.micro,
    borderWidth: 1,
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
    overflow: 'visible',
  },
  trackWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    zIndex: 10,
    elevation: 4,
  },
  optionButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  optionContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeLabelLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  optionLabel: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    textAlign: 'center',
    includeFontPadding: false,
  },
  badgeWrapper: {
    position: 'absolute',
    top: -22,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgePill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    lineHeight: 11,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
});

export default SegmentedControl;
