import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAlertStore, AlertButton } from '../../store/alertStore';
import { useTheme } from '../../store/themeStore';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { FontFamily, BorderRadius } from '../../config/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MAX_WIDTH = Math.min(SCREEN_WIDTH - 48, 380);

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
  const isDestructive = button.style === 'destructive';
  const isCancel = button.style === 'cancel';

  // Variant-specific styling based on theme
  let bg = colors.mintGreen;
  let textColor = '#1A2B4C';
  let borderC = 'transparent';

  if (isDestructive) {
    bg = colors.danger;
    textColor = '#FFFFFF';
  } else if (isCancel) {
    bg = colors.cardSubtle;
    textColor = colors.textPrimary;
    borderC = colors.border;
  } else if (isAmoled) {
    bg = colors.mintGreen;
    textColor = '#000000';
  } else if (!colors.isDark) {
    // In light theme, use deeper mint for strong contrast
    bg = colors.mintGreenDark || colors.mintGreen;
    textColor = '#1A2B4C';
  }

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
  const { isOpen, title, message, buttons, options, hideAlert } = useAlertStore();
  const { colors, themeMode } = useTheme();
  const reduceMotion = useReduceMotion();

  const isAmoled = themeMode === 'amoled' || colors.background === '#000000';

  // Internal mounted state to allow exit animations
  const [isRendered, setIsRendered] = useState(isOpen);

  const cardScale = useSharedValue(reduceMotion ? 1 : 0.93);
  const cardOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const backdropOpacity = useSharedValue(0);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const triggerClose = useCallback(
    (onDone?: () => void) => {
      if (reduceMotion) {
        setIsRendered(false);
        hideAlert();
        if (onDone) onDone();
        return;
      }

      cardScale.value = withTiming(0.94, { duration: 130 });
      cardOpacity.value = withTiming(0, { duration: 130 });
      backdropOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) {
          runOnJS(setIsRendered)(false);
          runOnJS(hideAlert)();
          if (onDone) {
            runOnJS(onDone)();
          }
        }
      });
    },
    [reduceMotion, hideAlert, cardScale, cardOpacity, backdropOpacity]
  );

  useEffect(() => {
    if (isOpen) {
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
    } else if (isRendered) {
      triggerClose();
    }
  }, [isOpen, reduceMotion, triggerClose, isRendered, cardScale, cardOpacity, backdropOpacity]);

  const handleButtonPress = (btn: AlertButton) => {
    Haptics.impactAsync(
      btn.style === 'destructive'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    ).catch(() => {});

    triggerClose(() => {
      if (btn.onPress) {
        try {
          const res = btn.onPress();
          if (res instanceof Promise) {
            res.catch((err) => {
              if (__DEV__) {
                console.error('[AppAlertModal] Action rejected:', err);
              }
            });
          }
        } catch (e) {
          if (__DEV__) {
            console.error('[AppAlertModal] Action threw:', e);
          }
        }
      }
    });
  };

  const handleBackdropPress = () => {
    if (options?.cancelable === false) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const cancelBtn = buttons.find((b) => b.style === 'cancel');

    triggerClose(() => {
      if (cancelBtn?.onPress) {
        try {
          cancelBtn.onPress();
        } catch (e) {
          if (__DEV__) {
            console.error('[AppAlertModal] Cancel action threw:', e);
          }
        }
      } else if (options?.onDismiss) {
        try {
          options.onDismiss();
        } catch (e) {
          if (__DEV__) {
            console.error('[AppAlertModal] onDismiss threw:', e);
          }
        }
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
