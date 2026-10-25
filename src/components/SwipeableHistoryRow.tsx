import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Trash2 from 'lucide-react-native/icons/trash';
import { ThemeColors, FontFamily, FontSize } from '../config/theme';
import { useReduceMotion } from '../hooks/useReduceMotion';

export interface SwipeableHistoryRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  colors: ThemeColors;
  isDark: boolean;
  disabled?: boolean;
  isOpen?: boolean;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

const ACTION_WIDTH = 80;

// Apple Fluid Interfaces momentum projection (0.992 deceleration for crisp responsive feel)
function project(velocity: number, decelerationRate = 0.992) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Apple Fluid Interfaces rubber-banding resistance past boundary
function rubberband(overshoot: number, dimension: number, constant = 0.5) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export const SwipeableHistoryRow: React.FC<SwipeableHistoryRowProps> = ({
  children,
  onDelete,
  deleteLabel = 'Delete',
  colors,
  isDark: _isDark,
  disabled = false,
  isOpen,
  onSwipeOpen,
  onSwipeClose,
}) => {
  const reduceMotion = useReduceMotion();
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);
  const btnScale = useSharedValue(1);
  const [swipedOpen, setSwipedOpen] = useState(false);

  // Sync with external multi-row coordination (close if another row opened)
  useEffect(() => {
    if (isOpen === false && translateX.value !== 0) {
      if (reduceMotion) {
        translateX.value = 0;
      } else {
        translateX.value = withSpring(0, { mass: 0.6, damping: 22, stiffness: 320 });
      }
      setSwipedOpen(false);
    }
  }, [isOpen, reduceMotion, translateX]);

  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const triggerMediumHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const handleOpenNotify = useCallback(() => {
    setSwipedOpen(true);
    onSwipeOpen?.();
  }, [onSwipeOpen]);

  const handleCloseNotify = useCallback(() => {
    setSwipedOpen(false);
    onSwipeClose?.();
  }, [onSwipeClose]);

  const closeSwipe = useCallback(() => {
    if (reduceMotion) {
      translateX.value = 0;
    } else {
      translateX.value = withSpring(0, { mass: 0.6, damping: 22, stiffness: 320 });
    }
    handleCloseNotify();
  }, [reduceMotion, translateX, handleCloseNotify]);

  const handleDeletePress = useCallback(() => {
    triggerMediumHaptic();
    closeSwipe();
    onDelete();
  }, [triggerMediumHaptic, closeSwipe, onDelete]);

  const panGesture = useMemo(() => {
    if (disabled) {
      return Gesture.Pan().enabled(false);
    }

    return Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-8, 8])
      .onStart(() => {
        'worklet';
        contextX.value = translateX.value;
      })
      .onUpdate((e) => {
        'worklet';
        const next = contextX.value + e.translationX;
        if (next > 0) {
          // Dragging right past 0: soft rubber-banding resistance
          translateX.value = rubberband(next, ACTION_WIDTH, 0.35);
        } else if (next < -ACTION_WIDTH) {
          // Dragging left past action width: smooth elastic stretch
          const overshoot = next + ACTION_WIDTH;
          translateX.value = -ACTION_WIDTH + rubberband(overshoot, ACTION_WIDTH * 1.4, 0.45);
        } else {
          // Direct 1:1 finger tracking
          translateX.value = next;
        }
      })
      .onEnd((e) => {
        'worklet';
        const projected = translateX.value + project(e.velocityX, 0.992);

        // Snap open if projected past 45% or flicked fast left (< -400px/s)
        if (projected < -ACTION_WIDTH * 0.45 || e.velocityX < -400) {
          translateX.value = withSpring(-ACTION_WIDTH, {
            mass: 0.6,
            damping: 22,
            stiffness: 320,
            velocity: e.velocityX,
          });
          scheduleOnRN(triggerLightHaptic);
          scheduleOnRN(handleOpenNotify);
        } else {
          // Snap closed
          translateX.value = withSpring(0, {
            mass: 0.6,
            damping: 22,
            stiffness: 320,
            velocity: e.velocityX,
          });
          scheduleOnRN(handleCloseNotify);
        }
      });
  }, [disabled, translateX, contextX, triggerLightHaptic, handleOpenNotify, handleCloseNotify]);

  // Foreground row animation
  const animatedRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Dynamic underlay expansion (fills revealed space if user overswipes)
  const animatedUnderlayStyle = useAnimatedStyle(() => {
    const w = Math.max(ACTION_WIDTH, -translateX.value);
    return {
      width: w,
    };
  });

  // Action button content choreography (scale, opacity & press response)
  const animatedActionContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-ACTION_WIDTH * 0.75, 0],
      [1, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      translateX.value,
      [-ACTION_WIDTH, 0],
      [1, 0.6],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale: scale * btnScale.value }],
    };
  });

  const handleBtnPressIn = useCallback(() => {
    if (!reduceMotion) {
      btnScale.value = withSpring(0.92, { damping: 20, stiffness: 400 });
    }
  }, [reduceMotion, btnScale]);

  const handleBtnPressOut = useCallback(() => {
    if (!reduceMotion) {
      btnScale.value = withSpring(1, { damping: 18, stiffness: 360 });
    }
  }, [reduceMotion, btnScale]);

  const deleteBgColor = colors.peachCoral;
  const deleteContentColor = colors.forestGreen;

  return (
    <View style={styles.wrapper}>
      {/* Dynamic Background Underlay */}
      <Animated.View style={[styles.underlay, animatedUnderlayStyle]}>
        <Pressable
          onPress={handleDeletePress}
          onPressIn={handleBtnPressIn}
          onPressOut={handleBtnPressOut}
          style={[styles.deleteBtn, { backgroundColor: deleteBgColor }]}
          accessibilityRole="button"
          accessibilityLabel={`${deleteLabel} transaction`}
        >
          <Animated.View style={[styles.actionContent, animatedActionContentStyle]}>
            <Trash2 size={20} color={deleteContentColor} strokeWidth={2.4} />
            <Text style={[styles.deleteText, { color: deleteContentColor }]}>
              {deleteLabel}
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* Foreground Row */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.foreground,
            animatedRowStyle,
            { backgroundColor: colors.background },
          ]}
        >
          {children}

          {/* Transparent full-card tap overlay when open (tap anywhere closes instantly) */}
          {swipedOpen && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeSwipe}
              accessibilityRole="button"
              accessibilityLabel="Cancel swipe action"
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  underlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingRight: 6,
    paddingLeft: 4,
  },
  deleteBtn: {
    width: '100%',
    height: '86%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  deleteText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.3,
  },
  foreground: {
    width: '100%',
  },
});
