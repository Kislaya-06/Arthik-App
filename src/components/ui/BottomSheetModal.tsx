import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  useAnimatedValue,
  StyleProp,
  ViewStyle,
  Keyboard,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors, FontFamily, FontSize, Spacing, BorderRadius } from '../../config/theme';

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
}

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
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      const token = (closeToken.current += 1);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: initialSlide,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (closeToken.current === token) {
          setIsMounted(false);
        }
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!isMounted) return null;

  return (
    <Modal visible={isMounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
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
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
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
            // Keyboard open: sit right above it and never be taller than the space that is left.
            keyboardOpen && {
              marginBottom: keyboardHeight,
              maxHeight: Math.max(240, windowHeight - keyboardHeight - insets.top - Spacing.block),
            },
            containerStyle,
          ]}
        >
          {/* Header Row */}
          {(title || headerLeft || headerRight) && (
            <View style={styles.headerRow}>
              {headerLeft ? (
                headerLeft
              ) : (
                <View style={{ width: 36 }} />
              )}
              {title ? (
                <Text
                  style={[
                    styles.headerTitle,
                    { color: colors.textPrimary, fontFamily: FontFamily.bold },
                  ]}
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
      </View>
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
