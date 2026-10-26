import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useAlertStore, AlertButton } from '../../store/alertStore';
import { useTheme } from '../../store/themeStore';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { FontFamily, BorderRadius } from '../../config/theme';
import { FIXED_SHAPE_MAX_FONT_SCALE } from '../../lib/fontScale';
import { alertButtonPalette } from '../../lib/alertButtonPalette';

// The overlay already keeps 24px on each side, so the card only needs a max width (no stale
// module-level screen size: it stays right after rotation, split screen or a foldable unfold).
const CARD_MAX_WIDTH = 380;

interface AlertButtonComponentProps {
  button: AlertButton;
  onPress: () => void;
  isRow: boolean;
  colors: any;
  isAmoled: boolean;
}

const AlertButtonComponent: React.FC<AlertButtonComponentProps> = ({
  button,
  onPress,
  isRow,
  colors,
  isAmoled,
}) => {
  const isCancel = button.style === 'cancel';
  // Every variant is >= 4.5:1 in Light, Dark and AMOLED (see lib/alertButtonPalette.ts).
  const palette = alertButtonPalette(button.style, colors, isAmoled);
  const bg = palette.background;
  const textColor = palette.text;
  const borderC = palette.border;

  const btnScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handlePressIn = () => {
    btnScale.value = withTiming(0.96, { duration: 80 });
  };

  const handlePressOut = () => {
    btnScale.value = withSpring(1, { damping: 14, stiffness: 300 });
  };

  return (
    <Animated.View style={[isRow ? styles.flexOne : styles.fullWidth, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={button.text || 'Action'}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[
          styles.button,
          {
            backgroundColor: bg,
            borderColor: isCancel ? borderC : 'transparent',
          },
        ]}
      >
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}
          style={[
            styles.buttonText,
            {
              color: textColor,
              fontFamily: isCancel ? FontFamily.medium : FontFamily.bold,
            },
          ]}
        >
          {button.text || 'OK'}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

export const AppAlertModal: React.FC = () => {
  const { isOpen, id, title, message, buttons, options, hideAlert } = useAlertStore();
  const { colors, themeMode } = useTheme();
  const reduceMotion = useReduceMotion();

  const isAmoled = themeMode === 'amoled' || colors.background === '#000000';

  // Internal mounted state to allow exit animations
  const [isRendered, setIsRendered] = useState(isOpen);

  const cardScale = useSharedValue(reduceMotion ? 1 : 0.93);
  const cardOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const backdropOpacity = useSharedValue(0);

  // Which alert (by id) has already played its entrance. The entrance runs once per alert, never
  // again on the re-render that `setIsRendered(true)` causes (that restart was a visible hitch).
  const enteredIdRef = useRef(0);
  // true from the first tap on a button / backdrop until the dialog is gone: every later tap is
  // ignored, so "Delete" can never run twice from a double tap.
  const closingRef = useRef(false);
  // The action to run once the exit animation ends. Runs exactly once, even if the animation is
  // interrupted (an interrupted animation reports finished=false; the old code then dropped the action).
  const pendingActionRef = useRef<(() => void) | undefined>(undefined);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // One JS task does everything, so React never renders a half-closed state in between.
  const finishClose = useCallback(() => {
    if (!closingRef.current) return;
    closingRef.current = false;
    const action = pendingActionRef.current;
    pendingActionRef.current = undefined;
    setIsRendered(false);
    hideAlert(); // shows the next queued alert, if any
    if (action) action();
  }, [hideAlert]);

  const triggerClose = useCallback(
    (onDone?: () => void) => {
      if (closingRef.current) return false;
      closingRef.current = true;
      pendingActionRef.current = onDone;

      if (reduceMotion) {
        finishClose();
        return true;
      }

      cardScale.value = withTiming(0.94, { duration: 130 });
      cardOpacity.value = withTiming(0, { duration: 130 });
      backdropOpacity.value = withTiming(0, { duration: 150 }, () => {
        scheduleOnRN(finishClose);
      });
      return true;
    },
    [reduceMotion, finishClose, cardScale, cardOpacity, backdropOpacity]
  );

  // Entrance: once per alert id.
  useEffect(() => {
    if (!isOpen || enteredIdRef.current === id) return;
    enteredIdRef.current = id;
    closingRef.current = false;
    pendingActionRef.current = undefined;
    try {
      Keyboard.dismiss();
    } catch {}
    setIsRendered(true);
    if (reduceMotion) {
      cardScale.value = 1;
      cardOpacity.value = 1;
      backdropOpacity.value = 1;
    } else {
      cardScale.value = 0.93;
      cardOpacity.value = 0;
      backdropOpacity.value = 0;

      cardScale.value = withSpring(1, { damping: 18, stiffness: 260 });
      cardOpacity.value = withTiming(1, { duration: 150 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    }
  }, [isOpen, id, reduceMotion, cardScale, cardOpacity, backdropOpacity]);

  // Closed from outside (hideAlert called by code, not by a tap here): play the exit, no action.
  useEffect(() => {
    if (!isOpen && isRendered && !closingRef.current) {
      triggerClose();
    }
  }, [isOpen, isRendered, triggerClose]);

  const runSafely = (fn: (() => void | Promise<void>) | null | undefined, label: string) => {
    if (!fn) return;
    try {
      const res = fn();
      if (res instanceof Promise) {
        res.catch((err) => {
          if (__DEV__) {
            console.error(`[AppAlertModal] ${label} rejected:`, err);
          }
        });
      }
    } catch (e) {
      if (__DEV__) {
        console.error(`[AppAlertModal] ${label} threw:`, e);
      }
    }
  };

  const handleButtonPress = (btn: AlertButton) => {
    if (closingRef.current) return;
    Haptics.impactAsync(
      btn.style === 'destructive'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    ).catch(() => {});

    triggerClose(() => runSafely(btn.onPress, 'Action'));
  };

  const handleBackdropPress = () => {
    if (closingRef.current) return;
    if (options?.cancelable === false) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const cancelBtn = buttons.find((b) => b.style === 'cancel');

    triggerClose(() => {
      if (cancelBtn?.onPress) {
        runSafely(cancelBtn.onPress, 'Cancel action');
      } else if (options?.onDismiss) {
        runSafely(options.onDismiss, 'onDismiss');
      }
    });
  };

  // Backdrop scrim tint based on theme
  const backdropColor = isAmoled
    ? 'rgba(0, 0, 0, 0.88)'
    : colors.isDark
    ? 'rgba(0, 0, 0, 0.72)'
    : 'rgba(15, 23, 42, 0.45)';

  // Button layout logic
  const isDouble = buttons.length === 2;

  // Determine if a 2-button alert can fit comfortably side-by-side or needs vertical stacking
  const hasLongButtonText = isDouble && buttons.some(
    (b) => (b.text || 'OK').length > 13
  );
  const isTotalTextTooLong = isDouble && (
    (buttons[0]?.text || '').length + (buttons[1]?.text || '').length > 22
  );

  const isRow = isDouble && !hasLongButtonText && !isTotalTextTooLong;

  let displayButtons = buttons;
  if (isRow) {
    // For horizontal row: Cancel always sits on LEFT, Action/Destructive on RIGHT
    const cancelIndex = buttons.findIndex((b) => b.style === 'cancel');
    if (cancelIndex === 1) {
      displayButtons = [buttons[1], buttons[0]];
    }
  } else if (isDouble) {
    // For vertical stack: Action sits on TOP, Cancel sits at the BOTTOM (Apple HIG standard)
    const cancelIndex = buttons.findIndex((b) => b.style === 'cancel');
    if (cancelIndex === 0) {
      displayButtons = [buttons[1], buttons[0]];
    }
  }

  if (!isRendered && !isOpen) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      // Without this the dialog window is not edge-to-edge on Android, so the scrim stops above the
      // system navigation bar and that strip stays undimmed.
      navigationBarTranslucent={true}
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.overlay}>
        {/* Animated Backdrop Scrim */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: backdropColor },
            backdropAnimStyle,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityLabel="Dismiss alert"
          />
        </Animated.View>

        {/* Animated Dialog Card */}
        <Animated.View
          accessibilityRole="alert"
          accessibilityLabel={title}
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            cardAnimStyle,
          ]}
        >
          {/* Header Title */}
          {title ? (
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary },
                !message && styles.titleWithoutMessage,
              ]}
            >
              {title}
            </Text>
          ) : null}

          {/* Subtitle Message */}
          {message ? (
            <ScrollView
              style={styles.messageScroll}
              contentContainerStyle={styles.messageScrollContent}
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={[
                  styles.message,
                  { color: colors.textSecondary },
                  !title && styles.messageWithoutTitle,
                ]}
              >
                {message}
              </Text>
            </ScrollView>
          ) : null}

          {/* Action Buttons */}
          <View
            style={[
              styles.actionsContainer,
              isRow ? styles.actionsRow : styles.actionsColumn,
            ]}
          >
            {displayButtons.map((btn, idx) => (
              <AlertButtonComponent
                key={`${btn.text || 'btn'}-${idx}`}
                button={btn}
                onPress={() => handleButtonPress(btn)}
                isRow={isRow}
                colors={colors}
                isAmoled={isAmoled}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  titleWithoutMessage: {
    marginBottom: 20,
  },
  messageScroll: {
    maxHeight: 220,
    width: '100%',
    marginBottom: 20,
  },
  messageScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  message: {
    fontFamily: FontFamily.medium,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  messageWithoutTitle: {
    marginTop: 4,
  },
  actionsContainer: {
    width: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionsColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  flexOne: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
  button: {
    height: 48,
    width: '100%',
    borderRadius: BorderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    letterSpacing: 0.1,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
