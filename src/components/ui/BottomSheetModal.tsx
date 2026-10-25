import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Easing,
  useAnimatedValue,
  StyleProp,
  ViewStyle,
  Keyboard,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import X from 'lucide-react-native/icons/x';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  Easing as REasing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { ThemeColors, FontFamily, FontSize, Spacing, BorderRadius, Motion } from '../../config/theme';
import { PressableOpacity } from './PressableOpacity';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  colors: ThemeColors;
  isDark: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Sheets with text inputs: lift the whole sheet (inputs AND the footer button) above the keyboard and let the
   * content scroll, so nothing ends up hidden behind the keyboard. Off by default: other sheets are unchanged.
   */
  avoidKeyboard?: boolean;
  /**
   * Drag the sheet down with a finger to close it (with a grab handle on top). The sheet follows the finger 1:1,
   * the backdrop lightens as it goes, and on release it either glides away (dragged far enough or flicked) or
   * springs back. Off by default: other sheets are unchanged.
   */
  swipeToDismiss?: boolean;
}

// ── Swipe-to-dismiss tuning ──
/** Fraction of the sheet's height past which a release closes the sheet. */
const DISMISS_DISTANCE_RATIO = 0.28;
/** A downward flick faster than this (pt/s) closes the sheet even if it was dragged only a little. */
const DISMISS_VELOCITY = 900;
/** The pan only takes over after this many points downwards, so taps and horizontal swipes stay untouched. */
const DRAG_ACTIVATION_PX = 10;
const SNAP_BACK_SPRING = Motion.springs.sheet;

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  title,
  headerLeft,
  headerRight,
  children,
  footer,
  colors,
  isDark,
  contentStyle,
  containerStyle,
  avoidKeyboard = false,
  swipeToDismiss = false,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!avoidKeyboard) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e?.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [avoidKeyboard]);
  const keyboardOpen = avoidKeyboard && keyboardHeight > 0;
  const [isMounted, setIsMounted] = useState(visible);
  const initialSlide = Math.max(windowHeight || 800, 600);
  const slideAnim = useAnimatedValue(initialSlide);
  const fadeAnim = useAnimatedValue(0);
  const flattenedContainerStyle = StyleSheet.flatten(containerStyle) as ViewStyle | undefined;
  const sheetBgColor = flattenedContainerStyle?.backgroundColor || colors.card;
  const isFirstRender = useRef(true);
  const reduceMotion = useReduceMotion();
  // Guards the close animation's completion callback: if `visible` flips back to true while the close animation is
  // still in flight, that stale callback must NOT unmount the (now reopened) sheet.
  const closeToken = useRef(0);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }

    if (visible) {
      closeToken.current += 1; // invalidate any in-flight close
      setIsMounted(true);
      if (reduceMotion) {
        fadeAnim.setValue(1);
        slideAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            stiffness: Motion.springs.sheet.stiffness,
            damping: Motion.springs.sheet.damping,
            mass: Motion.springs.sheet.mass,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      const token = (closeToken.current += 1);
      if (reduceMotion) {
        fadeAnim.setValue(0);
        slideAnim.setValue(initialSlide);
        setIsMounted(false);
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 160,
            easing: Easing.bezier(0.32, 0.72, 0, 1),
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: initialSlide,
            duration: 180,
            easing: Easing.bezier(0.32, 0.72, 0, 1),
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (closeToken.current === token) {
            setIsMounted(false);
          }
        });
      }
    }
  }, [visible, slideAnim, fadeAnim, reduceMotion]);

  // ── Swipe to dismiss (UI thread). dragY is applied on top of the open/close slide above. ──
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(Math.max(windowHeight * 0.5, 320));
  const pastThreshold = useSharedValue(false);

  // Every time the sheet opens it starts from rest (no left-over drag from the last close).
  useEffect(() => {
    if (visible) {
      cancelAnimation(dragY);
      dragY.value = 0;
      pastThreshold.value = false;
    }
  }, [visible, dragY, pastThreshold]);

  const lightTick = () => {
    Haptics.selectionAsync().catch(() => {});
  };

  const pan = useMemo(() => Gesture.Pan()
    .enabled(swipeToDismiss && !keyboardOpen)
    .activeOffsetY(DRAG_ACTIVATION_PX)
    .failOffsetX([-24, 24])
    .onStart(() => {
      cancelAnimation(dragY);
    })
    .onUpdate((e) => {
      const t = e.translationY;
      // Down: follows the finger 1:1. Up (past the resting point): a short, stiff rubber band.
      dragY.value = t >= 0 ? t : -Math.min(18, Math.sqrt(-t) * 2);
      const past = t > sheetHeight.value * DISMISS_DISTANCE_RATIO;
      if (past !== pastThreshold.value) {
        pastThreshold.value = past;
        if (past) scheduleOnRN(lightTick);
      }
    })
    .onEnd((e) => {
      const far = e.translationY > sheetHeight.value * DISMISS_DISTANCE_RATIO;
      const flicked = e.velocityY > DISMISS_VELOCITY && e.translationY > DRAG_ACTIVATION_PX * 2;
      if (far || flicked) {
        // Glide out at the speed of the finger (never slower than a crisp 260ms, never a jarring snap).
        const remaining = Math.max(0, sheetHeight.value + 80 - dragY.value);
        const speed = Math.max(e.velocityY, 1400);
        const duration = Math.min(260, Math.max(140, (remaining / speed) * 1000));
        dragY.value = withTiming(sheetHeight.value + 80, { duration, easing: REasing.out(REasing.cubic) });
        scheduleOnRN(onClose);
      } else {
        dragY.value = withSpring(0, { ...SNAP_BACK_SPRING, velocity: e.velocityY });
      }
      pastThreshold.value = false;
    }),
    // Shared values are stable; the gesture is rebuilt only when its inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swipeToDismiss, keyboardOpen, onClose]
  );

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  // The backdrop lightens as the sheet is pulled down, so the drag feels physically connected to the dim.
  const backdropDragStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, dragY.value / Math.max(1, sheetHeight.value)));
    return { opacity: 1 - p * 0.9 };
  });

  if (!isMounted) return null;

  const sheet = (
    <Animated.View
      onLayout={
        swipeToDismiss
          ? (e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) sheetHeight.value = h;
            }
          : undefined
      }
      style={[
        styles.sheetContainer,
        swipeToDismiss && styles.sheetContainerInDrag,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSubtle,
          borderTopWidth: isDark ? 1 : 0,
          borderLeftWidth: isDark ? 1 : 0,
          borderRightWidth: isDark ? 1 : 0,
          borderBottomWidth: 0,
          paddingBottom: keyboardOpen ? Spacing.block : Math.max(insets.bottom, Spacing.block),
          transform: [{ translateY: slideAnim }],
        },
        swipeToDismiss && styles.sheetContainerWithHandle,
        // Keyboard open: sit right above it and never be taller than the space that is left.
        keyboardOpen && {
          marginBottom: keyboardHeight,
          maxHeight: Math.max(240, windowHeight - keyboardHeight - insets.top - Spacing.block),
        },
        containerStyle,
      ]}
    >
      {/* Grab handle: tells the user the sheet can be pulled down */}
      {swipeToDismiss && (
        <View style={styles.handleZone} pointerEvents="none">
          <View
            style={[
              styles.handle,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(26, 43, 76, 0.18)' },
            ]}
          />
        </View>
      )}

      {/* Header Row */}
      {(title || headerLeft || headerRight) && (
        <View style={styles.headerRow}>
          {headerLeft ? headerLeft : <View style={{ width: 36 }} />}
          {title ? (
            <Text
              style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          {headerRight ? (
            headerRight
          ) : (
            <Pressable
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
              ]}
              onPress={onClose}
              hitSlop={8}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <X size={18} color={colors.textPrimary} />
            </Pressable>
          )}
        </View>
      )}

      {avoidKeyboard ? (
        <ScrollView
          style={styles.contentContainer}
          contentContainerStyle={contentStyle as any}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.contentContainer, contentStyle]}>{children}</View>
      )}

      {footer ? <View style={styles.footerContainer}>{footer}</View> : null}

      {/* Bleed skirt: anchors the bottom of the sheet so spring overshoot never exposes the background underneath */}
      {!keyboardOpen && (
        <View
          style={[
            styles.overshootSkirt,
            {
              backgroundColor: sheetBgColor,
              borderColor: colors.borderSubtle,
              borderLeftWidth: isDark ? 1 : 0,
              borderRightWidth: isDark ? 1 : 0,
              borderBottomWidth: 0,
              left: isDark ? -1 : 0,
              right: isDark ? -1 : 0,
            },
          ]}
          pointerEvents="none"
        />
      )}
    </Animated.View>
  );

  const backdrop = (
    <Animated.View
      style={[
        styles.backdrop,
        {
          opacity: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.55],
          }),
        },
      ]}
    >
      <PressableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
    </Animated.View>
  );

  if (!swipeToDismiss) {
    return (
      <Modal visible={isMounted} transparent animationType="none" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          {backdrop}
          {sheet}
        </View>
      </Modal>
    );
  }

  // Swipe-to-dismiss: gesture-handler needs its own root inside a Modal (Android).
  return (
    <Modal visible={isMounted} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalOverlay}>
        <Reanimated.View style={[StyleSheet.absoluteFill, backdropDragStyle]}>{backdrop}</Reanimated.View>
        <GestureDetector gesture={pan}>
          <Reanimated.View style={[styles.dragWrapper, dragStyle]}>{sheet}</Reanimated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  dragWrapper: {
    width: '100%',
    // The cap lives on the wrapper here (a % max-height on the sheet would resolve against an auto-height parent).
    maxHeight: '90%',
  },
  sheetContainerInDrag: {
    maxHeight: undefined,
  },
  sheetContainerWithHandle: {
    paddingTop: Spacing.block,
  },
  handleZone: {
    alignItems: 'center',
    paddingBottom: Spacing.element,
    marginTop: -4,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.cardLarge,
    borderTopRightRadius: BorderRadius.cardLarge,
    paddingTop: Spacing.surface,
    paddingHorizontal: Spacing.gutter,
    maxHeight: '90%',
    overflow: 'visible',
  },
  overshootSkirt: {
    position: 'absolute',
    bottom: -300,
    height: 300,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.block,
  },
  headerTitle: {
    fontSize: FontSize.titleMedium,
    textAlign: 'center',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexShrink: 1,
  },
  footerContainer: {
    marginTop: Spacing.block,
  },
});
